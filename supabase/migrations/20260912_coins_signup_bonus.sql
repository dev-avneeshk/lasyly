-- =====================================================================
-- Migration: Coins signup bonus
-- =====================================================================
-- Grants a one-time starter allotment of Coins to a user the first time
-- they finish onboarding, so that the Coins balance surfaced across the
-- app (wallet page, header pill, dashboard) is meaningful for new users.
--
-- Coins are Lasyly's in-app currency for unlocking creator content and
-- community access. They are NOT money and are not withdrawable as cash.
--
-- Design notes / conventions (match 20260522_security_rls_baseline.sql):
--   * All wallet movement goes through a SECURITY DEFINER function that
--     locks the affected profile row and writes the append-only ledger
--     entry in the same transaction. Application code never updates
--     profiles.wallet_balance directly (column-level privilege revoke).
--   * Idempotent: the grant is keyed on a per-user SIGNUP_BONUS ledger
--     row, so calling it more than once is a no-op ('duplicate').
--   * Ledger `type`/`status` use the UPPERCASE vocabulary the dashboard
--     and wallet read paths filter on ('SIGNUP_BONUS', 'COMPLETED').
-- =====================================================================

BEGIN;

-- Starter allotment. Kept as a single source of truth here; adjust in one
-- place if the welcome amount changes.
CREATE OR REPLACE FUNCTION public.grant_signup_bonus(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_bonus numeric := 500;  -- starter Coins
BEGIN
  -- Only real, existing users may receive the bonus.
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN 'no_profile';
  END IF;

  -- Idempotency: one SIGNUP_BONUS ledger row per user, ever.
  IF EXISTS (
    SELECT 1 FROM public.transactions
     WHERE user_id = p_user_id AND type = 'SIGNUP_BONUS'
  ) THEN
    RETURN 'duplicate';
  END IF;

  -- Lock the profile row, then credit.
  PERFORM wallet_balance FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  UPDATE public.profiles
     SET wallet_balance = COALESCE(wallet_balance, 0) + v_bonus
   WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, amount, type, status)
  VALUES (p_user_id, v_bonus, 'SIGNUP_BONUS', 'COMPLETED');

  RETURN 'completed';
END $$;

-- The function verifies the caller only affects an existing profile, but
-- the route handler MUST pass auth.uid() — never a client-supplied id.
REVOKE ALL ON FUNCTION public.grant_signup_bonus(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_signup_bonus(uuid) TO authenticated, service_role;

COMMIT;

-- =====================================================================
-- Post-deployment verification (run manually):
--   SELECT public.grant_signup_bonus('<some-user-uuid>');   -- 'completed'
--   SELECT public.grant_signup_bonus('<same-user-uuid>');   -- 'duplicate'
--   SELECT public.get_my_wallet_balance();                  -- reflects +500
-- =====================================================================
