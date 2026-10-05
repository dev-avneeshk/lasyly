#!/usr/bin/env bash
#
# End-to-end test for supabase/migrations/20260928_transactions_reference_id_text.sql
# against a THROWAWAY local Postgres. Never touches a real database.
#
# Builds the live shape (transactions.reference_id as UUID, with a foreign key
# to betslips), applies the REAL arena economy migration on top, reproduces the
# production error, applies the fix, then runs the real functions through a
# whole game's worth of money movement.
#
# Usage: scripts/db/test-reference-id-text.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ECONOMY="$ROOT/supabase/migrations/20260921_arena_economy.sql"
FIX="${FIX:-$ROOT/supabase/migrations/20260928_transactions_reference_id_text.sql}"
TYPE_FIX="${TYPE_FIX:-$ROOT/supabase/migrations/20260929_transactions_type_check_all_ledger_types.sql}"
REFUND_FIX="${REFUND_FIX:-$ROOT/supabase/migrations/20261003_refund_arena_stake_paid_game_guard.sql}"

for bin in initdb pg_ctl psql; do
  command -v "$bin" >/dev/null || { echo "error: $bin not found on PATH" >&2; exit 1; }
done

DATA="$(mktemp -d -t refid-text)"
PORT=$(( 20000 + RANDOM % 20000 ))
cleanup() { pg_ctl -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT

initdb -D "$DATA" -U postgres --auth=trust >/dev/null
pg_ctl -D "$DATA" -o "-p $PORT -k $DATA -c listen_addresses=''" -l "$DATA/log" -w start >/dev/null
PSQL=(psql -h "$DATA" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -X -q -t -A)
q() { "${PSQL[@]}" -c "$1" 2>&1 | tail -n 1; }

P1=11111111-1111-1111-1111-111111111111
P2=22222222-2222-2222-2222-222222222222
GAME=aaaaaaaa-0000-4000-8000-000000000001
BETSLIP=bbbbbbbb-0000-4000-8000-000000000001

# ── Live shape + the Supabase pieces the economy migration calls ─────────────
"${PSQL[@]}" <<SQL
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT NULL::uuid';
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS 'SELECT NULL::jsonb';
-- As in 20260914_lock_down_money_rpcs.sql: no JWT → privileged (psql path).
CREATE FUNCTION public.is_service_caller() RETURNS boolean LANGUAGE sql STABLE AS
  \$\$ SELECT COALESCE((SELECT auth.jwt() ->> 'role') = 'service_role', true) \$\$;

CREATE TABLE public.profiles (id uuid PRIMARY KEY, wallet_balance numeric DEFAULT 0);
CREATE TABLE public.betslips (id uuid PRIMARY KEY);
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  amount numeric NOT NULL,
  type text NOT NULL,
  status text,
  stripe_session_id text,
  reference_id uuid REFERENCES public.betslips(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text,
  -- The live CHECKs, as probed (not in any migration file). LEGACY_X stands in
  -- for any value we didn't probe for: the fix must keep it.
  CONSTRAINT transactions_type_check
    CHECK (type IN ('TOP_UP', 'PURCHASE', 'EARNING', 'WITHDRAWAL', 'LEGACY_X')),
  CONSTRAINT transactions_status_check
    CHECK (status IN ('COMPLETED', 'PENDING', 'FAILED'))
);
INSERT INTO public.profiles VALUES ('$P1', 500), ('$P2', 500);
INSERT INTO public.betslips VALUES ('$BETSLIP');
-- A pre-existing pick purchase, to prove old rows survive the conversion.
INSERT INTO public.transactions (user_id, amount, type, status, reference_id)
VALUES ('$P1', -10, 'PURCHASE', 'COMPLETED', '$BETSLIP');
SQL

# The real economy migration, exactly as shipped.
"${PSQL[@]}" -f "$ECONOMY" >/dev/null 2>&1

fail=0
check() { if [[ "$3" == "$2" ]]; then echo "  ok    $1"; else echo "  FAIL  $1 (expected '$2', got '$3')"; fail=1; fi; }

echo "before the fix (reproduces production)"
# Full output, not q(): the error spans several lines (ERROR / HINT / CONTEXT).
check "start_arena_stake errors on uuid = text" \
  "operator does not exist: uuid = text" \
  "$("${PSQL[@]}" -c "SELECT public.start_arena_stake('$P1', '$GAME', 50, true);" 2>&1 | grep -o 'operator does not exist: uuid = text' | head -n 1 || true)"

"${PSQL[@]}" -f "$FIX" >/dev/null 2>&1
"${PSQL[@]}" -f "$FIX" >/dev/null 2>&1   # re-runnable

check "signup bonus rejected by the live type CHECK" \
  "violates check constraint \"transactions_type_check\"" \
  "$("${PSQL[@]}" -c "SELECT public.grant_signup_bonus('$P1');" 2>&1 | grep -o 'violates check constraint "transactions_type_check"' | head -n 1 || true)"

"${PSQL[@]}" -f "$TYPE_FIX" >/dev/null 2>&1
"${PSQL[@]}" -f "$TYPE_FIX" >/dev/null 2>&1   # re-runnable

echo "after the fixes"
check "type CHECK kept an unprobed legacy value" t "$(q "SELECT pg_get_constraintdef(oid) LIKE '%LEGACY_X%' FROM pg_constraint WHERE conname = 'transactions_type_check';")"
check "type CHECK still rejects junk" rejected "$("${PSQL[@]}" -c "INSERT INTO public.transactions (user_id, amount, type) VALUES ('$P1', 1, 'JUNK');" >/dev/null 2>&1 && echo accepted || echo rejected)"
check "signup bonus granted"          completed "$(q "SELECT public.grant_signup_bonus('$P1');")"
check "signup bonus only once"        duplicate "$(q "SELECT public.grant_signup_bonus('$P1');")"
check "P1 balance 500+200"            700 "$(q "SELECT wallet_balance::int FROM public.profiles WHERE id='$P1';")"
q "UPDATE public.profiles SET wallet_balance = 500 WHERE id = '$P1';" >/dev/null   # reset for the game below
check "column is text"                  text "$(q "SELECT data_type FROM information_schema.columns WHERE table_name='transactions' AND column_name='reference_id';")"
check "old purchase row kept its id"    "$BETSLIP" "$(q "SELECT reference_id FROM public.transactions WHERE type='PURCHASE';")"
check "arena idempotency indexes exist" 3 "$(q "SELECT count(*) FROM pg_indexes WHERE indexname IN ('uq_transactions_arena_entry','uq_transactions_arena_credit','uq_transactions_weekly_bonus');")"

echo "a full 1v1, through the real functions"
check "P1 stakes"               completed "$(q "SELECT public.start_arena_stake('$P1', '$GAME', 50, true);")"
check "P1 stake is idempotent"  duplicate "$(q "SELECT public.start_arena_stake('$P1', '$GAME', 50, true);")"
check "P2 stakes"               completed "$(q "SELECT public.start_arena_stake('$P2', '$GAME', 50, true);")"
check "winner is paid"          completed "$(q "SELECT public.settle_1v1_stake('$GAME', '$P1', '$P2', 90, 25, 10);")"
check "payout is idempotent"    duplicate "$(q "SELECT public.settle_1v1_stake('$GAME', '$P1', '$P2', 90, 25, 10);")"
check "P1 balance 500-50+90"    540 "$(q "SELECT wallet_balance::int FROM public.profiles WHERE id='$P1';")"
check "P2 balance 500-50"       450 "$(q "SELECT wallet_balance::int FROM public.profiles WHERE id='$P2';")"
check "no refund after payout"  already_settled "$(q "SELECT public.refund_arena_stake('$P1', '$GAME');")"
# REV-17: the guard only checked the refunded user's own payout rows.
check "before 20261003: the LOSER of a paid game could be refunded" completed \
  "$("${PSQL[@]}" <<< "BEGIN; SELECT public.refund_arena_stake('$P2', '$GAME'); ROLLBACK;" | head -n 1)"
"${PSQL[@]}" -f "$REFUND_FIX" >/dev/null 2>&1
"${PSQL[@]}" -f "$REFUND_FIX" >/dev/null 2>&1   # re-runnable
check "after 20261003: loser of a paid game is not refunded" already_settled "$(q "SELECT public.refund_arena_stake('$P2', '$GAME');")"
check "P2 balance unchanged"    450 "$(q "SELECT wallet_balance::int FROM public.profiles WHERE id='$P2';")"
check "refund stays service-role only" f "$(q "SELECT has_function_privilege('authenticated', 'public.refund_arena_stake(uuid, text)', 'EXECUTE');")"

echo "the other money paths"
check "CPU reward"              completed "$(q "SELECT public.award_cpu_reward('$P1', 'cccccccc-0000-4000-8000-000000000001', 75, 20);")"
check "weekly bonus (non-UUID key)" completed "$(q "SELECT public.grant_weekly_level_bonus('$P1', '2026-W39', 150);")"
check "weekly bonus once per week"  duplicate "$(q "SELECT public.grant_weekly_level_bonus('$P1', '2026-W39', 150);")"
check "abandoned stake refunds"  completed "$(q "SELECT public.start_arena_stake('$P2', 'dddddddd-0000-4000-8000-000000000001', 20, true); SELECT public.refund_arena_stake('$P2', 'dddddddd-0000-4000-8000-000000000001');")"
check "uuid values still insert" 1 "$(q "INSERT INTO public.transactions (user_id, amount, type, reference_id) VALUES ('$P1', 1, 'EARNING', '$BETSLIP'::uuid); SELECT count(*) FROM public.transactions WHERE type='EARNING';")"

if [[ $fail -ne 0 ]]; then echo "FAILED"; exit 1; fi
echo "all checks passed"
