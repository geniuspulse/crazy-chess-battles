import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json();
    if (!username) {
      return NextResponse.json({ error: "Username required" }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase();

    const profileRes = await fetch(`https://api.chess.com/pub/player/${cleanUsername}`, {
      headers: { "User-Agent": "CrazyChessBattles/1.0" },
    });

    if (!profileRes.ok) {
      if (profileRes.status === 404) {
        return NextResponse.json({ error: "Chess.com account not found" }, { status: 404 });
      }
      return NextResponse.json({ error: "Chess.com API error" }, { status: 502 });
    }

    const profile = await profileRes.json();

    const statsRes = await fetch(`https://api.chess.com/pub/player/${cleanUsername}/stats`, {
      headers: { "User-Agent": "CrazyChessBattles/1.0" },
    });

    const stats = statsRes.ok ? await statsRes.json() : {};

    const getRating = (category: any) => category?.last?.rating || category?.best?.rating || null;

    const ratings = {
      blitz: getRating(stats?.chess_blitz),
      rapid: getRating(stats?.chess_rapid),
      bullet: getRating(stats?.chess_bullet),
      daily: getRating(stats?.chess_daily),
      puzzle: stats?.puzzle_rush?.best?.score || null,
    };

    const startingRating = ratings.rapid || ratings.blitz || ratings.bullet || ratings.daily || 1200;

    return NextResponse.json({
      found: true,
      username: profile.username,
      avatar: profile.avatar || null,
      country: profile.country || null,
      joined: profile.joined || null,
      isStreamer: profile.is_streamer || false,
      verified: profile.verified || false,
      ratings,
      startingRating,
    });
  } catch (e: any) {
    console.error("Chess.com verify error:", e);
    return NextResponse.json({ error: "Failed to verify Chess.com account" }, { status: 500 });
  }
}
