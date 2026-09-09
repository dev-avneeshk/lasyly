-- Migration: Create nba_players identity table
-- Stable player identity layer — anchor for all ranking, stat, and history records.
-- Names in nba_player_stats can have spelling inconsistencies; this table normalizes them.
-- Players are synthesized from nba_player_season_stats on first ranking run,
-- then enriched manually or via scraper updates.

CREATE TABLE IF NOT EXISTS public.nba_players (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_name TEXT NOT NULL,           -- canonical Basketball Reference name
  normalized_name TEXT,                -- lowercase, no punctuation, for fuzzy matching
  display_name TEXT,                   -- UI display name (may differ from canonical)
  birth_date DATE,
  position TEXT,                       -- primary position: PG, SG, SF, PF, C
  height TEXT,                         -- e.g., "6-7"
  weight TEXT,                         -- e.g., "230"
  active BOOLEAN NOT NULL DEFAULT true,
  basketball_reference_id TEXT,        -- e.g., "curryst01" — for scraper linkage
  headshot_url TEXT,                   -- ESPN CDN headshot URL
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint on canonical name (primary identity)
CREATE UNIQUE INDEX IF NOT EXISTS idx_nba_players_player_name
  ON public.nba_players (player_name);

-- Index for normalized name fuzzy matching
CREATE INDEX IF NOT EXISTS idx_nba_players_normalized_name
  ON public.nba_players (normalized_name);

CREATE INDEX IF NOT EXISTS idx_nba_players_active
  ON public.nba_players (active);

CREATE INDEX IF NOT EXISTS idx_nba_players_position
  ON public.nba_players (position);

CREATE INDEX IF NOT EXISTS idx_nba_players_bbref_id
  ON public.nba_players (basketball_reference_id)
  WHERE basketball_reference_id IS NOT NULL;

-- Auto-update updated_at on change
CREATE OR REPLACE FUNCTION public.nba_players_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_nba_players_ts
  BEFORE UPDATE ON public.nba_players
  FOR EACH ROW EXECUTE FUNCTION public.nba_players_update_timestamp();

-- Enable RLS
ALTER TABLE public.nba_players ENABLE ROW LEVEL SECURITY;

-- Public SELECT policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'nba_players'
      AND policyname = 'NBA players are viewable by everyone.'
  ) THEN
    CREATE POLICY "NBA players are viewable by everyone."
      ON public.nba_players FOR SELECT USING (true);
  END IF;
END $$;
