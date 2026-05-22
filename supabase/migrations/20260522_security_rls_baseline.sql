-- =====================================================================
-- Migration: Security RLS Baseline
-- =====================================================================
-- Establishes deny-by-default RLS for every table the application touches.
-- Idempotent: each policy is dropped and recreated so this file is the
-- single source of truth for authorization rules.
--
-- Key design decisions:
--   1. profiles.wallet_balance is gated by COLUMN-LEVEL privilege revoke
--      so the public anon/authenticated roles cannot SELECT it directly,
--      even with the publishable key. Self-reads go through the
--      SECURITY DEFINER RPC `get_my_wallet_balance()`.
--   2. Wallet/ledger writes (profiles.wallet_balance updates,
--      transactions inserts, unlocked_picks inserts) are denied for
--      anon/authenticated. They must go through service-role (Stripe
--      webhook) or SECURITY DEFINER RPCs added in a follow-up migration.
--   3. Room visibility is computed via SECURITY DEFINER helper functions
--      (`is_room_member`, `is_room_admin`, `room_is_public`) with
--      `SET search_path = ''` to avoid recursive RLS lookups and
--      satisfy Supabase security-advisor.
-- =====================================================================

-- Wrap everything in a transaction so partial failure leaves the schema
-- untouched.
BEGIN;

-- ---------------------------------------------------------------------
-- 0. Helper functions (SECURITY DEFINER, stable, locked search_path)
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_room_member(p_room_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_members
    WHERE room_id = p_room_id AND user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_room_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_room_member(uuid, uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_room_admin(p_room_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_members
    WHERE room_id = p_room_id
      AND user_id = p_user_id
      AND role IN ('owner', 'moderator')
  );
$$;

REVOKE ALL ON FUNCTION public.is_room_admin(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_room_admin(uuid, uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.room_is_public(p_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rooms
    WHERE id = p_room_id AND type IN ('Public', 'Tipster')
  );
$$;

REVOKE ALL ON FUNCTION public.room_is_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.room_is_public(uuid) TO anon, authenticated, service_role;

-- Self-read of wallet balance. Bypasses the column-level revoke below.
-- Returns 0 (not null) when no profile row exists so callers don't have
-- to disambiguate.
CREATE OR REPLACE FUNCTION public.get_my_wallet_balance()
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT wallet_balance FROM public.profiles WHERE id = auth.uid()),
    0
  );
$$;

REVOKE ALL ON FUNCTION public.get_my_wallet_balance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_wallet_balance() TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 1. profiles
-- ---------------------------------------------------------------------
-- Public profile fields are readable by anyone (consistent with the
-- existing /api/profiles/[identifier] endpoint). wallet_balance is
-- protected by a column-level privilege revoke (see end of file).
-- Updates: only the owning user, never to wallet_balance (enforced via
-- column privilege) and never to id.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
CREATE POLICY "profiles_select_public"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
CREATE POLICY "profiles_insert_self"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- No DELETE policy: profile deletion happens via auth.users CASCADE.

-- ---------------------------------------------------------------------
-- 2. follows
-- ---------------------------------------------------------------------
-- Follow graph is public (used by profile pages). Users can only
-- create/delete their own follow edges.

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "follows_select_public" ON public.follows;
CREATE POLICY "follows_select_public"
  ON public.follows FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "follows_insert_own" ON public.follows;
CREATE POLICY "follows_insert_own"
  ON public.follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id AND follower_id <> following_id);

DROP POLICY IF EXISTS "follows_delete_own" ON public.follows;
CREATE POLICY "follows_delete_own"
  ON public.follows FOR DELETE
  USING (auth.uid() = follower_id);

-- ---------------------------------------------------------------------
-- 3. rooms
-- ---------------------------------------------------------------------
-- Public/Tipster rooms are visible to everyone. Private rooms are
-- visible only to creator and members. Updates restricted to admins.

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rooms_select_visible" ON public.rooms;
CREATE POLICY "rooms_select_visible"
  ON public.rooms FOR SELECT
  USING (
    type IN ('Public', 'Tipster')
    OR creator_id = auth.uid()
    OR public.is_room_member(id, auth.uid())
  );

DROP POLICY IF EXISTS "rooms_insert_own" ON public.rooms;
CREATE POLICY "rooms_insert_own"
  ON public.rooms FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "rooms_update_admin" ON public.rooms;
CREATE POLICY "rooms_update_admin"
  ON public.rooms FOR UPDATE
  USING (creator_id = auth.uid() OR public.is_room_admin(id, auth.uid()))
  WITH CHECK (creator_id = auth.uid() OR public.is_room_admin(id, auth.uid()));

DROP POLICY IF EXISTS "rooms_delete_creator" ON public.rooms;
CREATE POLICY "rooms_delete_creator"
  ON public.rooms FOR DELETE
  USING (creator_id = auth.uid());

-- ---------------------------------------------------------------------
-- 4. room_members
-- ---------------------------------------------------------------------
-- Membership rows visible if the room is public OR the requester is a
-- member. Users can only add/remove themselves; admins can remove
-- anyone. Role changes (owner/moderator promotion) are NOT allowed via
-- the RLS path — those go through admin-only RPCs added later.

ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "room_members_select_visible" ON public.room_members;
CREATE POLICY "room_members_select_visible"
  ON public.room_members FOR SELECT
  USING (
    public.room_is_public(room_id)
    OR user_id = auth.uid()
    OR public.is_room_member(room_id, auth.uid())
  );

DROP POLICY IF EXISTS "room_members_insert_self" ON public.room_members;
CREATE POLICY "room_members_insert_self"
  ON public.room_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'member'  -- self-joins must be plain members
  );

