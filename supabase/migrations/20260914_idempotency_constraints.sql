-- =====================================================================
-- Idempotency constraints for the money paths
-- =====================================================================
-- The wallet RPCs all guarded themselves with an unlocked
-- `IF EXISTS (SELECT ...) THEN RETURN 'duplicate'` read. 20260914_lock_down_
-- money_rpcs.sql adds the advisory locks that make those reads correct, but a
-- lock is a convention: it only holds while every writer agrees to take it.
-- These indexes make the invariants structural, so a future code path, a
-- manual psql session, or a lock that is skipped cannot violate them.
--
--   1. transactions (user_id) WHERE type = 'SIGNUP_BONUS'
--        → at most one 500-Coin starter bonus per account, ever.
--          Doubles as the missing index for the guard's own predicate, which
--          had no index at all (transactions has only idempotency_key indexed).
--   2. transactions (stripe_session_id) WHERE NOT NULL
--        → at-most-once credit per Stripe checkout session. Stripe delivers
--          at-least-once and retries, so this is a live risk, not a theoretical
--          one.
--   3. unlocked_picks (user_id, betslip_id)
--        → a pick is bought at most once per buyer; blocks the double-charge.
--
-- IMPORTANT — pre-existing duplicates
-- Each index is created inside its own exception-handling block. If the live
-- table already contains duplicates (i.e. the race has already been exercised
-- in production), the CREATE fails, the block rolls back to its savepoint, and
-- the migration continues after printing the offending rows. Reconciling
-- historical duplicates changes user balances, so that is deliberately left as
-- an explicit operator decision rather than something this file does silently.
-- Re-run this migration after reconciling; it is idempotent.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. One signup bonus per user
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_dupes text;
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_signup_bonus
    ON public.transactions (user_id)
    WHERE type = 'SIGNUP_BONUS';
  RAISE NOTICE 'ok: uq_transactions_signup_bonus';
EXCEPTION
  WHEN unique_violation THEN
    SELECT string_agg(format('user_id=%s x%s', user_id, cnt), ', ')
      INTO v_dupes
      FROM (
        SELECT user_id, count(*) AS cnt
        FROM public.transactions
        WHERE type = 'SIGNUP_BONUS'
        GROUP BY user_id
        HAVING count(*) > 1
      ) d;
    RAISE WARNING
      'SKIPPED uq_transactions_signup_bonus — duplicate signup bonuses already exist: %. '
      'Reconcile the balances, delete the surplus ledger rows, then re-run this migration.',
      COALESCE(v_dupes, '(unknown)');
END
$$;

-- ---------------------------------------------------------------------
-- 2. One credit per Stripe checkout session
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_dupes text;
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_stripe_session
    ON public.transactions (stripe_session_id)
    WHERE stripe_session_id IS NOT NULL;
  RAISE NOTICE 'ok: uq_transactions_stripe_session';
EXCEPTION
  WHEN unique_violation THEN
    SELECT string_agg(format('session=%s x%s', stripe_session_id, cnt), ', ')
      INTO v_dupes
      FROM (
        SELECT stripe_session_id, count(*) AS cnt
        FROM public.transactions
        WHERE stripe_session_id IS NOT NULL
        GROUP BY stripe_session_id
        HAVING count(*) > 1
      ) d;
    RAISE WARNING
      'SKIPPED uq_transactions_stripe_session — double-credited Stripe sessions already exist: %. '
      'Reconcile, then re-run this migration.',
      COALESCE(v_dupes, '(unknown)');
END
$$;

-- ---------------------------------------------------------------------
-- 3. One unlock per (buyer, betslip)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_dupes text;
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS uq_unlocked_picks_user_betslip
    ON public.unlocked_picks (user_id, betslip_id);
  RAISE NOTICE 'ok: uq_unlocked_picks_user_betslip';
EXCEPTION
  WHEN unique_violation THEN
    SELECT string_agg(format('user=%s betslip=%s x%s', user_id, betslip_id, cnt), ', ')
      INTO v_dupes
      FROM (
        SELECT user_id, betslip_id, count(*) AS cnt
        FROM public.unlocked_picks
        GROUP BY user_id, betslip_id
        HAVING count(*) > 1
      ) d;
    RAISE WARNING
      'SKIPPED uq_unlocked_picks_user_betslip — duplicate unlocks already exist: %. '
      'Refund the surplus PURCHASE rows, delete the duplicates, then re-run this migration.',
      COALESCE(v_dupes, '(unknown)');
END
$$;

-- ---------------------------------------------------------------------
-- 4. Sanity floor on the social-feed counters
-- ---------------------------------------------------------------------
-- update_post_like_count / update_post_comment_count (20250528_create_social_
-- feed.sql:71-101) decrement unconditionally on DELETE, so any delete without
-- a matching insert drives the counter negative. Cheap to make impossible.
DO $$
BEGIN
  ALTER TABLE public.posts
    ADD CONSTRAINT posts_like_count_non_negative CHECK (like_count >= 0) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE public.posts
    ADD CONSTRAINT posts_comment_count_non_negative CHECK (comment_count >= 0) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Validate separately so the ADD doesn't need a full-table exclusive scan.
-- Skips (with a warning) if historical rows are already negative.
DO $$
BEGIN
  ALTER TABLE public.posts VALIDATE CONSTRAINT posts_like_count_non_negative;
  ALTER TABLE public.posts VALIDATE CONSTRAINT posts_comment_count_non_negative;
EXCEPTION
  WHEN check_violation THEN
    RAISE WARNING 'posts counters contain negative values; constraints left NOT VALID. '
                  'Fix with: UPDATE public.posts SET like_count = GREATEST(like_count, 0), '
                  'comment_count = GREATEST(comment_count, 0);';
END
$$;

COMMIT;

-- =====================================================================
-- Post-deployment verification (run manually):
--
--   SELECT indexname FROM pg_indexes
--   WHERE schemaname = 'public'
--     AND indexname IN ('uq_transactions_signup_bonus',
--                       'uq_transactions_stripe_session',
--                       'uq_unlocked_picks_user_betslip');
--   -- expect all three
--
--   -- No user should ever have more than one:
--   SELECT user_id, count(*) FROM public.transactions
--   WHERE type = 'SIGNUP_BONUS' GROUP BY user_id HAVING count(*) > 1;
-- =====================================================================
