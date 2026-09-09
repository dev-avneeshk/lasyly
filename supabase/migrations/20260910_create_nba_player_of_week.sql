-- Player of the Week
--
-- A weekly award computed from a SEPARATE 7-day formula (not the season-long
-- LPI ranking). It measures recent hot-hand production over a rolling 7-day
-- window: raw box-score production, scoring efficiency, how many games the
-- player suited up for in the window, and whether their team won.
--
-- One winner per (window_start, window_end, conference). conference = 'ALL'
-- stores the league-wide winner; East/West rows are optional future use.
--
-- Immutable history: each computed week is inserted once and kept, so the UI
-- can show past Players of the Week. A re-run for the same window upserts.

BEGIN;

CREATE TABLE IF NOT EXISTS public.nba_player_of_week (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

  -- Award window (inclusive dates)
  window_start DATE NOT NULL,
  window_end   DATE NOT NULL,
  season       TEXT NOT NULL,
  conference   TEXT NOT NULL DEFAULT 'ALL',   -- 'ALL' | 'East' | 'West'

  -- Winner identity
  player_id   UUID REFERENCES public.nba_players(id) ON DELETE SET NULL,
  player_name TEXT NOT NULL,
  team        TEXT,
  position    TEXT,

  -- POTW score + component breakdown (all 0-100 except raw per-game averages)
  potw_score        NUMERIC(5,2) NOT NULL,
  production_score  NUMERIC(5,2),
  efficiency_score  NUMERIC(5,2),
  availability_score NUMERIC(5,2),
  team_success_score NUMERIC(5,2),

  -- Window aggregates (for display: "averaged 32.4 / 8.1 / 6.0 over 4 games")
  games_in_window   INTEGER NOT NULL,
  team_wins_in_window INTEGER,
  pts_per_g NUMERIC(5,2),
  trb_per_g NUMERIC(5,2),
  ast_per_g NUMERIC(5,2),
  stl_per_g NUMERIC(4,2),
  blk_per_g NUMERIC(4,2),
  ts_pct    NUMERIC(5,4),          -- true shooting over the window

  -- Runners-up (top 5 player names + scores) for a "this week's best" list
  runners_up JSONB,

  headline TEXT,                   -- generated one-liner for the UI

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (window_start, window_end, conference)
);

CREATE INDEX IF NOT EXISTS idx_potw_window ON public.nba_player_of_week (window_end DESC, conference);
CREATE INDEX IF NOT EXISTS idx_potw_season ON public.nba_player_of_week (season, window_end DESC);
CREATE INDEX IF NOT EXISTS idx_potw_player ON public.nba_player_of_week (player_name);

-- RLS: public read (it's a published award), writes only via service role.
ALTER TABLE public.nba_player_of_week ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "potw public read" ON public.nba_player_of_week;
CREATE POLICY "potw public read"
  ON public.nba_player_of_week FOR SELECT
  USING (true);

COMMIT;
