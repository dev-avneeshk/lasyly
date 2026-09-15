-- =====================================================================
-- Indexes to drive the retention deletes
-- =====================================================================
--
--   ⚠ psql ONLY — cannot be pasted into the Supabase SQL Editor, which wraps
--   submissions in a transaction and so rejects CONCURRENTLY with
--   "ERROR: 25001: CREATE INDEX CONCURRENTLY cannot run inside a transaction
--   block". Use scripts/db/apply-migration.sh, or apply
--   supabase/migrations/20260916_indexes_no_concurrent.sql (which contains
--   these same indexes plus the hot-path ones, without CONCURRENTLY) instead.
--
-- NO BEGIN/COMMIT: CREATE INDEX CONCURRENTLY cannot run inside a transaction
-- block. See 20260914_hot_path_indexes.sql for the same note.
--
-- A retention job without an index on its predicate is a repeated sequential
-- scan of the largest table in the schema, which is worse than no retention at
-- all — it runs every night, competes with live traffic, and gets slower as the
-- table it is meant to shrink grows. Each index below backs exactly one delete
-- predicate in cleanup_expired_data() / cleanup_old_chat_data().
--
-- Partial where possible, so the index only covers rows that are candidates for
-- deletion and stays small even as the table grows.
-- =====================================================================

-- notifications: two predicates — read-and-old, and just-old.
-- The is_read=true partial index is what the 30-day pass uses; the plain
-- created_at index covers the 90-day sweep.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_read_created
  ON public.notifications (created_at)
  WHERE is_read = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_created
  ON public.notifications (created_at);

-- prop_line_history already has idx_line_history_recorded (recorded_at DESC);
-- a DESC index serves a `<` range scan fine, so nothing new is needed.

-- prop_votes: only (prop_identifier, vote_date) and (user_id) existed, neither
-- of which can drive `WHERE vote_date < …`.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prop_votes_vote_date
  ON public.prop_votes (vote_date);

-- ai_writeup_cache: idx_writeup_cache_expires already exists (and was never
-- used, because nothing ever deleted expired rows).

-- correlations_cache: had three indexes, none on computed_at.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_correlations_computed_at
  ON public.correlations_cache (computed_at);

-- espn_player_stats / matches: match_date indexes were added in
-- 20260914_hot_path_indexes.sql (espn) — matches already has idx_matches_date.

-- espn_news already has idx_espn_news_published (published_at DESC).

-- subchannel_join_requests: the only index was a partial on status='pending',
-- i.e. exactly the rows retention does NOT touch.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subchannel_requests_decided
  ON public.subchannel_join_requests (decided_at)
  WHERE status <> 'pending';

-- room_audit_log: pruned at 90 days by cleanup_old_chat_data with no supporting
-- index.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_room_audit_log_created
  ON public.room_audit_log (created_at);

-- room_mutes: cleanup deletes `WHERE muted_until < now()`. The existing
-- idx_room_mutes_lookup leads with (room_id, user_id), so it can't drive this.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_room_mutes_expiry
  ON public.room_mutes (muted_until);

-- message_reactions orphan sweep does `WHERE NOT EXISTS (… messages …)`, which
-- is an anti-join over the whole table by construction. idx_reactions_message
-- already provides the probe side; nothing more to add.

-- =====================================================================
-- Post-deployment verification (run manually):
--
--   SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;  -- expect none
--
--   -- Each of these should be an Index Scan, not a Seq Scan:
--   EXPLAIN DELETE FROM public.notifications
--     WHERE is_read = true AND created_at < now() - INTERVAL '30 days';
--   EXPLAIN DELETE FROM public.prop_votes
--     WHERE vote_date < (now() - INTERVAL '180 days')::date;
-- =====================================================================
