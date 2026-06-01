-- =====================================================================
-- Migration: Chat Cleanup, Mute System, and Performance
-- =====================================================================
-- 1. Auto-delete messages older than 30 days (pg_cron or manual trigger)
-- 2. Muted members table (timed mutes)
-- 3. Indexes for message pagination performance
-- 4. Function to purge old messages (called by cron job)
-- 5. Function to check if user is muted
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Muted Members Table
-- ---------------------------------------------------------------------
-- Admins can mute users for a duration. Muted users cannot send messages.

CREATE TABLE IF NOT EXISTS public.room_mutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  muted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  muted_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

ALTER TABLE public.room_mutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "room_mutes_select"
  ON public.room_mutes FOR SELECT
  USING (
    public.is_room_admin(room_id, auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "room_mutes_insert_admin"
  ON public.room_mutes FOR INSERT
  WITH CHECK (
    public.is_room_admin(room_id, auth.uid())
  );

CREATE POLICY "room_mutes_delete_admin"
  ON public.room_mutes FOR DELETE
  USING (
    public.is_room_admin(room_id, auth.uid())
  );

-- Index for fast mute lookups
CREATE INDEX IF NOT EXISTS idx_room_mutes_lookup
  ON public.room_mutes(room_id, user_id, muted_until);

-- ---------------------------------------------------------------------
-- 2. Helper: Check if user is muted
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_room_muted(p_room_id UUID, p_user_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_mutes
    WHERE room_id = p_room_id
      AND user_id = p_user_id
      AND muted_until > now()
  );
$$;

REVOKE ALL ON FUNCTION public.is_room_muted(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_room_muted(UUID, UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. Purge Old Messages Function
-- ---------------------------------------------------------------------
-- Deletes messages older than 30 days. Called by background job.
-- Also cleans up expired mutes and old audit logs (90 days).

CREATE OR REPLACE FUNCTION public.cleanup_old_chat_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_messages_deleted BIGINT;
  v_mutes_cleaned BIGINT;
  v_audit_cleaned BIGINT;
  v_reactions_cleaned BIGINT;
BEGIN
  -- Delete messages older than 30 days
  WITH deleted AS (
    DELETE FROM public.messages
    WHERE created_at < now() - INTERVAL '30 days'
    RETURNING id
  )
  SELECT count(*) INTO v_messages_deleted FROM deleted;

  -- Clean up expired mutes
  WITH deleted AS (
    DELETE FROM public.room_mutes
    WHERE muted_until < now()
    RETURNING id
  )
  SELECT count(*) INTO v_mutes_cleaned FROM deleted;

  -- Clean up audit logs older than 90 days
  WITH deleted AS (
    DELETE FROM public.room_audit_log
    WHERE created_at < now() - INTERVAL '90 days'
    RETURNING id
  )
  SELECT count(*) INTO v_audit_cleaned FROM deleted;

  -- Clean up orphaned reactions (message no longer exists)
  WITH deleted AS (
    DELETE FROM public.message_reactions mr
    WHERE NOT EXISTS (
      SELECT 1 FROM public.messages m WHERE m.id = mr.message_id
    )
    RETURNING mr.id
  )
  SELECT count(*) INTO v_reactions_cleaned FROM deleted;

  RETURN jsonb_build_object(
    'messages_deleted', v_messages_deleted,
    'mutes_cleaned', v_mutes_cleaned,
    'audit_cleaned', v_audit_cleaned,
    'reactions_cleaned', v_reactions_cleaned,
    'ran_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_old_chat_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_old_chat_data() TO service_role;

-- ---------------------------------------------------------------------
-- 4. Performance Indexes for Message Pagination
-- ---------------------------------------------------------------------

-- Composite index for cursor-based pagination (room + created_at DESC)
CREATE INDEX IF NOT EXISTS idx_messages_room_created
  ON public.messages(room_id, created_at DESC);

-- Index for message reactions lookup
CREATE INDEX IF NOT EXISTS idx_message_reactions_message
  ON public.message_reactions(message_id);

-- Partial index for pinned messages (only non-deleted)
CREATE INDEX IF NOT EXISTS idx_pinned_messages_room_pinned
  ON public.pinned_messages(room_id, pinned_at DESC);

-- ---------------------------------------------------------------------
-- 5. Connection Pooling Note
-- ---------------------------------------------------------------------
-- Supabase already provides PgBouncer connection pooling on port 6543.
-- The app uses the Supabase JS client which goes through the REST API
-- (PostgREST), which has its own connection pool. No additional config
-- needed at the application layer.
--
-- For direct DB connections (if ever needed), use:
--   DATABASE_URL with ?pgbouncer=true&connection_limit=1

COMMIT;
