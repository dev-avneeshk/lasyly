-- Stale-parlay expiry (lib/parlays/settlement.ts expireStaleParlays) reads
-- `status = 'pending' AND created_at < now() - 5 days` every settlement run;
-- nothing indexed it, so each run scanned parlays.
--
--   psql ONLY: CREATE INDEX CONCURRENTLY can't run inside the transaction the
--   Supabase SQL Editor wraps submissions in.
--   Apply with: scripts/db/apply-migration.sh <this file>
--   After applying: SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;  -- expect zero rows
--
-- Idempotent (IF NOT EXISTS), non-destructive. Files only.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parlays_pending_created
  ON public.parlays (created_at)
  WHERE status = 'pending';
