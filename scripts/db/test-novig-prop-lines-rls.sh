#!/usr/bin/env bash
#
# Prove supabase/migrations/20261020_novig_prop_lines.sql against a THROWAWAY
# local Postgres. Never touches a real database.
#
# Supabase's default table grants (ALL to anon/authenticated/service_role) are
# reproduced, then the migration is applied twice (it must be re-runnable) and:
#   - anon/authenticated can SELECT novig_prop_events and novig_prop_lines
#   - anon/authenticated INSERT/UPDATE/DELETE/TRUNCATE fail on all three tables,
#     and SELECT on novig_ingest_runs (credit counts) fails
#   - the ingest's insert (service role, ON CONFLICT on the PK DO NOTHING) is
#     store-once: a duplicate key keeps one row with the ORIGINAL line
#   - CHECK constraints refuse an unmapped stat ('pra') and a zero line
#   - two books can each store their own line for the same player/market
#
# The data dir stays inside the workspace (scratch rule) and is removed on exit.
# Postgres listens on 127.0.0.1 only (no unix socket: workspace paths are too
# long for the socket path limit on macOS).
#
# Usage: scripts/db/test-novig-prop-lines-rls.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MIGRATION="${MIGRATION:-$ROOT/supabase/migrations/20261020_novig_prop_lines.sql}"

for bin in initdb pg_ctl psql; do
  command -v "$bin" >/dev/null || { echo "error: $bin not found on PATH" >&2; exit 1; }
done

SCRATCH="${PG_SCRATCH_DIR:-$ROOT/.agents/tasks/lasyly-audit-2026-10-02/scratch}"
mkdir -p "$SCRATCH"
DATA="$(mktemp -d "$SCRATCH/novig-rls.XXXXXX")"
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

EVENT_COLS="canonical_event_id, game_date, commence_time, home_team, away_team, line_count"
LINE_COLS="canonical_event_id, player_key, market_key, stat, game_date, commence_time, home_team, away_team, novig_player, match_method, line, over_price, under_price, vig"
RUN_COLS="slate_date, status, paid_calls, credits_used, credits_remaining"

# Seed one captured game with one line and one run row (as the ingest would, but as owner).
"${PSQL[@]}" <<SQL
INSERT INTO public.novig_prop_events ($EVENT_COLS)
VALUES ('249f6ad5667cc3b1', '2026-10-20', '2026-10-20T19:00:00Z', 'DET', 'BOS', 44);
INSERT INTO public.novig_prop_lines ($LINE_COLS)
VALUES ('249f6ad5667cc3b1', 'jayson tatum', 'player_points', 'pts', '2026-10-20', '2026-10-20T19:00:00Z',
  'DET', 'BOS', 'Jayson Tatum', 'exact', 26.5, -104, -106, 0.0294);
INSERT INTO public.novig_ingest_runs ($RUN_COLS) VALUES ('2026-10-20', 'ok', 1, 3, 991);
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

EVENT_VALS="'aaaaaaaaaaaaaaaa', '2026-10-20', '2026-10-20T23:00:00Z', 'NYK', 'PHI', 0"
LINE_VALS="'249f6ad5667cc3b1', 'jaylen brown', 'player_points', 'pts', '2026-10-20', '2026-10-20T19:00:00Z', 'DET', 'BOS', 'Jaylen Brown', 'exact', 24.5, -110, -110, 0.0476"
RUN_VALS="'2026-10-20', 'ok', 0, 0, NULL"

echo "public read"
for role in anon authenticated; do
  check "$role reads novig_prop_events" ok "$(as "$role" "SELECT 'ok' FROM public.novig_prop_events WHERE canonical_event_id = '249f6ad5667cc3b1';")"
  check "$role reads novig_prop_lines"  ok "$(as "$role" "SELECT 'ok' FROM public.novig_prop_lines WHERE player_key = 'jayson tatum' AND line = 26.5;")"
  check "$role cannot read novig_ingest_runs" denied "$(as "$role" "SELECT 'allowed' FROM public.novig_ingest_runs;")"
done

echo "client writes fail"
for role in anon authenticated; do
  check "$role inserts an event"    denied "$(as "$role" "INSERT INTO public.novig_prop_events ($EVENT_COLS) VALUES ($EVENT_VALS) RETURNING 'allowed';")"
  check "$role inserts a line"      denied "$(as "$role" "INSERT INTO public.novig_prop_lines ($LINE_COLS) VALUES ($LINE_VALS) RETURNING 'allowed';")"
  check "$role inserts a run"       denied "$(as "$role" "INSERT INTO public.novig_ingest_runs ($RUN_COLS) VALUES ($RUN_VALS) RETURNING 'allowed';")"
  check "$role updates an event"    denied "$(as "$role" "UPDATE public.novig_prop_events SET line_count = 0 RETURNING 'allowed';")"
  check "$role updates a line"      denied "$(as "$role" "UPDATE public.novig_prop_lines SET line = 99.5 RETURNING 'allowed';")"
  check "$role updates a run"       denied "$(as "$role" "UPDATE public.novig_ingest_runs SET paid_calls = 0 RETURNING 'allowed';")"
  check "$role deletes an event"    denied "$(as "$role" "DELETE FROM public.novig_prop_events RETURNING 'allowed';")"
  check "$role deletes a line"      denied "$(as "$role" "DELETE FROM public.novig_prop_lines RETURNING 'allowed';")"
  check "$role deletes a run"       denied "$(as "$role" "DELETE FROM public.novig_ingest_runs RETURNING 'allowed';")"
  check "$role truncates events"    denied "$(as "$role" "TRUNCATE public.novig_prop_events; SELECT 'allowed';")"
  check "$role truncates lines"     denied "$(as "$role" "TRUNCATE public.novig_prop_lines; SELECT 'allowed';")"
  check "$role truncates runs"      denied "$(as "$role" "TRUNCATE public.novig_ingest_runs; SELECT 'allowed';")"
