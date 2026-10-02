#!/usr/bin/env bash
#
# Prove supabase/migrations/20261002_lock_down_profile_betslip_member_writes.sql
# (+ 20261002_parlays_owner_writes.sql, 20261003_betslip_grading_service_only.sql)
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
PARLAY_FIX="${PARLAY_FIX:-$ROOT/supabase/migrations/20261002_parlays_owner_writes.sql}"
BETSLIP_FIX="${BETSLIP_FIX:-$ROOT/supabase/migrations/20261003_betslip_grading_service_only.sql}"
INVITE_FIX="${INVITE_FIX:-$ROOT/supabase/migrations/20261003_room_subchannel_invite_token_private.sql}"
ROOM_FIX="${ROOM_FIX:-$ROOT/supabase/migrations/20261003_room_moderation_hierarchy.sql}"

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
MODROOM=aaaaaaaa-0000-0000-0000-000000000004  # OTHER owns it, ME moderates
PARLAY=bbbbbbbb-0000-0000-0000-000000000001

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

CREATE TABLE public.rooms (id uuid PRIMARY KEY, type text NOT NULL, creator_id uuid, name text);
CREATE TABLE public.room_members (id bigserial PRIMARY KEY, room_id uuid, user_id uuid, role text, UNIQUE (room_id, user_id));
CREATE TABLE public.room_bans (room_id uuid, user_id uuid);
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY room_members_select_all ON public.room_members FOR SELECT USING (true);
CREATE POLICY room_members_insert_self ON public.room_members FOR INSERT
  WITH CHECK (auth.uid() = user_id AND role = 'member');
