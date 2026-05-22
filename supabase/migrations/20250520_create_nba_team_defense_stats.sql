-- Migration: Create nba_team_defense_stats table and add position column to nba_player_stats
-- Stores team defensive statistics by position for probability model computation

CREATE TABLE IF NOT EXISTS public.nba_team_defense_stats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  team TEXT NOT NULL,
  position TEXT NOT NULL CHECK (position IN ('PG', 'SG', 'SF', 'PF', 'C', 'TEAM')),
  stat_category TEXT NOT NULL,
  value_per_game NUMERIC,
  value_per_36 NUMERIC,
  value_per_100_poss NUMERIC,
  pace NUMERIC,
  games_played INTEGER,
  season TEXT NOT NULL,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint for upsert on composite key
ALTER TABLE public.nba_team_defense_stats
  ADD CONSTRAINT uq_team_pos_stat_season
  UNIQUE (team, position, stat_category, season);

-- Index for efficient lookups during prop computation
CREATE INDEX IF NOT EXISTS idx_defense_team_pos_stat
  ON public.nba_team_defense_stats (team, position, stat_category);

-- Enable RLS with public SELECT policy
ALTER TABLE public.nba_team_defense_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Defense stats are viewable by everyone."
  ON public.nba_team_defense_stats FOR SELECT USING (true);

-- Add position column to nba_player_stats if not exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nba_player_stats' AND column_name = 'position'
  ) THEN
    ALTER TABLE public.nba_player_stats ADD COLUMN position TEXT;
  END IF;
END $$;
