-- Careers: associate applications with the signed-in account that submitted
-- them, and enforce "one application per account per scope".
--
-- The submit route already requires a real Supabase session, but until now the
-- application row didn't record which account it came from. This adds a
-- nullable user_id (nullable so rows submitted before this change, and rows
-- whose account is later deleted, stay valid) and two partial unique indexes
-- that make "already applied" a hard DB guarantee, not just an app-level check:
--   * one application per account per job (user_id + job_id), and
--   * one general / talent-pool application per account (user_id, job_id NULL).
--
-- ON DELETE SET NULL: if the account is deleted we keep the application row
-- (it's recruitment data) but drop the link.
--
-- No RLS/grant changes: careers_applications keeps RLS enabled with no
-- policies, and anon/authenticated keep no privileges (service role only).

BEGIN;

ALTER TABLE public.careers_applications
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- One application per account per job.
CREATE UNIQUE INDEX IF NOT EXISTS careers_applications_user_job_uniq
  ON public.careers_applications (user_id, job_id)
  WHERE user_id IS NOT NULL AND job_id IS NOT NULL;

-- One general / talent-pool application per account.
CREATE UNIQUE INDEX IF NOT EXISTS careers_applications_user_general_uniq
  ON public.careers_applications (user_id)
  WHERE user_id IS NOT NULL AND job_id IS NULL;

-- Plain lookup index for the "has this account already applied?" query.
CREATE INDEX IF NOT EXISTS idx_careers_applications_user
  ON public.careers_applications (user_id)
  WHERE user_id IS NOT NULL;

COMMENT ON COLUMN public.careers_applications.user_id IS
  'Supabase auth account that submitted the application (service role only); NULL for pre-existing rows or after the account is deleted.';

-- Keep the "no access with the anon key" guarantee explicit for the new column.
REVOKE ALL ON public.careers_applications FROM anon, authenticated;

COMMIT;
