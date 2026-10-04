#!/usr/bin/env bash
#
# Exercise supabase/migrations/20261002_room_realtime_authorization.sql against
# a THROWAWAY local Postgres. Never touches a real database.
#
# Realtime authorizes a private join by running a SELECT on realtime.messages
# as the joining user with realtime.topic() set; a returned row = allowed. The
# room helpers are stubbed with the same logic as 20260914_cheapen_hot_rls.sql.
#
# Usage: scripts/db/test-room-realtime-auth.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MIGRATION="${MIGRATION:-$ROOT/supabase/migrations/20261002_room_realtime_authorization.sql}"

for bin in initdb pg_ctl psql; do
  command -v "$bin" >/dev/null || { echo "error: $bin not found on PATH" >&2; exit 1; }
done

DATA="$(mktemp -d -t room-rt-auth)"
PORT=$(( 20000 + RANDOM % 20000 ))
cleanup() {
  pg_ctl -D "$DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$DATA"
}
trap cleanup EXIT

initdb -D "$DATA" -U postgres --auth=trust >/dev/null
pg_ctl -D "$DATA" -o "-p $PORT -k $DATA -c listen_addresses=''" -l "$DATA/log" -w start >/dev/null
PSQL=(psql -h "$DATA" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -X -q -t -A)

MEMBER=11111111-1111-1111-1111-111111111111
STRANGER=22222222-2222-2222-2222-222222222222
PUB=aaaaaaaa-0000-0000-0000-000000000001
PRIV=aaaaaaaa-0000-0000-0000-000000000002
PUB_SUB=cccccccc-0000-0000-0000-000000000001
PRIV_SUB=cccccccc-0000-0000-0000-000000000002

"${PSQL[@]}" <<SQL
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS \$\$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
\$\$;
CREATE SCHEMA realtime;
CREATE TABLE realtime.messages (id bigserial PRIMARY KEY, topic text NOT NULL, extension text NOT NULL, payload jsonb);
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION realtime.topic() RETURNS text LANGUAGE sql STABLE AS \$\$
  SELECT nullif(current_setting('realtime.topic', true), '')
\$\$;
GRANT USAGE ON SCHEMA auth, realtime, public TO anon, authenticated, service_role;
GRANT SELECT, INSERT ON realtime.messages TO anon, authenticated, service_role;

CREATE TABLE public.rooms (id uuid PRIMARY KEY, type text NOT NULL);
CREATE TABLE public.room_members (room_id uuid, user_id uuid);
CREATE TABLE public.room_subchannels (id uuid PRIMARY KEY, room_id uuid, visibility text);
CREATE FUNCTION public.room_is_public(p uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS \$\$
  SELECT EXISTS (SELECT 1 FROM public.rooms WHERE id = p AND type IN ('Public', 'Tipster'))
\$\$;
CREATE FUNCTION public.is_room_member(r uuid, u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS \$\$
  SELECT EXISTS (SELECT 1 FROM public.room_members WHERE room_id = r AND user_id = u)
\$\$;
CREATE FUNCTION public.can_view_subchannel(s uuid, u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS \$\$
  SELECT COALESCE((SELECT CASE WHEN sc.visibility = 'public'
    THEN public.room_is_public(sc.room_id) OR public.is_room_member(sc.room_id, u)
    ELSE public.is_room_member(sc.room_id, u) END
    FROM public.room_subchannels sc WHERE sc.id = s), false)
\$\$;

INSERT INTO public.rooms VALUES ('$PUB', 'Public'), ('$PRIV', 'Private');
INSERT INTO public.room_members VALUES ('$PRIV', '$MEMBER');
INSERT INTO public.room_subchannels VALUES ('$PUB_SUB', '$PUB', 'public'), ('$PRIV_SUB', '$PRIV', 'public');
-- Realtime inserts a probe row during authorization; seed equivalents.
INSERT INTO realtime.messages (topic, extension) VALUES
  ('room-sub-$PUB_SUB', 'broadcast'), ('room-sub-$PRIV_SUB', 'broadcast'),
  ('room-members-$PUB', 'broadcast'), ('room-members-$PRIV', 'broadcast'),
  ('room-sub-$PRIV_SUB', 'presence'), ('arena-abc', 'broadcast'), ('room-sub-not-a-uuid', 'broadcast');
SQL

# Apply twice: the migration must be re-runnable.
PGOPTIONS=--client-min-messages=warning "${PSQL[@]}" -f "$MIGRATION" >/dev/null
PGOPTIONS=--client-min-messages=warning "${PSQL[@]}" -f "$MIGRATION" >/dev/null

fail=0
check() {
  if [[ "$3" == "$2" ]]; then echo "  ok    $1"; else echo "  FAIL  $1 (expected '$2', got '$3')"; fail=1; fi
}
# can_join ROLE SUB TOPIC [EXTENSION] → t/f (or "error" if the policy raised)
can_join() {
  "${PSQL[@]}" 2>/dev/null <<EOF | tail -n 1 || echo error
BEGIN;
SET LOCAL ROLE $1;
SELECT set_config('request.jwt.claim.sub', '$2', true), set_config('realtime.topic', '$3', true) \\gset ignored_
SELECT count(*) > 0 FROM realtime.messages WHERE topic = '$3' AND extension = '${4:-broadcast}';
ROLLBACK;
EOF
}

echo "chat channels"
check "member joins private-room chat"      t "$(can_join authenticated "$MEMBER" "room-sub-$PRIV_SUB")"
check "stranger refused private-room chat"  f "$(can_join authenticated "$STRANGER" "room-sub-$PRIV_SUB")"
check "anon refused private-room chat"      f "$(can_join anon '' "room-sub-$PRIV_SUB")"
check "anon joins public-room chat"         t "$(can_join anon '' "room-sub-$PUB_SUB")"
echo "membership channels"
check "member joins private-room members"   t "$(can_join authenticated "$MEMBER" "room-members-$PRIV")"
check "stranger refused private members"    f "$(can_join authenticated "$STRANGER" "room-members-$PRIV")"
check "anon joins public-room members"      t "$(can_join anon '' "room-members-$PUB")"
echo "other topics"
check "malformed topic is refused, no error" f "$(can_join authenticated "$MEMBER" "room-sub-not-a-uuid")"
check "arena topic untouched, no error"      f "$(can_join authenticated "$MEMBER" "arena-abc")"
check "presence not granted"                 f "$(can_join authenticated "$MEMBER" "room-sub-$PRIV_SUB" presence)"
echo "clients cannot broadcast"
check "member broadcast denied" denied "$("${PSQL[@]}" 2>/dev/null <<EOF | tail -n 1 || echo denied
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '$MEMBER', true), set_config('realtime.topic', 'room-sub-$PRIV_SUB', true) \\gset ignored_
INSERT INTO realtime.messages (topic, extension) VALUES ('room-sub-$PRIV_SUB', 'broadcast');
SELECT 'allowed';
ROLLBACK;
EOF
)"

if [[ $fail -ne 0 ]]; then
  echo "FAILED"
  exit 1
fi
echo "all checks passed"
