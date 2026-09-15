-- =====================================================================
-- Missing indexes on hot-path predicates
-- =====================================================================
--
--   ⚠ psql ONLY — this file CANNOT be pasted into the Supabase SQL Editor.
--
--   The editor wraps every submission in a transaction, and CONCURRENTLY is
--   defined to run outside one (it makes two passes over the table and waits
--   for concurrent writers in between, which requires committing between
--   phases). Pasting this in fails with:
--
--       ERROR: 25001: CREATE INDEX CONCURRENTLY cannot run inside a
--                     transaction block
--
--   Apply it with:  scripts/db/apply-migration.sh <this file>
--   Or, for the SQL Editor, use supabase/migrations/20260916_indexes_no_concurrent.sql
--   instead — same indexes, no CONCURRENTLY. Apply EITHER path, not both
--   (harmless if you do; every statement is IF NOT EXISTS).
--
-- NOTE: this file deliberately has NO BEGIN/COMMIT. Every statement uses
-- CREATE INDEX CONCURRENTLY, which cannot run inside a transaction block.
-- scripts/db/apply-migration.sh runs psql without --single-transaction, so
-- each statement commits on its own. CONCURRENTLY avoids taking a write lock
-- on tables that serve live traffic.
--
-- If a CONCURRENTLY build is interrupted it leaves an INVALID index behind.
-- Find and drop any with:
--   SELECT i.indexrelid::regclass FROM pg_index i WHERE NOT i.indisvalid;
--
-- Every predicate below is executed on a request path today. The columns are
-- unindexed because the tables they live on (profiles, rooms, room_members,
-- messages, transactions, unlocked_picks, follows, betslips) were created in
-- the Supabase dashboard rather than in this repo, so only the columns added
-- by later migrations ever got indexes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- transactions — the financial ledger had exactly one index (idempotency_key)
-- ---------------------------------------------------------------------
-- transactions_select_own RLS filters user_id on every wallet/profile read.
-- The FK re-added in 20250518_fix_cascade_deletes.sql:16 was left unbacked.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_created
  ON public.transactions (user_id, created_at DESC);

-- ---------------------------------------------------------------------
-- follows — read as a correlated EXISTS inside two RLS policies
-- ---------------------------------------------------------------------
-- betslips_select_visible (20260522:311) and reactions_select_visible
-- (20260522:363) both run
--   EXISTS (SELECT 1 FROM follows WHERE follower_id = ... AND following_id = ...)
-- per candidate row, against a table with no index at all.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_follows_follower_following
  ON public.follows (follower_id, following_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_following
  ON public.follows (following_id);

-- ---------------------------------------------------------------------
-- room_members — is_room_member/is_room_admin are called from every room,
-- message and betslip policy
-- ---------------------------------------------------------------------
-- The unique index on (room_id, user_id) already exists (proved by the
-- ON CONFLICT in 20250531_room_admin_features.sql:327). Missing: the reverse
-- lookup ("my rooms") and the role filter is_room_admin adds.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_room_members_user
  ON public.room_members (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_room_members_room_role
  ON public.room_members (room_id, role);

-- ---------------------------------------------------------------------
-- rooms — rooms_select_visible filters type and creator_id; explore sorts
-- by member_count
-- ---------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rooms_creator
  ON public.rooms (creator_id);

-- Covers the discovery query: WHERE type IN ('Public','Tipster')
--                             ORDER BY member_count DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rooms_public_members
  ON public.rooms (type, member_count DESC);

-- ---------------------------------------------------------------------
-- messages — retention needs an index it can actually drive
-- ---------------------------------------------------------------------
-- cleanup_old_chat_data() does WHERE created_at < now() - INTERVAL '30 days'.
-- Both existing indexes lead with room_id / subchannel_id, so the batch
-- SELECT had no usable access path.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_created_at
  ON public.messages (created_at);

-- messages_delete_self_or_admin filters user_id.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_user
  ON public.messages (user_id);

-- ---------------------------------------------------------------------
-- message_reactions — delete_own filters user_id; had only (message_id)
-- ---------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_reactions_user
  ON public.message_reactions (user_id);

-- ---------------------------------------------------------------------
-- betslips — betslips_select_visible filters all three of these
-- ---------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_betslips_user
  ON public.betslips (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_betslips_room
  ON public.betslips (room_id)
  WHERE room_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_betslips_for_sale
  ON public.betslips (is_for_sale)
  WHERE is_for_sale = true;

-- ---------------------------------------------------------------------
-- unlocked_picks — the reverse lookup used by unlocked_picks_select_owner
-- ---------------------------------------------------------------------
-- (user_id, betslip_id) is covered by uq_unlocked_picks_user_betslip in
-- 20260914_idempotency_constraints.sql. This is the tipster-side direction.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unlocked_picks_betslip
  ON public.unlocked_picks (betslip_id);

-- ---------------------------------------------------------------------
-- notifications — the unread badge is polled every 30s per user
-- ---------------------------------------------------------------------
-- idx_notifications_user_unread puts a boolean in the middle position, so the
-- trailing created_at DESC is only usable for a fixed is_read. A partial index
-- on the unread case is what the badge query actually wants.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE is_read = false;

-- ---------------------------------------------------------------------
-- post_comments — "delete their own comments" filters user_id
-- ---------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_comments_user
  ON public.post_comments (user_id);

-- ---------------------------------------------------------------------
-- espn_games / nfl_games — cross-league "today" queries
-- ---------------------------------------------------------------------
-- Only (league, match_date) existed, so a query spanning leagues (the props
-- engine's upcoming-slate gate) could not use an index on the date alone.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_espn_games_match_date
  ON public.espn_games (match_date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_espn_player_stats_match_date
  ON public.espn_player_stats (match_date);

-- =====================================================================
-- Post-deployment verification (run manually):
--
--   SELECT NOT indisvalid AS broken, indexrelid::regclass
--   FROM pg_index WHERE NOT indisvalid;              -- expect zero rows
--
--   SELECT tablename, indexname FROM pg_indexes
--   WHERE schemaname = 'public'
--     AND indexname LIKE 'idx_%'
--   ORDER BY tablename, indexname;
--
--   -- Then confirm the chat page no longer seq-scans:
--   EXPLAIN (ANALYZE, BUFFERS)
--   SELECT id FROM public.messages
--   WHERE subchannel_id = '<uuid>' ORDER BY created_at DESC LIMIT 50;
-- =====================================================================
