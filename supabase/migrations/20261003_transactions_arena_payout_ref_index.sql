-- Index for refund_arena_stake's per-game "anyone paid?" check
-- (20261003_refund_arena_stake_paid_game_guard.sql).
--
--   psql ONLY: CREATE INDEX CONCURRENTLY can't run inside the transaction the
--   Supabase SQL Editor wraps submissions in.
--   Apply with: scripts/db/apply-migration.sh <this file>
--
-- `transactions` is the wallet ledger: every stake, payout and grant writes to
-- it, so a plain CREATE INDEX (SHARE lock) would block all coin writes for the
-- build. CONCURRENTLY keeps writes flowing. The function is correct without
-- the index, only slower, so applying this after it is fine. After applying:
--   SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;  -- expect zero rows
-- Idempotent (IF NOT EXISTS), non-destructive. Files only.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_arena_payout_ref
  ON public.transactions (reference_id)
  WHERE type IN ('ARENA_REWARD', 'ARENA_WINNINGS');
