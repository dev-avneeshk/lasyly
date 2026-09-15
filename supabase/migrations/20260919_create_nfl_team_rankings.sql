-- Migration: NFL team power rankings (daily-regenerated).
--
-- Derived from nfl_player_rankings (roster strength) + team scoring/defense
-- production. Recomputed each day by the same NFL ranking pipeline, upserted in
-- place under the fixed version (nfl-<season>-v1), and stored in the
-- NBA-shaped TeamRankingListItem columns so the existing TeamRankCard renders
-- NFL teams without a second code path.

BEGIN;

CREATE TABLE IF NOT EXISTS public.nfl_team_rankings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

  team             TEXT NOT NULL,           -- abbr, e.g. 'KC'
  team_full_name   TEXT,
  season           TEXT NOT NULL,           -- '2026'
  ranking_version  TEXT NOT NULL,           -- 'nfl-2026-v1'
  ranking_type     TEXT NOT NULL DEFAULT 'power',

  rank             INTEGER NOT NULL,
  power_score      NUMERIC(5,2) NOT NULL,   -- 0-100
  tier             TEXT,                    -- reuses NBA tier labels
  previous_rank    INTEGER,
  rank_change      INTEGER,

  offensive_score  NUMERIC(5,2),
  defensive_score  NUMERIC(5,2),
  depth_score      NUMERIC(5,2),
  star_power_score NUMERIC(5,2),
  net_score        NUMERIC(5,2),

  projected_wins   NUMERIC(4,1),
  wins             INTEGER,
  losses           INTEGER,

  is_published     BOOLEAN NOT NULL DEFAULT true,
  published_at     TIMESTAMPTZ,

  explanation      TEXT,
  why_ranked_here  TEXT,
  team_class       TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nfl_team_rankings_unique
  ON public.nfl_team_rankings (team, season, ranking_type, ranking_version);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nfl_team_rankings_rank_unique
  ON public.nfl_team_rankings (season, ranking_type, ranking_version, rank);

CREATE INDEX IF NOT EXISTS idx_nfl_team_rankings_read
  ON public.nfl_team_rankings (season, ranking_type, rank)
  WHERE is_published = true;

DROP TRIGGER IF EXISTS trg_nfl_team_rankings_ts ON public.nfl_team_rankings;
CREATE TRIGGER trg_nfl_team_rankings_ts
  BEFORE UPDATE ON public.nfl_team_rankings
  FOR EACH ROW EXECUTE FUNCTION public.nfl_player_rankings_update_timestamp();

ALTER TABLE public.nfl_team_rankings
  DROP CONSTRAINT IF EXISTS chk_nfl_team_ranking_score;
ALTER TABLE public.nfl_team_rankings
  ADD CONSTRAINT chk_nfl_team_ranking_score
  CHECK (power_score >= 0 AND power_score <= 100);

ALTER TABLE public.nfl_team_rankings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'nfl_team_rankings'
      AND policyname = 'NFL team rankings are viewable by everyone.'
  ) THEN
    CREATE POLICY "NFL team rankings are viewable by everyone."
      ON public.nfl_team_rankings FOR SELECT USING (true);
  END IF;
END $$;

COMMIT;
