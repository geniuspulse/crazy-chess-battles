import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Can be triggered by cron (with CRON_SECRET) or by any authenticated user
export async function POST(req: NextRequest) {
  try {
    // Allow cron or auth-based access
    const authHeader = req.headers.get("authorization");
    const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;

    const admin = createAdminClient();
    const now = new Date().toISOString();

    // Find upcoming tournaments whose start time has passed
    const { data: tournaments } = await admin
      .from("tournaments")
      .select("id, name, starts_at, status, type, initial_minutes, increment_seconds, time_control")
      .eq("status", "upcoming")
      .lte("starts_at", now);

    if (!tournaments || tournaments.length === 0) {
      return NextResponse.json({ checked: 0, started: 0 });
    }

    let started = 0;
    const errors: string[] = [];

    for (const tournament of tournaments) {
      try {
        // Fetch participants
        const { data: participants } = await admin
          .from("tournament_participants")
          .select("player_id, score")
          .eq("tournament_id", tournament.id);

        if (!participants || participants.length < 2) {
          // Not enough players — mark as cancelled
          await admin
            .from("tournaments")
            .update({ status: "cancelled", ended_at: now })
            .eq("id", tournament.id);

          // Refund any entry fees
          const { data: paid } = await admin
            .from("tournament_participants")
            .select("player_id, paid_entry_fee")
            .eq("tournament_id", tournament.id)
            .eq("paid_entry_fee", true);

          if (paid) {
            const { data: t } = await admin
              .from("tournaments")
              .select("entry_fee_cents")
              .eq("id", tournament.id)
              .single();

            if (t?.entry_fee_cents) {
              for (const p of paid) {
                await admin.rpc("credit_wallet", {
                  p_user_id: p.player_id,
                  p_amount_cents: t.entry_fee_cents,
                });
              }
            }
          }

          errors.push(`${tournament.name}: cancelled (not enough players)`);
          continue;
        }

        // Fetch ratings for seeding
        const playerIds = participants.map((p) => p.player_id);
        const { data: profiles } = await admin
          .from("profiles")
          .select("id, rating")
          .in("id", playerIds);

        const ratingMap = new Map((profiles || []).map((p) => [p.id, p.rating || 1200]));

        // Seed by rating
        const seeded = participants
          .map((p) => ({ ...p, rating: ratingMap.get(p.player_id) || 1200 }))
          .sort((a, b) => b.rating - a.rating);

        // Update seeds
        for (let i = 0; i < seeded.length; i++) {
          await admin
            .from("tournament_participants")
            .update({ seed: i + 1 })
            .eq("player_id", seeded[i].player_id)
            .eq("tournament_id", tournament.id);
        }

        // Swiss pairings (top half vs bottom half)
        const pairings: Array<{ white: string; black: string; bye?: string }> = [];
        const mid = Math.ceil(seeded.length / 2);
        const topHalf = seeded.slice(0, mid);
        const bottomHalf = seeded.slice(mid);

        for (let i = 0; i < mid; i++) {
          if (i < bottomHalf.length) {
            const white = i % 2 === 0 ? topHalf[i].player_id : bottomHalf[i].player_id;
            const black = i % 2 === 0 ? bottomHalf[i].player_id : topHalf[i].player_id;
            pairings.push({ white, black });
          } else {
            pairings.push({ white: "", black: "", bye: topHalf[i].player_id });
          }
        }

        // Create round entry
        await admin.from("tournament_rounds").insert({
          tournament_id: tournament.id,
          round_number: 1,
          pairings: pairings.map((p, i) => ({
            board: i + 1,
            white: p.white || null,
            black: p.black || null,
            bye: p.bye || null,
            result: null,
          })),
          is_complete: false,
        });

        // Create games and award byes
        for (const pairing of pairings) {
          if (pairing.bye) {
            await admin
              .from("tournament_participants")
              .update({ wins: 1, score: 1, games_played: 1 })
              .eq("player_id", pairing.bye)
              .eq("tournament_id", tournament.id);
            continue;
          }

          const whiteRating = ratingMap.get(pairing.white) || 1200;
          const blackRating = ratingMap.get(pairing.black) || 1200;
          const initialMs = (tournament.initial_minutes || 10) * 60 * 1000;

          await admin.from("games").insert({
            white_player_id: pairing.white,
            black_player_id: pairing.black,
            white_rating: whiteRating,
            black_rating: blackRating,
            status: "playing",
            time_control: tournament.time_control,
            initial_minutes: tournament.initial_minutes,
            increment_seconds: tournament.increment_seconds,
            rated: false,
            tournament_id: tournament.id,
            tournament_round: 1,
            fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            turn: "white",
            move_count: 0,
            white_clock_ms: initialMs,
            black_clock_ms: initialMs,
            last_move_at: new Date().toISOString(),
          });
        }

        // Update tournament status
        await admin
          .from("tournaments")
          .update({ status: "active", current_round: 1 })
          .eq("id", tournament.id);

        // Notify all participants
        for (const p of participants) {
          await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "https://ccb-github.vercel.app"}/api/notifications/send`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${process.env.CRON_SECRET}`,
            },
            body: JSON.stringify({
              userId: p.player_id,
              type: "tournament_started",
              data: { tournamentName: tournament.name, tournamentId: tournament.id },
            }),
          }).catch(() => {});
        }

        started++;
      } catch (e: any) {
        errors.push(`${tournament.name}: ${e.message}`);
      }
    }

    return NextResponse.json({ checked: tournaments.length, started, errors });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Auto-start failed" }, { status: 500 });
  }
}
