#!/usr/bin/env bash
#
# Apply one or more migration files to the Supabase database with psql.
#
# Migrations in this repo have historically been pasted into the Supabase SQL
# editor by hand, which is how the live schema drifted behind
# supabase/migrations/. This wraps psql so applying a file is one command and
# runs inside a single transaction (--single-transaction), so a failure rolls
# back instead of leaving a half-applied schema.
#
# Setup (once): grab the connection string from
#   Supabase dashboard -> Project Settings -> Database -> Connection string -> URI
# and export it. Use the session pooler URI on port 5432, not 6543: the
# transaction pooler on 6543 does not support all DDL reliably.
#
# Atomicity comes from each migration file's own BEGIN/COMMIT plus
# ON_ERROR_STOP=1, so a failure aborts the transaction and nothing commits.
# psql's --single-transaction is deliberately NOT used: it would nest inside the
# file's explicit BEGIN, emit "there is already a transaction in progress", and
# let the file's COMMIT end the transaction early anyway.
#
#   export DATABASE_URL='postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres'
#
# Usage:
#   scripts/db/apply-migration.sh supabase/migrations/20260904_repair_room_features.sql
#   scripts/db/apply-migration.sh supabase/migrations/*.sql
#
# Verify afterwards with:
#   node scripts/db/check-schema.mjs

set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "error: DATABASE_URL is not set." >&2
  echo "" >&2
  echo "Supabase dashboard -> Project Settings -> Database -> Connection string -> URI" >&2
  echo "Use port 5432 (session pooler), then:" >&2
  echo "  export DATABASE_URL='postgresql://...:5432/postgres'" >&2
  exit 1
fi

if [[ $# -eq 0 ]]; then
  echo "usage: $0 <migration.sql> [more.sql ...]" >&2
  exit 1
fi

for file in "$@"; do
  if [[ ! -f "$file" ]]; then
    echo "error: no such file: $file" >&2
    exit 1
  fi
done

command -v psql >/dev/null 2>&1 || { echo "error: psql not found (brew install libpq)" >&2; exit 1; }

for file in "$@"; do
  echo "==> applying $file"
  psql "$DATABASE_URL" \
    --set ON_ERROR_STOP=1 \
    --quiet \
    --file "$file"
  echo "==> ok: $file"
done

echo ""
echo "Done. Verify with: node scripts/db/check-schema.mjs"
