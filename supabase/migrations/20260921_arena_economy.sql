-- =====================================================================
-- Migration: Arena coin economy (staking, rewards, levels, weekly bonus)
-- =====================================================================
-- Adds the games economy on top of the existing Coins wallet:
--
--   1. Signup bonus lowered 500 → 200 (product decision).
--   2. profiles.level / profiles.xp — a progression system driven by
--      playing/winning arena games.
--   3. Arena vs CPU: a flat entry cost debited when the game starts and a
--      difficulty-scaled reward credited when the human wins.
--   4. 1v1 human staking: both players stake the same amount when the game
--      starts; the winner gets their own stake back plus the opponent's stake
--      less a 10% commission on the winnings (stake 100 → payout 190). The
--      payout is computed by the app (lib/economy/arena.ts::stakePayout) and
--      passed in as p_payout; this function just credits it.
--   5. Refunds when a staked game is abandoned before it resolves.
--   6. A weekly, level-scaled coin grant (one per user per ISO week).
--
-- SECURITY MODEL (mirrors 20260914_lock_down_money_rpcs.sql exactly):
--   * Every balance-moving function is SECURITY DEFINER, SET search_path=''.
--   * The acting user is auth.uid(); any user-id parameter is VERIFIED against
--     it, never trusted. public.is_service_caller() lets the service role
--     (cron / server routes using the admin client) bypass that check.
--   * A per-user (or per-game) advisory xact lock is taken BEFORE the
--     idempotency read to close the TOCTOU window; a partial UNIQUE index
--     makes the invariant structural, and unique_violation degrades to a
--     clean 'duplicate' return code instead of a 500.
--   * REVOKE ALL FROM PUBLIC, then GRANT narrowly.
--
-- Ledger `type` vocabulary added by this migration (UPPERCASE, matches the
-- existing SIGNUP_BONUS / TOP_UP / PURCHASE / EARNING style):
--   ARENA_ENTRY        — CPU entry cost debit (amount negative)
--   ARENA_REWARD       — CPU win reward credit
--   ARENA_STAKE        — 1v1 stake debit (amount negative)
--   ARENA_WINNINGS     — 1v1 winner payout credit
--   ARENA_REFUND       — abandoned staked game refund credit
--   WEEKLY_LEVEL_BONUS — weekly level-scaled grant credit
--
-- Idempotency keys use transactions.reference_id (text) to hold the arena
-- game id (or the ISO week key for the weekly bonus), so replays of the same
-- game/week are no-ops.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Signup bonus: 500 → 200
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_signup_bonus(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_bonus numeric := 200;  -- starter Coins (was 500)
  v_actor uuid := auth.uid();
  v_lock_key bigint;
BEGIN
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
-- 1. Level / XP columns + progression helpers
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS xp numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 1;

-- Cumulative XP required to REACH a level: 100 * (n-1) * n / 2.
-- Mirrors lib/economy/arena.ts::xpToReachLevel.
CREATE OR REPLACE FUNCTION public.xp_to_reach_level(p_level integer)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT (100 * (GREATEST(1, p_level) - 1) * GREATEST(1, p_level)) / 2.0;
$$;

-- The level a total XP corresponds to. Mirrors levelForXp.
CREATE OR REPLACE FUNCTION public.level_for_xp(p_xp numeric)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_level integer := 1;
  v_xp numeric := GREATEST(0, COALESCE(p_xp, 0));
BEGIN
  WHILE public.xp_to_reach_level(v_level + 1) <= v_xp LOOP
    v_level := v_level + 1;
  END LOOP;
  RETURN v_level;
END $$;

-- level_for_xp is pure; expose it so the app can compute progress if needed.
REVOKE ALL ON FUNCTION public.xp_to_reach_level(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.level_for_xp(numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.xp_to_reach_level(integer) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.level_for_xp(numeric) TO authenticated, anon, service_role;

-- Column-level exposure: level is public (shown on profiles / 1v1 cards); xp
-- stays readable too (it's not sensitive like wallet_balance). Grant SELECT so
-- SELECT * keeps working for anon/authenticated.
GRANT SELECT (level, xp) ON public.profiles TO anon, authenticated;

-- Self-read of level + xp + balance in one call, for the header/profile.
CREATE OR REPLACE FUNCTION public.get_my_level()
RETURNS TABLE (level integer, xp numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(p.level, 1), COALESCE(p.xp, 0)
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_level() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_level() TO authenticated, service_role;

-- Internal helper: add XP to a user (assumes the profile row is already locked
-- by the caller) and recompute the derived level. Not granted to anyone — it's
-- only ever called from other SECURITY DEFINER functions in this file.
CREATE OR REPLACE FUNCTION public.apply_xp(p_user_id uuid, p_xp numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles
     SET xp = COALESCE(xp, 0) + GREATEST(0, p_xp),
         level = public.level_for_xp(COALESCE(xp, 0) + GREATEST(0, p_xp))
   WHERE id = p_user_id;
END $$;

REVOKE ALL ON FUNCTION public.apply_xp(uuid, numeric) FROM PUBLIC;
-- service_role only (used indirectly; direct calls are not part of the API).
GRANT EXECUTE ON FUNCTION public.apply_xp(uuid, numeric) TO service_role;

-- ---------------------------------------------------------------------
-- 2. Idempotency indexes for the new arena ledger rows
-- ---------------------------------------------------------------------
-- One entry/stake debit per (user, game); one reward/winnings/refund credit
-- per (user, game); one weekly bonus per (user, week). reference_id holds the
-- game id or the ISO week key.
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_arena_entry
    ON public.transactions (user_id, reference_id)
    WHERE type IN ('ARENA_ENTRY', 'ARENA_STAKE');
  CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_arena_credit
    ON public.transactions (user_id, reference_id)
    WHERE type IN ('ARENA_REWARD', 'ARENA_WINNINGS', 'ARENA_REFUND');
  CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_weekly_bonus
    ON public.transactions (user_id, reference_id)
    WHERE type = 'WEEKLY_LEVEL_BONUS';
  RAISE NOTICE 'ok: arena idempotency indexes';
EXCEPTION
  WHEN unique_violation THEN
    RAISE WARNING 'SKIPPED an arena idempotency index — duplicates already exist. '
                  'Reconcile balances, delete surplus ledger rows, then re-run.';
END
$$;

-- ---------------------------------------------------------------------
-- 3. start_arena_stake — debit entry cost (CPU) or stake (1v1) at game start
-- ---------------------------------------------------------------------
-- Charged once per (user, game). For a CPU game p_is_pvp=false and p_amount is
-- the entry cost; for a 1v1 p_is_pvp=true and p_amount is the player's stake.
-- Returns: completed | duplicate | insufficient_funds | invalid_amount
--          | no_profile | unauthenticated | forbidden
CREATE OR REPLACE FUNCTION public.start_arena_stake(
  p_user_id uuid,
  p_game_id text,
  p_amount numeric,
  p_is_pvp boolean
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_balance numeric;
  v_type text := CASE WHEN p_is_pvp THEN 'ARENA_STAKE' ELSE 'ARENA_ENTRY' END;
  v_lock_key bigint;
BEGIN
  IF NOT public.is_service_caller() THEN
    IF v_actor IS NULL THEN RETURN 'unauthenticated'; END IF;
    IF v_actor <> p_user_id THEN RETURN 'forbidden'; END IF;
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 OR p_amount <> floor(p_amount) THEN
    RETURN 'invalid_amount';
  END IF;

  v_lock_key := ('x' || left(replace(p_user_id::text, '-', ''), 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN 'no_profile';
  END IF;

  -- Idempotency: already charged for this game?
  IF EXISTS (
    SELECT 1 FROM public.transactions
     WHERE user_id = p_user_id AND reference_id = p_game_id AND type = v_type
  ) THEN
    RETURN 'duplicate';
  END IF;

  SELECT wallet_balance INTO v_balance
    FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  IF COALESCE(v_balance, 0) < p_amount THEN
    RETURN 'insufficient_funds';
  END IF;

  UPDATE public.profiles
     SET wallet_balance = COALESCE(wallet_balance, 0) - p_amount
   WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, amount, type, status, reference_id)
  VALUES (p_user_id, -p_amount, v_type, 'COMPLETED', p_game_id);

  RETURN 'completed';
EXCEPTION
  WHEN unique_violation THEN
    RETURN 'duplicate';
END $$;

REVOKE ALL ON FUNCTION public.start_arena_stake(uuid, text, numeric, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_arena_stake(uuid, text, numeric, boolean) TO service_role;

-- ---------------------------------------------------------------------
-- 4. award_cpu_reward — credit CPU-win reward + XP, once per (user, game)
-- ---------------------------------------------------------------------
-- p_reward is the coin reward (0 on a loss → only XP is applied). p_xp is the
-- total XP for the game (play + win bonus). Called from the simulate route with
-- the service-role admin client after the authoritative result is persisted.
-- Returns: completed | duplicate | no_profile
CREATE OR REPLACE FUNCTION public.award_cpu_reward(
  p_user_id uuid,
  p_game_id text,
  p_reward numeric,
  p_xp numeric
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_lock_key bigint;
BEGIN
  -- service-role only (see GRANT); no auth.uid() path needed.
  v_lock_key := ('x' || left(replace(p_user_id::text, '-', ''), 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN 'no_profile';
  END IF;

  -- Idempotency: reward already granted for this game?
  IF EXISTS (
    SELECT 1 FROM public.transactions
     WHERE user_id = p_user_id AND reference_id = p_game_id AND type = 'ARENA_REWARD'
  ) THEN
    RETURN 'duplicate';
  END IF;

  PERFORM wallet_balance FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  IF p_reward > 0 THEN
    UPDATE public.profiles
       SET wallet_balance = COALESCE(wallet_balance, 0) + p_reward
     WHERE id = p_user_id;
  END IF;

  -- Always write a ledger row (even a 0-coin loss) so the game is marked
  -- settled and the idempotency guard holds.
  INSERT INTO public.transactions (user_id, amount, type, status, reference_id)
  VALUES (p_user_id, COALESCE(p_reward, 0), 'ARENA_REWARD', 'COMPLETED', p_game_id);

  PERFORM public.apply_xp(p_user_id, COALESCE(p_xp, 0));

  RETURN 'completed';
EXCEPTION
  WHEN unique_violation THEN
    RETURN 'duplicate';
END $$;

REVOKE ALL ON FUNCTION public.award_cpu_reward(uuid, text, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_cpu_reward(uuid, text, numeric, numeric) TO service_role;

-- ---------------------------------------------------------------------
-- 5. settle_1v1_stake — pay the winner the pot minus commission, award XP
-- ---------------------------------------------------------------------
-- Called once per game after the result is persisted. Both players already had
-- their stake debited by start_arena_stake, so the pot (2*stake) is held by the
-- house; this credits the winner p_payout and applies XP to both players.
-- Idempotent on (winner, game) via the ARENA_WINNINGS ledger row.
-- Returns: completed | duplicate | no_profile
CREATE OR REPLACE FUNCTION public.settle_1v1_stake(
  p_game_id text,
  p_winner_id uuid,
  p_loser_id uuid,
  p_payout numeric,
  p_winner_xp numeric,
  p_loser_xp numeric
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_lock_key bigint;
BEGIN
  -- service-role only. Serialize on the game id so a double-settle can't race.
  v_lock_key := ('x' || md5(p_game_id))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_winner_id) THEN
    RETURN 'no_profile';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.transactions
     WHERE reference_id = p_game_id AND type = 'ARENA_WINNINGS'
  ) THEN
    RETURN 'duplicate';
  END IF;

  PERFORM wallet_balance FROM public.profiles WHERE id = p_winner_id FOR UPDATE;

  UPDATE public.profiles
     SET wallet_balance = COALESCE(wallet_balance, 0) + p_payout
   WHERE id = p_winner_id;

  INSERT INTO public.transactions (user_id, amount, type, status, reference_id)
  VALUES (p_winner_id, p_payout, 'ARENA_WINNINGS', 'COMPLETED', p_game_id);

  PERFORM public.apply_xp(p_winner_id, COALESCE(p_winner_xp, 0));
  IF p_loser_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = p_loser_id) THEN
    PERFORM public.apply_xp(p_loser_id, COALESCE(p_loser_xp, 0));
  END IF;

  RETURN 'completed';
EXCEPTION
  WHEN unique_violation THEN
    RETURN 'duplicate';
END $$;

REVOKE ALL ON FUNCTION public.settle_1v1_stake(text, uuid, uuid, numeric, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_1v1_stake(text, uuid, uuid, numeric, numeric, numeric) TO service_role;

-- ---------------------------------------------------------------------
-- 6. refund_arena_stake — return a stake/entry for an abandoned game
-- ---------------------------------------------------------------------
-- Credits back exactly what the user was debited for this game, once. Used when
-- a staked game never resolves (e.g. no opponent joined). Idempotent on
-- (user, game) via the ARENA_REFUND row; also guards against refunding a game
-- that was already settled/rewarded.
-- Returns: completed | duplicate | nothing_to_refund | already_settled
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

  -- Don't refund a game that already paid out.
  IF EXISTS (
    SELECT 1 FROM public.transactions
     WHERE user_id = p_user_id AND reference_id = p_game_id
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

REVOKE ALL ON FUNCTION public.refund_arena_stake(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_arena_stake(uuid, text) TO service_role;

-- ---------------------------------------------------------------------
-- 7. grant_weekly_level_bonus — one level-scaled grant per user per ISO week
-- ---------------------------------------------------------------------
-- Called by the weekly cron for each eligible user. p_week_key is the ISO week
-- ("2026-W38"); p_amount is precomputed (100 + level*50) by the caller so the
-- curve lives in one place (lib/economy/arena.ts) — but we clamp to >0 here.
-- Idempotent on (user, week). Returns: completed | duplicate | no_profile
CREATE OR REPLACE FUNCTION public.grant_weekly_level_bonus(
  p_user_id uuid,
  p_week_key text,
  p_amount numeric
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_lock_key bigint;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN 'invalid_amount';
  END IF;

  v_lock_key := ('x' || left(replace(p_user_id::text, '-', ''), 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN 'no_profile';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.transactions
     WHERE user_id = p_user_id AND reference_id = p_week_key AND type = 'WEEKLY_LEVEL_BONUS'
  ) THEN
    RETURN 'duplicate';
  END IF;

  PERFORM wallet_balance FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  UPDATE public.profiles
     SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount
   WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, amount, type, status, reference_id)
  VALUES (p_user_id, p_amount, 'WEEKLY_LEVEL_BONUS', 'COMPLETED', p_week_key);

  RETURN 'completed';
EXCEPTION
  WHEN unique_violation THEN
    RETURN 'duplicate';
END $$;

REVOKE ALL ON FUNCTION public.grant_weekly_level_bonus(uuid, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_weekly_level_bonus(uuid, text, numeric) TO service_role;

COMMIT;

-- =====================================================================
-- Post-deployment verification (run manually):
--
--   SELECT public.start_arena_stake('<uid>','game-1',50,false);   -- 'completed'
--   SELECT public.start_arena_stake('<uid>','game-1',50,false);   -- 'duplicate'
--   SELECT public.award_cpu_reward('<uid>','game-1',150,25);      -- 'completed'
--   SELECT public.award_cpu_reward('<uid>','game-1',150,25);      -- 'duplicate'
--   SELECT * FROM public.get_my_level();                          -- level/xp
--   SELECT public.grant_weekly_level_bonus('<uid>','2026-W38',150);-- 'completed'
-- =====================================================================
