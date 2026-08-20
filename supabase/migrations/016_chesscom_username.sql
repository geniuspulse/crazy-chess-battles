-- Crazy Chess Battles — Chess.com Integration
-- Adds chesscom_username column to profiles table

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS chesscom_username TEXT;
