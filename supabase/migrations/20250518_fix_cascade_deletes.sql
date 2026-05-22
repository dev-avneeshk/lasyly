-- Fix foreign key constraints that block user deletion.
-- These tables reference profiles(id) without ON DELETE CASCADE,
-- which prevents deleting users from the Supabase dashboard.

-- 1. rooms.creator_id → SET NULL on delete (room stays, creator becomes null)
ALTER TABLE public.rooms
  DROP CONSTRAINT IF EXISTS rooms_creator_id_fkey;
ALTER TABLE public.rooms
  ALTER COLUMN creator_id DROP NOT NULL;
ALTER TABLE public.rooms
  ADD CONSTRAINT rooms_creator_id_fkey
  FOREIGN KEY (creator_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. transactions.user_id → CASCADE (delete user's transactions)
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 3. unlocked_picks.user_id → CASCADE (delete user's unlocked picks)
ALTER TABLE public.unlocked_picks
  DROP CONSTRAINT IF EXISTS unlocked_picks_user_id_fkey;
ALTER TABLE public.unlocked_picks
  ADD CONSTRAINT unlocked_picks_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