CREATE FUNCTION public.room_is_public(p uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS \$\$
  SELECT EXISTS (SELECT 1 FROM public.rooms WHERE id = p AND type IN ('Public', 'Tipster'))
\$\$;
CREATE FUNCTION public.is_room_admin(r uuid, u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS \$\$
  SELECT EXISTS (SELECT 1 FROM public.room_members WHERE room_id = r AND user_id = u AND role IN ('owner', 'moderator'))
\$\$;
-- Room moderation policies as 20260904/20260905 left them (admin = any write).
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY rooms_select_all ON public.rooms FOR SELECT USING (true);
CREATE POLICY rooms_update_admin ON public.rooms FOR UPDATE
  USING (creator_id = auth.uid() OR public.is_room_admin(id, auth.uid()))
  WITH CHECK (creator_id = auth.uid() OR public.is_room_admin(id, auth.uid()));
CREATE POLICY rooms_delete_creator ON public.rooms FOR DELETE USING (creator_id = auth.uid());
CREATE POLICY room_members_delete_self_or_admin ON public.room_members FOR DELETE
  USING (user_id = auth.uid() OR public.is_room_admin(room_id, auth.uid()));
ALTER TABLE public.room_bans ENABLE ROW LEVEL SECURITY;
CREATE POLICY room_bans_insert_admin ON public.room_bans FOR INSERT WITH CHECK (public.is_room_admin(room_id, auth.uid()));
CREATE POLICY room_bans_delete_admin ON public.room_bans FOR DELETE USING (public.is_room_admin(room_id, auth.uid()));
CREATE TABLE public.room_mutes (room_id uuid, user_id uuid, muted_by uuid, muted_until timestamptz, UNIQUE (room_id, user_id));
ALTER TABLE public.room_mutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY room_mutes_insert_admin ON public.room_mutes FOR INSERT WITH CHECK (public.is_room_admin(room_id, auth.uid()));
CREATE POLICY room_mutes_delete_admin ON public.room_mutes FOR DELETE USING (public.is_room_admin(room_id, auth.uid()));
CREATE TABLE public.room_audit_log (room_id uuid, actor_id uuid, action text, target_id uuid);
ALTER TABLE public.room_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY room_audit_log_insert_admin ON public.room_audit_log FOR INSERT WITH CHECK (public.is_room_admin(room_id, auth.uid()));
CREATE FUNCTION public.is_room_banned(r uuid, u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS \$\$
  SELECT EXISTS (SELECT 1 FROM public.room_bans WHERE room_id = r AND user_id = u)
\$\$;

-- Sub-channels as 20260902 left them: every column visible to room viewers.
CREATE TABLE public.room_subchannels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), room_id uuid NOT NULL, name text NOT NULL,
  visibility text NOT NULL DEFAULT 'public', slug text NOT NULL UNIQUE, invite_token text
);
ALTER TABLE public.room_subchannels ENABLE ROW LEVEL SECURITY;
CREATE POLICY subchannels_select_visible ON public.room_subchannels FOR SELECT USING (public.room_is_public(room_id));

CREATE TABLE public.betslips (
  id bigserial PRIMARY KEY, user_id uuid, room_id uuid, odds numeric, status text DEFAULT 'Pending',
  is_for_sale boolean DEFAULT false, price numeric, matches jsonb, created_at timestamptz DEFAULT now(),
  payout numeric
);
ALTER TABLE public.betslips ENABLE ROW LEVEL SECURITY;
CREATE POLICY betslips_select_visible ON public.betslips FOR SELECT
  USING (user_id = auth.uid() OR (room_id IS NOT NULL AND public.room_is_public(room_id)));
CREATE POLICY betslips_insert_own ON public.betslips FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY betslips_update_own ON public.betslips FOR UPDATE USING (user_id = auth.uid());

CREATE TABLE public.parlays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, status text NOT NULL DEFAULT 'pending',
  visibility text NOT NULL, odds numeric, stake numeric, custom_note text, combined_hit_rate numeric,
  is_logged boolean DEFAULT false, created_at timestamptz DEFAULT now(), resolved_at timestamptz
);
CREATE TABLE public.parlay_legs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), parlay_id uuid NOT NULL, player_name text NOT NULL,
  stat_category text NOT NULL, prop_line numeric NOT NULL, direction text NOT NULL, l10_hit_rate numeric,
  leg_order int NOT NULL, sport text NOT NULL, game_id text, result text NOT NULL DEFAULT 'pending'
);
ALTER TABLE public.parlays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parlay_legs ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_own ON public.parlays FOR SELECT USING (user_id = auth.uid());
CREATE POLICY insert_own ON public.parlays FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY update_own ON public.parlays FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY delete_own_pending ON public.parlays FOR DELETE USING (user_id = auth.uid() AND status = 'pending');
CREATE POLICY select_via_parlay ON public.parlay_legs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.parlays p WHERE p.id = parlay_id AND p.user_id = auth.uid()));
CREATE POLICY insert_via_parlay ON public.parlay_legs FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.parlays p WHERE p.id = parlay_id AND p.user_id = auth.uid()));
INSERT INTO public.parlays (id, user_id, visibility) VALUES ('bbbbbbbb-0000-0000-0000-000000000001', '$ME', 'private');

INSERT INTO public.profiles (id, username, wallet_balance) VALUES ('$ME', 'me', 100), ('$OTHER', 'other', 5000);
INSERT INTO public.rooms VALUES ('$PUB', 'Public'), ('$PRIV', 'Private'), ('$BANNED', 'Public');
INSERT INTO public.room_bans VALUES ('$BANNED', '$ME');
INSERT INTO public.rooms (id, type, creator_id, name) VALUES ('$MODROOM', 'Public', '$OTHER', 'Mod room');
INSERT INTO public.room_members (room_id, user_id, role) VALUES ('$MODROOM', '$OTHER', 'owner'), ('$MODROOM', '$ME', 'moderator');
INSERT INTO public.room_subchannels (room_id, name, visibility, slug, invite_token) VALUES ('$PUB', 'VIP', 'private', 'vip', 'SECRET');
INSERT INTO public.betslips (user_id, room_id, is_for_sale, price, matches)
  VALUES ('$OTHER', '$PUB', true, 50, '[{"pick":"PAID PICK CONTENT"}]');
