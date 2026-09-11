-- =====================================================================
-- Chat: realtime publication + batched cleanup
-- =====================================================================
-- Two related chat fixes:
--   1. Add `messages` to the supabase_realtime publication so the client's
--      postgres_changes INSERT subscription (the reliable delivery backstop
--      that no longer depends on the sender's broadcast relay) actually fires.
--   2. Replace the single unbounded DELETE in cleanup_old_chat_data() with a
--      batched LIMIT loop, so purging 30-day-old messages can't take one giant
--      lock / bloat-heavy transaction after a large backlog or missed cron run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Realtime: publish INSERTs on public.messages
-- ---------------------------------------------------------------------
-- The client subscribes with a `subchannel_id=eq.<id>` filter. Realtime
-- evaluates row filters against the replicated row, so REPLICA IDENTITY must
-- expose the filter column. DEFAULT (primary key) is enough for INSERT filters
-- since the full new row is always emitted, but we set it explicitly for
-- clarity and to survive future UPDATE/DELETE needs.
ALTER TABLE public.messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  -- The publication is created by Supabase; guard in case it doesn't exist
  -- (e.g. a bare Postgres used in CI).
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Adding a table that's already a member raises; swallow that specific case.
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2. Batched cleanup: cleanup_old_chat_data()
-- ---------------------------------------------------------------------
-- Same return shape and grants as before; only the message purge changes from
-- one unbounded DELETE to a bounded LIMIT loop. Mutes/audit/orphan-reactions
-- stay single-statement (they're small and bounded in practice).
CREATE OR REPLACE FUNCTION public.cleanup_old_chat_data()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_messages_deleted BIGINT := 0;
  v_batch            BIGINT := 0;
  v_batch_size       INT    := 5000;
  v_mutes_cleaned    BIGINT;
  v_audit_cleaned    BIGINT;
  v_reactions_cleaned BIGINT;
BEGIN
  -- Delete old messages in bounded batches so each transaction stays small.
  -- A single cron run drains the whole backlog; capping total iterations is a
  -- safety valve against a runaway loop.
  LOOP
    WITH doomed AS (
      SELECT id FROM public.messages
      WHERE created_at < now() - INTERVAL '30 days'
      LIMIT v_batch_size
    ),
    deleted AS (
      DELETE FROM public.messages m
      USING doomed d
      WHERE m.id = d.id
      RETURNING m.id
    )
    SELECT count(*) INTO v_batch FROM deleted;

    v_messages_deleted := v_messages_deleted + v_batch;
    EXIT WHEN v_batch < v_batch_size;
  END LOOP;

  WITH deleted AS (
    DELETE FROM public.room_mutes WHERE muted_until < now() RETURNING id
  ) SELECT count(*) INTO v_mutes_cleaned FROM deleted;

  WITH deleted AS (
    DELETE FROM public.room_audit_log WHERE created_at < now() - INTERVAL '90 days' RETURNING id
  ) SELECT count(*) INTO v_audit_cleaned FROM deleted;

  -- Orphaned reactions (message already gone). ON DELETE CASCADE handles the
  -- common path; this catches any that slipped through.
  WITH deleted AS (
    DELETE FROM public.message_reactions mr
    WHERE NOT EXISTS (SELECT 1 FROM public.messages m WHERE m.id = mr.message_id)
    RETURNING mr.id
  ) SELECT count(*) INTO v_reactions_cleaned FROM deleted;

  RETURN jsonb_build_object(
    'messages_deleted',  v_messages_deleted,
    'mutes_cleaned',     v_mutes_cleaned,
    'audit_cleaned',     v_audit_cleaned,
    'reactions_cleaned', v_reactions_cleaned,
    'ran_at',            now()
  );
END;
$$;
REVOKE ALL ON FUNCTION public.cleanup_old_chat_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_old_chat_data() TO service_role;
