-- Migration: NFL player rankings (daily-regenerated) + version registry.
--
-- Mirrors the NBA ranking tables (20260906_create_nba_*), but scoped to NFL.
-- Unlike NBA "projection" rankings, NFL rankings are recomputed every day from
-- the live nfl_player_stats box scores (the same table that feeds NFL props),
-- so a single fixed ranking_version (e.g. 'nfl-2026-v1') is UPSERTed in place.
--
-- The score/tier columns and the ranking_type set are deliberately kept
-- compatible with the NBA-shaped RankingListItem API response so the existing
-- rankings UI can render NFL players without a second code path.

BEGIN;

-- ─── Version registry ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.nfl_ranking_versions (
  ranking_version   TEXT PRIMARY KEY,          -- 'nfl-2026-v1'
  season            TEXT NOT NULL,             -- '2026' (NFL season year)
  algorithm_version TEXT NOT NULL DEFAULT 'nfl-ranking-v1',
  status            TEXT NOT NULL DEFAULT 'draft',  -- 'draft' | 'published' | 'archived'
  player_count      INTEGER,
  generated_at      TIMESTAMPTZ,
  published_at      TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Player rankings ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.nfl_player_rankings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

  -- Player identity
  player_name   TEXT NOT NULL,
  athlete_id    TEXT,                 -- ESPN athlete id (for headshots), when known
  position      TEXT,                 -- QB / RB / WR / TE / ... (raw ESPN position)

  -- Season + ranking context
  season          TEXT NOT NULL,      -- '2026'
  ranking_type    TEXT NOT NULL,      -- 'overall' | 'offense' | 'scoring' | 'playmaking'
  ranking_version TEXT NOT NULL,      -- 'nfl-2026-v1'

  -- Rank data
  rank          INTEGER NOT NULL,
  score         NUMERIC(5,2) NOT NULL,   -- normalized 0-100
  tier          TEXT NOT NULL,           -- reuses NBA tier labels (Ω/X/S/A/B/C/D/E)
  previous_rank INTEGER,                 -- rank in the prior generated version
  rank_change   INTEGER,                 -- positive = moved up

  team          TEXT,

  is_published  BOOLEAN NOT NULL DEFAULT true,   -- NFL rankings publish immediately
  published_at  TIMESTAMPTZ,

  -- Quality signals
  confidence      NUMERIC(4,3),
  is_new          BOOLEAN NOT NULL DEFAULT false,
  low_confidence  BOOLEAN NOT NULL DEFAULT false,
  games_played    INTEGER,

  -- Component scores (0-100). Named to line up with the shared RankingListItem
  -- fields the UI already renders: offense/defense/scoring/playmaking/two_way.
  offense_score     NUMERIC(5,2),
  defense_score     NUMERIC(5,2),
  scoring_score     NUMERIC(5,2),   -- yardage/production
  playmaking_score  NUMERIC(5,2),   -- TDs / big plays
  efficiency_score  NUMERIC(5,2),   -- per-attempt efficiency (rating/YPC/catch rate)
  two_way_score     NUMERIC(5,2),   -- overall two-way (defense contributors)
  availability_score NUMERIC(5,2),  -- games played vs slate

  explanation   TEXT,
  strengths     TEXT[],
  weaknesses    TEXT[],
  signature     TEXT,               -- short descriptor, e.g. 'VOLUME PASSER'
  status        TEXT,               -- 'ASCENDING' | 'STABLE' | 'NEW'

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per player per season/type/version
CREATE UNIQUE INDEX IF NOT EXISTS idx_nfl_player_rankings_unique
  ON public.nfl_player_rankings (player_name, season, ranking_type, ranking_version);

-- Unique rank within each season/type/version
CREATE UNIQUE INDEX IF NOT EXISTS idx_nfl_player_rankings_rank_unique
  ON public.nfl_player_rankings (season, ranking_type, ranking_version, rank);

CREATE INDEX IF NOT EXISTS idx_nfl_player_rankings_read
  ON public.nfl_player_rankings (season, ranking_type, rank)
  WHERE is_published = true;

CREATE INDEX IF NOT EXISTS idx_nfl_player_rankings_version
  ON public.nfl_player_rankings (ranking_version);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.nfl_player_rankings_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nfl_player_rankings_ts ON public.nfl_player_rankings;
CREATE TRIGGER trg_nfl_player_rankings_ts
  BEFORE UPDATE ON public.nfl_player_rankings
  FOR EACH ROW EXECUTE FUNCTION public.nfl_player_rankings_update_timestamp();

DROP TRIGGER IF EXISTS trg_nfl_ranking_versions_ts ON public.nfl_ranking_versions;
CREATE TRIGGER trg_nfl_ranking_versions_ts
  BEFORE UPDATE ON public.nfl_ranking_versions
  FOR EACH ROW EXECUTE FUNCTION public.nfl_player_rankings_update_timestamp();

-- Constraints
ALTER TABLE public.nfl_player_rankings
  DROP CONSTRAINT IF EXISTS chk_nfl_ranking_type;
ALTER TABLE public.nfl_player_rankings
  ADD CONSTRAINT chk_nfl_ranking_type
  CHECK (ranking_type IN ('overall', 'offense', 'defense', 'scoring', 'playmaking'));

ALTER TABLE public.nfl_player_rankings
  DROP CONSTRAINT IF EXISTS chk_nfl_ranking_score;
ALTER TABLE public.nfl_player_rankings
  ADD CONSTRAINT chk_nfl_ranking_score
  CHECK (score >= 0 AND score <= 100);

-- RLS: public read, writes only via service role (which bypasses RLS)
ALTER TABLE public.nfl_player_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfl_ranking_versions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'nfl_player_rankings'
      AND policyname = 'NFL player rankings are viewable by everyone.'
  ) THEN
    CREATE POLICY "NFL player rankings are viewable by everyone."
      ON public.nfl_player_rankings FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'nfl_ranking_versions'
      AND policyname = 'NFL ranking versions are viewable by everyone.'
  ) THEN
    CREATE POLICY "NFL ranking versions are viewable by everyone."
      ON public.nfl_ranking_versions FOR SELECT USING (true);
  END IF;
END $$;

COMMIT;
