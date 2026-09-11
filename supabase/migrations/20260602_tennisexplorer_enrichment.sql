-- =====================================================================
-- Migration: TennisExplorer enrichment
-- Adds the columns and tables needed to store the richer data scraped
-- from tennisexplorer.com (match-detail pages):
--   1. tennis_matches  : add match_id (TE id), surface, scheduled_time,
--                         match_date, source_url
--   2. tennis_players  : add bio/ranking fields + TE profile slug
--   3. tennis_match_odds : opening + current decimal odds per match
-- All additive and idempotent. Run in the Supabase SQL editor.
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. tennis_matches enrichment
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.tennis_matches
  ADD COLUMN IF NOT EXISTS match_id        TEXT,
  ADD COLUMN IF NOT EXISTS surface         TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_time  TEXT,
  ADD COLUMN IF NOT EXISTS match_date      DATE,
  ADD COLUMN IF NOT EXISTS source          TEXT DEFAULT 'tennisabstract',
  ADD COLUMN IF NOT EXISTS source_url      TEXT;

COMMENT ON COLUMN public.tennis_matches.match_id       IS 'Stable source match id (e.g. tennisexplorer match-detail id)';
COMMENT ON COLUMN public.tennis_matches.surface        IS 'Court surface: Clay, Hard, Grass, Indoors, Carpet';
COMMENT ON COLUMN public.tennis_matches.scheduled_time IS 'Local start time label (HH:MM) from the source';
COMMENT ON COLUMN public.tennis_matches.match_date     IS 'Calendar date of the match';
COMMENT ON COLUMN public.tennis_matches.source         IS 'Origin scraper: tennisabstract | tennisexplorer';

-- A unique index on match_id lets us upsert by the stable source id when present.
CREATE UNIQUE INDEX IF NOT EXISTS tennis_matches_match_id_uidx
  ON public.tennis_matches (match_id)
  WHERE match_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 2. tennis_players enrichment (bio + ranking)
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.tennis_players
  ADD COLUMN IF NOT EXISTS te_slug          TEXT,
  ADD COLUMN IF NOT EXISTS te_profile_url   TEXT,
  ADD COLUMN IF NOT EXISTS rank_singles     INTEGER,
  ADD COLUMN IF NOT EXISTS rank_doubles     INTEGER,
  ADD COLUMN IF NOT EXISTS birthdate        DATE,
  ADD COLUMN IF NOT EXISTS height_cm        INTEGER,
  ADD COLUMN IF NOT EXISTS weight_kg        INTEGER,
  ADD COLUMN IF NOT EXISTS plays            TEXT,
  ADD COLUMN IF NOT EXISTS turned_pro       INTEGER,
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN public.tennis_players.te_slug      IS 'tennisexplorer player slug (e.g. zverev-6f768)';
COMMENT ON COLUMN public.tennis_players.rank_singles IS 'Current ATP/WTA singles ranking';
COMMENT ON COLUMN public.tennis_players.plays         IS 'Handedness: right | left';

-- ─────────────────────────────────────────────────────────────────────
-- 3. tennis_match_odds (one row per match, opening + current decimal odds)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tennis_match_odds (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id        TEXT NOT NULL,
  player1_name    TEXT NOT NULL,
  player2_name    TEXT NOT NULL,
  player1_odds    NUMERIC(7,2),
  player2_odds    NUMERIC(7,2),
  player1_open    NUMERIC(7,2),
  player2_open    NUMERIC(7,2),
  bookmaker       TEXT DEFAULT 'average',
  scraped_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (match_id, bookmaker)
);

COMMENT ON TABLE public.tennis_match_odds IS 'Match-winner decimal odds (current + opening) scraped from tennisexplorer';

CREATE INDEX IF NOT EXISTS tennis_match_odds_match_idx
  ON public.tennis_match_odds (match_id);

-- ─────────────────────────────────────────────────────────────────────
-- 4. RLS: public-read, service-role-write (matches existing tennis tables)
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['tennis_match_odds', 'tennis_players', 'tennis_raw_stats', 'tennis_return_stats'];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_select_public" ON public.%I', t, t);
      EXECUTE format('CREATE POLICY "%s_select_public" ON public.%I FOR SELECT USING (true)', t, t);
    END IF;
  END LOOP;
END $$;
