-- =====================================================================
-- computed_props — precomputed prop slates (materialized read model)
-- =====================================================================
-- The /api/props endpoint computes prop cards (hit rates, matchup grades,
-- projections, confidence, correlations, line movement) on the fly from raw
-- game rows. Even behind the Redis cache-aside layer, a cache MISS fans out to
-- dozens of Supabase queries over tens of thousands of rows — the single most
-- expensive path in the app.
--
-- This table turns that read-time compute into a scheduled write. A cron
-- (/api/cron/precompute-props) runs the SAME engine functions a few times a day
-- for the DEFAULT slates (NBA + NFL, each default stat, both directions), and
-- stores the finished result here. The endpoint then serves a plain indexed
-- SELECT instead of recomputing, and falls back to live compute only when a row
-- is missing (e.g. a cron run was skipped) or the request carries custom
-- filters/search that were never precomputed.
--
-- Design mirrors 20260921_nfl_advanced_analytics.sql: TEXT synthetic key, RLS
-- with a public SELECT policy (writes go through the service role only). The
-- whole computed result — the props array plus todayGames and meta — is stored
-- verbatim as JSONB so the read path reconstructs exactly what the engine
-- produced, in one round trip.
--
-- Provenance note: the JSONB payload holds DERIVED/MODEL values (hit rates,
-- grades, projections). That is intentional and does not violate the RAW-only
-- rule on the stats tables — this is a cache/read model keyed by game_date and
-- computed_at, not a source-of-truth stats table. It is disposable and fully
-- rebuildable from the raw tables at any time.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- computed_props — one row per (sport, stat, direction, game_date).
--   key = "{sport}:{stat}:{direction}:{game_date}"  (lowercased sport/stat)
--   payload = { props: [...], todayGames: [...], fallbackMode, meta }
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.computed_props (
  id           TEXT PRIMARY KEY,            -- "{sport}:{stat}:{direction}:{game_date}"
  sport        TEXT NOT NULL,               -- "NBA" | "NFL"
  stat         TEXT NOT NULL,               -- engine stat key, or "all"
  direction    TEXT NOT NULL,               -- "over" | "under" | "all"
  game_date    DATE NOT NULL,               -- ET slate date the payload covers
  prop_count   INTEGER NOT NULL DEFAULT 0,  -- denormalized for cheap sanity checks
  payload      JSONB NOT NULL,              -- full computed result (props + todayGames + meta)
  computed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Primary read path: look up the exact slate the endpoint wants.
CREATE INDEX IF NOT EXISTS idx_computed_props_lookup
  ON public.computed_props (sport, stat, direction, game_date);

-- Prune path: delete stale slates by date.
CREATE INDEX IF NOT EXISTS idx_computed_props_date
  ON public.computed_props (game_date);

-- ---------------------------------------------------------------------
-- RLS: public SELECT (writes via service role only), matching every other
-- read-model table in this schema.
-- ---------------------------------------------------------------------
ALTER TABLE public.computed_props ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'computed_props'
      AND policyname = 'Public read'
  ) THEN
    CREATE POLICY "Public read" ON public.computed_props
      FOR SELECT USING (true);
  END IF;
END$$;

COMMIT;
