-- Migration: Create nba_ranking_history and nba_ranking_overrides tables
-- nba_ranking_history: immutable append-only record of every ranking computed.
--   Enables historical comparison across multiple seasons and algorithm versions.
--   Rows are NEVER updated or deleted — only inserted.
-- nba_ranking_overrides: rare manual adjustments to computed rankings.

-- ============================================================
-- nba_ranking_history — immutable historical record
-- ============================================================

CREATE TABLE IF NOT EXISTS public.nba_ranking_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  entity_type TEXT NOT NULL,          -- 'player' or 'team'
  entity_id UUID,                     -- FK to nba_players or nba_team (nullable for safety)
  entity_name TEXT NOT NULL,          -- player_name or team abbreviation
  season TEXT NOT NULL,
  ranking_type TEXT NOT NULL,
  rank INTEGER NOT NULL,
  score NUMERIC(5,2),
  previous_rank INTEGER,
  rank_change INTEGER,
  ranking_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  -- NOTE: No updated_at — this table is append-only by convention
  -- RLS prevents DELETE/UPDATE via policy
);

-- Entity type check
ALTER TABLE public.nba_ranking_history
  ADD CONSTRAINT chk_ranking_history_entity_type
  CHECK (entity_type IN ('player', 'team'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ranking_history_entity
  ON public.nba_ranking_history (entity_id, season, ranking_type);

CREATE INDEX IF NOT EXISTS idx_ranking_history_entity_name
  ON public.nba_ranking_history (entity_name, season, ranking_type);

CREATE INDEX IF NOT EXISTS idx_ranking_history_version
  ON public.nba_ranking_history (ranking_version);

-- Enable RLS
ALTER TABLE public.nba_ranking_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'nba_ranking_history'
      AND policyname = 'Ranking history is viewable by everyone.'
  ) THEN
    CREATE POLICY "Ranking history is viewable by everyone."
      ON public.nba_ranking_history FOR SELECT USING (true);
  END IF;
END $$;


-- ============================================================
-- nba_ranking_overrides — rare manual adjustments
-- ============================================================

CREATE TABLE IF NOT EXISTS public.nba_ranking_overrides (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  entity_type TEXT NOT NULL,          -- 'player' or 'team'
  entity_id UUID,
  entity_name TEXT NOT NULL,
  season TEXT NOT NULL,
  ranking_type TEXT NOT NULL,
  ranking_version TEXT,               -- null = applies to all versions of this season
  override_rank INTEGER,              -- the forced rank (null = no rank override, just note)
  override_score_adjustment NUMERIC(5,2), -- score delta to apply on top of computed score
  reason TEXT NOT NULL,               -- required justification
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT,                    -- admin identifier
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ranking_overrides_entity
  ON public.nba_ranking_overrides (entity_name, season, ranking_type)
  WHERE is_active = true;

CREATE TRIGGER trg_nba_ranking_overrides_ts
  BEFORE UPDATE ON public.nba_ranking_overrides
  FOR EACH ROW EXECUTE PROCEDURE public.nba_players_update_timestamp();

-- Enable RLS — admin-only access (service role reads all, anon reads nothing)
ALTER TABLE public.nba_ranking_overrides ENABLE ROW LEVEL SECURITY;
-- No public SELECT — this table is internal admin only
