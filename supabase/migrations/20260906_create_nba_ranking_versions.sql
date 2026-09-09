-- Migration: Create nba_ranking_versions table
-- Versioned snapshots of ranking algorithm configurations.
-- Every ranking run is associated with a version, making it possible to
-- update the algorithm without destroying historical ranking results.
-- Example versions: '2025-26-v1', '2026-27-v1', '2026-27-v2'

CREATE TABLE IF NOT EXISTS public.nba_ranking_versions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ranking_version TEXT UNIQUE NOT NULL,  -- '2026-27-v1'
  season TEXT NOT NULL,                  -- '2026-27'
  algorithm_version TEXT NOT NULL,       -- 'nba-ranking-v1'
  status TEXT NOT NULL DEFAULT 'draft',  -- 'draft', 'published', 'archived'
  weights JSONB NOT NULL DEFAULT '{}',   -- full formula weights snapshot at generation time
  generated_at TIMESTAMPTZ,             -- when rankings were computed
  published_at TIMESTAMPTZ,             -- when status set to 'published'
  archived_at TIMESTAMPTZ,              -- when status set to 'archived'
  player_count INTEGER,                  -- total players ranked in this version
  team_count INTEGER,                    -- total teams ranked
  notes TEXT,                            -- internal notes about this version
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Status check constraint
ALTER TABLE public.nba_ranking_versions
  ADD CONSTRAINT chk_ranking_version_status
  CHECK (status IN ('draft', 'published', 'archived'));

CREATE INDEX IF NOT EXISTS idx_ranking_versions_season
  ON public.nba_ranking_versions (season, status);

CREATE INDEX IF NOT EXISTS idx_ranking_versions_status
  ON public.nba_ranking_versions (status);

-- Auto-update trigger
CREATE OR REPLACE FUNCTION public.nba_ranking_versions_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_nba_ranking_versions_ts
  BEFORE UPDATE ON public.nba_ranking_versions
  FOR EACH ROW EXECUTE FUNCTION public.nba_ranking_versions_update_timestamp();

-- Enable RLS
ALTER TABLE public.nba_ranking_versions ENABLE ROW LEVEL SECURITY;

-- Public can see published versions only; drafts are internal
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'nba_ranking_versions'
      AND policyname = 'Published ranking versions are viewable by everyone.'
  ) THEN
    CREATE POLICY "Published ranking versions are viewable by everyone."
      ON public.nba_ranking_versions FOR SELECT USING (status = 'published');
  END IF;
END $$;
