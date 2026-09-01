-- =====================================================================
-- Flatten channels to a single level + correct free-tier limits
-- =====================================================================
-- Revised product model (Discord-server style):
--   Room  = the "channel" a user creates.
--   Room -> Sub-channels -> Messages  (ONE level of nesting; the middle
--   `room_channels` group layer is removed).
--
-- Free-tier limits:
--   - Rooms per user: max 2.
--   - Sub-channels per room: 1 default (auto, undeletable, the join landing)
--     + up to 2 extra = 3 total. "max 2 extra".
--
-- `room_subchannels` already carries `room_id`, so flattening only means:
--   - make `channel_id` nullable (we stop requiring the middle layer),
--   - replace the create RPC to key off room_id with the new limit,
--   - add a room-count cap RPC used by room creation.
--
-- Idempotent; safe to run after 20260902_*.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Drop the middle layer dependency
-- ---------------------------------------------------------------------
-- Sub-channels belong directly to the room now. Keep the column for existing
-- rows but stop requiring it.
ALTER TABLE public.room_subchannels
  ALTER COLUMN channel_id DROP NOT NULL;

-- Old per-channel create RPC is obsolete.
DROP FUNCTION IF EXISTS public.room_create_channel(UUID, TEXT, TEXT);

-- The old room_create_subchannel took p_channel_id as its first parameter.
-- We're changing that to p_room_id, and Postgres refuses to rename an input
-- parameter via CREATE OR REPLACE — so drop the old signature explicitly
-- before recreating it below.
DROP FUNCTION IF EXISTS public.room_create_subchannel(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

-- ---------------------------------------------------------------------
-- 2. Room count cap (free tier: 2 rooms per user)
-- ---------------------------------------------------------------------
-- Called by the room-create API BEFORE inserting, so the 3rd room for a free
-- user is blocked with LIMIT_REACHED (the API maps this to 402 -> upgrade UI).
CREATE OR REPLACE FUNCTION public.can_create_room(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_is_pro BOOLEAN;
  v_count INT;
BEGIN
  IF p_user_id IS NULL THEN RETURN jsonb_build_object('allowed', false, 'error', 'Not authenticated'); END IF;
  SELECT COALESCE(is_pro, false) INTO v_is_pro FROM public.profiles WHERE id = p_user_id;
  SELECT count(*) INTO v_count FROM public.rooms WHERE creator_id = p_user_id;
  IF v_count >= 2 AND NOT COALESCE(v_is_pro, false) THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'LIMIT_REACHED', 'limit', 'rooms');
  END IF;
  RETURN jsonb_build_object('allowed', true);
END;
$$;
REVOKE ALL ON FUNCTION public.can_create_room(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_create_room(UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. Create sub-channel keyed on ROOM (not the removed channel layer).
--    Free tier: at most 2 NON-default sub-channels per room (3 total).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.room_create_subchannel(
  p_room_id UUID,
  p_name TEXT,
  p_visibility TEXT DEFAULT 'public',
  p_post_policy TEXT DEFAULT 'members',
  p_join_policy TEXT DEFAULT 'open',
  p_icon TEXT DEFAULT NULL,
  p_topic TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_owner UUID;
  v_is_pro BOOLEAN;
  v_extra_count INT;
  v_id UUID;
  v_pos INT;
  v_slug TEXT;
  v_token TEXT;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  IF NOT public.is_room_admin(p_room_id, v_uid) THEN
    RETURN jsonb_build_object('error','Only admins can create sub-channels.');
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RETURN jsonb_build_object('error','Sub-channel name is required.');
  END IF;
  IF p_visibility NOT IN ('public','private') THEN RETURN jsonb_build_object('error','Invalid visibility.'); END IF;
  IF p_post_policy NOT IN ('everyone','members','admins') THEN RETURN jsonb_build_object('error','Invalid post policy.'); END IF;
  IF p_join_policy NOT IN ('open','request') THEN RETURN jsonb_build_object('error','Invalid join policy.'); END IF;

  SELECT creator_id INTO v_owner FROM public.rooms WHERE id = p_room_id;
  SELECT COALESCE(is_pro, false) INTO v_is_pro FROM public.profiles WHERE id = v_owner;

  -- Count only NON-default sub-channels; the default doesn't count toward the
  -- "2 extra" allowance.
  SELECT count(*) INTO v_extra_count
  FROM public.room_subchannels WHERE room_id = p_room_id AND is_default = false;

  IF v_extra_count >= 2 AND NOT COALESCE(v_is_pro, false) THEN
    RETURN jsonb_build_object('error','LIMIT_REACHED','limit','subchannels');
  END IF;

  LOOP
    v_slug := public._gen_code(8);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.room_subchannels WHERE slug = v_slug);
  END LOOP;

  v_token := CASE WHEN p_visibility = 'private' THEN public._gen_code(32) ELSE NULL END;

  SELECT COALESCE(max(position), -1) + 1 INTO v_pos FROM public.room_subchannels WHERE room_id = p_room_id;

  INSERT INTO public.room_subchannels
    (channel_id, room_id, name, topic, icon, position, visibility, post_policy, join_policy, slug, invite_token, is_default)
  VALUES
    (NULL, p_room_id, left(trim(p_name), 40), p_topic, p_icon, v_pos,
     p_visibility, p_post_policy, p_join_policy, v_slug, v_token, false)
  RETURNING id INTO v_id;

  INSERT INTO public.room_audit_log (room_id, actor_id, action, metadata)
  VALUES (p_room_id, v_uid, 'subchannel_create',
          jsonb_build_object('subchannel_id', v_id, 'name', p_name, 'visibility', p_visibility));

  RETURN jsonb_build_object('success', true, 'id', v_id, 'slug', v_slug, 'invite_token', v_token);
END;
$$;
REVOKE ALL ON FUNCTION public.room_create_subchannel(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.room_create_subchannel(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMIT;
