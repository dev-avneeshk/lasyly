# Database Scripts

## APPLY_MISSING.sql

**Purpose**: Manual rollup script for fresh database setup.

This file was previously in `supabase/migrations/` but has been moved here because:
1. It has no timestamp prefix, which confuses migration ordering tools
2. Every SQL statement is duplicated from individual timestamped migration files
3. It uses `IF NOT EXISTS` / `IF EXISTS` guards so it's safe to re-run

**When to use**: If you need to set up a fresh Supabase project from scratch and
individual migrations fail (e.g., dependency ordering issues), you can run this
file manually in the Supabase SQL Editor. It covers:

- Live scores tables (team_logos, matches)
- Bet tracker
- AI writeup cache
- Prop votes
- Football tables
- Wallet double-spend protection (idempotency_key + RPC functions)
- Bet tracker is_monitored column
- Tennis raw stats column type fixes

**Note**: The Security RLS baseline (section 9 mentioned in the header) is NOT
included in this file — it lives in `supabase/migrations/20260522_security_rls_baseline.sql`
and should be applied separately.

**Normal workflow**: Use `supabase db push` or `supabase migration up` with the
individual timestamped migrations in `supabase/migrations/`. This script is only
needed for manual recovery scenarios.

## Big-5 match stats import

**Purpose**: Load the Big-5 detailed-stats CSV (eng.1, esp.1, ger.1, ita.1,
fra.1) into `public.soccer_matches` (one row per match) and
`public.soccer_match_stats` (one row per match x period x stat). Soccer team
props for those leagues and the match-stats popup on the soccer team chart read
from these tables.

**Prerequisite**: apply `supabase/migrations/20261016_soccer_match_stats.sql`
(`DATABASE_URL=… scripts/db/apply-migration.sh supabase/migrations/20261016_soccer_match_stats.sql`
or the Supabase SQL editor), then `node scripts/db/check-schema.mjs`.

**Run** (cwd = repo root; reads `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` from `.env.local`; the CSV is not committed, so pass
its absolute path):

```bash
# Validate and report only. Writes nothing; still checks team names against
# espn_teams (read-only) when the env is present. Exits 1 on any rejected row,
# meta conflict or unmatched team.
node scripts/db/import-big5-match-stats.mjs --file /abs/path/big5_detailed_stats_all.csv --dry-run

# Import (idempotent upserts on the natural keys; re-running keeps row counts).
node scripts/db/import-big5-match-stats.mjs --file /abs/path/big5_detailed_stats_all.csv
```

Options: `--batch-size 1..1000` (default 1000), `--concurrency 1..8` (default 4),
`--allow-unmatched` (store unknown team names as-is instead of aborting). Rows
missing from a later CSV are never deleted.

**Snapshot**: the CSV is a one-time snapshot (the current file ends 2026-10-12).
Big-5 soccer props and the match-stats popup stay visible only while
today − 14 ≤ the last imported `match_date` (about 2026-10-26 for this file).
To keep them visible, import a newer CSV with
`node scripts/db/import-big5-match-stats.mjs --file <abs path>`. Nothing
refreshes it automatically.

**Caches**: the script doesn't touch Redis. After a re-import, caches catch up
within about 14 min (props) / 10 min (popup) of Redis, plus up to 3 / 7 min of
CDN. To refresh at once, re-import, then bump these cache key versions and
deploy: `team-props:v2`, `team-props:soccer:v2`, `soccer-db-history:v1`,
`soccer-slate:v2`, `soccer-match-stats:v1`. A key bump does not purge the CDN,
so the CDN bounds still apply.
