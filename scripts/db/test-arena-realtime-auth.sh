#!/usr/bin/env bash
#
# Exercise supabase/migrations/20260926_arena_realtime_authorization.sql against
# a THROWAWAY local Postgres. Never touches a real database.
#
# Supabase's own pieces the migration depends on are stubbed to match their
# production behaviour closely enough to test the policy logic:
#   - roles anon / authenticated / service_role (service_role has BYPASSRLS)
#   - auth.users, and auth.uid() reading the JWT `sub` claim
#   - realtime.messages (RLS on), and realtime.topic() reading the joined topic
#
# Realtime authorizes a join by running a SELECT on realtime.messages as the
# user, with the topic set, and checking whether any row comes back. The
# assertions below do the same.
#
# Usage: scripts/db/test-arena-realtime-auth.sh
# Needs initdb / pg_ctl / psql on PATH (e.g. `brew install postgresql@14`).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# Overridable so a deliberately broken copy can be tested (the checks must fail).
MIGRATION="${MIGRATION:-$ROOT/supabase/migrations/20260926_arena_realtime_authorization.sql}"

for bin in initdb pg_ctl psql; do
  command -v "$bin" >/dev/null || { echo "error: $bin not found on PATH" >&2; exit 1; }
done

DATA="$(mktemp -d -t arena-rt-auth)"
PORT=$(( 20000 + RANDOM % 20000 ))
cleanup() {
  pg_ctl -D "$DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$DATA"
}
trap cleanup EXIT

initdb -D "$DATA" -U postgres --auth=trust >/dev/null
pg_ctl -D "$DATA" -o "-p $PORT -k $DATA -c listen_addresses=''" -l "$DATA/log" -w start >/dev/null

PSQL=(psql -h "$DATA" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -X -q -t -A)

OWNER=11111111-1111-1111-1111-111111111111
GUEST=22222222-2222-2222-2222-222222222222
STRANGER=33333333-3333-3333-3333-333333333333

"${PSQL[@]}" <<SQL
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS \$\$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
\$\$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

CREATE SCHEMA realtime;
CREATE TABLE realtime.messages (
  id bigserial PRIMARY KEY,
  topic text NOT NULL,
  extension text NOT NULL,
  payload jsonb
);
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION realtime.topic() RETURNS text LANGUAGE sql STABLE AS \$\$
  SELECT nullif(current_setting('realtime.topic', true), '')
\$\$;
GRANT USAGE ON SCHEMA realtime TO anon, authenticated, service_role;
GRANT SELECT, INSERT ON realtime.messages TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

INSERT INTO auth.users VALUES ('$OWNER'), ('$GUEST'), ('$STRANGER');
SQL

# Apply twice: the migration must be re-runnable.
"${PSQL[@]}" -f "$MIGRATION" >/dev/null
"${PSQL[@]}" -f "$MIGRATION" >/dev/null

fail=0
check() {
  local name="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo "  ok    $name"
  else
    echo "  FAIL  $name (expected '$expected', got '$actual')"
    fail=1
  fi
}

# Run SQL as a role, optionally with a JWT subject and a joined topic.
as() {
  local role="$1" sub="$2" topic="$3" sql="$4"
  # stdin, not -c: with -c psql prints only the last statement's result. The
  # set_config calls are wrapped in PERFORM-free SELECTs into a discarded var so
  # the only printed row is the query under test.
  "${PSQL[@]}" <<EOF | tail -n 1
BEGIN;
SET LOCAL ROLE $role;
SELECT set_config('request.jwt.claim.sub', '$sub', true), set_config('realtime.topic', '$topic', true) \\gset ignored_
$sql
COMMIT;
EOF
}

# Would Realtime let this user join `topic`? = does the SELECT return a row.
can_join() {
  as authenticated "$1" "$2" "SELECT count(*) > 0 FROM realtime.messages WHERE topic = '$2' AND extension = 'broadcast';"
}

