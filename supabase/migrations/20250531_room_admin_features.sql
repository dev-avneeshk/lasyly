-- =====================================================================
-- Migration: Room Admin/Mod Features (Discord-like)
-- =====================================================================
-- Adds:
--   1. pinned_messages table
--   2. room_bans table
--   3. RPC for promoting/demoting members
--   4. RPC for banning/unbanning users
--   5. room_audit_log table for tracking admin actions
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Pinned Messages
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.pinned_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  pinned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  pinned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, message_id)
);

ALTER TABLE public.pinned_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pinned_messages_select"
  ON public.pinned_messages FOR SELECT
  USING (
    public.room_is_public(room_id)
    OR public.is_room_member(room_id, auth.uid())
  );

CREATE POLICY "pinned_messages_insert_admin"
  ON public.pinned_messages FOR INSERT
  WITH CHECK (
    public.is_room_admin(room_id, auth.uid())
  );

CREATE POLICY "pinned_messages_delete_admin"
  ON public.pinned_messages FOR DELETE
  USING (
    public.is_room_admin(room_id, auth.uid())
  );

-- ---------------------------------------------------------------------
-- 2. Room Bans
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.room_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  banned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

ALTER TABLE public.room_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "room_bans_select_admin"
  ON public.room_bans FOR SELECT
  USING (
    public.is_room_admin(room_id, auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "room_bans_insert_admin"
  ON public.room_bans FOR INSERT
  WITH CHECK (
    public.is_room_admin(room_id, auth.uid())
  );

CREATE POLICY "room_bans_delete_admin"
  ON public.room_bans FOR DELETE
  USING (
    public.is_room_admin(room_id, auth.uid())
  );

-- ---------------------------------------------------------------------
-- 3. Room Audit Log
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.room_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.room_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "room_audit_log_select_admin"
  ON public.room_audit_log FOR SELECT
  USING (
    public.is_room_admin(room_id, auth.uid())
  );

CREATE POLICY "room_audit_log_insert_admin"
  ON public.room_audit_log FOR INSERT
  WITH CHECK (
    public.is_room_admin(room_id, auth.uid())
  );

-- ---------------------------------------------------------------------
-- 4. RPC: Promote/Demote Member
-- ---------------------------------------------------------------------
-- Only the room owner can promote to moderator or demote back to member.
-- Moderators cannot promote others.

CREATE OR REPLACE FUNCTION public.room_set_member_role(
  p_room_id UUID,
  p_target_user_id UUID,
  p_new_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_target_role TEXT;
BEGIN
  v_caller_id := auth.uid();

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Only allow 'moderator' or 'member' as target roles
  IF p_new_role NOT IN ('moderator', 'member') THEN
    RETURN jsonb_build_object('error', 'Invalid role. Must be moderator or member.');
  END IF;

  -- Get caller's role
  SELECT role INTO v_caller_role
  FROM public.room_members
  WHERE room_id = p_room_id AND user_id = v_caller_id;

  IF v_caller_role IS NULL THEN
    RETURN jsonb_build_object('error', 'You are not a member of this room.');
  END IF;

  -- Only owner can change roles
  IF v_caller_role != 'owner' THEN
    RETURN jsonb_build_object('error', 'Only the room owner can change member roles.');
  END IF;

  -- Get target's current role
  SELECT role INTO v_target_role
  FROM public.room_members
  WHERE room_id = p_room_id AND user_id = p_target_user_id;

  IF v_target_role IS NULL THEN
    RETURN jsonb_build_object('error', 'Target user is not a member of this room.');
  END IF;

  -- Cannot change owner's role
  IF v_target_role = 'owner' THEN
    RETURN jsonb_build_object('error', 'Cannot change the owner role.');
  END IF;

  -- Cannot set same role
  IF v_target_role = p_new_role THEN
    RETURN jsonb_build_object('error', 'User already has this role.');
  END IF;

  -- Update the role
  UPDATE public.room_members
  SET role = p_new_role
  WHERE room_id = p_room_id AND user_id = p_target_user_id;

  -- Log the action
  INSERT INTO public.room_audit_log (room_id, actor_id, action, target_id, metadata)
  VALUES (p_room_id, v_caller_id, 'role_change', p_target_user_id,
    jsonb_build_object('old_role', v_target_role, 'new_role', p_new_role));

  RETURN jsonb_build_object('success', true, 'new_role', p_new_role);
END;
$$;

REVOKE ALL ON FUNCTION public.room_set_member_role(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.room_set_member_role(UUID, UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------
-- 5. RPC: Kick Member
-- ---------------------------------------------------------------------
-- Owner can kick anyone. Moderator can kick members (not other mods).

CREATE OR REPLACE FUNCTION public.room_kick_member(
  p_room_id UUID,
  p_target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_target_role TEXT;
BEGIN
  v_caller_id := auth.uid();

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Cannot kick yourself
  IF v_caller_id = p_target_user_id THEN
    RETURN jsonb_build_object('error', 'You cannot kick yourself. Use leave instead.');
  END IF;

  -- Get caller's role
  SELECT role INTO v_caller_role
  FROM public.room_members
  WHERE room_id = p_room_id AND user_id = v_caller_id;

  IF v_caller_role IS NULL OR v_caller_role = 'member' THEN
    RETURN jsonb_build_object('error', 'You do not have permission to kick members.');
  END IF;

  -- Get target's role
  SELECT role INTO v_target_role
  FROM public.room_members
  WHERE room_id = p_room_id AND user_id = p_target_user_id;

  IF v_target_role IS NULL THEN
    RETURN jsonb_build_object('error', 'Target user is not a member of this room.');
  END IF;

  -- Cannot kick owner
  IF v_target_role = 'owner' THEN
    RETURN jsonb_build_object('error', 'Cannot kick the room owner.');
  END IF;

  -- Moderators cannot kick other moderators
  IF v_caller_role = 'moderator' AND v_target_role = 'moderator' THEN
    RETURN jsonb_build_object('error', 'Moderators cannot kick other moderators.');
  END IF;

  -- Remove membership
  DELETE FROM public.room_members
  WHERE room_id = p_room_id AND user_id = p_target_user_id;

  -- Log the action
  INSERT INTO public.room_audit_log (room_id, actor_id, action, target_id, metadata)
  VALUES (p_room_id, v_caller_id, 'kick', p_target_user_id,
    jsonb_build_object('target_role', v_target_role));

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.room_kick_member(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.room_kick_member(UUID, UUID) TO authenticated;

-- ---------------------------------------------------------------------
-- 6. RPC: Ban Member
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.room_ban_member(
  p_room_id UUID,
  p_target_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_target_role TEXT;
BEGIN
  v_caller_id := auth.uid();

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF v_caller_id = p_target_user_id THEN
    RETURN jsonb_build_object('error', 'You cannot ban yourself.');
  END IF;

  -- Get caller's role
  SELECT role INTO v_caller_role
  FROM public.room_members
  WHERE room_id = p_room_id AND user_id = v_caller_id;

  IF v_caller_role IS NULL OR v_caller_role = 'member' THEN
    RETURN jsonb_build_object('error', 'You do not have permission to ban members.');
  END IF;

  -- Get target's role (may be null if already kicked)
  SELECT role INTO v_target_role
  FROM public.room_members
  WHERE room_id = p_room_id AND user_id = p_target_user_id;

  -- Cannot ban owner
  IF v_target_role = 'owner' THEN
    RETURN jsonb_build_object('error', 'Cannot ban the room owner.');
  END IF;

  -- Moderators cannot ban other moderators
  IF v_caller_role = 'moderator' AND v_target_role = 'moderator' THEN
    RETURN jsonb_build_object('error', 'Moderators cannot ban other moderators.');
  END IF;

  -- Remove membership if exists
  DELETE FROM public.room_members
  WHERE room_id = p_room_id AND user_id = p_target_user_id;

  -- Insert ban record (upsert)
  INSERT INTO public.room_bans (room_id, user_id, banned_by, reason)
  VALUES (p_room_id, p_target_user_id, v_caller_id, p_reason)
  ON CONFLICT (room_id, user_id) DO UPDATE SET
    banned_by = v_caller_id,
    reason = COALESCE(p_reason, public.room_bans.reason),
    banned_at = now();

  -- Log the action
  INSERT INTO public.room_audit_log (room_id, actor_id, action, target_id, metadata)
  VALUES (p_room_id, v_caller_id, 'ban', p_target_user_id,
    jsonb_build_object('reason', COALESCE(p_reason, 'No reason provided')));

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.room_ban_member(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.room_ban_member(UUID, UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------
-- 7. RPC: Unban Member
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.room_unban_member(
  p_room_id UUID,
  p_target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
BEGIN
  v_caller_id := auth.uid();

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT role INTO v_caller_role
  FROM public.room_members
  WHERE room_id = p_room_id AND user_id = v_caller_id;

  IF v_caller_role IS NULL OR v_caller_role = 'member' THEN
    RETURN jsonb_build_object('error', 'You do not have permission to unban members.');
  END IF;

  DELETE FROM public.room_bans
  WHERE room_id = p_room_id AND user_id = p_target_user_id;

  -- Log the action
  INSERT INTO public.room_audit_log (room_id, actor_id, action, target_id, metadata)
  VALUES (p_room_id, v_caller_id, 'unban', p_target_user_id, '{}');

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.room_unban_member(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.room_unban_member(UUID, UUID) TO authenticated;

-- ---------------------------------------------------------------------
-- 8. Update join route to check bans
-- ---------------------------------------------------------------------
-- We add a helper function that the join API can call.

CREATE OR REPLACE FUNCTION public.is_room_banned(p_room_id UUID, p_user_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_bans
    WHERE room_id = p_room_id AND user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_room_banned(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_room_banned(UUID, UUID) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 9. Indexes for performance
-- ---------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_pinned_messages_room ON public.pinned_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_room_bans_room ON public.room_bans(room_id);
CREATE INDEX IF NOT EXISTS idx_room_bans_user ON public.room_bans(user_id);
CREATE INDEX IF NOT EXISTS idx_room_audit_log_room ON public.room_audit_log(room_id);
CREATE INDEX IF NOT EXISTS idx_room_audit_log_created ON public.room_audit_log(room_id, created_at DESC);

COMMIT;
