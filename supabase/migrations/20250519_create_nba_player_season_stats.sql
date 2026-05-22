-- Migration: Create nba_player_season_stats table
-- Stores all player season stats from Basketball Reference league pages:
--   Totals, Per Game, Per 36 Min, Per 100 Poss, Advanced
--   Both regular season and playoffs

CREATE TABLE IF NOT EXISTS public.nba_player_season_stats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_name TEXT NOT NULL,
  team TEXT,
  position TEXT,
  age TEXT,
  games TEXT,
  games_started TEXT,
  stat_type TEXT NOT NULL,  -- 'totals', 'per_game', 'per_36', 'per_poss', 'advanced'
  is_playoff BOOLEAN NOT NULL DEFAULT false,
  season TEXT NOT NULL,
  stats JSONB NOT NULL DEFAULT '{}',  -- all stat columns stored as JSON
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint for upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_player_season_stats_composite'
  ) THEN
    ALTER TABLE public.nba_player_season_stats
      ADD CONSTRAINT uq_player_season_stats_composite
      UNIQUE (player_name, team, stat_type, is_playoff, season);
  END IF;
END $$;

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_player_season_stats_player
  ON public.nba_player_season_stats (player_name);

CREATE INDEX IF NOT EXISTS idx_player_season_stats_team
  ON public.nba_player_season_stats (team);

CREATE INDEX IF NOT EXISTS idx_player_season_stats_type
  ON public.nba_player_season_stats (stat_type, is_playoff);

CREATE INDEX IF NOT EXISTS idx_player_season_stats_season
  ON public.nba_player_season_stats (season);

-- GIN index for JSONB stats queries
CREATE INDEX IF NOT EXISTS idx_player_season_stats_stats_gin
  ON public.nba_player_season_stats USING gin (stats);

-- Enable RLS
ALTER TABLE public.nba_player_season_stats ENABLE ROW LEVEL SECURITY;

-- Public SELECT policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'nba_player_season_stats'
      AND policyname = 'Player season stats are viewable by everyone.'
  ) THEN
    CREATE POLICY "Player season stats are viewable by everyone."
      ON public.nba_player_season_stats FOR SELECT USING (true);
  END IF;
END $$;
