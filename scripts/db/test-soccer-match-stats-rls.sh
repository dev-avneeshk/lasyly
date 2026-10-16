#!/usr/bin/env bash
#
# Prove supabase/migrations/20261016_soccer_match_stats.sql against a THROWAWAY
# local Postgres. Never touches a real database.
#
# Supabase's default table grants (ALL to anon/authenticated/service_role) are
# reproduced, then the migration is applied twice (it must be re-runnable) and:
#   - anon/authenticated can SELECT both tables
#   - anon/authenticated INSERT/UPDATE/DELETE fail
#   - the importer's upsert (service role, ON CONFLICT on the natural key) is
#     idempotent: a duplicate key keeps one row
#   - deleting a soccer_matches row cascades to its stats
#
# The data dir stays inside the workspace (scratch rule) and is removed on exit.
# Postgres listens on 127.0.0.1 only (no unix socket: workspace paths are too
# long for the socket path limit on macOS).
#
# Usage: scripts/db/test-soccer-match-stats-rls.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MIGRATION="${MIGRATION:-$ROOT/supabase/migrations/20261016_soccer_match_stats.sql}"

for bin in initdb pg_ctl psql; do
  command -v "$bin" >/dev/null || { echo "error: $bin not found on PATH" >&2; exit 1; }
done

SCRATCH="${PG_SCRATCH_DIR:-$ROOT/.agents/tasks/lasyly-audit-2026-10-02/scratch}"
mkdir -p "$SCRATCH"
DATA="$(mktemp -d "$SCRATCH/soccer-rls.XXXXXX")"
PORT=$(( 20000 + RANDOM % 20000 ))
cleanup() {
  pg_ctl -D "$DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$DATA"
}
trap cleanup EXIT

initdb -D "$DATA" -U postgres --auth=trust >/dev/null
pg_ctl -D "$DATA" -o "-p $PORT -c listen_addresses=127.0.0.1 -c unix_socket_directories=''" -l "$DATA/log" -w start >/dev/null
PSQL=(psql -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -X -q -t -A)

"${PSQL[@]}" <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
-- Supabase default: every new public table is fully granted to the API roles.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
SQL

for _ in 1 2; do  # twice: must be re-runnable
  PGOPTIONS=--client-min-messages=warning "${PSQL[@]}" -f "$MIGRATION" >/dev/null
done

# Seed one match with one stat row (as the importer would, but as owner).
"${PSQL[@]}" <<'SQL'
INSERT INTO public.soccer_matches (id, league, league_slug, season, match_no, round, match_date, home_team, away_team,
  home_team_source, away_team_source, home_score, away_score, source, has_stats)
VALUES ('ger.1:2026-27:1', 'ger.1', 'bundesliga', '2026-27', 1, 1, '2026-08-21', 'Bayern Munich', 'SC Freiburg',
  'Bayern München', 'Freiburg', 3, 1, 'FotMob', true);
INSERT INTO public.soccer_match_stats (league, league_slug, season, match_no, round, match_date, home_team, away_team,
  home_score, away_score, period, stat_group, stat_name, home_value, away_value, home_pct, away_pct, home_raw, away_raw, source)
VALUES ('ger.1', 'bundesliga', '2026-27', 1, 1, '2026-08-21', 'Bayern Munich', 'SC Freiburg', 3, 1,
  'FT', 'Top stats', 'Corners', 7, 2, NULL, NULL, '7', '2', 'FotMob');
SQL

fail=0
check() {
  if [[ "$3" == "$2" ]]; then echo "  ok    $1"; else echo "  FAIL  $1 (expected '$2', got '$3')"; fail=1; fi
}
# Run SQL as a role inside a rolled-back transaction; prints the last row, or
# "denied" when Postgres raises.
as() {
  "${PSQL[@]}" 2>/dev/null <<EOF | tail -n 1 || echo denied
BEGIN;
SET LOCAL ROLE $1;
$2
ROLLBACK;
EOF
}

STAT_COLS="league, league_slug, season, match_no, round, match_date, home_team, away_team, home_score, away_score, period, stat_group, stat_name, home_value, away_value, home_raw, away_raw, source"
STAT_VALS="'ger.1', 'bundesliga', '2026-27', 1, 1, '2026-08-21', 'Bayern Munich', 'SC Freiburg', 3, 1, 'FT', 'Top stats', 'Corners', 9, 4, '9', '4', 'FotMob'"
MATCH_COLS="id, league, league_slug, season, match_no, match_date, home_team, away_team, home_team_source, away_team_source, home_score, away_score, source"
MATCH_VALS="'eng.1:2026-27:2', 'eng.1', 'premier_league', '2026-27', 2, '2026-08-22', 'Arsenal', 'Chelsea', 'Arsenal', 'Chelsea', 1, 1, 'FotMob'"

