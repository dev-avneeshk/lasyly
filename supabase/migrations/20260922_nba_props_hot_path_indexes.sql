-- =====================================================================
-- NBA props engine — missing hot-path indexes
-- =====================================================================
--
--   ⚠ psql ONLY — this file CANNOT be pasted into the Supabase SQL Editor.
--   It uses CREATE INDEX CONCURRENTLY, which cannot run inside the
--   transaction the editor wraps every submission in. See the twin file
--   20260922_nba_props_indexes_no_concurrent.sql for the editor-safe version.
--   Apply EITHER path, not both (harmless if you do; every statement is
--   IF NOT EXISTS).
--
--   Apply with:  scripts/db/apply-migration.sh <this file>
--
-- WHY
--
-- The props endpoint's NBA path (lib/analytics/engine-v2.ts →
-- fetchBatchPlayerStats) is the most expensive read in the app on a cache
-- miss, and it runs SIX times in parallel for the default `stat=all` load
-- (pts, trb, ast, tp, stl, blk). Each call issues:
--
--   SELECT … , nba_games!inner(game_date, home_team, away_team)
--   FROM nba_player_stats
--   WHERE team IN (<today's teams>)
--     AND nba_games.game_date >= <90 days ago>
--   ORDER BY nba_games.game_date DESC
--   LIMIT 5000
--
-- nba_player_stats and nba_games were created in the Supabase dashboard, so
-- the only index they ever received is the uq_player_stats_game_player
-- constraint on (game_id, player_name). That covers the join key, but NOT:
--
--   * nba_player_stats.team — the `IN (…)` filter, so the team scan is
--     sequential over the full table, six times per cold request.
--   * nba_games.game_date — the range filter AND the ORDER BY on the joined
--     side. Sorting a join across tens of thousands of rows with no index on
--     the sort key is the single heaviest part of the query.
--
-- With a 30s per-attempt Supabase timeout and up to 3 retries
-- (lib/supabase/fetch-with-retry.ts), a genuinely cold sequential scan can
-- stack toward the ~1 minute users reported. These two indexes give the
-- planner an access path for both the filter and the sort.
-- =====================================================================

-- The `team IN (…)` filter. game_date is included so the planner can push the
-- date bound and satisfy the ORDER BY from the index rather than re-sorting,
-- for the common case where the stat column is fetched by a subsequent lookup.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nba_player_stats_team
  ON public.nba_player_stats (team);

-- nba_games.game_date drives both the >= cutoff filter and the ORDER BY DESC
-- on the joined side.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nba_games_game_date
  ON public.nba_games (game_date);

-- =====================================================================
-- Post-deployment verification (run manually):
--
--   SELECT NOT indisvalid AS broken, indexrelid::regclass
--   FROM pg_index WHERE NOT indisvalid;              -- expect zero rows
--
--   -- Confirm the props batch query stopped seq-scanning nba_player_stats:
--   EXPLAIN (ANALYZE, BUFFERS)
--   SELECT ps.player_name, g.game_date
--   FROM public.nba_player_stats ps
--   JOIN public.nba_games g ON g.id = ps.game_id
--   WHERE ps.team IN ('LAL','BOS')
--     AND g.game_date >= (now() - interval '90 days')::date
--   ORDER BY g.game_date DESC
--   LIMIT 5000;
-- =====================================================================