INSERT INTO public.betslips (user_id, odds, status, matches) VALUES ('$ME', 2, 'Lost', '[]'), ('$ME', 2, 'Pending', '[]');
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
  check "owner self-settles parlay won"   "$1" "$(as authenticated "$ME" "UPDATE public.parlays SET status = 'won' WHERE id = '$PARLAY' RETURNING 'allowed';")"
  check "owner inserts a won parlay"      "$1" "$(as authenticated "$ME" "INSERT INTO public.parlays (user_id, visibility, status) VALUES ('$ME', 'public', 'won') RETURNING 'allowed';")"
  check "owner inserts a won leg"         "$1" "$(as authenticated "$ME" "INSERT INTO public.parlay_legs (parlay_id, player_name, stat_category, prop_line, direction, leg_order, sport, result) VALUES ('$PARLAY', 'X', 'pts', 1, 'over', 1, 'NBA', 'won') RETURNING 'allowed';")"
  # Past-posting: a pending leg added to an old parlay after the game finished
  # is graded from the parlay's created_at, so it settles as a win.
  check "owner adds a late leg to old parlay" "$1" "$(as authenticated "$ME" "INSERT INTO public.parlay_legs (parlay_id, player_name, stat_category, prop_line, direction, leg_order, sport) VALUES ('$PARLAY', 'X', 'pts', 0.5, 'over', 2, 'NBA') RETURNING 'allowed';")"
  check "owner creates a parlay directly" "$1" "$(as authenticated "$ME" "INSERT INTO public.parlays (user_id, visibility) VALUES ('$ME', 'public') RETURNING 'allowed';")"
  check "re-grade a lost betslip as won"  "$1" "$(as authenticated "$ME" "WITH u AS (UPDATE public.betslips SET status = 'Won' WHERE user_id = '$ME' AND status = 'Lost' RETURNING 1) SELECT CASE WHEN count(*) > 0 THEN 'allowed' ELSE 'denied' END FROM u;")"
  check "rewrite picks of a posted slip"  "$1" "$(as authenticated "$ME" "UPDATE public.betslips SET matches = '[{\"pick\":\"late\"}]', odds = 9 WHERE user_id = '$ME' AND status = 'Pending' RETURNING 'allowed';")"
  check "post a betslip already won"      "$1" "$(as authenticated "$ME" "INSERT INTO public.betslips (user_id, odds, status, matches) VALUES ('$ME', 2, 'Won', '[]') RETURNING 'allowed';")"
  check "owner deletes a pending parlay"  "$1" "$(as authenticated "$ME" "DELETE FROM public.parlays WHERE id = '$PARLAY' RETURNING 'allowed';")"
  payout_attacks "$1"
  invite_attacks "$1"
  moderator_attacks "$1"
}
# AUTHZ-5: a moderator acting on the owner through PostgREST.
moderator_attacks() {
  check "moderator hijacks creator_id"     "$1" "$(as authenticated "$ME" "UPDATE public.rooms SET creator_id = '$ME' WHERE id = '$MODROOM' RETURNING 'allowed';")"
  check "moderator bans the owner"         "$1" "$(as authenticated "$ME" "INSERT INTO public.room_bans VALUES ('$MODROOM', '$OTHER') RETURNING 'allowed';")"
  check "moderator removes the owner"      "$1" "$(as authenticated "$ME" "WITH d AS (DELETE FROM public.room_members WHERE room_id = '$MODROOM' AND user_id = '$OTHER' RETURNING 1) SELECT CASE WHEN count(*) > 0 THEN 'allowed' ELSE 'denied' END FROM d;")"
  check "moderator mutes the owner"        "$1" "$(as authenticated "$ME" "INSERT INTO public.room_mutes (room_id, user_id, muted_by) VALUES ('$MODROOM', '$OTHER', '$ME') RETURNING 'allowed';")"
  check "moderator forges an audit row"    "$1" "$(as authenticated "$ME" "INSERT INTO public.room_audit_log VALUES ('$MODROOM', '$OTHER', 'ban', '$ME') RETURNING 'allowed';")"
}
# AUTHZ-7: anyone who could see a public room's sub-channels read invite tokens.
invite_attacks() {
  check "anon reads a private invite token"   "$1" "$(as anon '' "SELECT 'allowed' FROM public.room_subchannels WHERE invite_token = 'SECRET';")"
  check "member reads a private invite token" "$1" "$(as authenticated "$ME" "SELECT 'allowed' FROM public.room_subchannels WHERE invite_token IS NOT NULL;")"
}
# REV-16: owners could write any payout (still open after the 20261002 fix).
payout_attacks() {
  check "owner writes payout on a pending slip" "$1" "$(as authenticated "$ME" "UPDATE public.betslips SET payout = 1e9 WHERE user_id = '$ME' AND status = 'Pending' RETURNING 'allowed';")"
  check "owner self-grades Won with any payout" "$1" "$(as authenticated "$ME" "UPDATE public.betslips SET status = 'Won', payout = 1e9 WHERE user_id = '$ME' AND status = 'Pending' RETURNING 'allowed';")"
}

