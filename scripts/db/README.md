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
