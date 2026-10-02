#!/usr/bin/env bash
#
# Prove supabase/migrations/20261002_lock_down_profile_betslip_member_writes.sql
# closes the direct-PostgREST bypasses L-01, AUTHZ-2 and AUTHZ-3, against a
# THROWAWAY local Postgres. Never touches a real database.
#
# Supabase's default table grants (ALL to anon/authenticated) are reproduced,
# plus the 20260522 column revokes, so the "before" checks show each attack
# working; then the fix is applied (twice) and the same attacks must fail while
# the legitimate calls the app makes keep working.
#
# Usage: scripts/db/test-direct-write-lockdown.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FIX="${FIX:-$ROOT/supabase/migrations/20261002_lock_down_profile_betslip_member_writes.sql}"

for bin in initdb pg_ctl psql; do
  command -v "$bin" >/dev/null || { echo "error: $bin not found on PATH" >&2; exit 1; }
done

DATA="$(mktemp -d -t direct-write-lockdown)"
PORT=$(( 20000 + RANDOM % 20000 ))
cleanup() {
  pg_ctl -D "$DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$DATA"
}
trap cleanup EXIT

initdb -D "$DATA" -U postgres --auth=trust >/dev/null
pg_ctl -D "$DATA" -o "-p $PORT -k $DATA -c listen_addresses=''" -l "$DATA/log" -w start >/dev/null
PSQL=(psql -h "$DATA" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -X -q -t -A)

ME=11111111-1111-1111-1111-111111111111
OTHER=22222222-2222-2222-2222-222222222222
PUB=aaaaaaaa-0000-0000-0000-000000000001
PRIV=aaaaaaaa-0000-0000-0000-000000000002
BANNED=aaaaaaaa-0000-0000-0000-000000000003

"${PSQL[@]}" <<SQL
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS \$\$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
\$\$;
GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
-- Supabase default: every new public table is fully granted to the API roles.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY, username text, display_name text, avatar_url text, bio text,
  favourite_sports text[], country text, account_type text, is_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(), wallet_balance numeric DEFAULT 0,
  is_pro boolean DEFAULT false, xp numeric DEFAULT 0, level integer DEFAULT 1
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_select_public ON public.profiles FOR SELECT USING (true);
CREATE POLICY profiles_insert_self ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
-- What 20260522 / 20260921 did (column-level only, which the table grant overrides).
REVOKE SELECT (wallet_balance), UPDATE (wallet_balance), INSERT (wallet_balance) ON public.profiles FROM anon, authenticated;

CREATE TABLE public.rooms (id uuid PRIMARY KEY, type text NOT NULL);
CREATE TABLE public.room_members (id bigserial PRIMARY KEY, room_id uuid, user_id uuid, role text, UNIQUE (room_id, user_id));
CREATE TABLE public.room_bans (room_id uuid, user_id uuid);
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY room_members_select_all ON public.room_members FOR SELECT USING (true);
CREATE POLICY room_members_insert_self ON public.room_members FOR INSERT
  WITH CHECK (auth.uid() = user_id AND role = 'member');
