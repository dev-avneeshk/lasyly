-- =====================================================================
-- Retention for the append-only tables
-- =====================================================================
-- Roughly two dozen tables grew without any pruning. Storage cost is the least
-- of it: unbounded tables inflate index size, degrade planner estimates, and
-- lengthen every VACUUM, so the tables that hurt most are the ones on hot read
-- paths (notifications is polled every 30s per user; prop_line_history and
-- espn_player_stats are written by scrapers on a 10-minute cadence).
--
-- ── Batching that actually batches ──────────────────────────────────────────
-- cleanup_old_chat_data() (20260913) bounds each DELETE to 5,000 rows but runs
-- the whole LOOP inside one function call — which is one transaction. Locks and
-- dead tuples therefore accumulate across every batch until the function
-- returns, which is the opposite of what the batching was for. Its own comment
-- ("each transaction stays small") does not match plpgsql semantics.
--
-- Both functions here do ONE bounded pass per call and report `has_more`. The
-- caller (app/api/cron/retention/route.ts) loops, so each pass is a separate
-- transaction that commits and releases its locks. cleanup_old_chat_data is
-- rewritten to the same shape.
--
-- ── Deliberately NOT pruned ─────────────────────────────────────────────────
--   transactions, unlocked_picks — financial ledger. Append-only on purpose.
--   nba_ranking_history        — documented in 20260906 as immutable
--                                ("Rows are NEVER updated or deleted"). Bounding
--                                it means choosing how many historical versions
--                                to keep, which is a product decision, not a
--                                cleanup one. Flagged, not changed.
--   room_bans                  — a ban with no expiry is intentional state.
--   push_subscriptions         — dead endpoints can't be detected in SQL; they
--                                are pruned at send time when Web Push returns
--                                404/410 (see lib/push.ts).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. cleanup_expired_data() — one bounded pass, caller loops
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_expired_data(p_batch_size int DEFAULT 2000)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_batch      int := GREATEST(1, LEAST(p_batch_size, 10000));
  v_counts     jsonb := '{}'::jsonb;
  v_n          bigint;
  v_has_more   boolean := false;
