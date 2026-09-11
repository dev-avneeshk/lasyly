-- Migration: NFL games + per-player boxscore stats (ESPN-sourced)
-- Dedicated tables (mirroring the NBA scraper pattern) with NUMERIC stat
-- columns parsed from ESPN's display strings, so prop lines can be computed
-- directly. Also extends prop_line_history to allow the 'NFL' sport.
--
-- Data source: ESPN unofficial public API (site.api.espn.com), no auth.

BEGIN;

-- ============================================================
-- 1. nfl_games — schedule + final scores, one row per game
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nfl_games (
  id           TEXT PRIMARY KEY,          -- ESPN event id (stable, unique)
  event_id     TEXT NOT NULL,             -- same as id; kept for parity/clarity
  season       INTEGER NOT NULL,          -- e.g. 2024, 2025
  season_type  INTEGER NOT NULL DEFAULT 2,-- 1=pre, 2=regular, 3=post
  week         INTEGER,                   -- NFL week number
  game_date    DATE NOT NULL,
  start_time   TIMESTAMPTZ,
  home_team    TEXT NOT NULL,
  away_team    TEXT NOT NULL,
  home_abbr    TEXT,
  away_abbr    TEXT,
  home_score   INTEGER,
  away_score   INTEGER,
  status       TEXT NOT NULL DEFAULT 'scheduled', -- scheduled|in_progress|completed|postponed
  venue        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nfl_games_date   ON public.nfl_games (game_date);
CREATE INDEX IF NOT EXISTS idx_nfl_games_season ON public.nfl_games (season, season_type, week);
CREATE INDEX IF NOT EXISTS idx_nfl_games_status ON public.nfl_games (status);

ALTER TABLE public.nfl_games ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'nfl_games'
      AND policyname = 'NFL games viewable by everyone.'
  ) THEN
    CREATE POLICY "NFL games viewable by everyone."
      ON public.nfl_games FOR SELECT USING (true);
  END IF;
END$$;

-- ============================================================
-- 2. nfl_player_stats — one row per player per game
--    Combines all ESPN stat categories into flat numeric columns.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nfl_player_stats (
  id            TEXT PRIMARY KEY,         -- "{eventId}-{athleteId}"
  game_id       TEXT NOT NULL REFERENCES public.nfl_games(id) ON DELETE CASCADE,
  player_name   TEXT NOT NULL,
  athlete_id    TEXT,
  team          TEXT NOT NULL,            -- team abbreviation/display
  opponent      TEXT,
  position      TEXT,
  game_date     DATE NOT NULL,

  -- Passing
  pass_c        INTEGER DEFAULT 0,        -- completions
  pass_att      INTEGER DEFAULT 0,
  pass_yds      INTEGER DEFAULT 0,
  pass_td       INTEGER DEFAULT 0,
  pass_int      INTEGER DEFAULT 0,
  pass_sacks    INTEGER DEFAULT 0,
  qbr           NUMERIC,
  pass_rtg      NUMERIC,

  -- Rushing
  rush_att      INTEGER DEFAULT 0,
  rush_yds      INTEGER DEFAULT 0,
  rush_avg      NUMERIC,
  rush_td       INTEGER DEFAULT 0,
  rush_long     INTEGER,

  -- Receiving
  rec           INTEGER DEFAULT 0,        -- receptions
  rec_yds       INTEGER DEFAULT 0,
  rec_avg       NUMERIC,
  rec_td        INTEGER DEFAULT 0,
  rec_long      INTEGER,
  targets       INTEGER DEFAULT 0,

  -- Fumbles
  fumbles       INTEGER DEFAULT 0,
  fumbles_lost  INTEGER DEFAULT 0,

  -- Defense
  tackles_total INTEGER DEFAULT 0,
  sacks         NUMERIC DEFAULT 0,
  tackles_tfl   INTEGER DEFAULT 0,
  passes_def    INTEGER DEFAULT 0,
  def_int       INTEGER DEFAULT 0,
  def_td        INTEGER DEFAULT 0,

  -- Kicking
  fg_made       INTEGER DEFAULT 0,
  fg_att        INTEGER DEFAULT 0,
  xp_made       INTEGER DEFAULT 0,
  xp_att        INTEGER DEFAULT 0,
  kick_pts      INTEGER DEFAULT 0,

  raw_stats     JSONB DEFAULT '{}'::jsonb,-- full per-category display strings
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nfl_ps_game   ON public.nfl_player_stats (game_id);
CREATE INDEX IF NOT EXISTS idx_nfl_ps_player ON public.nfl_player_stats (player_name);
CREATE INDEX IF NOT EXISTS idx_nfl_ps_date   ON public.nfl_player_stats (game_date DESC);

ALTER TABLE public.nfl_player_stats ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'nfl_player_stats'
      AND policyname = 'NFL player stats viewable by everyone.'
  ) THEN
    CREATE POLICY "NFL player stats viewable by everyone."
      ON public.nfl_player_stats FOR SELECT USING (true);
  END IF;
END$$;

-- ============================================================
-- 3. updated_at trigger for nfl_games
-- ============================================================
CREATE OR REPLACE FUNCTION public.nfl_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nfl_games_ts ON public.nfl_games;
CREATE TRIGGER trg_nfl_games_ts BEFORE UPDATE ON public.nfl_games
  FOR EACH ROW EXECUTE FUNCTION public.nfl_update_timestamp();

-- ============================================================
-- 4. Allow 'NFL' in prop_line_history.sport CHECK constraint
--    (was CHECK IN ('NBA','Tennis'))
-- ============================================================
DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.prop_line_history'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%sport%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.prop_line_history DROP CONSTRAINT %I', con_name);
  END IF;

  ALTER TABLE public.prop_line_history
    ADD CONSTRAINT prop_line_history_sport_check
    CHECK (sport IN ('NBA', 'Tennis', 'NFL'));
END$$;

COMMIT;