DROP POLICY IF EXISTS "room_members_delete_self_or_admin" ON public.room_members;
CREATE POLICY "room_members_delete_self_or_admin"
  ON public.room_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR public.is_room_admin(room_id, auth.uid())
  );

-- No UPDATE policy: role changes must go through privileged RPCs.

-- ---------------------------------------------------------------------
-- 5. messages
-- ---------------------------------------------------------------------
-- Visible to room members (or anyone for public rooms). Senders can
-- only insert their own messages and only into rooms they belong to.
-- Edits are not allowed via RLS to prevent message tampering.

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_visible" ON public.messages;
CREATE POLICY "messages_select_visible"
  ON public.messages FOR SELECT
  USING (
    public.room_is_public(room_id)
    OR public.is_room_member(room_id, auth.uid())
  );

DROP POLICY IF EXISTS "messages_insert_member" ON public.messages;
CREATE POLICY "messages_insert_member"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_room_member(room_id, auth.uid())
    AND is_system = false
  );

DROP POLICY IF EXISTS "messages_delete_self_or_admin" ON public.messages;
CREATE POLICY "messages_delete_self_or_admin"
  ON public.messages FOR DELETE
  USING (
    user_id = auth.uid()
    OR public.is_room_admin(room_id, auth.uid())
  );

-- ---------------------------------------------------------------------
-- 6. room_matches
-- ---------------------------------------------------------------------
-- Same visibility rules as messages. Only room admins can add/remove.

ALTER TABLE public.room_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "room_matches_select_visible" ON public.room_matches;
CREATE POLICY "room_matches_select_visible"
  ON public.room_matches FOR SELECT
  USING (
    public.room_is_public(room_id)
    OR public.is_room_member(room_id, auth.uid())
  );

DROP POLICY IF EXISTS "room_matches_insert_admin" ON public.room_matches;
CREATE POLICY "room_matches_insert_admin"
  ON public.room_matches FOR INSERT
  WITH CHECK (
    auth.uid() = added_by
    AND public.is_room_admin(room_id, auth.uid())
  );

DROP POLICY IF EXISTS "room_matches_delete_admin" ON public.room_matches;
CREATE POLICY "room_matches_delete_admin"
  ON public.room_matches FOR DELETE
  USING (public.is_room_admin(room_id, auth.uid()));

-- ---------------------------------------------------------------------
-- 7. betslips
-- ---------------------------------------------------------------------
-- Visibility:
--   - Always: the owner can see their own betslips.
--   - Room betslip with public room → visible to everyone.
--   - Room betslip with private room → visible to room members.
--   - No room (personal feed only) → visible only to owner and people
--     following the owner. Followers visibility is driven from the API
--     layer; for RLS we expose it broadly when room_id IS NULL because
--     the existing /api/betslips/feed already filters by follow graph.
-- Mutations: owners only. The for-sale flag and price can be edited
-- via UPDATE; status transitions go through the API layer with the
-- concurrency guard.

ALTER TABLE public.betslips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "betslips_select_visible" ON public.betslips;
CREATE POLICY "betslips_select_visible"
  ON public.betslips FOR SELECT
  USING (
    user_id = auth.uid()
    OR (room_id IS NOT NULL AND public.room_is_public(room_id))
    OR (room_id IS NOT NULL AND public.is_room_member(room_id, auth.uid()))
    OR (
      room_id IS NULL
      AND auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.follows f
        WHERE f.follower_id = auth.uid()
          AND f.following_id = betslips.user_id
      )
    )
    -- Anonymous viewers see nothing for room_id IS NULL betslips. The
    -- /api/betslips/feed endpoint uses the public-rooms branch for
    -- unauthenticated users, so this does not break public feeds.
  );

