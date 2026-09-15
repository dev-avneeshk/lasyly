-- =====================================================================
-- Lock down the SECURITY DEFINER money RPCs
-- =====================================================================
-- Every function below is SECURITY DEFINER, which means it runs as the owner
-- and bypasses RLS *and* the table-level `REVOKE INSERT ON transactions FROM
-- authenticated` hardening in 20260522_security_rls_baseline.sql. Any such
-- function that (a) is granted to `authenticated` and (b) takes the acting
-- user as a *parameter* is a privilege-escalation hole, because PostgREST
-- exposes it at POST /rest/v1/rpc/<name> to any browser holding a valid
-- session. The Next.js API routes, the proxy, and every rate limit are simply
-- not in the path.
--
-- Three concrete holes this migration closes:
--
--   1. credit_wallet / debit_wallet (20250527_wallet_double_spend_protection)
--      were GRANTed to `authenticated` and never referenced by application
--      code. `credit_wallet(p_user_id, p_amount, ...)` with no auth.uid()
--      check is an unlimited money printer; `debit_wallet` lets anyone zero
--      out another user's balance.
--
--   2. purchase_pick (20260522:746) is GRANTed to `authenticated` and trusts
--      p_buyer_id. The route correctly passes auth.uid(), but a direct RPC
--      call can name any victim as the buyer — list your own betslip at an
--      arbitrary price, then charge someone else's wallet into your own.
--
--   3. grant_signup_bonus (20260912:64) is GRANTed to `authenticated` and
--      trusts p_user_id, so the 500-Coin bonus can be granted to any account.
--
-- Separately, all three (plus process_stripe_topup) perform their duplicate
-- checks as an unlocked SELECT *before* taking any lock — a textbook TOCTOU.
-- Concurrent callers all read "no row yet" and all commit. This migration
-- adds a per-user advisory lock ahead of the check and, in the companion
-- migration 20260914_idempotency_constraints.sql, the unique indexes that
-- make the invariant enforceable rather than merely intended. The functions
-- here also trap unique_violation so a lost race degrades to a clean
-- 'duplicate' instead of a 500.
--
-- Actor resolution: `auth.uid()` is NULL for the service-role key, so each
-- function accepts a service-role caller (Stripe webhook, background jobs,
-- future admin tooling) and only enforces the auth.uid() match for ordinary
-- authenticated callers.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Helper: is the current caller the service role?
-- ---------------------------------------------------------------------
-- PostgREST puts the JWT's `role` claim on the request. The service-role key
-- carries role='service_role'; a normal user carries role='authenticated'.
-- Direct psql/superuser sessions have no JWT at all, which we also treat as
-- privileged (that's the migration/ops path).
CREATE OR REPLACE FUNCTION public.is_service_caller()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT auth.jwt() ->> 'role') = 'service_role',
    true  -- no JWT (psql / cron / superuser) → privileged
  );
$$;

REVOKE ALL ON FUNCTION public.is_service_caller() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_service_caller() TO authenticated, anon, service_role;

-- ---------------------------------------------------------------------
-- 1. credit_wallet / debit_wallet: remove them from the browser's reach
-- ---------------------------------------------------------------------
-- Neither is called anywhere in the application (grep: only purchase_pick,
-- process_stripe_topup, grant_signup_bonus and get_my_wallet_balance are).
-- They keep their advisory-lock + FOR UPDATE + idempotency_key implementation,
-- which is genuinely correct — they just must not be callable by users.
DO $$
DECLARE
  v_sig text;
