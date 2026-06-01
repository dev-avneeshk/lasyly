-- Migration: Add double-spend protection to wallet operations
-- Uses advisory locks and idempotency keys to prevent race conditions

-- 1. Add idempotency_key column to transactions for deduplication
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

-- 2. Create index for fast idempotency lookups
CREATE INDEX IF NOT EXISTS idx_transactions_idempotency
  ON public.transactions (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 3. Atomic wallet debit function with advisory lock
-- Prevents double-spending by:
-- a) Taking a per-user advisory lock (serializes concurrent requests)
-- b) Checking balance BEFORE deducting
-- c) Using idempotency_key to reject duplicate requests
CREATE OR REPLACE FUNCTION public.debit_wallet(
  p_user_id UUID,
  p_amount NUMERIC,
  p_type TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, new_balance NUMERIC, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_lock_key BIGINT;
BEGIN
  -- Generate a stable lock key from user_id (first 8 bytes as bigint)
  v_lock_key := ('x' || left(replace(p_user_id::text, '-', ''), 16))::bit(64)::bigint;

  -- Acquire advisory lock for this user (blocks concurrent debits)
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Check idempotency: if this key was already processed, return success
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM transactions WHERE idempotency_key = p_idempotency_key) THEN
      SELECT wallet_balance INTO v_current_balance FROM profiles WHERE id = p_user_id;
      RETURN QUERY SELECT true, v_current_balance, NULL::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Get current balance with row lock
  SELECT wallet_balance INTO v_current_balance
    FROM profiles
    WHERE id = p_user_id
    FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN QUERY SELECT false, 0::NUMERIC, 'User not found'::TEXT;
    RETURN;
  END IF;

  -- Check sufficient funds
  IF v_current_balance < p_amount THEN
    RETURN QUERY SELECT false, v_current_balance, 'Insufficient funds'::TEXT;
    RETURN;
  END IF;

  -- Deduct balance
  v_new_balance := v_current_balance - p_amount;
  UPDATE profiles SET wallet_balance = v_new_balance WHERE id = p_user_id;

  -- Record transaction
  INSERT INTO transactions (user_id, type, amount, status, reference_id, idempotency_key)
  VALUES (p_user_id, p_type, -p_amount, 'completed', p_reference_id, p_idempotency_key);

  RETURN QUERY SELECT true, v_new_balance, NULL::TEXT;
END;
$$;

-- 4. Atomic wallet credit function (for top-ups and winnings)
CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_user_id UUID,
  p_amount NUMERIC,
  p_type TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_stripe_session_id TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, new_balance NUMERIC, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_lock_key BIGINT;
BEGIN
  v_lock_key := ('x' || left(replace(p_user_id::text, '-', ''), 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM transactions WHERE idempotency_key = p_idempotency_key) THEN
      SELECT wallet_balance INTO v_current_balance FROM profiles WHERE id = p_user_id;
      RETURN QUERY SELECT true, v_current_balance, NULL::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Get current balance
  SELECT wallet_balance INTO v_current_balance
    FROM profiles
    WHERE id = p_user_id
    FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN QUERY SELECT false, 0::NUMERIC, 'User not found'::TEXT;
    RETURN;
  END IF;

  -- Credit balance
  v_new_balance := v_current_balance + p_amount;
  UPDATE profiles SET wallet_balance = v_new_balance WHERE id = p_user_id;

  -- Record transaction
  INSERT INTO transactions (user_id, type, amount, status, reference_id, stripe_session_id, idempotency_key)
  VALUES (p_user_id, p_type, p_amount, 'completed', p_reference_id, p_stripe_session_id, p_idempotency_key);

  RETURN QUERY SELECT true, v_new_balance, NULL::TEXT;
END;
$$;

-- 5. Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION public.debit_wallet TO authenticated;
GRANT EXECUTE ON FUNCTION public.credit_wallet TO authenticated, service_role;
