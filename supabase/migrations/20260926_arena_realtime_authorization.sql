-- =====================================================================
-- Migration: Arena realtime authorization (private broadcast channels)
-- =====================================================================
-- Arena 1v1 live updates go out over Supabase Realtime broadcast, and every
-- push carries the full game view (rosters, bids, result). Those used to be
-- PUBLIC channels, which have no per-subscriber check: anyone holding the anon
-- key (every browser has it) and the channel name could listen in.
--
-- This makes them private. Realtime Authorization decides who may join a
-- private channel by running the RLS policies on realtime.messages at join
-- time, so the database has to know who is playing which game. Game state lives
-- in Redis, so we mirror just the seat assignments here:
--
--   1. public.arena_game_members — (topic, user) rows the server writes when a
--      user takes a seat (create / matchmake / join). Service role only.
--   2. public.register_arena_channel_member() — the upsert the server calls. It
--      also prunes a bounded batch of expired rows, so the table stays small
--      without a cron job.
--   3. public.is_arena_channel_member() — SECURITY DEFINER lookup the policy
--      calls, so `authenticated` never needs SELECT on the table itself.
--   4. A SELECT policy on realtime.messages: a signed-in user may RECEIVE
--      broadcasts on an `arena-…` topic only if they hold a seat in it.
--
-- There is deliberately NO insert policy. Clients can't broadcast on these
-- channels at all; only the server (service role, which bypasses RLS) can. On
-- the old public channel either player could push a forged view to the other.
--
-- `topic` is the channel name the app derives (lib/realtime/arena.ts,
-- arenaChannelName: an HMAC of the game id). Rotating ARENA_CHANNEL_SECRET
-- changes every topic, so games in flight at that moment lose live updates and
-- fall back to polling; new games are unaffected.
--
-- Public channels (chat, members) are untouched: this adds a policy, and
-- policies only apply to channels joined with `private: true`. Leave the
-- project's "Allow public access" Realtime setting ON, or chat breaks.
--
-- Realtime caches a client's permissions for the life of the connection. That
-- is fine here: seats are never revoked mid-game, and rows expire well after a
-- game's 3-hour store TTL.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Seat mirror
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.arena_game_members (
  topic      text        NOT NULL,
  game_id    text        NOT NULL,
  user_id    uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  seat       text        NOT NULL CHECK (seat IN ('P1', 'P2')),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Games live 3 hours in the store; 6 hours covers a long game plus slack.
  expires_at timestamptz NOT NULL DEFAULT now() + interval '6 hours',
  PRIMARY KEY (topic, user_id)
);

-- The policy lookup is by (topic, user_id), which the primary key serves. This
-- one is for the prune in register_arena_channel_member.
CREATE INDEX IF NOT EXISTS idx_arena_game_members_expires_at
  ON public.arena_game_members (expires_at);

-- RLS on with no policies: invisible to anon/authenticated even if a grant is
-- added by mistake later. The service role bypasses RLS.
ALTER TABLE public.arena_game_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.arena_game_members FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arena_game_members TO service_role;

-- ---------------------------------------------------------------------
-- 2. register_arena_channel_member — called by the server when a seat is taken
-- ---------------------------------------------------------------------
-- Idempotent: re-registering refreshes the expiry. Returns:
--   completed | invalid | no_user
CREATE OR REPLACE FUNCTION public.register_arena_channel_member(
  p_topic   text,
  p_game_id text,
  p_user_id uuid,
  p_seat    text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_topic IS NULL OR p_topic NOT LIKE 'arena-%'
     OR p_game_id IS NULL OR p_user_id IS NULL
     OR p_seat NOT IN ('P1', 'P2') THEN
    RETURN 'invalid';
  END IF;

  -- Opportunistic cleanup, bounded so a backlog can never make this slow.
  DELETE FROM public.arena_game_members
   WHERE ctid IN (
     SELECT ctid FROM public.arena_game_members
      WHERE expires_at <= now()
      LIMIT 200
   );

  INSERT INTO public.arena_game_members (topic, game_id, user_id, seat)
  VALUES (p_topic, p_game_id, p_user_id, p_seat)
  ON CONFLICT (topic, user_id) DO UPDATE
    SET game_id    = EXCLUDED.game_id,
        seat       = EXCLUDED.seat,
        expires_at = now() + interval '6 hours';

  RETURN 'completed';
EXCEPTION
  WHEN foreign_key_violation THEN
    RETURN 'no_user';
END $$;

REVOKE ALL ON FUNCTION public.register_arena_channel_member(text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_arena_channel_member(text, text, uuid, text) TO service_role;

-- ---------------------------------------------------------------------
-- 3. is_arena_channel_member — the check the Realtime policy runs
-- ---------------------------------------------------------------------
-- SECURITY DEFINER so the policy can read the seat mirror without granting
-- `authenticated` any access to it. It only ever answers about the CALLER
-- (auth.uid()), so exposing it reveals nothing about anyone else.
CREATE OR REPLACE FUNCTION public.is_arena_channel_member(p_topic text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.arena_game_members m
     WHERE m.topic = p_topic
       AND m.user_id = auth.uid()
       AND m.expires_at > now()
  );
$$;

REVOKE ALL ON FUNCTION public.is_arena_channel_member(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_arena_channel_member(text) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. Realtime policy: players may receive their own game's broadcasts
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "arena players receive their game broadcasts" ON realtime.messages;

CREATE POLICY "arena players receive their game broadcasts"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.messages.extension = 'broadcast'
    AND realtime.topic() LIKE 'arena-%'
    AND public.is_arena_channel_member(realtime.topic())
  );

COMMIT;

-- =====================================================================
-- Post-deployment verification (run manually):
--
--   -- As service role: register a seat, then confirm it.
--   SELECT public.register_arena_channel_member('arena-test', 'g1', '<uid>', 'P1');  -- 'completed'
--   SELECT * FROM public.arena_game_members WHERE topic = 'arena-test';
--
--   -- The policy exists:
--   SELECT policyname, cmd, roles FROM pg_policies
--    WHERE schemaname = 'realtime' AND tablename = 'messages';
--
-- Automated check against a throwaway local Postgres:
--   scripts/db/test-arena-realtime-auth.sh
-- =====================================================================
