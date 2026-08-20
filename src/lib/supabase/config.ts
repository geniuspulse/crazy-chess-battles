// Correct Supabase project — hardcoded because Vercel env vars point to a stale project
// The anon key is PUBLIC by design — safe to commit
const SUPABASE_URL = "https://jykrncwtrmegmzimqekf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5a3JuY3d0cm1lZ216aW1xZWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5NDU5MDgsImV4cCI6MjEwMDUyMTkwOH0.GqVNE0xi-SBcHqNCDX-hTPSM_wJ89BCbLZutcHWj93k";

export { SUPABASE_URL, SUPABASE_ANON_KEY };