BEGIN
  FOR v_sig IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('credit_wallet', 'debit_wallet')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', v_sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated', v_sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_sig);
    RAISE NOTICE 'locked down %', v_sig;
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------
-- 2. purchase_pick: buyer is auth.uid(), never a parameter
-- ---------------------------------------------------------------------
-- Signature is unchanged so app/api/picks/unlock/route.ts keeps working, but
-- p_buyer_id is now *verified* against the session rather than trusted. New
-- return codes: 'unauthenticated', 'forbidden'.
CREATE OR REPLACE FUNCTION public.purchase_pick(
  p_buyer_id uuid,
  p_betslip_id uuid,
  p_tipster_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_betslip_owner uuid;
  v_is_for_sale boolean;
  v_price numeric;
  v_buyer_balance numeric;
  v_tipster_cut numeric;
  v_lock_key bigint;
BEGIN
  -- Authorization: an ordinary caller may only ever spend their OWN wallet.
  IF NOT public.is_service_caller() THEN
    IF v_actor IS NULL THEN
      RETURN 'unauthenticated';
    END IF;
    IF v_actor <> p_buyer_id THEN
      RETURN 'forbidden';
    END IF;
  END IF;

  IF p_buyer_id = p_tipster_id THEN
    RETURN 'self_purchase';
  END IF;

  -- Serialize everything this buyer does, so the already-unlocked check below
  -- cannot be raced by a second concurrent purchase of the same betslip.
  v_lock_key := ('x' || left(replace(p_buyer_id::text, '-', ''), 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT user_id, is_for_sale, price
    INTO v_betslip_owner, v_is_for_sale, v_price
    FROM public.betslips
   WHERE id = p_betslip_id;

  IF v_betslip_owner IS NULL OR v_is_for_sale IS NOT TRUE THEN
    RETURN 'not_for_sale';
  END IF;

  IF v_betslip_owner <> p_tipster_id THEN
    RETURN 'invalid_tipster';
  END IF;

  IF v_price IS NULL OR v_price <= 0 THEN
    RETURN 'invalid_price';
  END IF;

  -- Lock both profiles in a deterministic order to avoid deadlocks.
  IF p_buyer_id < p_tipster_id THEN
    PERFORM wallet_balance FROM public.profiles WHERE id = p_buyer_id FOR UPDATE;
    PERFORM wallet_balance FROM public.profiles WHERE id = p_tipster_id FOR UPDATE;
  ELSE
    PERFORM wallet_balance FROM public.profiles WHERE id = p_tipster_id FOR UPDATE;
    PERFORM wallet_balance FROM public.profiles WHERE id = p_buyer_id FOR UPDATE;
  END IF;

  -- Duplicate check AFTER the locks (was before them, which is what made it
  -- racy). uq_unlocked_picks_user_betslip is the real guard; this read just
  -- turns the common case into a clean return code instead of an exception.
  IF EXISTS (
    SELECT 1 FROM public.unlocked_picks
     WHERE user_id = p_buyer_id AND betslip_id = p_betslip_id
  ) THEN
    RETURN 'already_unlocked';
  END IF;

  SELECT COALESCE(wallet_balance, 0)
    INTO v_buyer_balance
    FROM public.profiles
   WHERE id = p_buyer_id;

  IF v_buyer_balance < v_price THEN
    RETURN 'insufficient_funds';
  END IF;

  v_tipster_cut := round(v_price * 0.85, 2);

  UPDATE public.profiles
     SET wallet_balance = COALESCE(wallet_balance, 0) - v_price
   WHERE id = p_buyer_id;

  UPDATE public.profiles
     SET wallet_balance = COALESCE(wallet_balance, 0) + v_tipster_cut
   WHERE id = p_tipster_id;

  INSERT INTO public.transactions (user_id, amount, type, status, reference_id)
  VALUES (p_buyer_id, -v_price, 'PURCHASE', 'COMPLETED', p_betslip_id);

  INSERT INTO public.transactions (user_id, amount, type, status, reference_id)
  VALUES (p_tipster_id, v_tipster_cut, 'EARNING', 'COMPLETED', p_betslip_id);

  INSERT INTO public.unlocked_picks (user_id, betslip_id, amount_paid)
  VALUES (p_buyer_id, p_betslip_id, v_price);

  RETURN 'completed';
EXCEPTION
  -- Belt and braces: if the unique index fires anyway, the whole function
  -- rolls back (no partial debit) and the caller sees the idempotent answer.
  WHEN unique_violation THEN
    RETURN 'already_unlocked';
END $$;

REVOKE ALL ON FUNCTION public.purchase_pick(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purchase_pick(uuid, uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. grant_signup_bonus: recipient is auth.uid(), and the guard is locked
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_signup_bonus(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_bonus numeric := 500;  -- starter Coins
  v_actor uuid := auth.uid();
  v_lock_key bigint;
BEGIN
  -- A user may only ever grant the bonus to themselves.
  IF NOT public.is_service_caller() THEN
    IF v_actor IS NULL THEN
      RETURN 'unauthenticated';
    END IF;
    IF v_actor <> p_user_id THEN
      RETURN 'forbidden';
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN 'no_profile';
  END IF;

  -- Serialize concurrent grants for this user BEFORE the idempotency read.
  -- Without this, N concurrent calls all saw "no bonus row" and all credited
  -- 500 — reachable from the app because PATCH /api/profiles/me called this
  -- on every profile update with no per-user rate limit.
  v_lock_key := ('x' || left(replace(p_user_id::text, '-', ''), 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  IF EXISTS (
    SELECT 1 FROM public.transactions
     WHERE user_id = p_user_id AND type = 'SIGNUP_BONUS'
  ) THEN
    RETURN 'duplicate';
  END IF;

  PERFORM wallet_balance FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  UPDATE public.profiles
     SET wallet_balance = COALESCE(wallet_balance, 0) + v_bonus
   WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, amount, type, status)
  VALUES (p_user_id, v_bonus, 'SIGNUP_BONUS', 'COMPLETED');

  RETURN 'completed';
EXCEPTION
  WHEN unique_violation THEN
    RETURN 'duplicate';
END $$;

REVOKE ALL ON FUNCTION public.grant_signup_bonus(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_signup_bonus(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. process_stripe_topup: lock before the idempotency read
-- ---------------------------------------------------------------------
-- Stripe delivers at-least-once and retries. Two concurrent deliveries of the
-- same checkout.session.completed both passed the unlocked
-- `WHERE stripe_session_id = ...` check and both credited the wallet. The
-- advisory lock plus uq_transactions_stripe_session make that impossible.
CREATE OR REPLACE FUNCTION public.process_stripe_topup(
  p_user_id uuid,
  p_amount numeric,
  p_stripe_session_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing uuid;
  v_lock_key bigint;
BEGIN
  IF p_amount <= 0 THEN
    RETURN 'invalid_amount';
  END IF;

  -- Serialize on the *session id*, not the user: concurrent retries of the
  -- same event are the race we care about.
  v_lock_key := ('x' || md5(p_stripe_session_id))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT id INTO v_existing
  FROM public.transactions
  WHERE stripe_session_id = p_stripe_session_id;

  IF v_existing IS NOT NULL THEN
    RETURN 'duplicate';
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  UPDATE public.profiles
     SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount
   WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, amount, type, status, stripe_session_id)
  VALUES (p_user_id, p_amount, 'TOP_UP', 'COMPLETED', p_stripe_session_id);

  RETURN 'completed';
EXCEPTION
  WHEN unique_violation THEN
    RETURN 'duplicate';
END $$;

REVOKE ALL ON FUNCTION public.process_stripe_topup(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_stripe_topup(uuid, numeric, text) TO service_role;

COMMIT;

-- =====================================================================
-- Post-deployment verification (run manually):
--
--   -- Must return f for anon/authenticated on every money RPC except
--   -- purchase_pick + grant_signup_bonus (which now verify auth.uid()).
--   SELECT p.proname, r.rolname,
--          has_function_privilege(r.rolname, p.oid, 'EXECUTE') AS can_execute
--   FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   CROSS JOIN (VALUES ('anon'),('authenticated')) r(rolname)
--   WHERE n.nspname = 'public'
--     AND p.proname IN ('credit_wallet','debit_wallet','purchase_pick',
--                       'grant_signup_bonus','process_stripe_topup')
--   ORDER BY p.proname, r.rolname;
--
--   -- As a logged-in user, both of these must now fail / be refused:
--   --   supabase.rpc('credit_wallet', {...})        -> permission denied
--   --   supabase.rpc('grant_signup_bonus', {p_user_id: SOMEONE_ELSE})
--   --                                               -> 'forbidden'
-- =====================================================================
