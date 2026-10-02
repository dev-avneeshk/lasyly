-- AUTHZ-5: moderators could bypass the room role hierarchy through PostgREST.
--
-- The routes and RPCs forbid a moderator from acting on the owner or on other
-- moderators, but the table policies only checked `is_room_admin`, so a
-- moderator could directly: set rooms.creator_id to themselves (then DELETE the
-- room as "creator"), ban or remove the owner, mute the owner or a fellow
-- moderator, and forge room_audit_log rows.
--
-- Every legitimate write already goes elsewhere: bans/kicks/roles through the
-- SECURITY DEFINER room_* RPCs (which check the hierarchy), mutes through
-- /api/rooms/[id]/members/mute with the service role after its own checks, and
-- no app path updates rooms with a user client. So the admin write policies
-- go; members can still leave (delete their own membership) and creators can
-- still delete their own room.
--
-- Idempotent (REVOKE / DROP POLICY IF EXISTS / CREATE after DROP) and
-- non-destructive. Files only; apply through the normal migration process.
DO $$
BEGIN
  IF to_regclass('public.rooms') IS NOT NULL THEN
    REVOKE UPDATE ON public.rooms FROM anon, authenticated;
    DROP POLICY IF EXISTS "rooms_update_admin" ON public.rooms;
  END IF;

  IF to_regclass('public.room_members') IS NOT NULL THEN
    DROP POLICY IF EXISTS "room_members_delete_self_or_admin" ON public.room_members;
    DROP POLICY IF EXISTS "room_members_delete_self" ON public.room_members;
    CREATE POLICY "room_members_delete_self" ON public.room_members FOR DELETE
      USING (user_id = (SELECT auth.uid()));
  END IF;

  IF to_regclass('public.room_bans') IS NOT NULL THEN
    DROP POLICY IF EXISTS "room_bans_insert_admin" ON public.room_bans;
    DROP POLICY IF EXISTS "room_bans_delete_admin" ON public.room_bans;
  END IF;

  IF to_regclass('public.room_mutes') IS NOT NULL THEN
    DROP POLICY IF EXISTS "room_mutes_insert_admin" ON public.room_mutes;
    DROP POLICY IF EXISTS "room_mutes_delete_admin" ON public.room_mutes;
  END IF;

  IF to_regclass('public.room_audit_log') IS NOT NULL THEN
    DROP POLICY IF EXISTS "room_audit_log_insert_admin" ON public.room_audit_log;
  END IF;
END $$;
