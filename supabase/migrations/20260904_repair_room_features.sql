-- =====================================================================
-- Repair room features: missing moderation tables + guaranteed default
-- sub-channel per room
-- =====================================================================
-- WHY THIS EXISTS
--
-- The live database drifted from `supabase/migrations/`. Two older migrations
-- were never applied:
--   * 20250531_chat_cleanup_and_security.sql -> room_mutes, is_room_muted(),
--     cleanup_old_chat_data()
--   * 20250531_room_admin_features.sql       -> pinned_messages, room_bans,
--     room_audit_log, is_room_banned(), room_set_member_role(),
--     room_kick_member(), room_ban_member(), room_unban_member()
--
-- ...while the newer 20260902/20260903 channel migrations WERE applied. That
-- combination is actively broken, not merely incomplete:
--
--   1. `can_post_subchannel()` (used by the messages INSERT RLS policy) calls
--      `is_room_muted()`. That function does not exist, so evaluating the
--      policy raises and EVERY message insert fails.
--   2. `room_create_subchannel()` writes to `room_audit_log`, which does not
--      exist, so creating a sub-channel fails.
--   3. The pin API reads/writes `pinned_messages`, which does not exist.
--
-- Separately, and the reason a brand-new room looks empty and read-only:
--   4. Nothing creates the default sub-channel for a NEW room. The 20260902
--      backfill only covered rooms that existed when it ran. Room creation
--      (app/api/rooms/create) inserts the room and the owner membership and
--      stops there. A room with zero sub-channels renders an empty channel
--      list, leaves `activeSub` null on the client, and therefore disables the
--      composer -- which is why even the OWNER saw "Join this room to chat".
--
-- This migration is idempotent and safe to re-run. It:
--   - creates the missing tables, policies, indexes and functions
--   - adds an AFTER INSERT trigger on `rooms` so every future room gets its
--     default sub-channel atomically, in the same transaction as the room
--   - adds `room_ensure_default_subchannel()` so the API can self-heal a room
--     that predates the trigger
--   - backfills every existing room that is missing a default sub-channel
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. room_mutes + is_room_muted()
--    Unblocks the messages INSERT policy via can_post_subchannel().
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.room_mutes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  muted_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason       TEXT,
  muted_until  TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);

