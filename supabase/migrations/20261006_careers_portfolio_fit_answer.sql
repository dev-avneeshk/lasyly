-- Careers: replace the CV upload with a portfolio/GitHub link and a
-- "why are you a fit" answer.
--
-- Lasyly no longer shortlists on CVs; every applicant gets a direct assessment
-- link instead. The application form stops collecting a CV link and
-- collects these two fields. The submit route requires both, so they are
-- nullable here only so rows submitted before this change stay valid.
--
-- cv_file_name / cv_file_url / cv_file_id are left in place (already nullable)
-- so existing applications keep their stored data. Nothing writes them now.
-- They are already nullable; the explicit DROP NOT NULL below is a no-op that
-- documents the requirement.
--
-- No RLS/grant changes: careers_applications keeps RLS enabled with no
-- policies, and anon/authenticated keep no privileges (service role only).

BEGIN;

ALTER TABLE public.careers_applications
  ADD COLUMN IF NOT EXISTS portfolio_url TEXT
    CHECK (portfolio_url IS NULL OR char_length(portfolio_url) BETWEEN 1 AND 500),
  ADD COLUMN IF NOT EXISTS fit_answer TEXT
    CHECK (fit_answer IS NULL OR char_length(fit_answer) BETWEEN 1 AND 3000),
  ALTER COLUMN cv_file_name DROP NOT NULL,
  ALTER COLUMN cv_file_url DROP NOT NULL,
  ALTER COLUMN cv_file_id DROP NOT NULL;

COMMENT ON COLUMN public.careers_applications.portfolio_url IS
  'Applicant portfolio or GitHub link (http/https only, validated by the submit route).';
COMMENT ON COLUMN public.careers_applications.fit_answer IS
  'Applicant answer to "Why are you a fit for this role?" (50-3000 chars, validated by the submit route).';
COMMENT ON COLUMN public.careers_applications.cv_file_url IS
  'Legacy CV link; no longer collected.';

-- Keep the "no access with the anon key" guarantee explicit for new columns.
REVOKE ALL ON public.careers_applications FROM anon, authenticated;

COMMIT;
