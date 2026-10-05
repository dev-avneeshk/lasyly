import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { cached, invalidateCache, CACHE_TTL } from "@/lib/cache"
import type { ApplicationStatus } from "./constants"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Job {
  id: string
  title: string
  department: string
  location: string
  employmentType: string
  experienceLevel: string
  description: string
  requirements: string[]
  skills: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Application {
  id: string
  reference: string
  applicationType: "job" | "general"
  jobId: string | null
  jobTitle: string | null
  fullName: string
  email: string
  phone: string
  location: string
  currentJobTitle: string | null
  currentCompany: string | null
  experience: string
  linkedin: string | null
  portfolioUrl: string | null
  fitAnswer: string | null
  /** Legacy: optional GitHub/portfolio field from before portfolioUrl. */
  github: string | null
  referralSource: string | null
  referralOther: string | null
  /** Legacy CV link; no longer collected. */
  cvFileUrl: string | null
  consentAt: string
  status: ApplicationStatus
  createdAt: string
  updatedAt: string
}

export type ApplicationSummary = Pick<
  Application,
  "id" | "reference" | "applicationType" | "jobTitle" | "fullName" | "experience" | "status" | "createdAt"
>

// ─── Row mapping ─────────────────────────────────────────────────────────────

const JOB_COLUMNS =
  "id, title, department, location, employment_type, experience_level, description, requirements, skills, is_active, created_at, updated_at"

const APPLICATION_COLUMNS =
  "id, reference, application_type, job_id, job_title, full_name, email, phone, location, current_job_title, current_company, experience, linkedin, portfolio_url, fit_answer, github, referral_source, referral_other, cv_file_url, consent_at, status, created_at, updated_at"

type Row = Record<string, unknown>

function toJob(r: Row): Job {
  return {
    id: r.id as string,
    title: r.title as string,
    department: r.department as string,
    location: r.location as string,
    employmentType: r.employment_type as string,
    experienceLevel: r.experience_level as string,
    description: r.description as string,
    requirements: (r.requirements as string[] | null) ?? [],
    skills: (r.skills as string[] | null) ?? [],
    isActive: Boolean(r.is_active),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

function toApplication(r: Row): Application {
  return {
    id: r.id as string,
    reference: r.reference as string,
    applicationType: r.application_type as "job" | "general",
    jobId: (r.job_id as string | null) ?? null,
    jobTitle: (r.job_title as string | null) ?? null,
    fullName: r.full_name as string,
    email: r.email as string,
    phone: r.phone as string,
    location: r.location as string,
    currentJobTitle: (r.current_job_title as string | null) ?? null,
    currentCompany: (r.current_company as string | null) ?? null,
    experience: r.experience as string,
    linkedin: (r.linkedin as string | null) ?? null,
    portfolioUrl: (r.portfolio_url as string | null) ?? null,
    fitAnswer: (r.fit_answer as string | null) ?? null,
    github: (r.github as string | null) ?? null,
    referralSource: (r.referral_source as string | null) ?? null,
    referralOther: (r.referral_other as string | null) ?? null,
    cvFileUrl: (r.cv_file_url as string | null) ?? null,
    consentAt: r.consent_at as string,
    status: r.status as ApplicationStatus,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

// ─── Public job reads (cache-aside via Redis) ────────────────────────────────

const ACTIVE_JOBS_KEY = "careers:jobs:active"

/**
 * Active job listings, newest first. Cached in Redis (falls back to memory) and
 * invalidated whenever an admin creates or edits a job. Throws on DB failure so
 * callers can tell "no jobs" apart from "couldn't load jobs".
 */
export async function getActiveJobs(): Promise<Job[]> {
  return cached(
    ACTIVE_JOBS_KEY,
    async () => {
      const { data, error } = await createAdminClient()
        .from("careers_jobs")
        .select(JOB_COLUMNS)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(100)
      if (error) throw new Error(`careers_jobs read failed: ${error.message}`)
      return (data ?? []).map((r) => toJob(r as Row))
    },
    CACHE_TTL.careers
  )
}

/** An active job by id, or null. Inactive jobs are not publicly reachable. */
export async function getActiveJobById(id: string): Promise<Job | null> {
  if (!isUuid(id)) return null
  const jobs = await getActiveJobs()
  return jobs.find((j) => j.id === id) ?? null
}

export async function invalidateJobsCache(): Promise<void> {
  await invalidateCache(ACTIVE_JOBS_KEY)
}

// ─── Admin reads (never cached: personal data, must be fresh) ────────────────

export async function listAllJobs(): Promise<Job[]> {
  const { data, error } = await createAdminClient()
    .from("careers_jobs")
    .select(JOB_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(500)
  if (error) throw new Error(`careers_jobs admin read failed: ${error.message}`)
  return (data ?? []).map((r) => toJob(r as Row))
}

export async function getJobById(id: string): Promise<Job | null> {
  if (!isUuid(id)) return null
  const { data, error } = await createAdminClient()
    .from("careers_jobs")
    .select(JOB_COLUMNS)
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(`careers_jobs admin read failed: ${error.message}`)
  return data ? toJob(data as Row) : null
}

export const APPLICATIONS_PAGE_SIZE = 50

export async function listApplications(opts: {
  status?: ApplicationStatus
  page?: number
}): Promise<{ items: ApplicationSummary[]; total: number }> {
  const page = Math.max(1, opts.page ?? 1)
  const from = (page - 1) * APPLICATIONS_PAGE_SIZE
  let query = createAdminClient()
    .from("careers_applications")
    .select("id, reference, application_type, job_title, full_name, experience, status, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, from + APPLICATIONS_PAGE_SIZE - 1)
  if (opts.status) query = query.eq("status", opts.status)
  const { data, error, count } = await query
  if (error) throw new Error(`careers_applications admin read failed: ${error.message}`)
  return {
    total: count ?? 0,
    items: (data ?? []).map((r) => {
      const row = r as Row
      return {
        id: row.id as string,
        reference: row.reference as string,
        applicationType: row.application_type as "job" | "general",
        jobTitle: (row.job_title as string | null) ?? null,
        fullName: row.full_name as string,
        experience: row.experience as string,
        status: row.status as ApplicationStatus,
        createdAt: row.created_at as string,
      }
    }),
  }
}

export async function getApplicationById(id: string): Promise<Application | null> {
  if (!isUuid(id)) return null
  const { data, error } = await createAdminClient()
    .from("careers_applications")
    .select(APPLICATION_COLUMNS)
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(`careers_applications admin read failed: ${error.message}`)
  return data ? toApplication(data as Row) : null
}
