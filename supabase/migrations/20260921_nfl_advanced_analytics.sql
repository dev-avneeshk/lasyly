-- =====================================================================
-- NFL Advanced Analytics tables
-- =====================================================================
-- The existing nfl_player_stats table is ESPN-shaped: a flat, standard box
-- score. Pro-Football-Reference exposes a richer layer that ESPN does not —
-- air yards, aDOT, YBC/YAC splits, pressure/blitz rates, snap counts, drive
-- summaries, and league-wide team offense/defense tables. Those are the raw
-- material the advanced player + matchup analytics engine needs, so they get
-- their own tables here rather than being crammed into nfl_player_stats.
--
-- Design mirrors 20260911_create_nfl_tables.sql: TEXT synthetic keys, RLS with
-- a public SELECT policy (writes go through the service role), and the shared
-- nfl_update_timestamp() trigger where an updated_at column exists. Every table
-- carries a stable game_id so a full week can be re-ingested idempotently.
--
-- Provenance: every column here is RAW (present verbatim in the PFR box score).
-- Derived / modeled values are computed in application code (lib/analytics/nfl)
-- and are never stored pre-computed, so the RAW/DERIVED/MODEL distinction the
-- product depends on stays honest at the data layer.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Extra RAW game context on nfl_games (surface/roof/weather/betting).
--    Added as nullable columns so existing rows and the ESPN scraper are
--    unaffected; the PFR loader fills them when present.
-- ---------------------------------------------------------------------
ALTER TABLE public.nfl_games
  ADD COLUMN IF NOT EXISTS roof            TEXT,
  ADD COLUMN IF NOT EXISTS surface         TEXT,
  ADD COLUMN IF NOT EXISTS attendance      INTEGER,
  ADD COLUMN IF NOT EXISTS duration        TEXT,
  ADD COLUMN IF NOT EXISTS temperature_f   INTEGER,
  ADD COLUMN IF NOT EXISTS humidity_pct    INTEGER,
  ADD COLUMN IF NOT EXISTS wind_mph        INTEGER,
  ADD COLUMN IF NOT EXISTS spread          NUMERIC,
  ADD COLUMN IF NOT EXISTS spread_favorite TEXT,
  ADD COLUMN IF NOT EXISTS over_under      NUMERIC,
  ADD COLUMN IF NOT EXISTS total_result    TEXT,  -- over|under|push
  ADD COLUMN IF NOT EXISTS went_to_ot      BOOLEAN;

