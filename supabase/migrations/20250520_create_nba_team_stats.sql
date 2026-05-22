-- Migration: Create nba_team_stats table
-- Stores ALL team stats from Basketball Reference league page
-- Both "Team" (what they score) and "Opponent" (what they allow) for each table type
-- Stats stored as JSONB for flexibility across different table structures

CREATE TABLE IF NOT EXISTS public.nba_team_stats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  team TEXT NOT NULL,                -- 3-letter abbreviation (e.g., "LAL")
  stat_type TEXT NOT NULL,           -- per_game, totals, per_100_poss, advanced, shooting
  side TEXT NOT NULL,                -- "team" (what they score) or "opponent" (what they allow)
  season TEXT NOT NULL,              -- e.g., "2025-26"
  stats JSONB NOT NULL DEFAULT '{}', -- all stat columns for this table/team
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint for upsert (one row per team/type/side/season)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_nba_team_stats_composite'
  ) THEN
    ALTER TABLE public.nba_team_stats
      ADD CONSTRAINT uq_nba_team_stats_composite
      UNIQUE (team, stat_type, side, season);
  END IF;
END $$;

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_nba_team_stats_team
  ON public.nba_team_stats (team);

CREATE INDEX IF NOT EXISTS idx_nba_team_stats_type_side
  ON public.nba_team_stats (stat_type, side);

CREATE INDEX IF NOT EXISTS idx_nba_team_stats_season
  ON public.nba_team_stats (season);

-- GIN index for JSONB stats queries
CREATE INDEX IF NOT EXISTS idx_nba_team_stats_gin
  ON public.nba_team_stats USING gin (stats);

-- Enable RLS
ALTER TABLE public.nba_team_stats ENABLE ROW LEVEL SECURITY;

-- Public SELECT policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'nba_team_stats'
      AND policyname = 'Team stats are viewable by everyone.'
  ) THEN
    CREATE POLICY "Team stats are viewable by everyone."
      ON public.nba_team_stats FOR SELECT USING (true);
  END IF;
END $$;
