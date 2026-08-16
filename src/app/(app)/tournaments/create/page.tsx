import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CreateTournamentForm from "./create-tournament-form";

export default async function CreateTournamentPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    redirect("/tournaments");
  }

  return <CreateTournamentForm />;
}
