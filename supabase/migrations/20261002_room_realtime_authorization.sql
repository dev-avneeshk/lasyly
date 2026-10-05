-- =====================================================================
-- Migration: private Realtime channels for room chat and membership (RT-03)
-- =====================================================================
-- Chat (`room-sub-<subchannel id>`) and membership (`room-members-<room id>`)
-- broadcasts went out on PUBLIC channels. Anyone with the anon key and an id
-- could listen to a private room's live messages (including users banned from
-- it), and any client could broadcast forged `new_message` events that other
-- viewers rendered as real messages.
--
-- The app now joins these topics with `private: true` and only the server
-- (service role, which bypasses RLS) sends on them. Realtime authorizes a
-- private join by running the SELECT policies below as the joining user:
--   room-sub-<id>      → public.can_view_subchannel(id, auth.uid())
--                        (the same rule as the messages table's SELECT policy)
--   room-members-<id>  → public room, or the caller is a member
-- anon is included so logged-out visitors keep live updates on public rooms.
-- There is deliberately NO insert policy: clients can't broadcast here.
--
-- Additive (two policies) and idempotent. Requires Realtime Authorization,
-- which the arena channels (20260926) already rely on.
-- Test: scripts/db/test-room-realtime-auth.sh (throwaway local Postgres).
-- =====================================================================
BEGIN;

DROP POLICY IF EXISTS "room viewers receive chat broadcasts" ON realtime.messages;
CREATE POLICY "room viewers receive chat broadcasts"
  ON realtime.messages
  FOR SELECT
  TO anon, authenticated
  -- CASE, not AND: AND doesn't guarantee evaluation order, and the uuid cast
  -- must never run on another topic (e.g. an arena one) or the join errors.
  USING (
    realtime.messages.extension = 'broadcast'
    AND CASE WHEN realtime.topic() ~ '^room-sub-[0-9a-f-]{36}$'
      THEN public.can_view_subchannel(substring(realtime.topic() FROM 10)::uuid, auth.uid())
      ELSE false END
  );

DROP POLICY IF EXISTS "room viewers receive membership broadcasts" ON realtime.messages;
CREATE POLICY "room viewers receive membership broadcasts"
  ON realtime.messages
  FOR SELECT
  TO anon, authenticated
  USING (
    realtime.messages.extension = 'broadcast'
    AND CASE WHEN realtime.topic() ~ '^room-members-[0-9a-f-]{36}$'
      THEN public.room_is_public(substring(realtime.topic() FROM 14)::uuid)
        OR public.is_room_member(substring(realtime.topic() FROM 14)::uuid, auth.uid())
      ELSE false END
  );

COMMIT;
