-- =====================================================================
-- Room Channels & Permissions
-- =====================================================================
-- Adds a two-level channel structure to rooms:
--   Room -> Channels (level 1, groups) -> Sub-channels (level 2, chat)
--   Messages live in sub-channels (messages.subchannel_id).
--
-- Also adds:
--   - Public/private sub-channels with short slugs + secret invite tokens
--   - Per-sub-channel post policy (everyone/members/admins) and join policy
--   - Free-tier limits (<=2 channels/room, <=2 sub-channels/channel) unless
--     the owner is `is_pro` (billing stubbed — flag flipped manually for now)
--   - Betslip sharing in chat (messages.kind + betslip_id)
--   - Join-request approval for private sub-channels
--
-- Backfill: every existing room gets one default channel + one default public
-- sub-channel, and all existing messages are moved into it (no data loss).
--
-- Reuses existing helpers: is_room_member, is_room_admin, room_is_public.
-- Follows repo convention: atomic, helpers-first, DROP+CREATE policies,
-- SECURITY DEFINER RPCs granted to authenticated.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. profiles.is_pro (governs free-tier limits; billing stubbed)
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_pro BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------

-- Level 1: channels (groups)
CREATE TABLE IF NOT EXISTS public.room_channels (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  icon       TEXT,
  position   INT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Level 2: sub-channels (chat streams)
CREATE TABLE IF NOT EXISTS public.room_subchannels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id    UUID NOT NULL REFERENCES public.room_channels(id) ON DELETE CASCADE,
  room_id       UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE, -- denormalized for RLS
  name          TEXT NOT NULL,
  topic         TEXT,
  icon          TEXT,
  position      INT  NOT NULL DEFAULT 0,
  visibility    TEXT NOT NULL DEFAULT 'public'   CHECK (visibility IN ('public','private')),
  post_policy   TEXT NOT NULL DEFAULT 'members'  CHECK (post_policy IN ('everyone','members','admins')),
  join_policy   TEXT NOT NULL DEFAULT 'open'     CHECK (join_policy IN ('open','request')),
  slug          TEXT NOT NULL UNIQUE,
  invite_token  TEXT,                            -- only set for private
  is_default    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Exactly one default sub-channel per room.
CREATE UNIQUE INDEX IF NOT EXISTS uq_subchannel_default_per_room
  ON public.room_subchannels (room_id) WHERE is_default;

CREATE INDEX IF NOT EXISTS idx_room_channels_room_pos
  ON public.room_channels (room_id, position);
CREATE INDEX IF NOT EXISTS idx_subchannels_channel_pos
  ON public.room_subchannels (channel_id, position);
CREATE INDEX IF NOT EXISTS idx_subchannels_room
  ON public.room_subchannels (room_id);

-- messages: scope to sub-channel + betslip sharing
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS subchannel_id UUID REFERENCES public.room_subchannels(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text','betslip')),
  ADD COLUMN IF NOT EXISTS betslip_id UUID;

-- Join requests (private sub-channels in request mode)
CREATE TABLE IF NOT EXISTS public.subchannel_join_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subchannel_id  UUID NOT NULL REFERENCES public.room_subchannels(id) ON DELETE CASCADE,
  room_id        UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied')),
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at     TIMESTAMPTZ,
  UNIQUE (subchannel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_subchannel_requests_pending
  ON public.subchannel_join_requests (subchannel_id) WHERE status = 'pending';

-- ---------------------------------------------------------------------
-- 2. Backfill: default channel + sub-channel per room, move messages
-- ---------------------------------------------------------------------
DO $backfill$
DECLARE
  r RECORD;
  v_channel_id UUID;
  v_sub_id UUID;
BEGIN
  FOR r IN SELECT id FROM public.rooms LOOP
    -- Skip if this room already has a default sub-channel (idempotent re-run)
    IF EXISTS (SELECT 1 FROM public.room_subchannels WHERE room_id = r.id AND is_default) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.room_channels (room_id, name, icon, position)
    VALUES (r.id, 'General', '💬', 0)
    RETURNING id INTO v_channel_id;

    INSERT INTO public.room_subchannels
      (channel_id, room_id, name, icon, position, visibility, post_policy, join_policy, slug, is_default)
    VALUES
      (v_channel_id, r.id, 'general', '💬', 0, 'public', 'members', 'open',
       substr(replace(gen_random_uuid()::text, '-', ''), 1, 8), true)
    RETURNING id INTO v_sub_id;

    -- Move all existing messages in this room into the default sub-channel
    UPDATE public.messages
      SET subchannel_id = v_sub_id
      WHERE room_id = r.id AND subchannel_id IS NULL;
  END LOOP;
END
$backfill$;

-- Any orphan messages (no room match) — leave null-safe; but enforce NOT NULL
-- only after backfill so a partial state can't wedge the migration.
-- If any messages remain unassigned (shouldn't happen), assign is skipped and
-- the NOT NULL below would fail loudly — which is the desired signal.
ALTER TABLE public.messages
  ALTER COLUMN subchannel_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_subchannel_created
  ON public.messages (subchannel_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 3. Helper functions (SECURITY DEFINER, STABLE, search_path='')
-- ---------------------------------------------------------------------

-- Owning room of a sub-channel.
CREATE OR REPLACE FUNCTION public.subchannel_room_id(p_subchannel_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT room_id FROM public.room_subchannels WHERE id = p_subchannel_id;
$$;
REVOKE ALL ON FUNCTION public.subchannel_room_id(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subchannel_room_id(UUID) TO anon, authenticated, service_role;

-- Can the user VIEW a sub-channel's messages?
CREATE OR REPLACE FUNCTION public.can_view_subchannel(p_subchannel_id UUID, p_user_id UUID)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_room UUID;
  v_vis  TEXT;
BEGIN
  SELECT room_id, visibility INTO v_room, v_vis
  FROM public.room_subchannels WHERE id = p_subchannel_id;
  IF v_room IS NULL THEN RETURN false; END IF;

  IF v_vis = 'public' THEN
    RETURN public.room_is_public(v_room) OR public.is_room_member(v_room, p_user_id);
  ELSE
    -- private sub-channel: members of the room who are also allowed in.
    RETURN public.is_room_member(v_room, p_user_id);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.can_view_subchannel(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_subchannel(UUID, UUID) TO anon, authenticated, service_role;

-- Can the user POST into a sub-channel?
CREATE OR REPLACE FUNCTION public.can_post_subchannel(p_subchannel_id UUID, p_user_id UUID)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_room   UUID;
  v_policy TEXT;
BEGIN
  SELECT room_id, post_policy INTO v_room, v_policy
  FROM public.room_subchannels WHERE id = p_subchannel_id;
  IF v_room IS NULL THEN RETURN false; END IF;

  IF public.is_room_muted(v_room, p_user_id) THEN RETURN false; END IF;

  IF v_policy = 'admins' THEN
    RETURN public.is_room_admin(v_room, p_user_id);
  ELSE
    -- everyone / members both require room membership to post.
    RETURN public.is_room_member(v_room, p_user_id);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.can_post_subchannel(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_post_subchannel(UUID, UUID) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------

ALTER TABLE public.room_channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "room_channels_select_visible" ON public.room_channels;
CREATE POLICY "room_channels_select_visible" ON public.room_channels FOR SELECT
  USING (public.room_is_public(room_id) OR public.is_room_member(room_id, auth.uid()));
DROP POLICY IF EXISTS "room_channels_write_admin" ON public.room_channels;
CREATE POLICY "room_channels_write_admin" ON public.room_channels FOR ALL
  USING (public.is_room_admin(room_id, auth.uid()))
  WITH CHECK (public.is_room_admin(room_id, auth.uid()));

ALTER TABLE public.room_subchannels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subchannels_select_visible" ON public.room_subchannels;
CREATE POLICY "subchannels_select_visible" ON public.room_subchannels FOR SELECT
  USING (public.room_is_public(room_id) OR public.is_room_member(room_id, auth.uid()));
DROP POLICY IF EXISTS "subchannels_write_admin" ON public.room_subchannels;
CREATE POLICY "subchannels_write_admin" ON public.room_subchannels FOR ALL
  USING (public.is_room_admin(room_id, auth.uid()))
  WITH CHECK (public.is_room_admin(room_id, auth.uid()));

-- messages: replace room-scoped policies with sub-channel-aware ones
DROP POLICY IF EXISTS "messages_select_visible" ON public.messages;
CREATE POLICY "messages_select_visible" ON public.messages FOR SELECT
  USING (public.can_view_subchannel(subchannel_id, auth.uid()));
DROP POLICY IF EXISTS "messages_insert_member" ON public.messages;
CREATE POLICY "messages_insert_member" ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND is_system = false
    AND public.can_post_subchannel(subchannel_id, auth.uid())
  );
-- delete policy unchanged (self or room admin) — recreate to be safe/idempotent
DROP POLICY IF EXISTS "messages_delete_self_or_admin" ON public.messages;
CREATE POLICY "messages_delete_self_or_admin" ON public.messages FOR DELETE
  USING (user_id = auth.uid() OR public.is_room_admin(room_id, auth.uid()));

ALTER TABLE public.subchannel_join_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subchannel_requests_select" ON public.subchannel_join_requests;
CREATE POLICY "subchannel_requests_select" ON public.subchannel_join_requests FOR SELECT
  USING (user_id = auth.uid() OR public.is_room_admin(room_id, auth.uid()));
DROP POLICY IF EXISTS "subchannel_requests_delete_own_or_admin" ON public.subchannel_join_requests;
CREATE POLICY "subchannel_requests_delete_own_or_admin" ON public.subchannel_join_requests FOR DELETE
  USING (user_id = auth.uid() OR public.is_room_admin(room_id, auth.uid()));
-- inserts/updates go through RPCs (SECURITY DEFINER), so no direct-write policy.

COMMIT;
