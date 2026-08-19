import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET — list recent games with player info
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles").select("is_admin").eq("id", user.id).single();
    if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const url = new URL(req.url);
    const status = url.searchParams.get("status");

    let query = admin
      .from("games")
      .select(`
        id, status, time_control, rated, white_id, black_id,
        white_rating, black_rating, winner, created_at, updated_at,
        moves
      `)
      .order("created_at", { ascending: false })
      .limit(50);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data: games, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Get player usernames
    const playerIds = new Set<string>();
    for (const g of games || []) {
      if (g.white_id) playerIds.add(g.white_id);
      if (g.black_id) playerIds.add(g.black_id);
    }

    let playerMap: Record<string, string> = {};
    if (playerIds.size > 0) {
      const { data: players } = await admin
        .from("profiles")
        .select("id, username")
        .in("id", Array.from(playerIds));
      for (const p of players || []) {
        playerMap[p.id] = p.username;
      }
    }

    return NextResponse.json({
      games: games?.map(g => ({
        ...g,
        white_username: playerMap[g.white_id] || "?",
        black_username: playerMap[g.black_id] || "?",
        move_count: Array.isArray(g.moves) ? g.moves.length : (typeof g.moves === "string" ? (g.moves.split(" ").length - 1) / 2 : 0),
      })) || [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 });
  }
}

// PATCH — abort a game (force-end as draw or assign winner)
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles").select("is_admin").eq("id", user.id).single();
    if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { gameId, action } = await req.json();
    if (!gameId || !action) return NextResponse.json({ error: "Missing parameters" }, { status: 400 });

    if (action === "abort") {
      const { error } = await admin
        .from("games")
        .update({ status: "aborted", winner: null, updated_at: new Date().toISOString() })
        .eq("id", gameId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    try {
      await admin.from("admin_logs").insert({
        admin_id: user.id,
        action: `game_${action}`,
        target_type: "game",
        target_id: gameId,
      });
    } catch {}

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
