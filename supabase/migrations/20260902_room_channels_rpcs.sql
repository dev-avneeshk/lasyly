-- =====================================================================
-- Room Channels & Permissions — Management RPCs
-- =====================================================================
-- SECURITY DEFINER functions that hold invariants RLS can't easily express:
--   - free-tier limits (<=2 channels/room, <=2 sub-channels/channel)
--   - last/default sub-channel protection
--   - slug/invite-token generation & rotation
--   - private-link join + approval flow
-- All follow the existing RPC style (auth.uid() checks inside, jsonb result,
-- REVOKE FROM PUBLIC + GRANT TO authenticated).
-- =====================================================================

BEGIN;

-- Short URL-safe code generator (base of a uuid, no dashes).
CREATE OR REPLACE FUNCTION public._gen_code(p_len INT)
RETURNS TEXT LANGUAGE sql VOLATILE SET search_path = '' AS $$
  SELECT substr(replace(gen_random_uuid()::text, '-', '') ||
                replace(gen_random_uuid()::text, '-', ''), 1, p_len);
$$;
REVOKE ALL ON FUNCTION public._gen_code(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._gen_code(INT) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- Create channel (level 1). Free tier: max 2 per room.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.room_create_channel(
  p_room_id UUID, p_name TEXT, p_icon TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_owner UUID;
  v_is_pro BOOLEAN;
  v_count INT;
  v_id UUID;
  v_pos INT;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  IF NOT public.is_room_admin(p_room_id, v_uid) THEN
    RETURN jsonb_build_object('error','Only admins can create channels.');
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RETURN jsonb_build_object('error','Channel name is required.');
  END IF;

  SELECT creator_id INTO v_owner FROM public.rooms WHERE id = p_room_id;
  SELECT COALESCE(is_pro, false) INTO v_is_pro FROM public.profiles WHERE id = v_owner;
  SELECT count(*) INTO v_count FROM public.room_channels WHERE room_id = p_room_id;

  IF v_count >= 2 AND NOT COALESCE(v_is_pro, false) THEN
    RETURN jsonb_build_object('error','LIMIT_REACHED','limit','channels');
  END IF;

  SELECT COALESCE(max(position), -1) + 1 INTO v_pos FROM public.room_channels WHERE room_id = p_room_id;

  INSERT INTO public.room_channels (room_id, name, icon, position)
  VALUES (p_room_id, left(trim(p_name), 40), p_icon, v_pos)
  RETURNING id INTO v_id;

  INSERT INTO public.room_audit_log (room_id, actor_id, action, metadata)
  VALUES (p_room_id, v_uid, 'channel_create', jsonb_build_object('channel_id', v_id, 'name', p_name));

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.room_create_channel(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.room_create_channel(UUID, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------
-- Create sub-channel (level 2). Free tier: max 2 per channel.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.room_create_subchannel(
  p_channel_id UUID,
  p_name TEXT,
  p_visibility TEXT DEFAULT 'public',
  p_post_policy TEXT DEFAULT 'members',
  p_join_policy TEXT DEFAULT 'open',
  p_icon TEXT DEFAULT NULL,
  p_topic TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_room UUID;
  v_owner UUID;
  v_is_pro BOOLEAN;
  v_count INT;
  v_id UUID;
  v_pos INT;
  v_slug TEXT;
  v_token TEXT;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;

  SELECT room_id INTO v_room FROM public.room_channels WHERE id = p_channel_id;
  IF v_room IS NULL THEN RETURN jsonb_build_object('error','Channel not found.'); END IF;
  IF NOT public.is_room_admin(v_room, v_uid) THEN
    RETURN jsonb_build_object('error','Only admins can create sub-channels.');
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RETURN jsonb_build_object('error','Sub-channel name is required.');
  END IF;
  IF p_visibility NOT IN ('public','private') THEN
    RETURN jsonb_build_object('error','Invalid visibility.');
  END IF;
  IF p_post_policy NOT IN ('everyone','members','admins') THEN
    RETURN jsonb_build_object('error','Invalid post policy.');
  END IF;
  IF p_join_policy NOT IN ('open','request') THEN
    RETURN jsonb_build_object('error','Invalid join policy.');
  END IF;

  SELECT creator_id INTO v_owner FROM public.rooms WHERE id = v_room;
  SELECT COALESCE(is_pro, false) INTO v_is_pro FROM public.profiles WHERE id = v_owner;
  SELECT count(*) INTO v_count FROM public.room_subchannels WHERE channel_id = p_channel_id;

  IF v_count >= 2 AND NOT COALESCE(v_is_pro, false) THEN
    RETURN jsonb_build_object('error','LIMIT_REACHED','limit','subchannels');
  END IF;

  -- unique slug (retry a couple times on collision)
  LOOP
    v_slug := public._gen_code(8);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.room_subchannels WHERE slug = v_slug);
  END LOOP;

  IF p_visibility = 'private' THEN
    v_token := public._gen_code(32);
  ELSE
    v_token := NULL;
  END IF;

  SELECT COALESCE(max(position), -1) + 1 INTO v_pos FROM public.room_subchannels WHERE channel_id = p_channel_id;

  INSERT INTO public.room_subchannels
    (channel_id, room_id, name, topic, icon, position, visibility, post_policy, join_policy, slug, invite_token, is_default)
  VALUES
    (p_channel_id, v_room, left(trim(p_name), 40), p_topic, p_icon, v_pos,
     p_visibility, p_post_policy, p_join_policy, v_slug, v_token, false)
  RETURNING id INTO v_id;

  INSERT INTO public.room_audit_log (room_id, actor_id, action, metadata)
  VALUES (v_room, v_uid, 'subchannel_create',
          jsonb_build_object('subchannel_id', v_id, 'name', p_name, 'visibility', p_visibility));

  RETURN jsonb_build_object('success', true, 'id', v_id, 'slug', v_slug, 'invite_token', v_token);
END;
$$;
REVOKE ALL ON FUNCTION public.room_create_subchannel(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.room_create_subchannel(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------
-- Update sub-channel (name/topic/icon/policies). Admin only.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.room_update_subchannel(
  p_subchannel_id UUID,
  p_name TEXT DEFAULT NULL,
  p_topic TEXT DEFAULT NULL,
  p_icon TEXT DEFAULT NULL,
  p_post_policy TEXT DEFAULT NULL,
  p_join_policy TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_room UUID;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  SELECT room_id INTO v_room FROM public.room_subchannels WHERE id = p_subchannel_id;
  IF v_room IS NULL THEN RETURN jsonb_build_object('error','Sub-channel not found.'); END IF;
  IF NOT public.is_room_admin(v_room, v_uid) THEN
    RETURN jsonb_build_object('error','Only admins can edit sub-channels.');
  END IF;
  IF p_post_policy IS NOT NULL AND p_post_policy NOT IN ('everyone','members','admins') THEN
    RETURN jsonb_build_object('error','Invalid post policy.');
  END IF;
  IF p_join_policy IS NOT NULL AND p_join_policy NOT IN ('open','request') THEN
    RETURN jsonb_build_object('error','Invalid join policy.');
  END IF;

  UPDATE public.room_subchannels SET
    name        = COALESCE(left(trim(p_name), 40), name),
    topic       = COALESCE(p_topic, topic),
    icon        = COALESCE(p_icon, icon),
    post_policy = COALESCE(p_post_policy, post_policy),
    join_policy = COALESCE(p_join_policy, join_policy)
  WHERE id = p_subchannel_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.room_update_subchannel(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.room_update_subchannel(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------
-- Delete sub-channel. Admin only; cannot delete the default.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.room_delete_subchannel(p_subchannel_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_room UUID;
  v_is_default BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  SELECT room_id, is_default INTO v_room, v_is_default
  FROM public.room_subchannels WHERE id = p_subchannel_id;
  IF v_room IS NULL THEN RETURN jsonb_build_object('error','Sub-channel not found.'); END IF;
  IF NOT public.is_room_admin(v_room, v_uid) THEN
    RETURN jsonb_build_object('error','Only admins can delete sub-channels.');
  END IF;
  IF v_is_default THEN
    RETURN jsonb_build_object('error','Cannot delete the default sub-channel.');
  END IF;

  DELETE FROM public.room_subchannels WHERE id = p_subchannel_id;

  INSERT INTO public.room_audit_log (room_id, actor_id, action, metadata)
  VALUES (v_room, v_uid, 'subchannel_delete', jsonb_build_object('subchannel_id', p_subchannel_id));

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.room_delete_subchannel(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.room_delete_subchannel(UUID) TO authenticated;

-- ---------------------------------------------------------------------
-- Rotate a private sub-channel's invite token. Admin only.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.room_rotate_invite(p_subchannel_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_room UUID;
  v_vis TEXT;
  v_token TEXT;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  SELECT room_id, visibility INTO v_room, v_vis FROM public.room_subchannels WHERE id = p_subchannel_id;
  IF v_room IS NULL THEN RETURN jsonb_build_object('error','Sub-channel not found.'); END IF;
  IF NOT public.is_room_admin(v_room, v_uid) THEN
    RETURN jsonb_build_object('error','Only admins can rotate invite links.');
  END IF;
  IF v_vis <> 'private' THEN
    RETURN jsonb_build_object('error','Only private sub-channels have invite links.');
  END IF;

  v_token := public._gen_code(32);
  UPDATE public.room_subchannels SET invite_token = v_token WHERE id = p_subchannel_id;
  RETURN jsonb_build_object('success', true, 'invite_token', v_token);
END;
$$;
REVOKE ALL ON FUNCTION public.room_rotate_invite(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.room_rotate_invite(UUID) TO authenticated;

-- ---------------------------------------------------------------------
-- Join via link. Handles public + private(open/request). Returns state.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.subchannel_join(p_slug TEXT, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_sub RECORD;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;

  SELECT * INTO v_sub FROM public.room_subchannels WHERE slug = p_slug;
  IF v_sub.id IS NULL THEN RETURN jsonb_build_object('error','Link not found.'); END IF;

  IF public.is_room_banned(v_sub.room_id, v_uid) THEN
    RETURN jsonb_build_object('error','You are banned from this room.');
  END IF;

  -- private link requires the exact token
  IF v_sub.visibility = 'private' THEN
    IF p_token IS NULL OR p_token <> v_sub.invite_token THEN
      RETURN jsonb_build_object('error','Invalid or expired invite link.');
    END IF;
  END IF;

  -- already a member?
  IF public.is_room_member(v_sub.room_id, v_uid) THEN
    RETURN jsonb_build_object('success', true, 'joined', true, 'room_id', v_sub.room_id);
  END IF;

  -- request-mode: queue a pending request instead of joining
  IF v_sub.join_policy = 'request' THEN
    INSERT INTO public.subchannel_join_requests (subchannel_id, room_id, user_id, status)
    VALUES (v_sub.id, v_sub.room_id, v_uid, 'pending')
    ON CONFLICT (subchannel_id, user_id) DO NOTHING;
    RETURN jsonb_build_object('success', true, 'requested', true, 'room_id', v_sub.room_id);
  END IF;

  -- open: join the room directly as a member
  INSERT INTO public.room_members (room_id, user_id, role)
  VALUES (v_sub.room_id, v_uid, 'member')
  ON CONFLICT (room_id, user_id) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'joined', true, 'room_id', v_sub.room_id);
END;
$$;
REVOKE ALL ON FUNCTION public.subchannel_join(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subchannel_join(TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------
-- Decide a pending join request (approve/deny). Admin only.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.subchannel_decide_request(p_request_id UUID, p_approve BOOLEAN)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_req RECORD;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  SELECT * INTO v_req FROM public.subchannel_join_requests WHERE id = p_request_id;
  IF v_req.id IS NULL THEN RETURN jsonb_build_object('error','Request not found.'); END IF;
  IF NOT public.is_room_admin(v_req.room_id, v_uid) THEN
    RETURN jsonb_build_object('error','Only admins can decide requests.');
  END IF;
  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('error','Request already decided.');
  END IF;

  IF p_approve THEN
    INSERT INTO public.room_members (room_id, user_id, role)
    VALUES (v_req.room_id, v_req.user_id, 'member')
    ON CONFLICT (room_id, user_id) DO NOTHING;
    UPDATE public.subchannel_join_requests
      SET status = 'approved', decided_by = v_uid, decided_at = now()
      WHERE id = p_request_id;
  ELSE
    UPDATE public.subchannel_join_requests
      SET status = 'denied', decided_by = v_uid, decided_at = now()
      WHERE id = p_request_id;
  END IF;

  INSERT INTO public.room_audit_log (room_id, actor_id, action, target_id, metadata)
  VALUES (v_req.room_id, v_uid, CASE WHEN p_approve THEN 'request_approve' ELSE 'request_deny' END,
          v_req.user_id, jsonb_build_object('subchannel_id', v_req.subchannel_id));

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.subchannel_decide_request(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subchannel_decide_request(UUID, BOOLEAN) TO authenticated;

COMMIT;
