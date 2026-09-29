import Link from "next/link"
import { Building2, MapPin, Clock, TrendingUp } from "lucide-react"
import type { Job } from "@/lib/careers/server"

export function JobCard({ job }: { job: Job }) {
  const titleId = `job-${job.id}-title`
  const meta = [
    { icon: Building2, label: "Department", value: job.department },
    { icon: MapPin, label: "Location", value: job.location },
    { icon: Clock, label: "Employment type", value: job.employmentType },
    { icon: TrendingUp, label: "Experience", value: job.experienceLevel },
  ]

  return (
    <article
      aria-labelledby={titleId}
      className="group flex h-full min-w-0 flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-7 transition-colors duration-300 hover:border-white/15 hover:bg-[var(--color-surface-elevated)]/60"
    >
      <h3 id={titleId} className="text-xl sm:text-2xl font-bold font-serif tracking-tight text-white">
        {job.title}
      </h3>

      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {meta.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex min-w-0 items-center gap-2 text-[13px]">
            <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--color-lime)]" aria-hidden="true" />
            <dt className="sr-only">{label}</dt>
            <dd className="truncate text-white/75">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-5 text-[15px] leading-relaxed text-[var(--color-text-muted)] line-clamp-4">
        {job.description}
      </p>

      {job.requirements.length > 0 && (
        <div className="mt-5">
          <h4 className="text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
            Requirements
          </h4>
          <ul className="mt-2 space-y-1.5">
            {job.requirements.slice(0, 4).map((req) => (
              <li key={req} className="flex gap-2 text-[14px] leading-snug text-white/70">
                <span className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-white/30" aria-hidden="true" />
                <span className="min-w-0">{req}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {job.skills.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-2" aria-label="Skills">
          {job.skills.map((skill) => (
            <li
              key={skill}
              className="rounded-full border border-[var(--color-border)] bg-white/[0.03] px-3 py-1 text-[12px] font-medium text-white/70"
            >
              {skill}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-7">
        <Link
          href={`/careers/apply/${job.id}`}
          aria-label={`Apply now for ${job.title}`}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--color-lime)] px-6 py-2.5 text-sm font-semibold text-black transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-[0.98] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-lime)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
        >
          Apply Now
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </article>
  )
}
