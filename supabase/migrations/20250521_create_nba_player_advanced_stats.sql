-- Migration: Create nba_player_advanced_stats table
-- Stores advanced shooting distribution, rebounding, and playmaking metrics
-- scraped from Basketball Reference Shooting and Advanced tables

CREATE TABLE IF NOT EXISTS public.nba_player_advanced_stats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_name TEXT NOT NULL,
  season TEXT NOT NULL,
  games_played INTEGER,
  -- Shooting distribution (% of FGA by distance, 0-100)
  fga_pct_0_3ft NUMERIC,
  fga_pct_3_10ft NUMERIC,
  fga_pct_10_16ft NUMERIC,
  fga_pct_16_3pt NUMERIC,
  fga_pct_3pt NUMERIC,
  -- Assisted percentages (0-100)
  pct_2p_assisted NUMERIC,
  pct_3p_assisted NUMERIC,
  -- Rebounding percentages (0-100)
  trb_pct NUMERIC,
  orb_pct NUMERIC,
  drb_pct NUMERIC,
  -- Playmaking
  ast_pct NUMERIC,
  pga NUMERIC,
  -- Metadata
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint for upsert on (player_name, season) — idempotent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_player_advanced_stats_player_season'
  ) THEN
    ALTER TABLE public.nba_player_advanced_stats
      ADD CONSTRAINT uq_player_advanced_stats_player_season
      UNIQUE (player_name, season);
  END IF;
END $$;

-- Index for efficient lookups by player name
CREATE INDEX IF NOT EXISTS idx_advanced_stats_player_name
  ON public.nba_player_advanced_stats (player_name);

-- Enable RLS
ALTER TABLE public.nba_player_advanced_stats ENABLE ROW LEVEL SECURITY;

-- Public SELECT policy — idempotent with existence check
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'nba_player_advanced_stats'
      AND policyname = 'Advanced stats are viewable by everyone.'
  ) THEN
    CREATE POLICY "Advanced stats are viewable by everyone."
      ON public.nba_player_advanced_stats FOR SELECT USING (true);
  END IF;
END $$;
