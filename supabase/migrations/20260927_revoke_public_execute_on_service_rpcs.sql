-- =====================================================================
-- Migration: close public EXECUTE on service-only functions
-- =====================================================================
-- These functions move coins or XP, or delete data, and are meant to be
-- callable only by the server (service role). Their migrations did:
--
--     REVOKE ALL ON FUNCTION ... FROM PUBLIC;
--     GRANT EXECUTE ON FUNCTION ... TO service_role;
--
-- That is not enough on Supabase. The project's default privileges grant
-- EXECUTE on every new function in `public` DIRECTLY to `anon` and
-- `authenticated`, not via PUBLIC, so revoking from PUBLIC leaves both grants in
-- place. Confirmed against the live database with the public anon key (the key
-- in every browser bundle), which could call, among others:
--
--   process_stripe_topup      credit any user any amount, no Stripe payment
--   award_cpu_reward          credit any user any "reward"
--   settle_1v1_stake          pay any user any "winnings"
--   grant_weekly_level_bonus  credit any user any "bonus"
--   apply_xp                  add unlimited XP (level drives the weekly bonus)
--
-- None of them check the caller: they trust their grants. The ledger held no
-- rows of these types when this was found, so nothing had been exploited.
--
-- The fix is the pattern 20260914_lock_down_money_rpcs.sql already used for
-- credit_wallet / debit_wallet: revoke from PUBLIC *and* anon/authenticated
-- explicitly. It covers every overload by name, so a signature change can't
-- leave an old, still-callable version behind.
--
-- Every caller in the app uses the service-role admin client (lib/economy/
-- wallet.ts, lib/realtime/arena.ts, the Stripe webhook, the cron and queue
-- handlers), so nothing loses access it needs.
--
-- Verify afterwards: node scripts/db/check-rpc-grants.mjs
-- =====================================================================

BEGIN;

DO $$
DECLARE
  v_sig   text;
  v_count int := 0;
BEGIN
  FOR v_sig IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN (
         -- coins
         'process_stripe_topup',
         'award_cpu_reward',
         'settle_1v1_stake',
         'grant_weekly_level_bonus',
         'start_arena_stake',
         'refund_arena_stake',
         'credit_wallet',
         'debit_wallet',
         -- XP (sets level, which sizes the weekly bonus)
         'apply_xp',
         -- data deletion
         'cleanup_old_chat_data',
         -- realtime seat grants (20260926)
         'register_arena_channel_member'
       )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_sig);
    v_count := v_count + 1;
    RAISE NOTICE 'service-role only: %', v_sig;
  END LOOP;
  RAISE NOTICE 'locked down % function(s)', v_count;
END
$$;

-- The Realtime policy runs this as the joining user, so `authenticated` keeps
-- it. `anon` never needs it (the policy is TO authenticated), and it only ever
-- answers about auth.uid(), which is null for anon anyway.
REVOKE ALL ON FUNCTION public.is_arena_channel_member(text) FROM anon;

COMMIT;
