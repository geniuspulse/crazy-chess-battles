import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const LEVEL_RATINGS: Record<string, number> = {
  beginner: 400,
  intermediate: 1500,
  expert: 2500,
};

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const chessLevel = user.user_metadata?.chess_level as string | undefined;

    if (!chessLevel || !LEVEL_RATINGS[chessLevel]) {
      return NextResponse.json({ error: "No chess level set" }, { status: 400 });
    }

    // Get the user's profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("rating, games_played")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Only set initial rating if the user hasn't played any games yet
    // (games_played === 0 means rating is still at default 1500 from trigger)
    if (profile.games_played > 0) {
      return NextResponse.json({ 
        message: "Already initialized — rating locked",
        rating: profile.rating 
      });
    }

    const targetRating = LEVEL_RATINGS[chessLevel];

    // Only update if the current rating differs from the target
    if (profile.rating === targetRating) {
      return NextResponse.json({ 
        message: "Rating already correct", 
        rating: profile.rating 
      });
    }

    // Update the rating using admin client (bypasses RLS)
    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({ rating: targetRating })
      .eq("id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      rating: targetRating,
      level: chessLevel 
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
