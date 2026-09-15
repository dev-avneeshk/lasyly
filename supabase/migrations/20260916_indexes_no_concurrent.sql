-- =====================================================================
-- Index creation for the Supabase SQL Editor (non-CONCURRENTLY)
-- =====================================================================
-- WHY THIS FILE EXISTS
--
-- 20260914_hot_path_indexes.sql and 20260915_retention_indexes.sql use
-- CREATE INDEX CONCURRENTLY, which fails in the Supabase SQL Editor with:
--
--     ERROR: 25001: CREATE INDEX CONCURRENTLY cannot run inside a
--                   transaction block
--
-- That is not a bug in those files. The SQL Editor wraps every submission in a
-- transaction, and CONCURRENTLY is defined to run outside one — it makes two
-- passes over the table and waits for concurrent writers in between, which is
-- only possible if it can commit between phases. The same files apply fine via
-- psql (scripts/db/apply-migration.sh), which does not wrap them.
--
-- This file contains THE SAME INDEXES without CONCURRENTLY, so it can be pasted
-- into the SQL Editor. Apply EITHER this file OR the two CONCURRENTLY files —
-- never both is required, and doing both is harmless because every statement is
-- IF NOT EXISTS.
--
-- ── The tradeoff, stated plainly ────────────────────────────────────────────
-- A plain CREATE INDEX takes a SHARE lock on the table: reads continue, writes
-- BLOCK until the build finishes. CONCURRENTLY exists to avoid exactly that.
--
-- For this database today that is a non-issue — the tables are small (a probe of
-- /api/leaderboard, /api/props and /api/rankings returned empty result sets), so
-- each build is milliseconds. If you are reading this later with millions of rows
-- in `messages` or `espn_player_stats`, do NOT use this file: use psql and the
-- CONCURRENTLY versions, or you will stall writes for the duration of the build.
--
-- `lock_timeout` below is the safety net either way: if a build cannot acquire
-- its lock within 5 seconds (because a long transaction is holding the table),
-- it fails that one index instead of queueing and blocking every writer behind
-- it.
--
-- ── Failure isolation ───────────────────────────────────────────────────────
-- Because the editor runs this as ONE transaction, a single failing statement
-- would normally abort every other index too. Each CREATE is therefore executed
-- inside its own exception block (an implicit savepoint), so one problem is
-- isolated and reported as a WARNING while the rest still apply. That matters
-- for two specific cases:
--
--   * A table that doesn't exist in this environment. betslips, reactions,
--     unlocked_picks, follows, room_members, rooms, messages and transactions
--     are not defined anywhere in this repo (they were created in the dashboard),
--     so their presence cannot be assumed.
--   * uq_follows_follower_following is a UNIQUE index. If `follows` already
--     contains duplicate (follower_id, following_id) pairs it cannot be created;
--     you will get a WARNING naming it, and you can de-duplicate and re-run.
--
-- Read the WARNINGs in the output. An empty warning list means everything landed.
-- =====================================================================

SET lock_timeout = '5s';

