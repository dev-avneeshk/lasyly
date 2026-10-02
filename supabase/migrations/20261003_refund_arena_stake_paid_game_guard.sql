-- refund_arena_stake: refuse once ANY player was paid for the game.
--
-- The guard in 20260921_arena_economy.sql only looked at the refunded user's
-- own ARENA_REWARD/ARENA_WINNINGS rows. The lobby sweep refunds a lobby's owner
-- when its tracking entry outlives the game key; if the best-effort untrack
-- after a join had failed, a played game that the owner LOST (winner paid, no
-- payout row for the owner) got the owner's stake back: minted coin.
--
-- Same signature, same results; the paid check is now per game. Idempotent:
-- CREATE OR REPLACE + IF NOT EXISTS. Non-destructive. Files only; apply through
-- the normal migration process.

-- The per-game lookup's index is built CONCURRENTLY in
-- 20261003_transactions_arena_payout_ref_index.sql (a plain build here would
-- block every coin write on `transactions` for its duration).

CREATE OR REPLACE FUNCTION public.refund_arena_stake(
  p_user_id uuid,
  p_game_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_debit numeric;
  v_lock_key bigint;
BEGIN
  v_lock_key := ('x' || left(replace(p_user_id::text, '-', ''), 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);
  -- Don't refund a game that already paid out, to anyone.
  IF EXISTS (
    SELECT 1 FROM public.transactions
     WHERE reference_id = p_game_id
       AND type IN ('ARENA_REWARD', 'ARENA_WINNINGS')
  ) THEN
    RETURN 'already_settled';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.transactions
     WHERE user_id = p_user_id AND reference_id = p_game_id AND type = 'ARENA_REFUND'
  ) THEN
    RETURN 'duplicate';
  END IF;
  -- Total debited for this game (ARENA_ENTRY/ARENA_STAKE amounts are negative).
  SELECT COALESCE(-SUM(amount), 0) INTO v_debit
    FROM public.transactions
   WHERE user_id = p_user_id AND reference_id = p_game_id
     AND type IN ('ARENA_ENTRY', 'ARENA_STAKE');
  IF v_debit <= 0 THEN
    RETURN 'nothing_to_refund';
  END IF;
  PERFORM wallet_balance FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  UPDATE public.profiles
     SET wallet_balance = COALESCE(wallet_balance, 0) + v_debit
   WHERE id = p_user_id;
  INSERT INTO public.transactions (user_id, amount, type, status, reference_id)
  VALUES (p_user_id, v_debit, 'ARENA_REFUND', 'COMPLETED', p_game_id);
  RETURN 'completed';
EXCEPTION
  WHEN unique_violation THEN
    RETURN 'duplicate';
END $$;

-- Service role only (Supabase grants new functions to anon/authenticated directly).
REVOKE ALL ON FUNCTION public.refund_arena_stake(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_arena_stake(uuid, text) TO service_role;