done

echo "service role (ingest)"
check "line insert ON CONFLICT DO NOTHING twice keeps 1 row with the original line" "1|26.5" "$(as service_role "
INSERT INTO public.novig_prop_lines ($LINE_COLS)
VALUES ('249f6ad5667cc3b1', 'jayson tatum', 'player_points', 'pts', '2026-10-20', '2026-10-20T19:00:00Z',
  'DET', 'BOS', 'Jayson Tatum', 'exact', 27.5, -110, -110, 0.0476)
  ON CONFLICT (canonical_event_id, bookmaker, player_key, market_key) DO NOTHING;
INSERT INTO public.novig_prop_lines ($LINE_COLS)
VALUES ('249f6ad5667cc3b1', 'jayson tatum', 'player_points', 'pts', '2026-10-20', '2026-10-20T19:00:00Z',
  'DET', 'BOS', 'Jayson Tatum', 'exact', 28.5, -110, -110, 0.0476)
  ON CONFLICT (canonical_event_id, bookmaker, player_key, market_key) DO NOTHING;
SELECT count(*), max(line) FROM public.novig_prop_lines WHERE player_key = 'jayson tatum' AND market_key = 'player_points';")"
check "a second book stores its own line for the same player/market" "2" "$(as service_role "
INSERT INTO public.novig_prop_lines (bookmaker, $LINE_COLS)
VALUES ('pinnacle', '249f6ad5667cc3b1', 'jayson tatum', 'player_points', 'pts', '2026-10-20', '2026-10-20T19:00:00Z',
  'DET', 'BOS', 'Jayson Tatum', 'exact', 26.5, -105, -115, 0.0398)
  ON CONFLICT (canonical_event_id, bookmaker, player_key, market_key) DO NOTHING;
SELECT count(*) FROM public.novig_prop_lines WHERE player_key = 'jayson tatum' AND market_key = 'player_points';")"
check "event marker ON CONFLICT DO NOTHING keeps the original line_count" "1|44" "$(as service_role "
INSERT INTO public.novig_prop_events ($EVENT_COLS)
VALUES ('249f6ad5667cc3b1', '2026-10-20', '2026-10-20T19:00:00Z', 'DET', 'BOS', 0)
  ON CONFLICT (canonical_event_id) DO NOTHING;
SELECT count(*), max(line_count) FROM public.novig_prop_events WHERE canonical_event_id = '249f6ad5667cc3b1';")"
check "service role writes a run row" 2 "$(as service_role "
INSERT INTO public.novig_ingest_runs ($RUN_COLS) VALUES ($RUN_VALS);
SELECT count(*) FROM public.novig_ingest_runs;")"
check "unmapped stat 'pra' refused (CHECK)" denied "$(as service_role "INSERT INTO public.novig_prop_lines ($LINE_COLS) VALUES ('249f6ad5667cc3b1', 'jayson tatum', 'player_pts_rebs_asts', 'pra', '2026-10-20', '2026-10-20T19:00:00Z', 'DET', 'BOS', 'Jayson Tatum', 'exact', 40.5, -110, -110, 0.0476) RETURNING 'allowed';")"
check "zero line refused (CHECK)" denied "$(as service_role "INSERT INTO public.novig_prop_lines ($LINE_COLS) VALUES ('249f6ad5667cc3b1', 'jayson tatum', 'player_steals', 'stl', '2026-10-20', '2026-10-20T19:00:00Z', 'DET', 'BOS', 'Jayson Tatum', 'exact', 0, -110, -110, 0.0476) RETURNING 'allowed';")"
check "unknown match_method refused (CHECK)" denied "$(as service_role "INSERT INTO public.novig_prop_lines ($LINE_COLS) VALUES ('249f6ad5667cc3b1', 'jayson tatum', 'player_blocks', 'blk', '2026-10-20', '2026-10-20T19:00:00Z', 'DET', 'BOS', 'Jayson Tatum', 'guess', 0.5, -110, -110, 0.0476) RETURNING 'allowed';")"

if [[ $fail -ne 0 ]]; then
  echo "FAILED"
  exit 1
fi
echo "all checks passed"
