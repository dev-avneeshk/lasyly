#!/usr/bin/env bash
#
# Prove supabase/migrations/20260927_revoke_public_execute_on_service_rpcs.sql
# closes public EXECUTE on the service-only functions, against a THROWAWAY local
# Postgres. Never touches a real database.
#
# The bug only exists because of Supabase's default privileges, which grant
# EXECUTE on every new function in `public` directly to anon and authenticated.
# This reproduces those defaults, shows the old "REVOKE ... FROM PUBLIC" pattern
# leaves the grants in place, then applies the fix and checks every overload.
#
# Usage: scripts/db/test-service-rpc-grants.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FIX="${FIX:-$ROOT/supabase/migrations/20260927_revoke_public_execute_on_service_rpcs.sql}"

for bin in initdb pg_ctl psql; do
  command -v "$bin" >/dev/null || { echo "error: $bin not found on PATH" >&2; exit 1; }
done

DATA="$(mktemp -d -t svc-rpc-grants)"
PORT=$(( 20000 + RANDOM % 20000 ))
cleanup() {
  pg_ctl -D "$DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$DATA"
}
trap cleanup EXIT

initdb -D "$DATA" -U postgres --auth=trust >/dev/null
pg_ctl -D "$DATA" -o "-p $PORT -k $DATA -c listen_addresses=''" -l "$DATA/log" -w start >/dev/null
PSQL=(psql -h "$DATA" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -X -q -t -A)

SERVICE_ONLY=(
  process_stripe_topup award_cpu_reward settle_1v1_stake grant_weekly_level_bonus
  start_arena_stake refund_arena_stake credit_wallet debit_wallet apply_xp
  cleanup_old_chat_data register_arena_channel_member
)

# Roles + Supabase's default privileges on public functions.
"${PSQL[@]}" <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
SQL

# Stand-ins with the real names, created the way the original migrations did.
# Two overloads for one of them, so the by-name loop is exercised.
for fn in "${SERVICE_ONLY[@]}"; do
  "${PSQL[@]}" -c "CREATE FUNCTION public.$fn(p int) RETURNS int LANGUAGE sql AS 'SELECT p';
                   REVOKE ALL ON FUNCTION public.$fn(int) FROM PUBLIC;
                   GRANT EXECUTE ON FUNCTION public.$fn(int) TO service_role;"
done
"${PSQL[@]}" -c "CREATE FUNCTION public.award_cpu_reward(p text) RETURNS text LANGUAGE sql AS 'SELECT p';
                 REVOKE ALL ON FUNCTION public.award_cpu_reward(text) FROM PUBLIC;"
"${PSQL[@]}" -c "CREATE FUNCTION public.is_arena_channel_member(p text) RETURNS boolean LANGUAGE sql AS 'SELECT true';
                 REVOKE ALL ON FUNCTION public.is_arena_channel_member(text) FROM PUBLIC;
                 GRANT EXECUTE ON FUNCTION public.is_arena_channel_member(text) TO authenticated, service_role;"
# A function the fix must NOT touch.
"${PSQL[@]}" -c "CREATE FUNCTION public.get_my_level() RETURNS int LANGUAGE sql AS 'SELECT 1';
                 GRANT EXECUTE ON FUNCTION public.get_my_level() TO authenticated, service_role;"

# Every overload of the service-only names, per role: "fn(args):anon,auth,svc".
grants() {
  "${PSQL[@]}" -c "
    SELECT count(*) FILTER (WHERE has_function_privilege('$1', p.oid, 'EXECUTE'))
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = ANY (string_to_array('$(IFS=,; echo "${SERVICE_ONLY[*]}")', ','));"
}
priv() { "${PSQL[@]}" -c "SELECT has_function_privilege('$1', '$2', 'EXECUTE');"; }

TOTAL=$(( ${#SERVICE_ONLY[@]} + 1 ))  # + the extra award_cpu_reward overload

fail=0
check() {
  if [[ "$3" == "$2" ]]; then echo "  ok    $1"; else echo "  FAIL  $1 (expected '$2', got '$3')"; fail=1; fi
}

echo "before the fix (reproduces the bug)"
check "anon can execute all $TOTAL overloads"          "$TOTAL" "$(grants anon)"
check "authenticated can execute all $TOTAL overloads" "$TOTAL" "$(grants authenticated)"

"${PSQL[@]}" -f "$FIX" >/dev/null 2>&1
"${PSQL[@]}" -f "$FIX" >/dev/null 2>&1   # re-runnable

echo "after the fix"
check "anon can execute none"            0        "$(grants anon)"
check "authenticated can execute none"   0        "$(grants authenticated)"
check "service_role keeps all"           "$TOTAL" "$(grants service_role)"
check "is_arena_channel_member: anon"          f "$(priv anon 'public.is_arena_channel_member(text)')"
check "is_arena_channel_member: authenticated" t "$(priv authenticated 'public.is_arena_channel_member(text)')"
check "untouched: get_my_level for authenticated" t "$(priv authenticated 'public.get_my_level()')"

if [[ $fail -ne 0 ]]; then echo "FAILED"; exit 1; fi
echo "all checks passed"
