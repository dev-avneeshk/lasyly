-- Migration: Fix tennis_raw_stats column types for float averages
-- The scraper computes per-match averages (games_won, games_lost, sets_won, sets_lost)
-- and win percentage as floats. These columns must be NUMERIC, not INTEGER.
-- This supersedes 20250523_tennis_raw_stats_sets_games.sql if that was never applied.

-- Use IF NOT to make this idempotent (safe to run even if 20250523 was already applied)
DO $$
BEGIN
  -- win_pct: percentage like 67.5
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tennis_raw_stats'
      AND column_name = 'win_pct'
      AND data_type IN ('integer', 'bigint', 'smallint')
  ) THEN
    ALTER TABLE public.tennis_raw_stats ALTER COLUMN win_pct TYPE NUMERIC(5,1);
  END IF;

  -- sets_won: average sets won per match (e.g. 1.23)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tennis_raw_stats'
      AND column_name = 'sets_won'
      AND data_type IN ('integer', 'bigint', 'smallint')
  ) THEN
    ALTER TABLE public.tennis_raw_stats ALTER COLUMN sets_won TYPE NUMERIC(6,2);
  END IF;

  -- sets_lost: average sets lost per match (e.g. 0.85)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tennis_raw_stats'
      AND column_name = 'sets_lost'
      AND data_type IN ('integer', 'bigint', 'smallint')
  ) THEN
    ALTER TABLE public.tennis_raw_stats ALTER COLUMN sets_lost TYPE NUMERIC(6,2);
  END IF;

  -- games_won: average games won per match (e.g. 12.3)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tennis_raw_stats'
      AND column_name = 'games_won'
      AND data_type IN ('integer', 'bigint', 'smallint')
  ) THEN
    ALTER TABLE public.tennis_raw_stats ALTER COLUMN games_won TYPE NUMERIC(6,1);
  END IF;

  -- games_lost: average games lost per match (e.g. 10.8)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tennis_raw_stats'
      AND column_name = 'games_lost'
      AND data_type IN ('integer', 'bigint', 'smallint')
  ) THEN
    ALTER TABLE public.tennis_raw_stats ALTER COLUMN games_lost TYPE NUMERIC(6,1);
  END IF;
END $$;

COMMENT ON COLUMN public.tennis_raw_stats.win_pct    IS 'Win percentage (0-100) for this surface/year';
COMMENT ON COLUMN public.tennis_raw_stats.sets_won   IS 'Average sets won per match on this surface/year';
COMMENT ON COLUMN public.tennis_raw_stats.sets_lost  IS 'Average sets lost per match on this surface/year';
COMMENT ON COLUMN public.tennis_raw_stats.games_won  IS 'Average games won per match on this surface/year';
COMMENT ON COLUMN public.tennis_raw_stats.games_lost IS 'Average games lost per match on this surface/year';
