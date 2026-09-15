-- =====================================================================
-- Cheapen the hot-path RLS policies
-- =====================================================================
-- Two mechanical costs dominate the chat and feed read paths, and neither is
-- about policy *logic* — the security semantics below are byte-for-byte
-- equivalent to what they replace.
--
--   1. can_view_subchannel / can_post_subchannel are LANGUAGE plpgsql
--      (20260902:154, :176). A plpgsql function pays executor setup on every
--      invocation and can never be inlined. They are invoked once per
--      candidate `messages` row, so a 50-message page pays it 50 times before
--      the 2-3 index lookups each one performs. Rewritten here as
--      LANGUAGE sql — same reads, same result, far less per-row overhead.
--
--   2. `auth.uid()` appears bare in the policy predicates, so it is evaluated
--      per row. Wrapping it as `(SELECT auth.uid())` turns it into an InitPlan
--      the planner evaluates once per statement. This is the documented
--      Supabase RLS performance idiom and is purely mechanical.
--
-- Also here: revert `messages` REPLICA IDENTITY to DEFAULT. 20260913 set it to
-- FULL "for clarity", which makes Postgres write the entire old tuple into the
-- WAL for every UPDATE and DELETE. `messages` has no UPDATE policy at all, and
-- the Realtime subscription filters INSERTs (where the full new row is always
-- emitted regardless), so FULL buys nothing and costs WAL volume on every
-- retention batch — 5,000 full tuples per 5,000-row delete.
--
-- ⚠ AND ONE SECURITY FIX. The verification block at the end of this file aborted
-- the first apply attempt with:
--
--     Permissive policy present after rebuild:
--       betslips."Betslips are viewable by everyone." (SELECT),
--       reactions."Reactions are viewable by everyone." (SELECT)
--
-- Those `USING (true)` policies exist in the live database but in no migration in
-- this repo, and because Postgres ORs permissive policies they have been
-- cancelling out `betslips_select_visible` / `reactions_select_visible` entirely
-- since 20260522 shipped — every betslip and reaction has been world-readable,
-- private rooms included. Section 3 now rebuilds those tables' policies from
-- scratch instead of dropping by name. See the note there.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Sub-channel permission helpers: plpgsql → sql
-- ---------------------------------------------------------------------
-- COALESCE(..., false) preserves the original "no such sub-channel → false"
-- behaviour; a bare SELECT over zero rows would return NULL.
CREATE OR REPLACE FUNCTION public.can_view_subchannel(p_subchannel_id UUID, p_user_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT CASE
      WHEN sc.visibility = 'public'
        THEN public.room_is_public(sc.room_id)
             OR public.is_room_member(sc.room_id, p_user_id)
      ELSE public.is_room_member(sc.room_id, p_user_id)
    END
    FROM public.room_subchannels sc
    WHERE sc.id = p_subchannel_id
  ), false);
