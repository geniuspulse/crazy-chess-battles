-- Enable realtime on challenges table so the challenger can detect
-- when their opponent accepts the challenge
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenges;
