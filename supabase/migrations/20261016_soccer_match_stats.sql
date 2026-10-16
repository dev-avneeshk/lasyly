-- Big-5 European league match stats (eng.1 / esp.1 / ger.1 / ita.1 / fra.1),
-- loaded from the Big-5 detailed-stats CSV by
-- scripts/db/import-big5-match-stats.mjs (service role, idempotent upserts).
-- Read by the soccer team-props engine and the match-stats popup route.
-- Additive; undo with: DROP TABLE public.soccer_match_stats, public.soccer_matches;
BEGIN;

-- One row per match (2,050). Owns match identity, final score and source, and
-- covers the 139 matches that have no stat rows (needed for goals props and the
-- popup header).
CREATE TABLE IF NOT EXISTS public.soccer_matches (
  id                TEXT PRIMARY KEY,            -- "{league}:{season}:{match_no}", e.g. "eng.1:2026-27:45"; set by the importer
  league            TEXT NOT NULL CHECK (league IN ('eng.1','esp.1','ger.1','ita.1','fra.1')),
  league_slug       TEXT NOT NULL,               -- CSV slug, e.g. "premier_league"
  season            TEXT NOT NULL CHECK (season ~ '^[0-9]{4}-[0-9]{2}$'),
  match_no          INTEGER NOT NULL CHECK (match_no BETWEEN 1 AND 9999),
  round             INTEGER CHECK (round BETWEEN 1 AND 99),
  match_date        DATE NOT NULL,
  home_team         TEXT NOT NULL,               -- canonical = espn_teams.name
  away_team         TEXT NOT NULL,
  home_team_source  TEXT NOT NULL,               -- name as it appears in the CSV (audit)
  away_team_source  TEXT NOT NULL,
  home_score        INTEGER NOT NULL CHECK (home_score >= 0),
  away_score        INTEGER NOT NULL CHECK (away_score >= 0),
  source            TEXT NOT NULL,               -- 'FotMob' | 'AiScore' | 'N/A'
  has_stats         BOOLEAN NOT NULL DEFAULT false,
  imported_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT soccer_matches_league_season_match_no_key UNIQUE (league, season, match_no)
);

CREATE INDEX IF NOT EXISTS idx_soccer_matches_league_date
  ON public.soccer_matches (league, match_date DESC);

-- Long format: one row per match x period x (stat_group, stat_name). Match
-- columns are denormalized so the props engine reads a single table with no
-- join.
CREATE TABLE IF NOT EXISTS public.soccer_match_stats (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,  -- never sent by the importer
  league       TEXT NOT NULL CHECK (league IN ('eng.1','esp.1','ger.1','ita.1','fra.1')),
  league_slug  TEXT NOT NULL,
  season       TEXT NOT NULL CHECK (season ~ '^[0-9]{4}-[0-9]{2}$'),
  match_no     INTEGER NOT NULL,
  round        INTEGER,
  match_date   DATE NOT NULL,
  home_team    TEXT NOT NULL,                    -- canonical, copied from soccer_matches
  away_team    TEXT NOT NULL,
  home_score   INTEGER NOT NULL,
  away_score   INTEGER NOT NULL,
  period       TEXT NOT NULL CHECK (period IN ('FT','1H','2H')),
  stat_group   TEXT NOT NULL,
  stat_name    TEXT NOT NULL,
  home_value   NUMERIC,                          -- NULL when raw is 'n/a' / unparseable
  away_value   NUMERIC,
  home_pct     NUMERIC CHECK (home_pct BETWEEN 0 AND 100),
  away_pct     NUMERIC CHECK (away_pct BETWEEN 0 AND 100),
  home_raw     TEXT NOT NULL,
  away_raw     TEXT NOT NULL,
  source       TEXT NOT NULL,
  imported_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT soccer_match_stats_natural_key
    UNIQUE (league, season, match_no, period, stat_group, stat_name),
  CONSTRAINT soccer_match_stats_match_fk
    FOREIGN KEY (league, season, match_no)
    REFERENCES public.soccer_matches (league, season, match_no) ON DELETE CASCADE
);

-- Engine scan: period='FT' AND stat_group=$1 AND stat_name IN (...) ORDER BY match_date DESC.
-- The natural-key UNIQUE already covers (league, season, match_no) lookups and the FK.
CREATE INDEX IF NOT EXISTS idx_soccer_match_stats_prop_scan
  ON public.soccer_match_stats (period, stat_group, stat_name, match_date DESC);

-- RLS: public read, service-role writes (mirrors 20260522 section 13).
ALTER TABLE public.soccer_matches     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soccer_match_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "soccer_matches_select_public" ON public.soccer_matches;
CREATE POLICY "soccer_matches_select_public" ON public.soccer_matches FOR SELECT USING (true);
DROP POLICY IF EXISTS "soccer_match_stats_select_public" ON public.soccer_match_stats;
CREATE POLICY "soccer_match_stats_select_public" ON public.soccer_match_stats FOR SELECT USING (true);
-- Explicit read grant so the public read doesn't depend on project default
-- privileges; explicit write revoke so writes fail on privilege as well as RLS.
GRANT SELECT ON public.soccer_matches, public.soccer_match_stats TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.soccer_matches, public.soccer_match_stats FROM anon, authenticated;

COMMIT;
-- Verification (manual): SELECT count(*) FROM public.soccer_matches;  -- 2050 after import
