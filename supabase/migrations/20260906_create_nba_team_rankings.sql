-- Migration: Create nba_team_rankings table
-- Team power rankings. Computed from projected player talent + team-level metrics.
-- Understands roster transactions: players moving teams affect BOTH
-- the team they left (lower score) and the team they joined (higher score).

CREATE TABLE IF NOT EXISTS public.nba_team_rankings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

  -- Team identity
  team TEXT NOT NULL,                  -- 3-letter abbreviation
  team_full_name TEXT,                 -- e.g., 'Los Angeles Lakers'

  -- Season + ranking context
  season TEXT NOT NULL,               -- '2026-27'
  ranking_version TEXT NOT NULL,      -- '2026-27-v1'
  ranking_type TEXT NOT NULL DEFAULT 'power',  -- 'power' (future: 'offense', 'defense')

  -- Rank data
  rank INTEGER NOT NULL,
  power_score NUMERIC(5,2) NOT NULL,
  tier TEXT,

  -- Component scores (all 0-100)
  offensive_score NUMERIC(5,2),
  defensive_score NUMERIC(5,2),
  depth_score NUMERIC(5,2),
  star_power_score NUMERIC(5,2),
  net_score NUMERIC(5,2),             -- offense - defense

  -- Movement
  previous_rank INTEGER,
  rank_change INTEGER,

  -- Projection fields
  projected_wins INTEGER,             -- estimated win total
  projected_win_pct NUMERIC(4,3),     -- 0.000-1.000

  -- Publication
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,

  -- Roster context
  key_additions TEXT[],               -- player names added this offseason
  key_losses TEXT[],                  -- player names lost this offseason
  returning_core_pct NUMERIC(5,2),    -- % of minutes returning from last season

  -- Explanation
  explanation TEXT,
  why_ranked_here TEXT,

  -- Power Profile Details
  team_class TEXT,                    -- e.g., 'THE EMPIRE'

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique: one entry per team per season per version per ranking type
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_rankings_unique
  ON public.nba_team_rankings (team, season, ranking_version, ranking_type);

-- Fast reads
CREATE INDEX IF NOT EXISTS idx_team_rankings_season_rank
  ON public.nba_team_rankings (season, ranking_type, rank)
  WHERE is_published = true;

CREATE INDEX IF NOT EXISTS idx_team_rankings_version
  ON public.nba_team_rankings (ranking_version);

-- Auto-update trigger
CREATE OR REPLACE FUNCTION public.nba_team_rankings_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_nba_team_rankings_ts
  BEFORE UPDATE ON public.nba_team_rankings
  FOR EACH ROW EXECUTE FUNCTION public.nba_team_rankings_update_timestamp();

-- Enable RLS
ALTER TABLE public.nba_team_rankings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'nba_team_rankings'
      AND policyname = 'Team rankings are viewable by everyone.'
  ) THEN
    CREATE POLICY "Team rankings are viewable by everyone."
      ON public.nba_team_rankings FOR SELECT USING (true);
  END IF;
END $$;