BEGIN
  -- ── notifications ────────────────────────────────────────────────────────
  -- Read notifications are dead weight after a month; unread ones get longer,
  -- because "unread" is the only reason the row still matters.
  WITH doomed AS (
    SELECT id FROM public.notifications
    WHERE is_read = true AND created_at < now() - INTERVAL '30 days'
    LIMIT v_batch
  ), del AS (
    DELETE FROM public.notifications n USING doomed d WHERE n.id = d.id RETURNING n.id
  ) SELECT count(*) INTO v_n FROM del;
  v_counts := v_counts || jsonb_build_object('notifications_read', v_n);
  IF v_n >= v_batch THEN v_has_more := true; END IF;

  WITH doomed AS (
    SELECT id FROM public.notifications
    WHERE created_at < now() - INTERVAL '90 days'
    LIMIT v_batch
  ), del AS (
    DELETE FROM public.notifications n USING doomed d WHERE n.id = d.id RETURNING n.id
  ) SELECT count(*) INTO v_n FROM del;
  v_counts := v_counts || jsonb_build_object('notifications_old', v_n);
  IF v_n >= v_batch THEN v_has_more := true; END IF;

  -- ── prop_line_history (scraper time series) ───────────────────────────────
  WITH doomed AS (
    SELECT id FROM public.prop_line_history
    WHERE recorded_at < now() - INTERVAL '90 days'
    LIMIT v_batch
  ), del AS (
    DELETE FROM public.prop_line_history t USING doomed d WHERE t.id = d.id RETURNING t.id
  ) SELECT count(*) INTO v_n FROM del;
  v_counts := v_counts || jsonb_build_object('prop_line_history', v_n);
  IF v_n >= v_batch THEN v_has_more := true; END IF;

  -- ── prop_votes (one row per user/prop/day, forever) ───────────────────────
  WITH doomed AS (
    SELECT id FROM public.prop_votes
    WHERE vote_date < (now() - INTERVAL '180 days')::date
    LIMIT v_batch
  ), del AS (
    DELETE FROM public.prop_votes t USING doomed d WHERE t.id = d.id RETURNING t.id
  ) SELECT count(*) INTO v_n FROM del;
  v_counts := v_counts || jsonb_build_object('prop_votes', v_n);
  IF v_n >= v_batch THEN v_has_more := true; END IF;

  -- ── ai_writeup_cache: it HAS expires_at and an index for it, and nothing
  --    ever deleted a single expired row. ─────────────────────────────────────
  WITH doomed AS (
    SELECT id FROM public.ai_writeup_cache
    WHERE expires_at < now()
    LIMIT v_batch
  ), del AS (
    DELETE FROM public.ai_writeup_cache t USING doomed d WHERE t.id = d.id RETURNING t.id
  ) SELECT count(*) INTO v_n FROM del;
  v_counts := v_counts || jsonb_build_object('ai_writeup_cache', v_n);
  IF v_n >= v_batch THEN v_has_more := true; END IF;

  -- ── correlations_cache (recomputed daily; no TTL column existed) ──────────
  WITH doomed AS (
    SELECT id FROM public.correlations_cache
    WHERE computed_at < now() - INTERVAL '30 days'
    LIMIT v_batch
  ), del AS (
    DELETE FROM public.correlations_cache t USING doomed d WHERE t.id = d.id RETURNING t.id
  ) SELECT count(*) INTO v_n FROM del;
  v_counts := v_counts || jsonb_build_object('correlations_cache', v_n);
  IF v_n >= v_batch THEN v_has_more := true; END IF;

  -- ── espn_player_stats (per game per athlete — the fastest grower) ─────────
  WITH doomed AS (
    SELECT id FROM public.espn_player_stats
    WHERE match_date < (now() - INTERVAL '400 days')::date
    LIMIT v_batch
  ), del AS (
    DELETE FROM public.espn_player_stats t USING doomed d WHERE t.id = d.id RETURNING t.id
  ) SELECT count(*) INTO v_n FROM del;
  v_counts := v_counts || jsonb_build_object('espn_player_stats', v_n);
  IF v_n >= v_batch THEN v_has_more := true; END IF;

  -- ── espn_news ─────────────────────────────────────────────────────────────
  WITH doomed AS (
    SELECT id FROM public.espn_news
    WHERE published_at < now() - INTERVAL '120 days'
    LIMIT v_batch
  ), del AS (
    DELETE FROM public.espn_news t USING doomed d WHERE t.id = d.id RETURNING t.id
  ) SELECT count(*) INTO v_n FROM del;
  v_counts := v_counts || jsonb_build_object('espn_news', v_n);
  IF v_n >= v_batch THEN v_has_more := true; END IF;

  -- ── matches (legacy live-scores mirror) ───────────────────────────────────
  WITH doomed AS (
    SELECT id FROM public.matches
    WHERE match_date < (now() - INTERVAL '400 days')::date
    LIMIT v_batch
  ), del AS (
    DELETE FROM public.matches t USING doomed d WHERE t.id = d.id RETURNING t.id
  ) SELECT count(*) INTO v_n FROM del;
  v_counts := v_counts || jsonb_build_object('matches', v_n);
  IF v_n >= v_batch THEN v_has_more := true; END IF;

  -- ── subchannel_join_requests: decided requests are historical noise ───────
  WITH doomed AS (
    SELECT id FROM public.subchannel_join_requests
    WHERE status <> 'pending' AND COALESCE(decided_at, requested_at) < now() - INTERVAL '30 days'
    LIMIT v_batch
  ), del AS (
    DELETE FROM public.subchannel_join_requests t USING doomed d WHERE t.id = d.id RETURNING t.id
  ) SELECT count(*) INTO v_n FROM del;
  v_counts := v_counts || jsonb_build_object('subchannel_join_requests', v_n);
  IF v_n >= v_batch THEN v_has_more := true; END IF;

  RETURN v_counts || jsonb_build_object('has_more', v_has_more, 'ran_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_data(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_data(int) TO service_role;

-- ---------------------------------------------------------------------
-- 2. cleanup_old_chat_data(): one bounded pass instead of an internal LOOP
-- ---------------------------------------------------------------------
-- Same return keys as before (the cron route reads them), plus `has_more`.
--
-- The zero-argument version MUST be dropped, not just replaced: adding a
-- parameter creates a new overload rather than superseding the old one, and
-- PostgREST's `rpc("cleanup_old_chat_data")` with no arguments would keep
-- resolving to the exact zero-arg match — i.e. the old unbatched function, which
-- would still drain the entire backlog in one transaction.
DROP FUNCTION IF EXISTS public.cleanup_old_chat_data();

CREATE OR REPLACE FUNCTION public.cleanup_old_chat_data(p_batch_size int DEFAULT 5000)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_batch             int := GREATEST(1, LEAST(p_batch_size, 20000));
  v_messages_deleted  bigint := 0;
  v_mutes_cleaned     bigint := 0;
  v_audit_cleaned     bigint := 0;
  v_reactions_cleaned bigint := 0;
BEGIN
  -- ONE bounded pass. The previous version looped internally, which meant the
  -- whole backlog was drained inside a single transaction — the batching bought
  -- nothing because no batch ever committed on its own.
  WITH doomed AS (
    SELECT id FROM public.messages
    WHERE created_at < now() - INTERVAL '30 days'
    LIMIT v_batch
  ),
  deleted AS (
    DELETE FROM public.messages m
    USING doomed d
    WHERE m.id = d.id
    RETURNING m.id
  )
  SELECT count(*) INTO v_messages_deleted FROM deleted;

  WITH deleted AS (
    DELETE FROM public.room_mutes WHERE muted_until < now() RETURNING id
  ) SELECT count(*) INTO v_mutes_cleaned FROM deleted;

  WITH deleted AS (
    DELETE FROM public.room_audit_log WHERE created_at < now() - INTERVAL '90 days' RETURNING id
  ) SELECT count(*) INTO v_audit_cleaned FROM deleted;

  -- Orphaned reactions (message already gone). ON DELETE CASCADE handles the
  -- common path; this catches any that slipped through.
  WITH doomed AS (
    SELECT mr.id FROM public.message_reactions mr
    WHERE NOT EXISTS (SELECT 1 FROM public.messages m WHERE m.id = mr.message_id)
    LIMIT v_batch
  ),
  deleted AS (
    DELETE FROM public.message_reactions mr USING doomed d WHERE mr.id = d.id RETURNING mr.id
  ) SELECT count(*) INTO v_reactions_cleaned FROM deleted;

  RETURN jsonb_build_object(
    'messages_deleted',  v_messages_deleted,
    'mutes_cleaned',     v_mutes_cleaned,
    'audit_cleaned',     v_audit_cleaned,
    'reactions_cleaned', v_reactions_cleaned,
    'has_more',          v_messages_deleted >= v_batch OR v_reactions_cleaned >= v_batch,
    'ran_at',            now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_old_chat_data(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_old_chat_data(int) TO service_role;

COMMIT;

-- =====================================================================
-- Post-deployment verification (run manually):
--
--   SELECT public.cleanup_expired_data(100);   -- expect a jsonb summary
--   -- has_more=true means run it again; the cron route loops for you.
--
--   -- Confirm nothing accumulates any more:
--   SELECT 'notifications' t, count(*) FROM public.notifications
--     WHERE is_read AND created_at < now() - INTERVAL '31 days'
--   UNION ALL SELECT 'ai_writeup_cache', count(*) FROM public.ai_writeup_cache
--     WHERE expires_at < now();
--   -- both should trend to 0 after a few cron runs
-- =====================================================================
