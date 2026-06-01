-- Migration: Add is_logged column to parlays
-- Logged parlays are "log only" — they track outcomes but don't count in dashboard/profile stats (win rate, ROI, etc.)

ALTER TABLE public.parlays
  ADD COLUMN IF NOT EXISTS is_logged BOOLEAN NOT NULL DEFAULT false;

-- Index for filtering logged vs real parlays (includes status for stats queries)
CREATE INDEX IF NOT EXISTS idx_parlays_logged ON public.parlays (user_id, is_logged, status);
