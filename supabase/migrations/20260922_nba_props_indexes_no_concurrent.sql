-- =====================================================================
-- NBA props engine — hot-path indexes (Supabase SQL Editor, non-CONCURRENTLY)
-- =====================================================================
-- Editor-safe twin of 20260922_nba_props_hot_path_indexes.sql. Same indexes,
-- no CONCURRENTLY, so it can be pasted into the Supabase SQL Editor (which
-- wraps submissions in a transaction that CONCURRENTLY cannot run inside).
-- Apply EITHER this file OR the CONCURRENTLY twin via psql — not both is
-- required, and doing both is harmless (every statement is IF NOT EXISTS).
--
-- Tradeoff: a plain CREATE INDEX takes a SHARE lock — reads continue, writes
-- block until the build finishes. lock_timeout below caps that wait at 5s so a
-- build fails fast rather than queueing behind a long transaction. See the
-- CONCURRENTLY twin's header for why these indexes exist (the NBA props batch
-- query filters nba_player_stats.team and sorts on nba_games.game_date, neither
-- of which was indexed).
-- =====================================================================

SET lock_timeout = '5s';

DO $indexes$
DECLARE
  stmt text;
  v_ok int := 0;
  v_skipped int := 0;
  stmts text[] := ARRAY[
    'CREATE INDEX IF NOT EXISTS idx_nba_player_stats_team
       ON public.nba_player_stats (team)',
    'CREATE INDEX IF NOT EXISTS idx_nba_games_game_date
       ON public.nba_games (game_date)'
  ];
BEGIN
  FOREACH stmt IN ARRAY stmts
  LOOP
    BEGIN
      EXECUTE stmt;
      v_ok := v_ok + 1;
    EXCEPTION
      WHEN others THEN
        v_skipped := v_skipped + 1;
        RAISE WARNING 'SKIPPED index: % — %', SQLERRM, regexp_replace(stmt, '\s+', ' ', 'g');
    END;
  END LOOP;

  RAISE NOTICE '% index statements applied, % skipped', v_ok, v_skipped;
END
$indexes$;

RESET lock_timeout;