$$;
REVOKE ALL ON FUNCTION public.can_view_subchannel(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_subchannel(UUID, UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_post_subchannel(p_subchannel_id UUID, p_user_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT CASE
      WHEN public.is_room_muted(sc.room_id, p_user_id) THEN false
      WHEN sc.post_policy = 'admins'
        THEN public.is_room_admin(sc.room_id, p_user_id)
      ELSE public.is_room_member(sc.room_id, p_user_id)
    END
    FROM public.room_subchannels sc
    WHERE sc.id = p_subchannel_id
  ), false);
$$;
REVOKE ALL ON FUNCTION public.can_post_subchannel(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_post_subchannel(UUID, UUID) TO anon, authenticated, service_role;

-- Mark the leaf helpers PARALLEL SAFE too; bodies are unchanged.
CREATE OR REPLACE FUNCTION public.is_room_member(p_room_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE PARALLEL SAFE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_members
    WHERE room_id = p_room_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_room_admin(p_room_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE PARALLEL SAFE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_members
    WHERE room_id = p_room_id
      AND user_id = p_user_id
      AND role IN ('owner', 'moderator')
  );
$$;

CREATE OR REPLACE FUNCTION public.room_is_public(p_room_id uuid)
RETURNS boolean LANGUAGE sql STABLE PARALLEL SAFE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rooms
    WHERE id = p_room_id AND type IN ('Public', 'Tipster')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_room_muted(p_room_id UUID, p_user_id UUID)
RETURNS boolean LANGUAGE sql STABLE PARALLEL SAFE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_mutes
    WHERE room_id = p_room_id AND user_id = p_user_id AND muted_until > now()
  );
$$;

-- ---------------------------------------------------------------------
-- 2. Hoist auth.uid() out of the per-row loop on the room/chat policies
-- ---------------------------------------------------------------------
-- Same predicates as 20260905_fix_permissive_rls_policies.sql, with
-- auth.uid() → (SELECT auth.uid()).
DROP POLICY IF EXISTS "rooms_select_visible" ON public.rooms;
CREATE POLICY "rooms_select_visible" ON public.rooms FOR SELECT
  USING (
    type IN ('Public', 'Tipster')
    OR creator_id = (SELECT auth.uid())
    OR public.is_room_member(id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "messages_select_visible" ON public.messages;
CREATE POLICY "messages_select_visible" ON public.messages FOR SELECT
  USING (public.can_view_subchannel(subchannel_id, (SELECT auth.uid())));

DROP POLICY IF EXISTS "messages_insert_member" ON public.messages;
CREATE POLICY "messages_insert_member" ON public.messages FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND is_system = false
    AND public.can_post_subchannel(subchannel_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "messages_delete_self_or_admin" ON public.messages;
CREATE POLICY "messages_delete_self_or_admin" ON public.messages FOR DELETE
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_room_admin(room_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "room_members_select_visible" ON public.room_members;
CREATE POLICY "room_members_select_visible" ON public.room_members FOR SELECT
  USING (
    public.room_is_public(room_id)
    OR user_id = (SELECT auth.uid())
    OR public.is_room_member(room_id, (SELECT auth.uid()))
  );

-- ---------------------------------------------------------------------
-- 3. betslips / reactions / unlocked_picks / transactions
-- ---------------------------------------------------------------------
-- ⚠ SECURITY FIX, not just a performance one.
--
-- The verification block at the end of this file failed on first run with:
--
--   Permissive policy present after rebuild:
--     betslips."Betslips are viewable by everyone." (SELECT),
--     reactions."Reactions are viewable by everyone." (SELECT)
--
-- Those two policies are `USING (true)` and exist in the live database but in NO
-- migration in this repo — they were created in the Supabase dashboard alongside
-- the `betslips` and `reactions` tables themselves, which are likewise not in
-- version control.
--
-- Postgres ORs permissive policies. So the carefully-scoped
-- `betslips_select_visible` that 20260522_security_rls_baseline.sql introduced
-- (owner OR public room OR room member OR follower) has never actually
-- restricted anything: a sibling `USING (true)` policy made every betslip and
-- every reaction world-readable, including betslips in PRIVATE rooms and
-- for-sale picks. The baseline could not have caught this, because it only ran
-- `DROP POLICY IF EXISTS "betslips_select_visible"` — it dropped by its own
-- naming convention and never looked at what was already there.
--
-- This is precisely the bug class 20260905_fix_permissive_rls_policies.sql was
-- written to fix on rooms/messages/room_members, and it fixed it the only way
-- that works: iterate pg_policies and drop everything, rather than guessing
-- names. The same treatment is applied here.
--
-- Every policy on these four tables is dropped and the canonical set from
-- 20260522 recreated, so a legacy permissive UPDATE or DELETE (which would let
-- anyone edit or delete anyone's betslip) is removed too — the guard below only
-- inspects SELECT/UPDATE/DELETE `qual`, so a permissive INSERT would have slipped
-- past it.
--
-- Guarded on table existence: betslips / reactions / unlocked_picks are not
-- defined in this repo, so a fresh or partially-migrated environment may not
-- have them.
DO $wipe$
DECLARE
  r RECORD;
  v_dropped int := 0;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('betslips', 'reactions', 'unlocked_picks', 'transactions')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    RAISE NOTICE 'dropped policy "%" on %', r.policyname, r.tablename;
    v_dropped := v_dropped + 1;
  END LOOP;
  RAISE NOTICE 'dropped % pre-existing policies before rebuild', v_dropped;
END
$wipe$;

-- RLS must be ON. If a permissive policy was masking a table with RLS disabled,
-- the recreated policies would otherwise not bind at all.
DO $enable$
DECLARE
  t text;
  -- Declared rather than inlined, matching the proven FOREACH pattern in
  -- 20260522_security_rls_baseline.sql:492.
  v_tables text[] := ARRAY['betslips', 'reactions', 'unlocked_picks', 'transactions'];
BEGIN
  FOREACH t IN ARRAY v_tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END
$enable$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'betslips') THEN
    CREATE POLICY "betslips_select_visible"
      ON public.betslips FOR SELECT
      USING (
        user_id = (SELECT auth.uid())
        OR (room_id IS NOT NULL AND public.room_is_public(room_id))
        OR (room_id IS NOT NULL AND public.is_room_member(room_id, (SELECT auth.uid())))
        OR (
          room_id IS NULL
          AND (SELECT auth.uid()) IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.follows f
            WHERE f.follower_id = (SELECT auth.uid())
              AND f.following_id = betslips.user_id
          )
        )
      );

    -- Write policies recreated verbatim from 20260522. They were dropped by the
    -- wipe above along with the permissive SELECT policy, so they must come back
    -- or owners lose the ability to edit their own betslips.
    CREATE POLICY "betslips_insert_own"
      ON public.betslips FOR INSERT
      WITH CHECK ((SELECT auth.uid()) = user_id);

    CREATE POLICY "betslips_update_own"
      ON public.betslips FOR UPDATE
      USING ((SELECT auth.uid()) = user_id)
      WITH CHECK ((SELECT auth.uid()) = user_id);

    CREATE POLICY "betslips_delete_own"
      ON public.betslips FOR DELETE
      USING ((SELECT auth.uid()) = user_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'reactions') THEN
    CREATE POLICY "reactions_select_visible"
      ON public.reactions FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.betslips b
          WHERE b.id = reactions.betslip_id
            AND (
              b.user_id = (SELECT auth.uid())
              OR (b.room_id IS NOT NULL AND public.room_is_public(b.room_id))
              OR (b.room_id IS NOT NULL AND public.is_room_member(b.room_id, (SELECT auth.uid())))
              OR (
                b.room_id IS NULL
                AND (SELECT auth.uid()) IS NOT NULL
                AND EXISTS (
                  SELECT 1 FROM public.follows f
                  WHERE f.follower_id = (SELECT auth.uid())
                    AND f.following_id = b.user_id
                )
              )
            )
        )
      );

    CREATE POLICY "reactions_insert_own"
      ON public.reactions FOR INSERT
      WITH CHECK ((SELECT auth.uid()) = user_id);

    CREATE POLICY "reactions_delete_own"
      ON public.reactions FOR DELETE
      USING ((SELECT auth.uid()) = user_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'unlocked_picks') THEN
    -- SELECT only, deliberately. Writes go through purchase_pick (SECURITY
    -- DEFINER) and are additionally blocked by the table-level
    -- `REVOKE INSERT, UPDATE, DELETE ... FROM anon, authenticated` in 20260522.
    CREATE POLICY "unlocked_picks_select_owner"
      ON public.unlocked_picks FOR SELECT
      USING (
        (SELECT auth.uid()) = user_id
        OR EXISTS (
          SELECT 1 FROM public.betslips b
          WHERE b.id = unlocked_picks.betslip_id
            AND b.user_id = (SELECT auth.uid())
        )
      );
  END IF;
END
$$;

-- transactions: SELECT only. The ledger is append-only via service-role and the
-- wallet RPCs; 20260522 also revokes INSERT/UPDATE/DELETE at the table level.
CREATE POLICY "transactions_select_own"
  ON public.transactions FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- 4. messages REPLICA IDENTITY: FULL → DEFAULT
-- ---------------------------------------------------------------------
ALTER TABLE public.messages REPLICA IDENTITY DEFAULT;

-- ---------------------------------------------------------------------
-- 5. Anti-permissive guard
-- ---------------------------------------------------------------------
-- Extends the 20260905 guard in two ways, both prompted by what it caught here:
--
--   1. It now also inspects `with_check`, so a `WITH CHECK (true)` INSERT or
--      UPDATE policy is flagged. The original only looked at `qual` and skipped
--      cmd='INSERT' entirely, which means a permissive INSERT policy — "anyone
--      may insert any row" — would have passed silently.
--   2. It reports the offending predicate, not just the policy name, so the next
--      failure is diagnosable without a separate query.
DO $verify$
DECLARE
  v_bad TEXT;
BEGIN
  SELECT string_agg(
           format('%s.%s (%s: %s)', tablename, policyname, cmd,
                  COALESCE(NULLIF(btrim(qual), ''), btrim(with_check), 'true')),
           ', '
         )
  INTO v_bad
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('rooms', 'messages', 'room_members', 'betslips',
                      'reactions', 'transactions', 'unlocked_picks')
    AND (
      -- Permissive read/modify predicate.
      (cmd <> 'INSERT' AND (qual IS NULL OR btrim(lower(qual)) = 'true'))
      -- Permissive write predicate.
      OR (cmd IN ('INSERT', 'UPDATE', 'ALL')
          AND with_check IS NOT NULL
          AND btrim(lower(with_check)) = 'true')
    );

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Permissive policy present after rebuild: %', v_bad;
  END IF;
END
$verify$;

COMMIT;

-- =====================================================================
-- ⚠ FOLLOW-UP: audit the tables this migration does NOT rebuild
-- =====================================================================
-- The permissive-policy shadowing fixed above was not a one-off. It happened
-- because `betslips` and `reactions` were created in the Supabase dashboard, and
-- the dashboard's default "viewable by everyone" policy was never removed when
-- 20260522 added a scoped one alongside it. Any other dashboard-created table
-- can have the same problem, and the guard above only covers seven tables.
--
-- Run this read-only query and review every row. A table appearing here has a
-- `USING (true)` SELECT policy; that is CORRECT for genuinely public scraper data
-- (espn_*, nba_*, matches, blog_posts) and WRONG for anything user-scoped:
--
--   SELECT p.tablename,
--          count(*) FILTER (WHERE p.qual IS NULL OR btrim(lower(p.qual)) = 'true')
--            AS permissive_select,
--          count(*) FILTER (WHERE p.qual IS NOT NULL AND btrim(lower(p.qual)) <> 'true')
--            AS scoped_select,
--          string_agg(p.policyname, ' | ') AS policies
--   FROM pg_policies p
--   WHERE p.schemaname = 'public' AND p.cmd = 'SELECT'
--   GROUP BY p.tablename
--   HAVING count(*) FILTER (WHERE p.qual IS NULL OR btrim(lower(p.qual)) = 'true') > 0
--   ORDER BY scoped_select DESC, p.tablename;
--
-- Rows with BOTH permissive_select > 0 AND scoped_select > 0 are the dangerous
-- shape — someone wrote a restrictive rule that a permissive sibling is
-- cancelling out. `user_achievements` is a known instance
-- (20250528_create_achievements.sql:12-13 has select_own next to
-- select_public USING (true)); it is left alone here because public readability
-- is plausibly intended for profile pages, but confirm that is deliberate.
-- =====================================================================

-- =====================================================================
-- Post-deployment verification (run manually):
--
--   SELECT proname, prolang::regproc, provolatile, proparallel
--   FROM pg_proc WHERE proname IN
--     ('can_view_subchannel','can_post_subchannel','is_room_member',
--      'is_room_admin','room_is_public','is_room_muted');
--   -- prolang must be `sql`, provolatile 's', proparallel 's'
--
--   SELECT relreplident FROM pg_class WHERE relname = 'messages';  -- 'd'
--
--   -- And confirm the per-row function call collapsed to an InitPlan:
--   EXPLAIN (ANALYZE) SELECT id, content FROM public.messages
--   WHERE subchannel_id = '<uuid>' ORDER BY created_at DESC LIMIT 50;
-- =====================================================================
