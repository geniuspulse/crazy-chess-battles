import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// This route is called after signup to set the initial ELO rating
// based on the user's selected chess level (stored in auth metadata).
// This is needed because the DB trigger can't be updated without DDL access.

const LEVEL_RATINGS: Record<string, number> = {
  beginner: 400,
  intermediate: 1500,
  expert: 2500,
};

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get the user's auth metadata to find chess_level
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !userData?.user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const chessLevel = userData.user.user_metadata?.chess_level || "beginner";
    const targetRating = LEVEL_RATINGS[chessLevel] || 400;

    // Update the profile's rating
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ rating: targetRating })
      .eq("id", userId);

    if (updateError) {
      console.error("Failed to update rating:", updateError);
      return NextResponse.json({ error: "Failed to set rating" }, { status: 500 });
    }

    return NextResponse.json({ success: true, rating: targetRating, chessLevel });
  } catch (err) {
    console.error("Set rating error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
