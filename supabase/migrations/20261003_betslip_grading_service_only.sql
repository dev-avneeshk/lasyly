-- Betslips are graded only by /api/betslips/[id]/status, with the service role.
--
-- 20261002_lock_down_profile_betslip_member_writes.sql left
-- `GRANT UPDATE (status, payout)` to authenticated so the route could grade
-- with the user's client. That also let an owner PATCH `payout` to any value
-- through PostgREST (on a Pending slip, or together with status 'Won'); payout
-- feeds the betslip feed, CSV export and the "Payout … Coins" badge. The route
-- now verifies owner + Pending itself and writes with the service role, so
-- users need no UPDATE at all.
--
-- Idempotent (REVOKE / DROP POLICY IF EXISTS) and non-destructive. Files only;
-- apply through the normal migration process.
DO $$
BEGIN
  IF to_regclass('public.betslips') IS NULL THEN
    RETURN;
  END IF;
  REVOKE UPDATE ON public.betslips FROM anon, authenticated;
  DROP POLICY IF EXISTS "betslips_update_own" ON public.betslips;
END $$;
