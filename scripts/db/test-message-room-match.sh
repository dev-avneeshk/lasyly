#!/usr/bin/env bash
#
# Exercise supabase/migrations/20261005_messages_insert_same_room.sql (RA-1)
# against a THROWAWAY local Postgres. Never touches a real database.
#
# Starts from the 20260914_cheapen_hot_rls.sql insert policy (helpers stubbed
# with the same membership logic), shows a cross-room insert succeeding, applies
# the migration twice, then shows it refused while a normal post still works.
#
# Usage: scripts/db/test-message-room-match.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MIGRATION="${MIGRATION:-$ROOT/supabase/migrations/20261005_messages_insert_same_room.sql}"
for bin in initdb pg_ctl psql; do
  command -v "$bin" >/dev/null || { echo "error: $bin not found on PATH" >&2; exit 1; }
done
DATA="$(mktemp -d -t msg-room-match)"
PORT=$(( 20000 + RANDOM % 20000 ))
cleanup() {
  pg_ctl -D "$DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$DATA"
}
trap cleanup EXIT
initdb -D "$DATA" -U postgres --auth=trust >/dev/null
pg_ctl -D "$DATA" -o "-p $PORT -k $DATA -c listen_addresses=''" -l "$DATA/log" -w start >/dev/null
PSQL=(psql -h "$DATA" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -X -q -t -A)
USER_ID=11111111-1111-1111-1111-111111111111
ROOM_A=aaaaaaaa-0000-0000-0000-000000000001
ROOM_B=aaaaaaaa-0000-0000-0000-000000000002
SUB_A=cccccccc-0000-0000-0000-000000000001
SUB_B=cccccccc-0000-0000-0000-000000000002
"${PSQL[@]}" <<SQL
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS \$\$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
\$\$;
GRANT USAGE ON SCHEMA auth, public TO authenticated;
CREATE TABLE public.room_members (room_id uuid, user_id uuid);
CREATE TABLE public.room_subchannels (id uuid PRIMARY KEY, room_id uuid);
CREATE TABLE public.messages (id bigserial PRIMARY KEY, room_id uuid, subchannel_id uuid, user_id uuid, content text, is_system boolean);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public.messages TO authenticated;
GRANT USAGE ON SEQUENCE public.messages_id_seq TO authenticated;
CREATE FUNCTION public.subchannel_room_id(p uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS \$\$
  SELECT room_id FROM public.room_subchannels WHERE id = p
\$\$;
CREATE FUNCTION public.can_post_subchannel(s uuid, u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS \$\$
  SELECT EXISTS (SELECT 1 FROM public.room_subchannels sc JOIN public.room_members m ON m.room_id = sc.room_id
    WHERE sc.id = s AND m.user_id = u)
\$\$;
-- The policy as of 20260914_cheapen_hot_rls.sql.
CREATE POLICY "messages_insert_member" ON public.messages FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id AND is_system = false
    AND public.can_post_subchannel(subchannel_id, (SELECT auth.uid())));
INSERT INTO public.room_subchannels VALUES ('$SUB_A', '$ROOM_A'), ('$SUB_B', '$ROOM_B');
INSERT INTO public.room_members VALUES ('$ROOM_A', '$USER_ID'), ('$ROOM_B', '$USER_ID');
SQL
fail=0
check() {
  if [[ "$3" == "$2" ]]; then echo "  ok    $1"; else echo "  FAIL  $1 (expected '$2', got '$3')"; fail=1; fi
}
# post ROOM SUB → allowed/denied
post() {
  "${PSQL[@]}" 2>/dev/null <<EOF | tail -n 1 || echo denied
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '$USER_ID', true) \\gset ignored_
INSERT INTO public.messages (room_id, subchannel_id, user_id, content, is_system) VALUES ('$1', '$2', '$USER_ID', 'hi', false);
SELECT 'allowed';
ROLLBACK;
EOF
}
echo "before"
check "cross-room insert (room A, B's channel) allowed" allowed "$(post "$ROOM_A" "$SUB_B")"
# Apply twice: the migration must be re-runnable.
PGOPTIONS=--client-min-messages=warning "${PSQL[@]}" -f "$MIGRATION" >/dev/null
PGOPTIONS=--client-min-messages=warning "${PSQL[@]}" -f "$MIGRATION" >/dev/null
echo "after"
check "cross-room insert denied"           denied  "$(post "$ROOM_A" "$SUB_B")"
check "post in room A's own channel"       allowed "$(post "$ROOM_A" "$SUB_A")"
check "post in room B's own channel"       allowed "$(post "$ROOM_B" "$SUB_B")"
if [[ $fail -ne 0 ]]; then
  echo "FAILED"
  exit 1
fi
echo "all checks passed"
