import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json(
        { error: "Forbidden: Admin privileges required" },
        { status: 403 }
      );
    }

    const resolvedParams = await params;
    const tournamentId = resolvedParams.id;

    const { error } = await supabase
      .from("tournaments")
      .update({ status: "finished", ended_at: new Date().toISOString() })
      .eq("id", tournamentId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Rank participants by score
    const { data: participants } = await supabase
      .from("tournament_participants")
      .select("id, score")
      .eq("tournament_id", tournamentId)
      .order("score", { ascending: false });

    if (participants && participants.length > 0) {
      for (let i = 0; i < participants.length; i++) {
        await supabase
          .from("tournament_participants")
          .update({ final_rank: i + 1 })
          .eq("id", participants[i].id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Failed to finish tournament" },
      { status: 500 }
    );
  }
}
