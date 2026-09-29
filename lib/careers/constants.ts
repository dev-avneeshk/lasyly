/**
 * Careers constants shared by client and server. No secrets, no server imports.
 * The code values here must match the CHECK constraints in
 * supabase/migrations/20260930_create_careers.sql.
 */

export const EXPERIENCE_OPTIONS = [
  { value: "fresher", label: "Fresher" },
  { value: "lt1", label: "Less than 1 year" },
  { value: "1-2", label: "1–2 years" },
  { value: "2-4", label: "2–4 years" },
  { value: "4-7", label: "4–7 years" },
  { value: "7plus", label: "7+ years" },
] as const

export type ExperienceCode = (typeof EXPERIENCE_OPTIONS)[number]["value"]

export const REFERRAL_OPTIONS = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "job_portal", label: "Job Portal" },
  { value: "university", label: "University / College" },
  { value: "google", label: "Google" },
  { value: "other", label: "Other" },
] as const

export type ReferralCode = (typeof REFERRAL_OPTIONS)[number]["value"]

export const APPLICATION_STATUSES = [
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "interview", label: "Interview" },
  { value: "rejected", label: "Rejected" },
  { value: "hired", label: "Hired" },
] as const

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]["value"]

/** Badge classes per status, built from the site's existing color tokens. */
export const STATUS_BADGE_CLASS: Record<ApplicationStatus, string> = {
  new: "bg-[var(--color-lime)]/10 text-[var(--color-lime)] border-[var(--color-lime)]/30",
  reviewing: "bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/30",
  shortlisted: "bg-[var(--color-secondary)]/10 text-[var(--color-secondary)] border-[var(--color-secondary)]/30",
  interview: "bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-[var(--color-warning)]/30",
  rejected: "bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/30",
  hired: "bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/30",
}

export function labelFor<T extends { value: string; label: string }>(
  options: readonly T[],
  value: string | null | undefined
): string {
  if (!value) return "—"
  return options.find((o) => o.value === value)?.label ?? value
}

/** The route segment used for the talent-pool application. */
export const GENERAL_APPLICATION_SLUG = "general"

/** Exact FileXL embed URL supplied for the CV upload widget. Do not change. */
export const FILEXL_EMBED_SRC = "https://www.filexl.com/embed.php"

/** Minimum time (ms) between form render and submit; faster is treated as a bot. */
export const MIN_FILL_TIME_MS = 3000
