-- NBA player-prop main lines from Novig and the other two-way books ParlayAPI
-- carries (Pinnacle, ProphetX, DraftKings, FanDuel, ... see lib/novig/markets.ts
-- BOOKMAKERS), one main line per book. Captured ONCE per game from ParlayAPI by
-- /api/cron/ingest-novig-lines (lib/novig/ingest.ts, service role). The NBA
-- props engine uses the stored line as the prop line and falls back to the L10
-- average when a (player, stat) has no Novig line.
--   novig_prop_events: capture marker per game (a row = never refetched)
--   novig_prop_lines:  one main line per (game, book, player, market), insert-only
--   novig_ingest_runs: per-run log (paid calls, credits), service role only
-- Additive; undo with: DROP TABLE public.novig_prop_lines, public.novig_prop_events, public.novig_ingest_runs;
BEGIN;

CREATE TABLE IF NOT EXISTS public.novig_prop_events (
  canonical_event_id TEXT PRIMARY KEY,
  game_date      DATE NOT NULL,            -- ET slate date of tip
  commence_time  TIMESTAMPTZ NOT NULL,
  home_team      TEXT NOT NULL,            -- 3-letter abbr
  away_team      TEXT NOT NULL,
  line_count     INTEGER NOT NULL DEFAULT 0 CHECK (line_count >= 0),
  source         TEXT NOT NULL DEFAULT 'novig' CHECK (source = 'novig'),
  captured_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_novig_prop_events_date ON public.novig_prop_events (game_date);

CREATE TABLE IF NOT EXISTS public.novig_prop_lines (
  canonical_event_id  TEXT NOT NULL,
  bookmaker           TEXT NOT NULL DEFAULT 'novig' CHECK (bookmaker ~ '^[a-z0-9_]+$'), -- ParlayAPI book key
  player_key          TEXT NOT NULL,       -- normalizePersonName(novig_player)
  market_key          TEXT NOT NULL,       -- Novig market_key, e.g. player_points
  stat                TEXT NOT NULL CHECK (stat IN ('pts','trb','ast','tp','stl','blk','tov')),
  game_date           DATE NOT NULL,
  commence_time       TIMESTAMPTZ NOT NULL,
  home_team           TEXT NOT NULL,
  away_team           TEXT NOT NULL,
  novig_player        TEXT NOT NULL,
  betroom_player_id   UUID,                -- nba_players.id; no FK (disposable read model, like computed_props)
  betroom_player_name TEXT,
  match_method        TEXT NOT NULL CHECK (match_method IN ('exact','alias','fuzzy','unmatched')),
  line                NUMERIC(5,1) NOT NULL CHECK (line > 0),
  over_price          INTEGER NOT NULL,
  under_price         INTEGER NOT NULL,
  vig                 NUMERIC(6,4),
  novig_last_update   TIMESTAMPTZ,
  source              TEXT NOT NULL DEFAULT 'novig' CHECK (source = 'novig'),
  captured_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (canonical_event_id, bookmaker, player_key, market_key)
);
-- Read path: WHERE game_date = $1 ORDER BY PK (paged)
CREATE INDEX IF NOT EXISTS idx_novig_prop_lines_date ON public.novig_prop_lines (game_date);

CREATE TABLE IF NOT EXISTS public.novig_ingest_runs (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  slate_date        DATE NOT NULL,
  status            TEXT NOT NULL,   -- ok|nothing_missing|no_slate|no_events|credit_floor|daily_cap|auth_error|credits_exhausted|api_error|locked
  needed_events     INTEGER NOT NULL DEFAULT 0,
  missing_events    INTEGER NOT NULL DEFAULT 0,
  captured_events   INTEGER NOT NULL DEFAULT 0,
  rows_inserted     INTEGER NOT NULL DEFAULT 0,
  paid_calls        INTEGER NOT NULL DEFAULT 0,
  credits_used      INTEGER NOT NULL DEFAULT 0,
  credits_remaining INTEGER,
  truncated         BOOLEAN NOT NULL DEFAULT false,
  detail            JSONB
);
CREATE INDEX IF NOT EXISTS idx_novig_ingest_runs_slate ON public.novig_ingest_runs (slate_date);
CREATE INDEX IF NOT EXISTS idx_novig_ingest_runs_run_at ON public.novig_ingest_runs (run_at DESC);

-- RLS: lines/events = public read, service-role writes (mirrors computed_props / soccer_match_stats).
ALTER TABLE public.novig_prop_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.novig_prop_lines  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.novig_ingest_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "novig_prop_events_select_public" ON public.novig_prop_events;
CREATE POLICY "novig_prop_events_select_public" ON public.novig_prop_events FOR SELECT USING (true);
DROP POLICY IF EXISTS "novig_prop_lines_select_public" ON public.novig_prop_lines;
CREATE POLICY "novig_prop_lines_select_public" ON public.novig_prop_lines FOR SELECT USING (true);
-- Explicit read grant so the public read doesn't depend on project default
-- privileges; explicit write revoke so writes fail on privilege as well as RLS.
GRANT SELECT ON public.novig_prop_events, public.novig_prop_lines TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.novig_prop_events, public.novig_prop_lines FROM anon, authenticated;
-- Ingest run log is operational (credit counts): service role only, no policies.
REVOKE ALL ON public.novig_ingest_runs FROM anon, authenticated;

COMMIT;
-- Verification (manual): node scripts/db/check-schema.mjs  -- novig_* tables ok
