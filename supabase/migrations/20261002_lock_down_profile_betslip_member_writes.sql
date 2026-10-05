-- =====================================================================
-- Migration: close three direct-PostgREST bypasses (audit L-01, AUTHZ-2, AUTHZ-3)
-- =====================================================================
-- Idempotent and non-destructive: only grants and one policy change.
--
-- 1. profiles (L-01). 20260522 revoked wallet_balance column privileges, but
--    Supabase grants SELECT/INSERT/UPDATE on every public table to anon and
--    authenticated at TABLE level, and a column REVOKE does not remove a table
--    grant. So any user could `UPDATE profiles SET wallet_balance=…, xp=…,
--    level=…, is_verified=true` on their own row, and anon could read every
--    balance. Fix: drop the table-level grants, then grant columns explicitly.
--    SELECT covers every column except wallet_balance (computed from the live
--    schema so columns added outside migrations keep working). Writes are
--    limited to the fields /api/profiles/me lets users edit.
--    Consequence: `select('*')` / `RETURNING *` on profiles as anon or
--    authenticated now fails with 42501; name the columns instead.
--
-- 2. betslips (AUTHZ-3). Same pattern for `matches`: the paywall was only a
--    JSON redaction in the feed route, while RLS let anyone SELECT the picks
--    of for-sale slips straight from PostgREST. User clients can no longer read
--    `matches`; the server reads it with the service role after deciding who
--    may see it (owner, free slip, or unlocked).
--
-- 3. room_members (AUTHZ-2). The INSERT policy only checked identity, so any
--    user could insert themselves into a Private room, or one they are banned
--    from. Self-joins are now limited to public rooms and non-banned users.
--    Private / request-mode joins keep working through the SECURITY DEFINER
--    RPCs, which bypass RLS.
--
-- Test: scripts/db/test-direct-write-lockdown.sh (throwaway local Postgres).
-- =====================================================================

-- 1. profiles -------------------------------------------------------------
DO $$
DECLARE
  v_cols text;
BEGIN
  REVOKE SELECT, INSERT, UPDATE ON public.profiles FROM anon, authenticated;

  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO v_cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'profiles'
     AND column_name <> 'wallet_balance';
  EXECUTE format('GRANT SELECT (%s) ON public.profiles TO anon, authenticated', v_cols);
END $$;

GRANT UPDATE (username, display_name, avatar_url, bio, favourite_sports, country, account_type)
  ON public.profiles TO authenticated;
GRANT INSERT (id, username, display_name, avatar_url, bio, favourite_sports, country, account_type)
  ON public.profiles TO authenticated;

-- 2. betslips -------------------------------------------------------------
DO $$
DECLARE
  v_cols text;
BEGIN
  IF to_regclass('public.betslips') IS NULL THEN
    RETURN;
  END IF;

  REVOKE SELECT ON public.betslips FROM anon, authenticated;

  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO v_cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'betslips'
     AND column_name <> 'matches';
  EXECUTE format('GRANT SELECT (%s) ON public.betslips TO anon, authenticated', v_cols);

  -- L-12: a slip is graded once (Pending → result) and its picks/odds are
  -- fixed after posting. Owners could UPDATE any column at any time (turn old
  -- losses into wins, rewrite picks after the games) or INSERT a slip already
  -- 'Won'. Only /api/betslips/[id]/status updates betslips.
  REVOKE UPDATE ON public.betslips FROM anon, authenticated;
  GRANT UPDATE (status, payout) ON public.betslips TO authenticated;
  DROP POLICY IF EXISTS "betslips_update_own" ON public.betslips;
  CREATE POLICY "betslips_update_own" ON public.betslips FOR UPDATE
    USING ((SELECT auth.uid()) = user_id AND status = 'Pending')
    WITH CHECK ((SELECT auth.uid()) = user_id);
  DROP POLICY IF EXISTS "betslips_insert_own" ON public.betslips;
  CREATE POLICY "betslips_insert_own" ON public.betslips FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id AND status = 'Pending' AND payout IS NULL);
END $$;

-- 3. room_members ---------------------------------------------------------
DROP POLICY IF EXISTS "room_members_insert_self" ON public.room_members;
CREATE POLICY "room_members_insert_self" ON public.room_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'member'
    AND public.room_is_public(room_id)
    AND NOT public.is_room_banned(room_id, auth.uid())
  );
