-- Migration: Populate sets/games columns in tennis_raw_stats
-- These were stored as integers (0) before; convert to float averages per match.

ALTER TABLE public.tennis_raw_stats
  ALTER COLUMN sets_won TYPE NUMERIC(6,2),
  ALTER COLUMN sets_lost TYPE NUMERIC(6,2),
  ALTER COLUMN games_won TYPE NUMERIC(6,1),
  ALTER COLUMN games_lost TYPE NUMERIC(6,1);

COMMENT ON COLUMN public.tennis_raw_stats.sets_won   IS 'Average sets won per match on this surface/year';
COMMENT ON COLUMN public.tennis_raw_stats.sets_lost  IS 'Average sets lost per match on this surface/year';
COMMENT ON COLUMN public.tennis_raw_stats.games_won  IS 'Average games won per match on this surface/year';
COMMENT ON COLUMN public.tennis_raw_stats.games_lost IS 'Average games lost per match on this surface/year';
