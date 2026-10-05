-- =====================================================================
-- Migration: parlay outcomes are written by settlement only (audit L-02),
-- plus a 'void' status for parlays settlement can't decide (audit L-04)
-- =====================================================================
-- RLS let an owner UPDATE any column of their parlay and INSERT one with any
-- status, straight through PostgREST, so `status = 'won'` (or a leg with
-- `result = 'won'`) went onto the leaderboard as a real result. They could also
-- DELETE a losing pick while it was still pending.
--
-- Now (idempotent, non-destructive; no data changes):
--   parlays      UPDATE only `visibility`; no INSERT / DELETE.
--   parlay_legs  no INSERT / UPDATE / DELETE.
-- /api/parlays validates the legs and writes parlay + legs with the service
-- role. A user INSERT on parlay_legs let an owner add legs to an old parlay
-- after the games finished; settlement grades legs from the parlay's
-- created_at, so those legs were past-posted wins. Settlement uses the
-- service role and is unaffected.
--
-- Test: scripts/db/test-direct-write-lockdown.sh
-- =====================================================================
REVOKE INSERT, UPDATE, DELETE ON public.parlays FROM anon, authenticated;
GRANT UPDATE (visibility) ON public.parlays TO authenticated;
DROP POLICY IF EXISTS "delete_own_pending" ON public.parlays;

-- L-04: settlement marks parlays it can never settle (all legs pushed, or
-- unsettleable legs at expiry) as 'void' instead of 'won'. Widening the CHECK
-- is non-destructive; win rates count won/lost only.
ALTER TABLE public.parlays DROP CONSTRAINT IF EXISTS parlays_status_check;
ALTER TABLE public.parlays ADD CONSTRAINT parlays_status_check
  CHECK (status IN ('pending', 'won', 'lost', 'void'));

REVOKE INSERT, UPDATE, DELETE ON public.parlay_legs FROM anon, authenticated;