ALTER TABLE public.room_mutes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "room_mutes_select" ON public.room_mutes;
CREATE POLICY "room_mutes_select" ON public.room_mutes FOR SELECT
  USING (public.is_room_admin(room_id, auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "room_mutes_insert_admin" ON public.room_mutes;
CREATE POLICY "room_mutes_insert_admin" ON public.room_mutes FOR INSERT
  WITH CHECK (public.is_room_admin(room_id, auth.uid()));

DROP POLICY IF EXISTS "room_mutes_delete_admin" ON public.room_mutes;
CREATE POLICY "room_mutes_delete_admin" ON public.room_mutes FOR DELETE
  USING (public.is_room_admin(room_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_room_mutes_lookup
  ON public.room_mutes (room_id, user_id, muted_until);

CREATE OR REPLACE FUNCTION public.is_room_muted(p_room_id UUID, p_user_id UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_mutes
    WHERE room_id = p_room_id AND user_id = p_user_id AND muted_until > now()
  );
$$;
REVOKE ALL ON FUNCTION public.is_room_muted(UUID, UUID) FROM PUBLIC;
-- Grants mirror can_post_subchannel(), the only caller. The nested call runs as
-- the definer regardless, so `anon` is included for parity rather than need.
GRANT EXECUTE ON FUNCTION public.is_room_muted(UUID, UUID) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. pinned_messages
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.pinned_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  message_id  UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  pinned_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  pinned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, message_id)
);

ALTER TABLE public.pinned_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pinned_messages_select" ON public.pinned_messages;
CREATE POLICY "pinned_messages_select" ON public.pinned_messages FOR SELECT
  USING (public.room_is_public(room_id) OR public.is_room_member(room_id, auth.uid()));

DROP POLICY IF EXISTS "pinned_messages_insert_admin" ON public.pinned_messages;
CREATE POLICY "pinned_messages_insert_admin" ON public.pinned_messages FOR INSERT
  WITH CHECK (public.is_room_admin(room_id, auth.uid()));

DROP POLICY IF EXISTS "pinned_messages_delete_admin" ON public.pinned_messages;
CREATE POLICY "pinned_messages_delete_admin" ON public.pinned_messages FOR DELETE
  USING (public.is_room_admin(room_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_pinned_messages_room ON public.pinned_messages (room_id);
CREATE INDEX IF NOT EXISTS idx_pinned_messages_room_pinned
  ON public.pinned_messages (room_id, pinned_at DESC);

-- ---------------------------------------------------------------------
-- 3. room_bans + is_room_banned()
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.room_bans (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banned_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason     TEXT,
  banned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);

ALTER TABLE public.room_bans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "room_bans_select_admin" ON public.room_bans;
CREATE POLICY "room_bans_select_admin" ON public.room_bans FOR SELECT
  USING (public.is_room_admin(room_id, auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "room_bans_insert_admin" ON public.room_bans;
CREATE POLICY "room_bans_insert_admin" ON public.room_bans FOR INSERT
  WITH CHECK (public.is_room_admin(room_id, auth.uid()));

DROP POLICY IF EXISTS "room_bans_delete_admin" ON public.room_bans;
CREATE POLICY "room_bans_delete_admin" ON public.room_bans FOR DELETE
  USING (public.is_room_admin(room_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_room_bans_room ON public.room_bans (room_id);
CREATE INDEX IF NOT EXISTS idx_room_bans_user ON public.room_bans (user_id);

CREATE OR REPLACE FUNCTION public.is_room_banned(p_room_id UUID, p_user_id UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_bans WHERE room_id = p_room_id AND user_id = p_user_id
  );
$$;
REVOKE ALL ON FUNCTION public.is_room_banned(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_room_banned(UUID, UUID) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. room_audit_log
--    room_create_subchannel() already writes here, so its absence is what
--    breaks "Add sub-channel".
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.room_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  target_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.room_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "room_audit_log_select_admin" ON public.room_audit_log;
CREATE POLICY "room_audit_log_select_admin" ON public.room_audit_log FOR SELECT
  USING (public.is_room_admin(room_id, auth.uid()));

DROP POLICY IF EXISTS "room_audit_log_insert_admin" ON public.room_audit_log;
CREATE POLICY "room_audit_log_insert_admin" ON public.room_audit_log FOR INSERT
  WITH CHECK (public.is_room_admin(room_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_room_audit_log_room ON public.room_audit_log (room_id);
CREATE INDEX IF NOT EXISTS idx_room_audit_log_created
  ON public.room_audit_log (room_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 5. Moderation RPCs (role change / kick / ban / unban)
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.room_set_member_role(
  p_room_id UUID, p_target_user_id UUID, p_new_role TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_role TEXT;
  v_target_role TEXT;
BEGIN
  IF v_caller_id IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  IF p_new_role NOT IN ('moderator','member') THEN
    RETURN jsonb_build_object('error','Invalid role. Must be moderator or member.');
  END IF;

  SELECT role INTO v_caller_role FROM public.room_members
  WHERE room_id = p_room_id AND user_id = v_caller_id;
  IF v_caller_role IS NULL THEN RETURN jsonb_build_object('error','You are not a member of this room.'); END IF;
  IF v_caller_role <> 'owner' THEN
    RETURN jsonb_build_object('error','Only the room owner can change member roles.');
  END IF;

  SELECT role INTO v_target_role FROM public.room_members
  WHERE room_id = p_room_id AND user_id = p_target_user_id;
  IF v_target_role IS NULL THEN RETURN jsonb_build_object('error','Target user is not a member of this room.'); END IF;
  IF v_target_role = 'owner' THEN RETURN jsonb_build_object('error','Cannot change the owner role.'); END IF;
  IF v_target_role = p_new_role THEN RETURN jsonb_build_object('error','User already has this role.'); END IF;

  UPDATE public.room_members SET role = p_new_role
  WHERE room_id = p_room_id AND user_id = p_target_user_id;

  INSERT INTO public.room_audit_log (room_id, actor_id, action, target_id, metadata)
  VALUES (p_room_id, v_caller_id, 'role_change', p_target_user_id,
          jsonb_build_object('old_role', v_target_role, 'new_role', p_new_role));

  RETURN jsonb_build_object('success', true, 'new_role', p_new_role);
END;
$$;
REVOKE ALL ON FUNCTION public.room_set_member_role(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.room_set_member_role(UUID, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.room_kick_member(p_room_id UUID, p_target_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_role TEXT;
  v_target_role TEXT;
BEGIN
  IF v_caller_id IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  IF v_caller_id = p_target_user_id THEN
    RETURN jsonb_build_object('error','You cannot kick yourself. Use leave instead.');
  END IF;

  SELECT role INTO v_caller_role FROM public.room_members
  WHERE room_id = p_room_id AND user_id = v_caller_id;
  IF v_caller_role IS NULL OR v_caller_role = 'member' THEN
    RETURN jsonb_build_object('error','You do not have permission to kick members.');
  END IF;

  SELECT role INTO v_target_role FROM public.room_members
  WHERE room_id = p_room_id AND user_id = p_target_user_id;
  IF v_target_role IS NULL THEN RETURN jsonb_build_object('error','Target user is not a member of this room.'); END IF;
  IF v_target_role = 'owner' THEN RETURN jsonb_build_object('error','Cannot kick the room owner.'); END IF;
  IF v_caller_role = 'moderator' AND v_target_role = 'moderator' THEN
    RETURN jsonb_build_object('error','Moderators cannot kick other moderators.');
  END IF;

  DELETE FROM public.room_members WHERE room_id = p_room_id AND user_id = p_target_user_id;

  INSERT INTO public.room_audit_log (room_id, actor_id, action, target_id, metadata)
  VALUES (p_room_id, v_caller_id, 'kick', p_target_user_id,
          jsonb_build_object('target_role', v_target_role));

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.room_kick_member(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.room_kick_member(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.room_ban_member(
  p_room_id UUID, p_target_user_id UUID, p_reason TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_role TEXT;
  v_target_role TEXT;
BEGIN
  IF v_caller_id IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  IF v_caller_id = p_target_user_id THEN RETURN jsonb_build_object('error','You cannot ban yourself.'); END IF;

  SELECT role INTO v_caller_role FROM public.room_members
  WHERE room_id = p_room_id AND user_id = v_caller_id;
  IF v_caller_role IS NULL OR v_caller_role = 'member' THEN
    RETURN jsonb_build_object('error','You do not have permission to ban members.');
  END IF;

  SELECT role INTO v_target_role FROM public.room_members
  WHERE room_id = p_room_id AND user_id = p_target_user_id;
  IF v_target_role = 'owner' THEN RETURN jsonb_build_object('error','Cannot ban the room owner.'); END IF;
  IF v_caller_role = 'moderator' AND v_target_role = 'moderator' THEN
    RETURN jsonb_build_object('error','Moderators cannot ban other moderators.');
  END IF;

  DELETE FROM public.room_members WHERE room_id = p_room_id AND user_id = p_target_user_id;

  -- Aliased as `b` purely for readability in the DO UPDATE clause; the
  -- schema-qualified form used in the original 20250531 migration is also
  -- valid. EXCLUDED.reason is the proposed value, i.e. p_reason.
  INSERT INTO public.room_bans AS b (room_id, user_id, banned_by, reason)
  VALUES (p_room_id, p_target_user_id, v_caller_id, p_reason)
  ON CONFLICT (room_id, user_id) DO UPDATE
    SET banned_by = v_caller_id,
        reason    = COALESCE(EXCLUDED.reason, b.reason),
        banned_at = now();

  INSERT INTO public.room_audit_log (room_id, actor_id, action, target_id, metadata)
  VALUES (p_room_id, v_caller_id, 'ban', p_target_user_id,
          jsonb_build_object('reason', COALESCE(p_reason, 'No reason provided')));

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.room_ban_member(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.room_ban_member(UUID, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.room_unban_member(p_room_id UUID, p_target_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_role TEXT;
BEGIN
  IF v_caller_id IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;

  SELECT role INTO v_caller_role FROM public.room_members
  WHERE room_id = p_room_id AND user_id = v_caller_id;
  IF v_caller_role IS NULL OR v_caller_role = 'member' THEN
    RETURN jsonb_build_object('error','You do not have permission to unban members.');
  END IF;

  DELETE FROM public.room_bans WHERE room_id = p_room_id AND user_id = p_target_user_id;

  INSERT INTO public.room_audit_log (room_id, actor_id, action, target_id, metadata)
  VALUES (p_room_id, v_caller_id, 'unban', p_target_user_id, '{}');

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.room_unban_member(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.room_unban_member(UUID, UUID) TO authenticated;

-- ---------------------------------------------------------------------
-- 6. cleanup_old_chat_data() -- used by .github/workflows/cleanup-chat.yml
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cleanup_old_chat_data()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_messages_deleted BIGINT;
  v_mutes_cleaned BIGINT;
  v_audit_cleaned BIGINT;
  v_reactions_cleaned BIGINT;
BEGIN
  WITH deleted AS (
    DELETE FROM public.messages WHERE created_at < now() - INTERVAL '30 days' RETURNING id
  ) SELECT count(*) INTO v_messages_deleted FROM deleted;

  WITH deleted AS (
    DELETE FROM public.room_mutes WHERE muted_until < now() RETURNING id
  ) SELECT count(*) INTO v_mutes_cleaned FROM deleted;

  WITH deleted AS (
    DELETE FROM public.room_audit_log WHERE created_at < now() - INTERVAL '90 days' RETURNING id
  ) SELECT count(*) INTO v_audit_cleaned FROM deleted;

  WITH deleted AS (
    DELETE FROM public.message_reactions mr
    WHERE NOT EXISTS (SELECT 1 FROM public.messages m WHERE m.id = mr.message_id)
    RETURNING mr.id
  ) SELECT count(*) INTO v_reactions_cleaned FROM deleted;

  RETURN jsonb_build_object(
    'messages_deleted',  v_messages_deleted,
    'mutes_cleaned',     v_mutes_cleaned,
    'audit_cleaned',     v_audit_cleaned,
    'reactions_cleaned', v_reactions_cleaned,
    'ran_at',            now()
  );
END;
$$;
REVOKE ALL ON FUNCTION public.cleanup_old_chat_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_old_chat_data() TO service_role;

CREATE INDEX IF NOT EXISTS idx_messages_room_created
  ON public.messages (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message
  ON public.message_reactions (message_id);

-- =====================================================================
-- 7. THE ROOT CAUSE FIX: every room always has a default sub-channel
-- =====================================================================

-- Creates the room's default sub-channel if it is missing, and returns its id.
-- Idempotent, so it doubles as a self-heal entry point for the channels API.
-- SECURITY DEFINER because it must write past `subchannels_write_admin` RLS
-- during room creation, when the owner's room_members row may not exist yet.
CREATE OR REPLACE FUNCTION public.room_ensure_default_subchannel(p_room_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id   UUID;
  v_slug TEXT;
BEGIN
  IF p_room_id IS NULL THEN RETURN NULL; END IF;

  SELECT id INTO v_id
  FROM public.room_subchannels
  WHERE room_id = p_room_id AND is_default
  LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  -- Don't create channels for a room that doesn't exist.
  IF NOT EXISTS (SELECT 1 FROM public.rooms WHERE id = p_room_id) THEN
    RETURN NULL;
  END IF;

  LOOP
    v_slug := public._gen_code(8);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.room_subchannels WHERE slug = v_slug);
  END LOOP;

  -- channel_id is NULL: the middle "channel group" layer was removed in
  -- 20260903_flatten_channels_and_limits.sql.
  -- post_policy 'members' matches the product rule (room members can talk);
  -- is_default = true makes it the join landing and undeletable.
  INSERT INTO public.room_subchannels
    (channel_id, room_id, name, topic, icon, position,
     visibility, post_policy, join_policy, slug, invite_token, is_default)
  VALUES
    (NULL, p_room_id, 'general', NULL, NULL, 0,
     'public', 'members', 'open', v_slug, NULL, true)
  -- Concurrent room reads could race here; uq_subchannel_default_per_room is a
  -- partial unique index, so swallow the conflict and re-select below.
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.room_subchannels
    WHERE room_id = p_room_id AND is_default LIMIT 1;
  END IF;

  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.room_ensure_default_subchannel(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.room_ensure_default_subchannel(UUID) TO authenticated, service_role;

-- Trigger: new rooms get their default sub-channel in the SAME transaction as
-- the room insert, so the "room with no channels" state can never exist again.
-- This is deliberately in the DB rather than the create API, so every code
-- path (API, SQL console, seed script) is covered.
CREATE OR REPLACE FUNCTION public.rooms_create_default_subchannel()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.room_ensure_default_subchannel(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rooms_default_subchannel ON public.rooms;
CREATE TRIGGER trg_rooms_default_subchannel
  AFTER INSERT ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.rooms_create_default_subchannel();

-- Backfill: heal every room that is currently missing a default sub-channel,
-- and adopt any orphaned messages into it.
DO $backfill$
DECLARE
  r RECORD;
  v_sub UUID;
BEGIN
  FOR r IN SELECT id FROM public.rooms LOOP
    v_sub := public.room_ensure_default_subchannel(r.id);
    IF v_sub IS NOT NULL THEN
      UPDATE public.messages
        SET subchannel_id = v_sub
        WHERE room_id = r.id AND subchannel_id IS NULL;
    END IF;
  END LOOP;
END
$backfill$;

COMMIT;
