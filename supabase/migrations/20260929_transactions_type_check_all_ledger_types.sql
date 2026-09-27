-- =====================================================================
-- Migration: let the ledger accept every type the app writes
-- =====================================================================
-- The live database has a CHECK constraint, transactions_type_check, that is
-- not defined in any file in supabase/migrations (schema drift). Probing it
-- showed it allows the original types (TOP_UP, PURCHASE, EARNING, WITHDRAWAL)
-- and rejects everything added since:
--
--     SIGNUP_BONUS        grant_signup_bonus           (20260912 / 20260921)
--     ARENA_ENTRY         start_arena_stake (CPU)      (20260921)
--     ARENA_STAKE         start_arena_stake (1v1)
--     ARENA_REWARD        award_cpu_reward
--     ARENA_WINNINGS      settle_1v1_stake
--     ARENA_REFUND        refund_arena_stake
--     WEEKLY_LEVEL_BONUS  grant_weekly_level_bonus
--
-- So no account has ever received its starter Coins, and every arena stake,
-- reward, payout, refund and weekly bonus fails with:
--
--     new row for relation "transactions" violates check constraint
--     "transactions_type_check"
--
-- The full live definition can't be read from the API, so rather than
-- hard-coding a replacement (and silently dropping a value nobody probed for),
-- this reads the current constraint, keeps every value already in it, and adds
-- the missing ones. It prints the before and after definitions.
--
-- The ledger was empty when this was written; either way, widening a CHECK can
-- only ever accept more rows, so no existing row can fail it.
-- =====================================================================

BEGIN;

DO $$
DECLARE
  v_required text[] := ARRAY[
    -- already allowed, listed so the constraint is self-describing
    'TOP_UP', 'PURCHASE', 'EARNING', 'WITHDRAWAL',
    -- missing
    'SIGNUP_BONUS',
    'ARENA_ENTRY', 'ARENA_STAKE', 'ARENA_REWARD', 'ARENA_WINNINGS', 'ARENA_REFUND',
    'WEEKLY_LEVEL_BONUS'
  ];
  v_def      text;
  v_existing text[] := ARRAY[]::text[];
  v_allowed  text[];
  v_list     text;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO v_def
    FROM pg_constraint c
   WHERE c.conrelid = 'public.transactions'::regclass
     AND c.conname = 'transactions_type_check';

  IF v_def IS NOT NULL THEN
    RAISE NOTICE 'current: %', v_def;
    -- Every quoted literal in the current definition, e.g. 'TOP_UP'::text.
    SELECT coalesce(array_agg(DISTINCT m[1]), ARRAY[]::text[]) INTO v_existing
      FROM regexp_matches(v_def, '''([^'']+)''', 'g') AS m;
    ALTER TABLE public.transactions DROP CONSTRAINT transactions_type_check;
  ELSE
    RAISE NOTICE 'no transactions_type_check found; creating one';
  END IF;

  SELECT array_agg(DISTINCT t ORDER BY t) INTO v_allowed
    FROM unnest(v_existing || v_required) AS t;

  SELECT string_agg(quote_literal(t), ', ' ORDER BY t) INTO v_list FROM unnest(v_allowed) AS t;

  EXECUTE format(
    'ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check CHECK (type IN (%s))',
    v_list
  );

  RAISE NOTICE 'new: CHECK (type IN (%))', v_list;
  RAISE NOTICE 'kept from the old constraint: %', v_existing;
END
$$;

COMMIT;
