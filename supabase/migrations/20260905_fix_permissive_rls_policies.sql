-- =====================================================================
-- Remove permissive RLS policies leaking private room data
-- =====================================================================
-- FINDING
--
-- With only the PUBLIC anon key (the one shipped in the browser bundle), an
-- unauthenticated caller could read rows belonging to a PRIVATE room:
--
--   GET /rest/v1/rooms?id=eq.<private>         -> 1 row  (name, description, type)
--   GET /rest/v1/messages?room_id=eq.<private> -> 1 row  (full message content)
--   GET /rest/v1/room_members?room_id=eq.<...> -> 1 row  (user_id, role)
--   GET /rest/v1/room_subchannels?room_id=...  -> 0 rows (correctly filtered)
--
-- room_subchannels filtering correctly is the tell: RLS is enabled and working
-- on this schema, so the three leaking tables must carry an ADDITIONAL
-- permissive SELECT policy. Postgres ORs policies together, so one
-- `USING (true)` policy (the classic "Enable read access for all users"
-- template from early Supabase setup) defeats every stricter policy beside it.
--
-- The named policies from 20260522_security_rls_baseline.sql are correct. They
-- were added with DROP POLICY IF EXISTS on their OWN names, which never removed
-- a legacy policy sitting under a different name.
--
-- Writes were NOT affected: INSERT/UPDATE/DELETE as anon all matched 0 rows,
-- verified against production. This is a read-confidentiality bug only.
--
-- FIX
--
-- Drop EVERY policy on the three affected tables by iterating pg_policies
-- (name-agnostic, so unknown legacy names cannot survive), then recreate only
-- the canonical set. Both steps run in one transaction, so the tables are never
-- left unprotected.
--
-- Idempotent; safe to re-run.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Drop all existing policies on the affected tables
-- ---------------------------------------------------------------------
DO $wipe$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('rooms', 'messages', 'room_members')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    RAISE NOTICE 'dropped policy % on %', r.policyname, r.tablename;
  END LOOP;
END
$wipe$;

-- Belt and braces: RLS must be on. If a permissive policy was masking a
-- disabled-RLS table, this makes the recreated policies actually bind.
ALTER TABLE public.rooms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 1. rooms
-- ---------------------------------------------------------------------
-- Public/Tipster rooms are discoverable by anyone. Private rooms only by the
-- creator and members.
CREATE POLICY "rooms_select_visible" ON public.rooms FOR SELECT
  USING (
    type IN ('Public', 'Tipster')
    OR creator_id = auth.uid()
    OR public.is_room_member(id, auth.uid())
  );

CREATE POLICY "rooms_insert_own" ON public.rooms FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "rooms_update_admin" ON public.rooms FOR UPDATE
  USING (creator_id = auth.uid() OR public.is_room_admin(id, auth.uid()))
  WITH CHECK (creator_id = auth.uid() OR public.is_room_admin(id, auth.uid()));

CREATE POLICY "rooms_delete_creator" ON public.rooms FOR DELETE
  USING (creator_id = auth.uid());

-- ---------------------------------------------------------------------
-- 2. messages
-- ---------------------------------------------------------------------
-- Sub-channel scoped, per 20260902_room_channels_permissions.sql. No UPDATE
-- policy at all, so message content cannot be edited after the fact.
CREATE POLICY "messages_select_visible" ON public.messages FOR SELECT
  USING (public.can_view_subchannel(subchannel_id, auth.uid()));

CREATE POLICY "messages_insert_member" ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND is_system = false
    AND public.can_post_subchannel(subchannel_id, auth.uid())
  );

CREATE POLICY "messages_delete_self_or_admin" ON public.messages FOR DELETE
  USING (user_id = auth.uid() OR public.is_room_admin(room_id, auth.uid()));

-- ---------------------------------------------------------------------
-- 3. room_members
-- ---------------------------------------------------------------------
-- Membership is visible for public rooms, to the member themselves, and to
-- fellow members. Self-joins must be plain members; role changes go through
-- the admin-only RPCs, so there is deliberately no UPDATE policy.
CREATE POLICY "room_members_select_visible" ON public.room_members FOR SELECT
  USING (
    public.room_is_public(room_id)
    OR user_id = auth.uid()
    OR public.is_room_member(room_id, auth.uid())
  );

CREATE POLICY "room_members_insert_self" ON public.room_members FOR INSERT
  WITH CHECK (auth.uid() = user_id AND role = 'member');

CREATE POLICY "room_members_delete_self_or_admin" ON public.room_members FOR DELETE
  USING (user_id = auth.uid() OR public.is_room_admin(room_id, auth.uid()));

-- ---------------------------------------------------------------------
-- 4. Guard against the same class of bug returning
-- ---------------------------------------------------------------------
-- Fail loudly if any policy on these tables is unconditionally permissive.
-- `qual IS NULL` on a SELECT/UPDATE/DELETE policy means USING (true).
DO $verify$
DECLARE
  v_bad TEXT;
BEGIN
  SELECT string_agg(format('%s.%s (%s)', tablename, policyname, cmd), ', ')
  INTO v_bad
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('rooms', 'messages', 'room_members')
    AND cmd <> 'INSERT'
    AND (qual IS NULL OR btrim(lower(qual)) = 'true');

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Permissive policy still present after cleanup: %', v_bad;
  END IF;
END
$verify$;

COMMIT;
