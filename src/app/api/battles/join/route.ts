import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CONFIG } from "@/lib/battles/battle-helpers";
import { tryMatch } from "@/lib/battles/matchmaker";

const TIME_CONTROLS: Record<string, { minutes: number; increment: number }> = {
  bullet:    { minutes: 1,  increment: 0 },
  blitz3:    { minutes: 3,  increment: 2 },
  blitz:     { minutes: 5,  increment: 0 },
  rapid:     { minutes: 10, increment: 0 },
  rapid15:   { minutes: 15, increment: 10 },
  classical: { minutes: 30, increment: 0 },
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { stakeCents, timeControl } = await req.json();
    if (!stakeCents || stakeCents <= 0) {
      return NextResponse.json({ error: "Invalid stake amount" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: configRow } = await admin.from("battle_config").select("*").limit(1).single();
    const config = { ...DEFAULT_CONFIG, ...configRow };

    if (!config.enabled) {
      return NextResponse.json({ error: "Chess Battles are currently disabled" }, { status: 403 });
    }

    const allowedStakes = config.stake_levels as number[];
    if (!allowedStakes.includes(stakeCents)) {
      return NextResponse.json({ error: "Invalid stake level" }, { status: 400 });
    }

    const { data: existing } = await admin
      .from("battle_queue")
      .select("id, stake_cents")
      .eq("player_id", user.id)
      .eq("status", "waiting");

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "Already in a battle queue. Leave the current queue first." },
        { status: 400 }
      );
    }

    const { data: activeBattle } = await admin
      .from("battles")
      .select("id")
      .or(`white_player_id.eq.${user.id},black_player_id.eq.${user.id}`)
      .in("status", ["pending", "playing", "draw_armageddon"])
      .limit(1);

    if (activeBattle && activeBattle.length > 0) {
      return NextResponse.json(
        { error: "You have an active battle. Finish it first." },
        { status: 400 }
      );
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("rating, wallet_balance_cents")
      .eq("id", user.id)
      .single();

    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    const balance = profile.wallet_balance_cents ?? 0;
    if (balance < stakeCents) {
      return NextResponse.json(
        { error: `Insufficient balance. You need at least MK ${(stakeCents / 100).toLocaleString()}.` },
        { status: 402 }
      );
    }

    const { error: debitErr } = await admin.rpc("debit_wallet", {
      p_user_id: user.id,
      p_amount_cents: stakeCents,
    });

    if (debitErr) {
      console.error("Escrow debit failed:", debitErr);
      return NextResponse.json({ error: "Failed to lock stake. Try again." }, { status: 500 });
    }

    const { error: _depErr } = await admin.from("deposits").insert({
      user_id: user.id,
      amount_cents: stakeCents,
      status: "success",
      method: "battle_escrow",
      reference: `battle_queue:${user.id}:${stakeCents}`,
    });
    if (_depErr) console.error("Deposit audit log failed:", _depErr);

    // Insert queue entry — try with time_control, fall back without if column doesn't exist
    const insertData: any = {
      player_id: user.id,
      stake_cents: stakeCents,
      rating: profile.rating ?? 1200,
      status: "waiting",
    };
    if (timeControl) {
      insertData.time_control = timeControl;
    }

    const { data: queueEntry, error: queueErr } = await admin
      .from("battle_queue")
      .insert(insertData)
      .select()
      .single();

    // If insert failed and time_control was included, try without it (column may not exist yet)
    if (queueErr && timeControl) {
      delete insertData.time_control;
      const { data: retryEntry, error: retryErr } = await admin
        .from("battle_queue")
        .insert(insertData)
        .select()
        .single();

      if (retryErr) {
        await admin.rpc("credit_wallet", { p_user_id: user.id, p_amount_cents: stakeCents });
        return NextResponse.json({ error: "Failed to join queue" }, { status: 500 });
      }

      const matchResult = await tryMatch(admin, user.id, stakeCents, profile.rating ?? 1200, config, timeControl);
      return NextResponse.json({
        queueId: retryEntry.id,
        stakeCents,
        timeControl,
        matched: matchResult?.matched ?? false,
        battleId: matchResult?.battleId ?? null,
      });
    }

    if (queueErr) {
      await admin.rpc("credit_wallet", { p_user_id: user.id, p_amount_cents: stakeCents });
      return NextResponse.json({ error: "Failed to join queue" }, { status: 500 });
    }

    const matchResult = await tryMatch(admin, user.id, stakeCents, profile.rating ?? 1200, config, timeControl);

    return NextResponse.json({
      queueId: queueEntry.id,
      stakeCents,
      timeControl,
      matched: matchResult?.matched ?? false,
      battleId: matchResult?.battleId ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to join battle" }, { status: 500 });
  }
}
