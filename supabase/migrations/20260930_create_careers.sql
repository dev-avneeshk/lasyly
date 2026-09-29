-- Careers: job listings + applications.
--
-- RLS model
--   careers_jobs
--     * anon/authenticated may SELECT rows where is_active = true (public
--       listings). Inactive/draft rows are invisible outside the service role.
--     * No INSERT/UPDATE/DELETE policies: writes go through the service role
--       from /api/careers/admin/* after an allowlist check (CAREERS_ADMIN_EMAILS).
--   careers_applications
--     * No policies at all. Applications hold personal data (name, email,
--       phone, CV link), so nothing is readable or writable with the anon key.
--       The public submit route and the admin UI both use the service role
--       after their own server-side checks.
--
-- CVs are uploaded through the embedded FileXL widget, which runs on FileXL's
-- origin and does not report anything back to this page (no postMessage, no
-- callback). The applicant pastes the FileXL download link it shows after the
-- upload; that is stored in cv_file_url. cv_file_id / cv_file_name exist for a
-- future integration that exposes them and are NULL today.

BEGIN;

CREATE TABLE IF NOT EXISTS public.careers_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
  department TEXT NOT NULL CHECK (char_length(department) BETWEEN 2 AND 80),
  location TEXT NOT NULL CHECK (char_length(location) BETWEEN 2 AND 120),
  employment_type TEXT NOT NULL CHECK (char_length(employment_type) BETWEEN 2 AND 40),
  experience_level TEXT NOT NULL CHECK (char_length(experience_level) BETWEEN 1 AND 40),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 10 AND 4000),
  requirements TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(requirements) <= 30),
  skills TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(skills) <= 20),
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_careers_jobs_active
  ON public.careers_jobs (created_at DESC) WHERE is_active;

CREATE TABLE IF NOT EXISTS public.careers_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Short human-facing reference shown on the success screen (#XXXXXXXX).
  reference TEXT NOT NULL UNIQUE
    DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  -- Client-generated idempotency key: a double-click or a retried request
  -- resolves to the same row instead of creating a duplicate application.
  submission_key UUID NOT NULL UNIQUE,
  application_type TEXT NOT NULL CHECK (application_type IN ('job', 'general')),
  job_id UUID REFERENCES public.careers_jobs(id) ON DELETE SET NULL,
  -- Snapshot of the title at submission time, so the record still reads
  -- correctly if the job is later edited or deleted.
  job_title TEXT CHECK (job_title IS NULL OR char_length(job_title) <= 120),

  full_name TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  email TEXT NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254),
  phone TEXT NOT NULL CHECK (char_length(phone) BETWEEN 7 AND 32),
  location TEXT NOT NULL CHECK (char_length(location) BETWEEN 2 AND 120),

  current_job_title TEXT CHECK (current_job_title IS NULL OR char_length(current_job_title) <= 120),
  current_company TEXT CHECK (current_company IS NULL OR char_length(current_company) <= 120),
  experience TEXT NOT NULL CHECK (experience IN (
    'fresher', 'lt1', '1-2', '2-4', '4-7', '7plus'
  )),

  linkedin TEXT CHECK (linkedin IS NULL OR char_length(linkedin) <= 300),
  github TEXT CHECK (github IS NULL OR char_length(github) <= 300),

  referral_source TEXT CHECK (referral_source IS NULL OR referral_source IN (
    'linkedin', 'instagram', 'website', 'referral', 'job_portal', 'university', 'google', 'other'
  )),
  referral_other TEXT CHECK (referral_other IS NULL OR char_length(referral_other) <= 120),

  cv_file_name TEXT CHECK (cv_file_name IS NULL OR char_length(cv_file_name) <= 255),
  cv_file_url TEXT CHECK (cv_file_url IS NULL OR char_length(cv_file_url) <= 500),
  cv_file_id TEXT CHECK (cv_file_id IS NULL OR char_length(cv_file_id) <= 255),

  consent_at TIMESTAMPTZ NOT NULL,

  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
    'new', 'reviewing', 'shortlisted', 'interview', 'rejected', 'hired'
  )),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (
    (application_type = 'job' AND job_id IS NOT NULL)
    OR (application_type = 'general' AND job_id IS NULL)
    -- A job application whose job was later deleted keeps its snapshot title.
    OR (application_type = 'job' AND job_id IS NULL AND job_title IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_careers_applications_created
  ON public.careers_applications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_careers_applications_status
  ON public.careers_applications (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_careers_applications_job
  ON public.careers_applications (job_id) WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_careers_applications_email
  ON public.careers_applications (lower(email), created_at DESC);

-- updated_at maintenance
CREATE OR REPLACE FUNCTION public.careers_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_careers_jobs_updated_at ON public.careers_jobs;
CREATE TRIGGER trg_careers_jobs_updated_at
  BEFORE UPDATE ON public.careers_jobs
  FOR EACH ROW EXECUTE FUNCTION public.careers_touch_updated_at();

DROP TRIGGER IF EXISTS trg_careers_applications_updated_at ON public.careers_applications;
CREATE TRIGGER trg_careers_applications_updated_at
  BEFORE UPDATE ON public.careers_applications
  FOR EACH ROW EXECUTE FUNCTION public.careers_touch_updated_at();

REVOKE ALL ON FUNCTION public.careers_touch_updated_at() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.careers_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.careers_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "careers_jobs select active" ON public.careers_jobs;
CREATE POLICY "careers_jobs select active" ON public.careers_jobs
  FOR SELECT USING (is_active = true);

-- careers_applications: intentionally no policies (service role only).
REVOKE ALL ON public.careers_applications FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.careers_jobs FROM anon, authenticated;

COMMIT;