echo "public read"
for role in anon authenticated; do
  check "$role reads soccer_matches"     ok "$(as "$role" "SELECT 'ok' FROM public.soccer_matches WHERE home_team = 'Bayern Munich';")"
  check "$role reads soccer_match_stats" ok "$(as "$role" "SELECT 'ok' FROM public.soccer_match_stats WHERE stat_name = 'Corners' AND home_value = 7;")"
done

echo "client writes fail"
for role in anon authenticated; do
  check "$role inserts a match"     denied "$(as "$role" "INSERT INTO public.soccer_matches ($MATCH_COLS) VALUES ($MATCH_VALS) RETURNING 'allowed';")"
  check "$role inserts a stat row"  denied "$(as "$role" "INSERT INTO public.soccer_match_stats ($STAT_COLS) VALUES ('ger.1', 'bundesliga', '2026-27', 1, 1, '2026-08-21', 'Bayern Munich', 'SC Freiburg', 3, 1, '1H', 'Top stats', 'Corners', 1, 1, '1', '1', 'FotMob') RETURNING 'allowed';")"
  check "$role updates a match"     denied "$(as "$role" "UPDATE public.soccer_matches SET home_score = 9 RETURNING 'allowed';")"
  check "$role updates a stat row"  denied "$(as "$role" "UPDATE public.soccer_match_stats SET home_value = 99 RETURNING 'allowed';")"
  check "$role deletes a match"     denied "$(as "$role" "DELETE FROM public.soccer_matches RETURNING 'allowed';")"
  check "$role deletes a stat row"  denied "$(as "$role" "DELETE FROM public.soccer_match_stats RETURNING 'allowed';")"
  check "$role truncates stats"     denied "$(as "$role" "TRUNCATE public.soccer_match_stats; SELECT 'allowed';")"
done

echo "service role (importer)"
check "match upsert on (league, season, match_no)" 1 "$(as service_role "
INSERT INTO public.soccer_matches ($MATCH_COLS) VALUES ($MATCH_VALS)
  ON CONFLICT (league, season, match_no) DO UPDATE SET home_score = EXCLUDED.home_score;
INSERT INTO public.soccer_matches ($MATCH_COLS) VALUES ($MATCH_VALS)
  ON CONFLICT (league, season, match_no) DO UPDATE SET home_score = EXCLUDED.home_score;
SELECT count(*) FROM public.soccer_matches WHERE league = 'eng.1';")"
check "duplicate natural key upsert keeps 1 row" "1|9" "$(as service_role "
INSERT INTO public.soccer_match_stats ($STAT_COLS) VALUES ($STAT_VALS)
  ON CONFLICT (league, season, match_no, period, stat_group, stat_name)
  DO UPDATE SET home_value = EXCLUDED.home_value, away_value = EXCLUDED.away_value;
INSERT INTO public.soccer_match_stats ($STAT_COLS) VALUES ($STAT_VALS)
  ON CONFLICT (league, season, match_no, period, stat_group, stat_name)
  DO UPDATE SET home_value = EXCLUDED.home_value, away_value = EXCLUDED.away_value;
SELECT count(*), max(home_value) FROM public.soccer_match_stats WHERE league = 'ger.1' AND stat_name = 'Corners';")"
check "stat row for an unknown match refused (FK)" denied "$(as service_role "INSERT INTO public.soccer_match_stats ($STAT_COLS) VALUES ('ita.1', 'serie_a', '2026-27', 77, 1, '2026-08-21', 'Inter', 'Milan', 0, 0, 'FT', 'Top stats', 'Corners', 1, 1, '1', '1', 'FotMob') RETURNING 'allowed';")"
check "unknown period refused (CHECK)" denied "$(as service_role "INSERT INTO public.soccer_match_stats ($STAT_COLS) VALUES ('ger.1', 'bundesliga', '2026-27', 1, 1, '2026-08-21', 'Bayern Munich', 'SC Freiburg', 3, 1, 'ET', 'Top stats', 'Corners', 1, 1, '1', '1', 'FotMob') RETURNING 'allowed';")"
check "deleting a match cascades to its stats" 0 "$(as service_role "
DELETE FROM public.soccer_matches WHERE id = 'ger.1:2026-27:1';
SELECT count(*) FROM public.soccer_match_stats WHERE league = 'ger.1' AND season = '2026-27' AND match_no = 1;")"

if [[ $fail -ne 0 ]]; then
  echo "FAILED"
  exit 1
fi
echo "all checks passed"