echo "seat registration (service role)"
check "owner registers"        completed "$(as service_role '' '' "SELECT public.register_arena_channel_member('arena-g1', 'g1', '$OWNER', 'P1');")"
check "guest registers"        completed "$(as service_role '' '' "SELECT public.register_arena_channel_member('arena-g1', 'g1', '$GUEST', 'P2');")"
check "re-register is a no-op" completed "$(as service_role '' '' "SELECT public.register_arena_channel_member('arena-g1', 'g1', '$OWNER', 'P1');")"
check "rows"                   2         "$(as service_role '' '' "SELECT count(*) FROM public.arena_game_members;")"
check "bad topic rejected"     invalid   "$(as service_role '' '' "SELECT public.register_arena_channel_member('room-sub-1', 'g1', '$OWNER', 'P1');")"
check "bad seat rejected"      invalid   "$(as service_role '' '' "SELECT public.register_arena_channel_member('arena-g1', 'g1', '$OWNER', 'P3');")"
check "unknown user"           no_user   "$(as service_role '' '' "SELECT public.register_arena_channel_member('arena-g1', 'g1', '44444444-4444-4444-4444-444444444444', 'P1');")"

# Realtime inserts a probe row during authorization; seed equivalent rows.
"${PSQL[@]}" -c "INSERT INTO realtime.messages (topic, extension) VALUES
  ('arena-g1', 'broadcast'), ('arena-g1', 'presence'), ('arena-g2', 'broadcast'), ('room-sub-1', 'broadcast');"

echo "joining a private arena channel"
check "owner can join"                 t "$(can_join "$OWNER" arena-g1)"
check "guest can join"                 t "$(can_join "$GUEST" arena-g1)"
check "stranger cannot join"           f "$(can_join "$STRANGER" arena-g1)"
check "owner cannot join another game" f "$(can_join "$OWNER" arena-g2)"
check "presence is not granted"        0 "$(as authenticated "$OWNER" arena-g1 "SELECT count(*) FROM realtime.messages WHERE extension = 'presence';")"
check "anon cannot join"               0 "$(as anon '' arena-g1 "SELECT count(*) FROM realtime.messages;")"
check "policy ignores non-arena topics" 0 "$(as authenticated "$OWNER" room-sub-1 "SELECT count(*) FROM realtime.messages WHERE topic = 'room-sub-1';")"

echo "clients cannot broadcast"
# No INSERT policy exists, so RLS rejects the row and psql exits non-zero.
check "player broadcast denied" denied "$(as authenticated "$OWNER" arena-g1 "INSERT INTO realtime.messages (topic, extension) VALUES ('arena-g1', 'broadcast'); SELECT 'allowed';" 2>/dev/null || echo denied)"

echo "the seat table is private"
check "authenticated cannot read seats" denied "$(as authenticated "$OWNER" '' "SELECT count(*) FROM public.arena_game_members;" 2>/dev/null || echo denied)"
check "authenticated cannot register"   denied "$(as authenticated "$OWNER" '' "SELECT public.register_arena_channel_member('arena-g9', 'g9', '$OWNER', 'P1');" 2>/dev/null || echo denied)"

echo "expiry"
as service_role '' '' "UPDATE public.arena_game_members SET expires_at = now() - interval '1 minute' WHERE user_id = '$GUEST';" >/dev/null
check "expired seat cannot join" f "$(can_join "$GUEST" arena-g1)"
as service_role '' '' "SELECT public.register_arena_channel_member('arena-g5', 'g5', '$STRANGER', 'P1');" >/dev/null
check "expired rows pruned on next register" 0 "$(as service_role '' '' "SELECT count(*) FROM public.arena_game_members WHERE user_id = '$GUEST';")"

if [[ $fail -ne 0 ]]; then
  echo "FAILED"
  exit 1
fi
echo "all checks passed"
