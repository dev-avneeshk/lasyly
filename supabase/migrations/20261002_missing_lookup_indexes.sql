-- =====================================================================
-- Migration: two missing lookup indexes (audit DB-03, DB-07)
-- =====================================================================
-- Additive and idempotent. Plain CREATE INDEX (not CONCURRENTLY) so it runs in
-- the SQL editor's transaction; both tables are small enough for a brief lock.
--
-- DB-03: /api/scores/[eventId]/summary now looks matches up by exact event_id
--        (it used an unanchored LIKE); there was no index on event_id.
-- DB-07: idx_room_audit_log_created already existed as a different (composite)
--        index, so the retention migrations' IF NOT EXISTS silently skipped the
--        created_at index that cleanup_old_chat_data's 90-day prune needs.
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_matches_event_id ON public.matches (event_id);
CREATE INDEX IF NOT EXISTS idx_room_audit_log_created_at ON public.room_audit_log (created_at);

-- Verify (read-only):
--   SELECT indexname, indexdef FROM pg_indexes
--    WHERE indexname IN ('idx_matches_event_id', 'idx_room_audit_log_created_at');