-- ---------------------------------------------------------------------
-- 1. nfl_team_game_stats — one row per team per game (Team Stats table)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nfl_team_game_stats (
  id                TEXT PRIMARY KEY,        -- "{game_id}-{team}"
  game_id           TEXT NOT NULL,
  team              TEXT NOT NULL,
  opponent          TEXT NOT NULL,
  is_home           BOOLEAN NOT NULL,
  first_downs       INTEGER DEFAULT 0,
  rush_att          INTEGER DEFAULT 0,
  rush_yds          INTEGER DEFAULT 0,
  rush_td           INTEGER DEFAULT 0,
  pass_cmp          INTEGER DEFAULT 0,
  pass_att          INTEGER DEFAULT 0,
  pass_yds          INTEGER DEFAULT 0,
  pass_td           INTEGER DEFAULT 0,
  pass_int          INTEGER DEFAULT 0,
  sacked            INTEGER DEFAULT 0,
  sacked_yds        INTEGER DEFAULT 0,
  net_pass_yds      INTEGER DEFAULT 0,
  total_yds         INTEGER DEFAULT 0,
  fumbles           INTEGER DEFAULT 0,
  fumbles_lost      INTEGER DEFAULT 0,
  turnovers         INTEGER DEFAULT 0,
  penalties         INTEGER DEFAULT 0,
  penalty_yds       INTEGER DEFAULT 0,
  third_down_att    INTEGER DEFAULT 0,
  third_down_conv   INTEGER DEFAULT 0,
  fourth_down_att   INTEGER DEFAULT 0,
  fourth_down_conv  INTEGER DEFAULT 0,
  top               TEXT,                    -- time of possession "MM:SS"
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nfl_tgs_game ON public.nfl_team_game_stats (game_id);
CREATE INDEX IF NOT EXISTS idx_nfl_tgs_team ON public.nfl_team_game_stats (team);

-- ---------------------------------------------------------------------
-- 2. nfl_adv_receiving — one row per receiver per game
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nfl_adv_receiving (
  id                    TEXT PRIMARY KEY,    -- "{game_id}-{player}"
  game_id               TEXT NOT NULL,
  player                TEXT NOT NULL,
  team                  TEXT NOT NULL,
  targets               INTEGER DEFAULT 0,
  rec                   INTEGER DEFAULT 0,
  yds                   INTEGER DEFAULT 0,
  td                    INTEGER DEFAULT 0,
  first_downs           INTEGER DEFAULT 0,
  ybc                   INTEGER DEFAULT 0,
  ybc_per_rec           NUMERIC,
  yac                   INTEGER DEFAULT 0,
  yac_per_rec           NUMERIC,
  adot                  NUMERIC,
  broken_tackles        INTEGER DEFAULT 0,
  rec_per_broken        NUMERIC,
  drops                 INTEGER DEFAULT 0,
  drop_pct              NUMERIC,
  int_on_target         INTEGER DEFAULT 0,
  rating_when_targeted  NUMERIC,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nfl_advrec_game   ON public.nfl_adv_receiving (game_id);
CREATE INDEX IF NOT EXISTS idx_nfl_advrec_player ON public.nfl_adv_receiving (player);

-- ---------------------------------------------------------------------
-- 3. nfl_adv_rushing — one row per rusher per game
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nfl_adv_rushing (
  id              TEXT PRIMARY KEY,          -- "{game_id}-{player}"
  game_id         TEXT NOT NULL,
  player          TEXT NOT NULL,
  team            TEXT NOT NULL,
  att             INTEGER DEFAULT 0,
  yds             INTEGER DEFAULT 0,
  td              INTEGER DEFAULT 0,
  first_downs     INTEGER DEFAULT 0,
  ybc             INTEGER DEFAULT 0,
  ybc_per_att     NUMERIC,
  yac             INTEGER DEFAULT 0,
  yac_per_att     NUMERIC,
  broken_tackles  INTEGER DEFAULT 0,
  att_per_broken  NUMERIC,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nfl_advrush_game   ON public.nfl_adv_rushing (game_id);
CREATE INDEX IF NOT EXISTS idx_nfl_advrush_player ON public.nfl_adv_rushing (player);

-- ---------------------------------------------------------------------
-- 4. nfl_adv_passing — one row per passer per game
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nfl_adv_passing (
  id              TEXT PRIMARY KEY,          -- "{game_id}-{player}"
  game_id         TEXT NOT NULL,
  player          TEXT NOT NULL,
  team            TEXT NOT NULL,
  cmp             INTEGER DEFAULT 0,
  att             INTEGER DEFAULT 0,
  yds             INTEGER DEFAULT 0,
  first_downs     INTEGER DEFAULT 0,
  first_down_pct  NUMERIC,
  iay             INTEGER DEFAULT 0,
  iay_per_att     NUMERIC,
  cay             INTEGER DEFAULT 0,
  cay_per_cmp     NUMERIC,
  cay_per_att     NUMERIC,
  yac             INTEGER DEFAULT 0,
  yac_per_cmp     NUMERIC,
  drops           INTEGER DEFAULT 0,
  drop_pct        NUMERIC,
  bad_throws      INTEGER DEFAULT 0,
  bad_throw_pct   NUMERIC,
  sacked          INTEGER DEFAULT 0,
  blitzed         INTEGER DEFAULT 0,
  hurried         INTEGER DEFAULT 0,
  hits            INTEGER DEFAULT 0,
  pressured       INTEGER DEFAULT 0,
  pressured_pct   NUMERIC,
  scrambles       INTEGER DEFAULT 0,
  yds_per_scramble NUMERIC,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nfl_advpass_game   ON public.nfl_adv_passing (game_id);
CREATE INDEX IF NOT EXISTS idx_nfl_advpass_player ON public.nfl_adv_passing (player);

-- ---------------------------------------------------------------------
-- 5. nfl_snap_counts — one row per player per game
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nfl_snap_counts (
  id          TEXT PRIMARY KEY,              -- "{game_id}-{player}"
  game_id     TEXT NOT NULL,
  player      TEXT NOT NULL,
  team        TEXT NOT NULL,
  pos         TEXT,
  off_snaps   INTEGER DEFAULT 0,
  off_pct     INTEGER DEFAULT 0,
  def_snaps   INTEGER DEFAULT 0,
  def_pct     INTEGER DEFAULT 0,
  st_snaps    INTEGER DEFAULT 0,
  st_pct      INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nfl_snaps_game   ON public.nfl_snap_counts (game_id);
CREATE INDEX IF NOT EXISTS idx_nfl_snaps_player ON public.nfl_snap_counts (player);

-- ---------------------------------------------------------------------
-- 6. nfl_drives — one row per drive
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nfl_drives (
  id           TEXT PRIMARY KEY,             -- "{game_id}-{team}-{drive_num}"
  game_id      TEXT NOT NULL,
  team         TEXT NOT NULL,
  drive_num    INTEGER NOT NULL,
  quarter      INTEGER,
  start_clock  TEXT,
  start_los    TEXT,
  plays        INTEGER DEFAULT 0,
  length       TEXT,
  net_yds      INTEGER DEFAULT 0,
  result       TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nfl_drives_game ON public.nfl_drives (game_id);
CREATE INDEX IF NOT EXISTS idx_nfl_drives_team ON public.nfl_drives (team);

-- ---------------------------------------------------------------------
-- 7. nfl_team_season_units — league-wide team offense/defense table.
--    One row per (season, week, team, unit) where unit ∈ {offense,defense}.
--    This is the comparison population for baselines / ranks / percentiles.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nfl_team_season_units (
  id                TEXT PRIMARY KEY,        -- "{season}-{week}-{team}-{unit}"
  season            INTEGER NOT NULL,
  week              INTEGER NOT NULL,
  team              TEXT NOT NULL,
  unit              TEXT NOT NULL CHECK (unit IN ('offense', 'defense')),
  games             INTEGER DEFAULT 0,
  points            INTEGER DEFAULT 0,
  total_yds         INTEGER DEFAULT 0,
  plays             INTEGER DEFAULT 0,
  yds_per_play      NUMERIC,
  turnovers         INTEGER DEFAULT 0,
  fumbles_lost      INTEGER DEFAULT 0,
  first_downs       INTEGER DEFAULT 0,
  pass_cmp          INTEGER DEFAULT 0,
  pass_att          INTEGER DEFAULT 0,
  pass_yds          INTEGER DEFAULT 0,
  pass_td           INTEGER DEFAULT 0,
  pass_int          INTEGER DEFAULT 0,
  net_yds_per_att   NUMERIC,
  rush_att          INTEGER DEFAULT 0,
  rush_yds          INTEGER DEFAULT 0,
  rush_td           INTEGER DEFAULT 0,
  rush_yds_per_att  NUMERIC,
  penalties         INTEGER DEFAULT 0,
  penalty_yds       INTEGER DEFAULT 0,
  score_pct         NUMERIC,
  turnover_pct      NUMERIC,
  exp_points        NUMERIC,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nfl_tsu_lookup ON public.nfl_team_season_units (season, week, unit);
CREATE INDEX IF NOT EXISTS idx_nfl_tsu_team   ON public.nfl_team_season_units (team);

-- ---------------------------------------------------------------------
-- 8. RLS: public SELECT on all new tables (writes via service role only).
-- ---------------------------------------------------------------------
DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'nfl_team_game_stats', 'nfl_adv_receiving', 'nfl_adv_rushing',
    'nfl_adv_passing', 'nfl_snap_counts', 'nfl_drives', 'nfl_team_season_units'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
        AND policyname = 'Public read'
    ) THEN
      EXECUTE format(
        'CREATE POLICY "Public read" ON public.%I FOR SELECT USING (true)', tbl
      );
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------
-- 9. updated_at trigger for the one table that tracks it. Reuses the
--    existing public.nfl_update_timestamp() from 20260911.
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_nfl_tsu_ts ON public.nfl_team_season_units;
CREATE TRIGGER trg_nfl_tsu_ts BEFORE UPDATE ON public.nfl_team_season_units
  FOR EACH ROW EXECUTE FUNCTION public.nfl_update_timestamp();

COMMIT;