CREATE FUNCTION public.room_is_public(p uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS \$\$
  SELECT EXISTS (SELECT 1 FROM public.rooms WHERE id = p AND type IN ('Public', 'Tipster'))
\$\$;
CREATE FUNCTION public.is_room_banned(r uuid, u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS \$\$
  SELECT EXISTS (SELECT 1 FROM public.room_bans WHERE room_id = r AND user_id = u)
\$\$;

CREATE TABLE public.betslips (
  id bigserial PRIMARY KEY, user_id uuid, room_id uuid, odds numeric, status text DEFAULT 'Pending',
  is_for_sale boolean DEFAULT false, price numeric, matches jsonb, created_at timestamptz DEFAULT now()
);
ALTER TABLE public.betslips ENABLE ROW LEVEL SECURITY;
CREATE POLICY betslips_select_visible ON public.betslips FOR SELECT
  USING (user_id = auth.uid() OR (room_id IS NOT NULL AND public.room_is_public(room_id)));
CREATE POLICY betslips_insert_own ON public.betslips FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY betslips_update_own ON public.betslips FOR UPDATE USING (user_id = auth.uid());

INSERT INTO public.profiles (id, username, wallet_balance) VALUES ('$ME', 'me', 100), ('$OTHER', 'other', 5000);
INSERT INTO public.rooms VALUES ('$PUB', 'Public'), ('$PRIV', 'Private'), ('$BANNED', 'Public');
INSERT INTO public.room_bans VALUES ('$BANNED', '$ME');
INSERT INTO public.betslips (user_id, room_id, is_for_sale, price, matches)
  VALUES ('$OTHER', '$PUB', true, 50, '[{"pick":"PAID PICK CONTENT"}]');
SQL

fail=0
check() {
  if [[ "$3" == "$2" ]]; then echo "  ok    $1"; else echo "  FAIL  $1 (expected '$2', got '$3')"; fail=1; fi
}
# Run SQL as a role (optionally with a JWT subject) inside a rolled-back
# transaction; prints the last row, or "denied" when Postgres raises.
as() {
  "${PSQL[@]}" 2>/dev/null <<EOF | tail -n 1 || echo denied
BEGIN;
SET LOCAL ROLE $1;
SELECT set_config('request.jwt.claim.sub', '$2', true) \\gset ignored_
$3
ROLLBACK;
EOF
}

attacks() {
  check "user mints own wallet_balance"  "$1" "$(as authenticated "$ME" "UPDATE public.profiles SET wallet_balance = 999999 WHERE id = '$ME' RETURNING 'allowed';")"
  check "user sets own xp/level/verified" "$1" "$(as authenticated "$ME" "UPDATE public.profiles SET xp = 1e9, level = 500, is_verified = true WHERE id = '$ME' RETURNING 'allowed';")"
  check "anon reads every wallet_balance" "$1" "$(as anon '' "SELECT 'allowed' FROM public.profiles WHERE wallet_balance > 0 LIMIT 1;")"
  check "anon reads paid pick content"    "$1" "$(as anon '' "SELECT 'allowed' FROM public.betslips WHERE matches IS NOT NULL;")"
  check "self-join private room"          "$1" "$(as authenticated "$ME" "INSERT INTO public.room_members (room_id, user_id, role) VALUES ('$PRIV', '$ME', 'member') RETURNING 'allowed';")"
  check "self-join room banned from"      "$1" "$(as authenticated "$ME" "INSERT INTO public.room_members (room_id, user_id, role) VALUES ('$BANNED', '$ME', 'member') RETURNING 'allowed';")"
}

echo "before the fix (attacks succeed)"
attacks allowed

"${PSQL[@]}" -f "$FIX" >/dev/null
"${PSQL[@]}" -f "$FIX" >/dev/null

echo "after the fix (attacks fail)"
attacks denied

echo "after the fix (legit calls still work)"
check "edit own profile fields"   ok "$(as authenticated "$ME" "UPDATE public.profiles SET bio = 'hi', display_name = 'Me' WHERE id = '$ME' RETURNING 'ok';")"
check "public profile read"       ok "$(as anon '' "SELECT 'ok' FROM public.profiles WHERE username = 'me' AND level = 1 AND xp = 0 AND is_verified = false;")"
check "profile select * refused"  denied "$(as anon '' "SELECT * FROM public.profiles;")"
check "join public room"          ok "$(as authenticated "$ME" "INSERT INTO public.room_members (room_id, user_id, role) VALUES ('$PUB', '$ME', 'member') RETURNING 'ok';")"
check "join as owner refused"     denied "$(as authenticated "$ME" "INSERT INTO public.room_members (room_id, user_id, role) VALUES ('$PUB', '$ME', 'owner') RETURNING 'ok';")"
check "betslip listing readable"  ok "$(as anon '' "SELECT 'ok' FROM public.betslips WHERE is_for_sale AND price = 50;")"
check "post betslip with picks"   ok "$(as authenticated "$ME" "INSERT INTO public.betslips (user_id, odds, matches) VALUES ('$ME', 2, '[]') RETURNING 'ok';")"
check "settle own betslip"        ok "$(as authenticated "$OTHER" "UPDATE public.betslips SET status = 'Won' WHERE user_id = '$OTHER' AND status = 'Pending' RETURNING 'ok';")"
check "service role reads picks"  ok "$(as service_role '' "SELECT 'ok' FROM public.betslips WHERE matches IS NOT NULL;")"

if [[ $fail -ne 0 ]]; then
  echo "FAILED"
  exit 1
fi
echo "all checks passed"