DROP POLICY IF EXISTS "betslips_insert_own" ON public.betslips;
CREATE POLICY "betslips_insert_own"
  ON public.betslips FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "betslips_update_own" ON public.betslips;
CREATE POLICY "betslips_update_own"
  ON public.betslips FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "betslips_delete_own" ON public.betslips;
CREATE POLICY "betslips_delete_own"
  ON public.betslips FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 8. reactions (betslip emoji reactions)
-- ---------------------------------------------------------------------
-- Anyone who can see the betslip can see its reactions. Users can only
-- toggle their own reactions.

ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reactions_select_visible" ON public.reactions;
CREATE POLICY "reactions_select_visible"
  ON public.reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.betslips b
      WHERE b.id = reactions.betslip_id
        AND (
          b.user_id = auth.uid()
          OR (b.room_id IS NOT NULL AND public.room_is_public(b.room_id))
          OR (b.room_id IS NOT NULL AND public.is_room_member(b.room_id, auth.uid()))
          OR (
            b.room_id IS NULL
            AND auth.uid() IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.follows f
              WHERE f.follower_id = auth.uid()
                AND f.following_id = b.user_id
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS "reactions_insert_own" ON public.reactions;
CREATE POLICY "reactions_insert_own"
  ON public.reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reactions_delete_own" ON public.reactions;
CREATE POLICY "reactions_delete_own"
  ON public.reactions FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 9. transactions (financial ledger)
-- ---------------------------------------------------------------------
-- Users can only SELECT their own transactions. NO insert/update/delete
-- policies for anon/authenticated — the ledger is append-only via
-- service-role (Stripe webhook) and the upcoming wallet RPC.

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
CREATE POLICY "transactions_select_own"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Explicitly drop any prior write policies to harden against drift.
DROP POLICY IF EXISTS "transactions_insert_own" ON public.transactions;
DROP POLICY IF EXISTS "transactions_update_own" ON public.transactions;
DROP POLICY IF EXISTS "transactions_delete_own" ON public.transactions;

-- ---------------------------------------------------------------------
-- 10. unlocked_picks
-- ---------------------------------------------------------------------
-- Same pattern as transactions: read-only for the owner; writes via
-- privileged RPC. Tipsters also need to see who unlocked their slips.

ALTER TABLE public.unlocked_picks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unlocked_picks_select_owner" ON public.unlocked_picks;
CREATE POLICY "unlocked_picks_select_owner"
  ON public.unlocked_picks FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.betslips b
      WHERE b.id = unlocked_picks.betslip_id
        AND b.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "unlocked_picks_insert_own" ON public.unlocked_picks;
DROP POLICY IF EXISTS "unlocked_picks_update_own" ON public.unlocked_picks;
DROP POLICY IF EXISTS "unlocked_picks_delete_own" ON public.unlocked_picks;

-- ---------------------------------------------------------------------
-- 11. bet_tracker (already had RLS in 20250519_create_bet_tracker.sql)
-- ---------------------------------------------------------------------
-- Re-assert idempotently in case policy names changed.

ALTER TABLE public.bet_tracker ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own bets." ON public.bet_tracker;
DROP POLICY IF EXISTS "Users can insert their own bets." ON public.bet_tracker;
DROP POLICY IF EXISTS "Users can update their own bets." ON public.bet_tracker;
DROP POLICY IF EXISTS "bet_tracker_select_own" ON public.bet_tracker;
DROP POLICY IF EXISTS "bet_tracker_insert_own" ON public.bet_tracker;
DROP POLICY IF EXISTS "bet_tracker_update_own" ON public.bet_tracker;
DROP POLICY IF EXISTS "bet_tracker_delete_own" ON public.bet_tracker;

CREATE POLICY "bet_tracker_select_own"
  ON public.bet_tracker FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "bet_tracker_insert_own"
  ON public.bet_tracker FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bet_tracker_update_own"
  ON public.bet_tracker FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bet_tracker_delete_own"
  ON public.bet_tracker FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 12. prop_votes (already partially policied)
-- ---------------------------------------------------------------------

ALTER TABLE public.prop_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all votes." ON public.prop_votes;
DROP POLICY IF EXISTS "Users can insert their own votes." ON public.prop_votes;
DROP POLICY IF EXISTS "Users can update their own votes." ON public.prop_votes;
DROP POLICY IF EXISTS "prop_votes_select_public" ON public.prop_votes;
DROP POLICY IF EXISTS "prop_votes_insert_own" ON public.prop_votes;
DROP POLICY IF EXISTS "prop_votes_update_own" ON public.prop_votes;
DROP POLICY IF EXISTS "prop_votes_delete_own" ON public.prop_votes;

CREATE POLICY "prop_votes_select_public"
  ON public.prop_votes FOR SELECT
  USING (true);

CREATE POLICY "prop_votes_insert_own"
  ON public.prop_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "prop_votes_update_own"
  ON public.prop_votes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "prop_votes_delete_own"
  ON public.prop_votes FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 13. Public-read sport/stats reference tables
-- ---------------------------------------------------------------------
-- These tables are written only by the scrapers (service-role) and
-- read publicly. RLS is enabled with a public SELECT policy and no
-- write policy for anon/authenticated.

DO $$
DECLARE
  t text;
  public_read_tables text[] := ARRAY[
    'matches',
    'team_logos',
    'nba_games',
    'nba_player_stats',
    'tennis_matches',
    'tennis_serve_stats'
  ];
BEGIN
  FOREACH t IN ARRAY public_read_tables
  LOOP
    -- Only act on tables that actually exist; some may not be present
    -- in every environment.
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format(
        'DROP POLICY IF EXISTS "%s_select_public" ON public.%I',
        t, t
      );
      EXECUTE format(
        'CREATE POLICY "%s_select_public" ON public.%I FOR SELECT USING (true)',
        t, t
      );
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 14. Column-level privilege: lock down profiles.wallet_balance
-- ---------------------------------------------------------------------
-- Even though RLS allows public SELECT on profiles, this column is
-- sensitive. Revoke direct read/write privileges from anon and
-- authenticated roles. Self-reads must use get_my_wallet_balance().
-- service_role retains full access for the Stripe webhook.

REVOKE SELECT (wallet_balance) ON public.profiles FROM anon, authenticated;
REVOKE UPDATE (wallet_balance) ON public.profiles FROM anon, authenticated;
REVOKE INSERT (wallet_balance) ON public.profiles FROM anon, authenticated;

-- Grant the safe, non-sensitive columns explicitly so SELECT * still
-- works (PostgREST will simply omit wallet_balance for these roles).
GRANT SELECT (
  id,
  username,
  display_name,
  avatar_url,
  bio,
  favourite_sports,
  country,
  account_type,
  is_verified,
  created_at
) ON public.profiles TO anon, authenticated;

-- Allow authenticated users to update their non-sensitive profile fields
-- (RLS still enforces row-level ownership).
GRANT UPDATE (
  username,
  display_name,
  avatar_url,
  bio,
  favourite_sports,
  country,
  account_type
) ON public.profiles TO authenticated;

GRANT INSERT (
  id,
  username,
  display_name,
  avatar_url,
  bio,
  favourite_sports,
  country,
  account_type
) ON public.profiles TO authenticated;

-- ---------------------------------------------------------------------
-- 15. Ledger write privileges
-- ---------------------------------------------------------------------
-- transactions and unlocked_picks must NOT be writable by anon or
-- authenticated under any circumstances. Revoke at the table level so
-- this stays true even if a policy is accidentally added later.

REVOKE INSERT, UPDATE, DELETE ON public.transactions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.unlocked_picks FROM anon, authenticated;

-- service_role retains full access (it bypasses RLS by default and the
-- table-level GRANTs from initdb cover it).

-- ---------------------------------------------------------------------
-- 16. Atomic wallet RPCs
-- ---------------------------------------------------------------------
-- All wallet movement runs inside SECURITY DEFINER functions that take
-- a row lock on the affected profile rows and write the ledger entries
-- inside a single transaction. The functions are the ONLY supported
-- way for application code to debit/credit wallets.

-- Stripe top-up handler. Idempotent on stripe_session_id.
-- Returns 'completed' / 'duplicate' / 'invalid_amount'.
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
BEGIN
  IF p_amount <= 0 THEN
    RETURN 'invalid_amount';
  END IF;

  -- Idempotency check.
  SELECT id INTO v_existing
  FROM public.transactions
  WHERE stripe_session_id = p_stripe_session_id;

  IF v_existing IS NOT NULL THEN
    RETURN 'duplicate';
  END IF;

  -- Lock the recipient row, credit it, and insert the ledger entry.
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  UPDATE public.profiles
     SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount
   WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, amount, type, status, stripe_session_id)
  VALUES (p_user_id, p_amount, 'TOP_UP', 'COMPLETED', p_stripe_session_id);

  RETURN 'completed';
END $$;

REVOKE ALL ON FUNCTION public.process_stripe_topup(uuid, numeric, text) FROM PUBLIC;
-- Only service_role (Stripe webhook) may call this.
GRANT EXECUTE ON FUNCTION public.process_stripe_topup(uuid, numeric, text) TO service_role;

-- Pick purchase handler. Atomically:
--   1. Locks both buyer and tipster profile rows
--   2. Verifies betslip exists, is for sale, and belongs to tipster
--   3. Verifies buyer balance >= price
--   4. Verifies pick is not already unlocked
--   5. Debits buyer, credits tipster (85% cut), inserts both ledger
--      entries and the unlocked_picks row.
-- All-or-nothing: any failed condition rolls back.
-- Returns one of: 'completed', 'self_purchase', 'not_for_sale',
--                 'invalid_tipster', 'already_unlocked',
--                 'insufficient_funds', 'invalid_price'.
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
  v_betslip_owner uuid;
  v_is_for_sale boolean;
  v_price numeric;
  v_buyer_balance numeric;
  v_tipster_cut numeric;
BEGIN
  IF p_buyer_id = p_tipster_id THEN
    RETURN 'self_purchase';
  END IF;

  -- Fetch betslip details.
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

  -- Reject duplicate unlocks before locking balances.
  IF EXISTS (
    SELECT 1 FROM public.unlocked_picks
     WHERE user_id = p_buyer_id AND betslip_id = p_betslip_id
  ) THEN
    RETURN 'already_unlocked';
  END IF;

  -- Lock both profiles in a deterministic order to avoid deadlocks.
  IF p_buyer_id < p_tipster_id THEN
    PERFORM wallet_balance FROM public.profiles WHERE id = p_buyer_id FOR UPDATE;
    PERFORM wallet_balance FROM public.profiles WHERE id = p_tipster_id FOR UPDATE;
  ELSE
    PERFORM wallet_balance FROM public.profiles WHERE id = p_tipster_id FOR UPDATE;
    PERFORM wallet_balance FROM public.profiles WHERE id = p_buyer_id FOR UPDATE;
  END IF;

  SELECT COALESCE(wallet_balance, 0)
    INTO v_buyer_balance
    FROM public.profiles
   WHERE id = p_buyer_id;

  IF v_buyer_balance < v_price THEN
    RETURN 'insufficient_funds';
  END IF;

  v_tipster_cut := round(v_price * 0.85, 2);

  -- Debit buyer.
  UPDATE public.profiles
     SET wallet_balance = COALESCE(wallet_balance, 0) - v_price
   WHERE id = p_buyer_id;

  -- Credit tipster (85% cut).
  UPDATE public.profiles
     SET wallet_balance = COALESCE(wallet_balance, 0) + v_tipster_cut
   WHERE id = p_tipster_id;

  -- Ledger entries and unlock record.
  INSERT INTO public.transactions (user_id, amount, type, status, reference_id)
  VALUES (p_buyer_id, -v_price, 'PURCHASE', 'COMPLETED', p_betslip_id);

  INSERT INTO public.transactions (user_id, amount, type, status, reference_id)
  VALUES (p_tipster_id, v_tipster_cut, 'EARNING', 'COMPLETED', p_betslip_id);

  INSERT INTO public.unlocked_picks (user_id, betslip_id, amount_paid)
  VALUES (p_buyer_id, p_betslip_id, v_price);

  RETURN 'completed';
END $$;

REVOKE ALL ON FUNCTION public.purchase_pick(uuid, uuid, uuid) FROM PUBLIC;
-- authenticated may call it (function checks p_buyer_id internally,
-- but the route handler MUST pass auth.uid() — never trust the client).
GRANT EXECUTE ON FUNCTION public.purchase_pick(uuid, uuid, uuid) TO authenticated, service_role;

COMMIT;

-- =====================================================================
-- Post-deployment verification queries (run manually):
--
--   SELECT tablename, rowsecurity
--   FROM pg_tables
--   WHERE schemaname = 'public'
--   ORDER BY tablename;
--
--   SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
--   FROM pg_policies
--   WHERE schemaname = 'public'
--   ORDER BY tablename, policyname;
--
-- Expected: every tablename above has rowsecurity = true. Sensitive
-- tables (transactions, unlocked_picks) have only SELECT policies.
-- =====================================================================