DO $indexes$
DECLARE
  stmt text;
  v_ok int := 0;
  v_skipped int := 0;
  stmts text[] := ARRAY[
    -- ── transactions: the ledger had exactly one index (idempotency_key) ─────
    -- transactions_select_own RLS filters user_id on every wallet/profile read.
    'CREATE INDEX IF NOT EXISTS idx_transactions_user_created
       ON public.transactions (user_id, created_at DESC)',

    -- ── follows: read as a correlated EXISTS inside two RLS policies ─────────
    -- betslips_select_visible and reactions_select_visible both run
    -- EXISTS (SELECT 1 FROM follows WHERE follower_id = … AND following_id = …)
    -- per candidate row, against a table with no index at all.
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_follows_follower_following
       ON public.follows (follower_id, following_id)',
    'CREATE INDEX IF NOT EXISTS idx_follows_following
       ON public.follows (following_id)',

    -- ── room_members: is_room_member/is_room_admin are called from every
    --    room, message and betslip policy ───────────────────────────────────
    'CREATE INDEX IF NOT EXISTS idx_room_members_user
       ON public.room_members (user_id)',
    'CREATE INDEX IF NOT EXISTS idx_room_members_room_role
       ON public.room_members (room_id, role)',

    -- ── rooms: rooms_select_visible filters type and creator_id; discovery
    --    sorts by member_count ──────────────────────────────────────────────
    'CREATE INDEX IF NOT EXISTS idx_rooms_creator
       ON public.rooms (creator_id)',
    'CREATE INDEX IF NOT EXISTS idx_rooms_public_members
       ON public.rooms (type, member_count DESC)',

    -- ── messages: retention needs an index it can actually drive ────────────
    -- Both existing indexes lead with room_id / subchannel_id, so the 30-day
    -- purge had no usable access path.
    'CREATE INDEX IF NOT EXISTS idx_messages_created_at
       ON public.messages (created_at)',
    'CREATE INDEX IF NOT EXISTS idx_messages_user
       ON public.messages (user_id)',

    -- ── message_reactions: delete_own filters user_id ───────────────────────
    'CREATE INDEX IF NOT EXISTS idx_message_reactions_user
       ON public.message_reactions (user_id)',

    -- ── betslips: betslips_select_visible filters all three ─────────────────
    'CREATE INDEX IF NOT EXISTS idx_betslips_user
       ON public.betslips (user_id)',
    'CREATE INDEX IF NOT EXISTS idx_betslips_room
       ON public.betslips (room_id) WHERE room_id IS NOT NULL',
    'CREATE INDEX IF NOT EXISTS idx_betslips_for_sale
       ON public.betslips (is_for_sale) WHERE is_for_sale = true',

    -- ── unlocked_picks: the tipster-side lookup ─────────────────────────────
    'CREATE INDEX IF NOT EXISTS idx_unlocked_picks_betslip
       ON public.unlocked_picks (betslip_id)',

    -- ── notifications: the unread badge is polled every 30s per user, and
    --    retention prunes by age ────────────────────────────────────────────
    'CREATE INDEX IF NOT EXISTS idx_notifications_unread
       ON public.notifications (user_id, created_at DESC) WHERE is_read = false',
    'CREATE INDEX IF NOT EXISTS idx_notifications_read_created
       ON public.notifications (created_at) WHERE is_read = true',
    'CREATE INDEX IF NOT EXISTS idx_notifications_created
       ON public.notifications (created_at)',

    -- ── post_comments: "delete their own comments" filters user_id ──────────
    'CREATE INDEX IF NOT EXISTS idx_post_comments_user
       ON public.post_comments (user_id)',

    -- ── espn_*: cross-league "today" queries had only (league, match_date) ──
    'CREATE INDEX IF NOT EXISTS idx_espn_games_match_date
       ON public.espn_games (match_date)',
    'CREATE INDEX IF NOT EXISTS idx_espn_player_stats_match_date
       ON public.espn_player_stats (match_date)',

    -- ── retention predicates ────────────────────────────────────────────────
    -- prop_votes had (prop_identifier, vote_date) and (user_id); neither can
    -- drive WHERE vote_date < …
    'CREATE INDEX IF NOT EXISTS idx_prop_votes_vote_date
       ON public.prop_votes (vote_date)',
    -- correlations_cache had three indexes, none on computed_at.
    'CREATE INDEX IF NOT EXISTS idx_correlations_computed_at
       ON public.correlations_cache (computed_at)',
    -- subchannel_join_requests'' only index was a partial on status=''pending'',
    -- i.e. exactly the rows retention does NOT touch.
    'CREATE INDEX IF NOT EXISTS idx_subchannel_requests_decided
       ON public.subchannel_join_requests (decided_at) WHERE status <> ''pending''',
    -- room_audit_log is pruned at 90 days with no supporting index.
    'CREATE INDEX IF NOT EXISTS idx_room_audit_log_created
       ON public.room_audit_log (created_at)',
    -- room_mutes cleanup deletes WHERE muted_until < now(); the existing
    -- idx_room_mutes_lookup leads with (room_id, user_id) so it cannot help.
    'CREATE INDEX IF NOT EXISTS idx_room_mutes_expiry
       ON public.room_mutes (muted_until)'
  ];
BEGIN
  FOREACH stmt IN ARRAY stmts
  LOOP
    BEGIN
      EXECUTE stmt;
      v_ok := v_ok + 1;
    EXCEPTION
      WHEN others THEN
        -- Isolated to this statement''s savepoint; the rest still apply.
        v_skipped := v_skipped + 1;
        RAISE WARNING 'SKIPPED index: % — %', SQLERRM, regexp_replace(stmt, '\s+', ' ', 'g');
    END;
  END LOOP;

  RAISE NOTICE '% index statements applied, % skipped', v_ok, v_skipped;
END
$indexes$;

RESET lock_timeout;

-- =====================================================================
-- Post-deployment verification (run manually):
--
--   -- Every index this file creates, and whether it is valid:
--   SELECT indexrelid::regclass AS index_name,
--          indrelid::regclass  AS table_name,
--          indisvalid
--   FROM pg_index
--   WHERE indexrelid::regclass::text LIKE 'idx_%'
--      OR indexrelid::regclass::text LIKE 'uq_%'
--   ORDER BY table_name, index_name;
--
--   -- Nothing should be invalid (only CONCURRENTLY builds can leave these
--   -- behind, but check anyway if you also ran the psql versions):
--   SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;
--
--   -- If uq_follows_follower_following was SKIPPED, find the duplicates:
--   SELECT follower_id, following_id, count(*)
--   FROM public.follows GROUP BY 1, 2 HAVING count(*) > 1;
--
--   -- Spot-check that the chat page stopped seq-scanning:
--   EXPLAIN (ANALYZE, BUFFERS)
--   SELECT id FROM public.messages
--   WHERE subchannel_id = '<uuid>' ORDER BY created_at DESC LIMIT 50;
-- =====================================================================
