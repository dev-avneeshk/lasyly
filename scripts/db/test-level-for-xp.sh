#!/usr/bin/env bash
#
# Exercise supabase/migrations/20261005_level_for_xp_closed_form.sql (L-21)
# against a THROWAWAY local Postgres. Never touches a real database.
#
# Loads the 20260921_arena_economy.sql functions (copied below), records the
# loop version's levels, applies the migration twice, then checks the closed
# form returns the same levels and answers a huge input under a short timeout.
#
# Usage: scripts/db/test-level-for-xp.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MIGRATION="${MIGRATION:-$ROOT/supabase/migrations/20261005_level_for_xp_closed_form.sql}"
for bin in initdb pg_ctl psql; do
  command -v "$bin" >/dev/null || { echo "error: $bin not found on PATH" >&2; exit 1; }
done
DATA="$(mktemp -d -t level-for-xp)"
PORT=$(( 20000 + RANDOM % 20000 ))
cleanup() {
  pg_ctl -D "$DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$DATA"
}
trap cleanup EXIT
initdb -D "$DATA" -U postgres --auth=trust >/dev/null
pg_ctl -D "$DATA" -o "-p $PORT -k $DATA -c listen_addresses=''" -l "$DATA/log" -w start >/dev/null
PSQL=(psql -h "$DATA" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -X -q -t -A)
"${PSQL[@]}" <<'SQL'
CREATE FUNCTION public.xp_to_reach_level(p_level integer) RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT (100 * (GREATEST(1, p_level) - 1) * GREATEST(1, p_level)) / 2.0;
$$;
CREATE FUNCTION public.level_for_xp(p_xp numeric) RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  v_level integer := 1;
  v_xp numeric := GREATEST(0, COALESCE(p_xp, 0));
BEGIN
  WHILE public.xp_to_reach_level(v_level + 1) <= v_xp LOOP
    v_level := v_level + 1;
  END LOOP;
  RETURN v_level;
END $$;
-- Every boundary (and one below) for levels 1..1000, plus odd inputs.
CREATE TABLE before AS
  SELECT x, public.level_for_xp(x) AS level FROM (
    SELECT public.xp_to_reach_level(n) + d AS x FROM generate_series(1, 1000) n, (VALUES (-1), (0), (0.5)) v(d)
    UNION VALUES (NULL::numeric), (-50), (0), (12345.678)
  ) s;
SQL
fail=0
check() {
  if [[ "$3" == "$2" ]]; then echo "  ok    $1"; else echo "  FAIL  $1 (expected '$2', got '$3')"; fail=1; fi
}
echo "before"
check "loop version times out on 1e30" timeout "$("${PSQL[@]}" -c "SET statement_timeout = '1s'" -c "SELECT public.level_for_xp(1e30)" 2>/dev/null || echo timeout)"
# Apply twice: the migration must be re-runnable.
PGOPTIONS=--client-min-messages=warning "${PSQL[@]}" -f "$MIGRATION" >/dev/null
PGOPTIONS=--client-min-messages=warning "${PSQL[@]}" -f "$MIGRATION" >/dev/null
echo "after"
check "same level as the loop for $("${PSQL[@]}" -c "SELECT count(*) FROM before") inputs" 0 \
  "$("${PSQL[@]}" -c "SELECT count(*) FROM before WHERE public.level_for_xp(x) IS DISTINCT FROM level")"
check "1e30 answers within 1s"  2147483647 "$("${PSQL[@]}" -c "SET statement_timeout = '1s'" -c "SELECT public.level_for_xp(1e30)")"
check "1e15 exact"              4472136    "$("${PSQL[@]}" -c "SELECT public.level_for_xp(1e15)")"
if [[ $fail -ne 0 ]]; then
  echo "FAILED"
  exit 1
fi
echo "all checks passed"
