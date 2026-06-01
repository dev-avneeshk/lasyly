-- Migration: Add is_monitored column to bet_tracker
-- Monitored picks are "log only" — they track outcomes but don't count in dashboard stats (ROI, win rate, etc.)

ALTER TABLE public.bet_tracker
  ADD COLUMN IF NOT EXISTS is_monitored BOOLEAN NOT NULL DEFAULT false;

-- Index for filtering monitored vs real bets (includes status for stats queries)
CREATE INDEX IF NOT EXISTS idx_bets_monitored ON public.bet_tracker (user_id, is_monitored, status);

-- Composite index for sport/stat filtering with created_at ordering (covers GET /api/bets filters)
CREATE INDEX IF NOT EXISTS idx_bets_sport_stat ON public.bet_tracker (user_id, sport, stat_category, created_at DESC);

-- Make odds and stake nullable for monitored picks (they don't need real values)
ALTER TABLE public.bet_tracker
  ALTER COLUMN odds DROP NOT NULL,
  ALTER COLUMN stake DROP NOT NULL;

-- Update check constraints to allow null for monitored picks
ALTER TABLE public.bet_tracker DROP CONSTRAINT IF EXISTS bet_tracker_odds_check;
ALTER TABLE public.bet_tracker ADD CONSTRAINT bet_tracker_odds_check
  CHECK (is_monitored = true OR (odds IS NOT NULL AND odds BETWEEN -10000 AND 10000));

ALTER TABLE public.bet_tracker DROP CONSTRAINT IF EXISTS bet_tracker_stake_check;
ALTER TABLE public.bet_tracker ADD CONSTRAINT bet_tracker_stake_check
  CHECK (is_monitored = true OR (stake IS NOT NULL AND stake BETWEEN 0.01 AND 99999.99));
