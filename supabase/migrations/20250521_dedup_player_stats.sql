-- Migration: Remove duplicate player stats and add unique constraint
-- Prevents the same player from having multiple rows for the same game

-- 1. Delete duplicate rows, keeping the one with the earliest created_at
DELETE FROM public.nba_player_stats
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY game_id, player_name
        ORDER BY created_at ASC
      ) AS rn
    FROM public.nba_player_stats
  ) dupes
  WHERE rn > 1
);

-- 2. Add unique constraint to prevent future duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_player_stats_game_player'
  ) THEN
    ALTER TABLE public.nba_player_stats
      ADD CONSTRAINT uq_player_stats_game_player
      UNIQUE (game_id, player_name);
  END IF;
END $$;
