-- Migration: Add game_id and result columns to parlay_legs
-- Enables automatic settlement of parlay legs based on actual game results

ALTER TABLE public.parlay_legs
  ADD COLUMN IF NOT EXISTS game_id TEXT,
  ADD COLUMN IF NOT EXISTS result TEXT CHECK (result IN ('pending', 'won', 'lost', 'push'));

-- Default existing legs to 'pending'
UPDATE public.parlay_legs SET result = 'pending' WHERE result IS NULL;

-- Make result NOT NULL with default going forward
ALTER TABLE public.parlay_legs
  ALTER COLUMN result SET DEFAULT 'pending',
  ALTER COLUMN result SET NOT NULL;

-- Index for finding unsettled legs efficiently
CREATE INDEX IF NOT EXISTS idx_parlay_legs_result
  ON public.parlay_legs (result) WHERE result = 'pending';

-- Index for matching legs to game stats
CREATE INDEX IF NOT EXISTS idx_parlay_legs_settlement
  ON public.parlay_legs (player_name, stat_category, sport, result);
