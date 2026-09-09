-- Migration: Create nba_player_team_history table
-- Season-aware roster tracking. Allows representing:
--   Player A: 2024-25 → BOS, 2025-26 → BOS, 2026-27 → LAL
-- and players who played for multiple teams in one season (via multiple rows).
--
-- IMPORTANT: Historical stat records (nba_player_stats) are NEVER modified
-- to reflect team changes — this table is the single source of truth for
-- which team a player was on during a given season.

CREATE TABLE IF NOT EXISTS public.nba_player_team_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_id UUID REFERENCES public.nba_players(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,           -- denormalized for query convenience
  season TEXT NOT NULL,                -- '2025-26', '2026-27', etc.
  team TEXT NOT NULL,                  -- 3-letter abbreviation (e.g., 'LAL', 'NYK')
  team_full_name TEXT,                 -- e.g., 'Los Angeles Lakers'
  is_current BOOLEAN NOT NULL DEFAULT false,  -- true = active assignment for this season
  is_primary BOOLEAN NOT NULL DEFAULT true,   -- false = mid-season trade (secondary team)
  source TEXT NOT NULL DEFAULT 'scraped',     -- 'scraped', 'manual', 'verified', 'projected'
  effective_from DATE,                 -- when this assignment started
  effective_to DATE,                   -- when this assignment ended (null = still active)
  notes TEXT,                          -- e.g., "signed as FA", "traded from PHX"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one primary team per player per season
-- Mid-season trades create additional rows with is_primary = false
CREATE UNIQUE INDEX IF NOT EXISTS idx_nba_team_history_primary
  ON public.nba_player_team_history (player_id, season, team);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_nba_team_history_player_id
  ON public.nba_player_team_history (player_id);

CREATE INDEX IF NOT EXISTS idx_nba_team_history_player_name
  ON public.nba_player_team_history (player_name);

CREATE INDEX IF NOT EXISTS idx_nba_team_history_season_team
  ON public.nba_player_team_history (season, team);

CREATE INDEX IF NOT EXISTS idx_nba_team_history_is_current
  ON public.nba_player_team_history (season, is_current)
  WHERE is_current = true;

-- Auto-update trigger
CREATE OR REPLACE FUNCTION public.nba_team_history_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_nba_team_history_ts
  BEFORE UPDATE ON public.nba_player_team_history
  FOR EACH ROW EXECUTE FUNCTION public.nba_team_history_update_timestamp();

-- Enable RLS
ALTER TABLE public.nba_player_team_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'nba_player_team_history'
      AND policyname = 'NBA team history is viewable by everyone.'
  ) THEN
    CREATE POLICY "NBA team history is viewable by everyone."
      ON public.nba_player_team_history FOR SELECT USING (true);
  END IF;
END $$;
