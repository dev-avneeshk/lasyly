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
--   parlays      INSERT only the fields /api/parlays sets (status defaults to
--                'pending'); UPDATE only `visibility`; no DELETE.
--   parlay_legs  INSERT without `result` / `game_id`; no UPDATE / DELETE.
-- Settlement uses the service role and is unaffected. /api/parlays rolls back a
-- failed legs insert with the service role.
--
-- Test: scripts/db/test-direct-write-lockdown.sh
-- =====================================================================
REVOKE INSERT, UPDATE, DELETE ON public.parlays FROM anon, authenticated;
GRANT INSERT (user_id, visibility, odds, stake, custom_note, combined_hit_rate, is_logged)
  ON public.parlays TO authenticated;
GRANT UPDATE (visibility) ON public.parlays TO authenticated;
DROP POLICY IF EXISTS "delete_own_pending" ON public.parlays;

-- L-04: settlement marks parlays it can never settle (all legs pushed, or
-- unsettleable legs at expiry) as 'void' instead of 'won'. Widening the CHECK
-- is non-destructive; win rates count won/lost only.
ALTER TABLE public.parlays DROP CONSTRAINT IF EXISTS parlays_status_check;
ALTER TABLE public.parlays ADD CONSTRAINT parlays_status_check
  CHECK (status IN ('pending', 'won', 'lost', 'void'));

REVOKE INSERT, UPDATE, DELETE ON public.parlay_legs FROM anon, authenticated;
GRANT INSERT (parlay_id, player_name, stat_category, prop_line, direction, l10_hit_rate, leg_order, sport)
  ON public.parlay_legs TO authenticated;