echo "before the fix (attacks succeed)"
attacks allowed

for f in "$FIX" "$PARLAY_FIX" "$FIX" "$PARLAY_FIX"; do  # twice: must be re-runnable
  PGOPTIONS=--client-min-messages=warning "${PSQL[@]}" -f "$f" >/dev/null
done
echo "after 20261002 only (payout, invite tokens, moderator writes still open)"
payout_attacks allowed
invite_attacks allowed
moderator_attacks allowed
for f in "$BETSLIP_FIX" "$INVITE_FIX" "$ROOM_FIX" "$BETSLIP_FIX" "$INVITE_FIX" "$ROOM_FIX"; do
  PGOPTIONS=--client-min-messages=warning "${PSQL[@]}" -f "$f" >/dev/null
done

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
check "API grades own betslip"    ok "$(as service_role '' "UPDATE public.betslips SET status = 'Won', payout = 4 WHERE user_id = '$ME' AND status = 'Pending' RETURNING 'ok';")"
check "moderator leaves the room"  ok "$(as authenticated "$ME" "DELETE FROM public.room_members WHERE room_id = '$MODROOM' AND user_id = '$ME' RETURNING 'ok';")"
check "creator deletes own room"   ok "$(as authenticated "$OTHER" "DELETE FROM public.rooms WHERE id = '$MODROOM' RETURNING 'ok';")"
check "API mutes (service role)"   ok "$(as service_role '' "INSERT INTO public.room_mutes (room_id, user_id, muted_by) VALUES ('$MODROOM', '$ME', '$OTHER') ON CONFLICT (room_id, user_id) DO UPDATE SET muted_until = now() RETURNING 'ok';")"
check "anon lists sub-channels"   ok "$(as anon '' "SELECT 'ok' FROM public.room_subchannels WHERE slug = 'vip' AND visibility = 'private' AND name = 'VIP';")"
check "API reads invite token"    ok "$(as service_role '' "SELECT 'ok' FROM public.room_subchannels WHERE invite_token = 'SECRET';")"
check "service role reads picks"  ok "$(as service_role '' "SELECT 'ok' FROM public.betslips WHERE matches IS NOT NULL;")"
check "API creates parlay + legs" ok "$(as service_role '' "WITH p AS (INSERT INTO public.parlays (user_id, visibility, odds, stake, custom_note, combined_hit_rate, is_logged) VALUES ('$ME', 'public', 2.5, 10, 'n', 60, false) RETURNING id) INSERT INTO public.parlay_legs (parlay_id, player_name, stat_category, prop_line, direction, l10_hit_rate, leg_order, sport) SELECT id, 'X', 'pts', 1, 'over', 50, 1, 'NBA' FROM p RETURNING 'ok';")"
check "owner reads own parlay"    ok "$(as authenticated "$ME" "SELECT 'ok' FROM public.parlays WHERE id = '$PARLAY';")"
check "change parlay visibility"  ok "$(as authenticated "$ME" "UPDATE public.parlays SET visibility = 'public' WHERE id = '$PARLAY' RETURNING 'ok';")"
check "settlement (service) runs" ok "$(as service_role '' "UPDATE public.parlays SET status = 'won', resolved_at = now() WHERE id = '$PARLAY' RETURNING 'ok';")"
check "settlement can void"       ok "$(as service_role '' "UPDATE public.parlays SET status = 'void' WHERE id = '$PARLAY' RETURNING 'ok';")"
check "unknown status rejected"   denied "$(as service_role '' "UPDATE public.parlays SET status = 'bogus' WHERE id = '$PARLAY' RETURNING 'ok';")"

if [[ $fail -ne 0 ]]; then
  echo "FAILED"
  exit 1
fi
echo "all checks passed"
