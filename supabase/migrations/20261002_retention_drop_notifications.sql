-- =====================================================================
-- Migration: retention without the removed notifications feature (audit DB-05)
-- =====================================================================
-- 20260915_retention.sql had been emptied in place after it was applied, so a
-- fresh database never got cleanup_expired_data / cleanup_old_chat_data and the
-- retention cron failed. That file is restored verbatim (history must not be
-- edited); this forward migration redefines cleanup_expired_data without the
-- notifications passes, since the notifications feature was removed. Same
-- signature and return keys minus notifications_*; idempotent (CREATE OR
-- REPLACE). The notifications table itself is left alone.
-- =====================================================================
BEGIN;

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

COMMIT;
