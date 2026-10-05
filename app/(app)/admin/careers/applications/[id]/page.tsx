import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { getCareersAdmin } from "@/lib/careers/adminAuth"
import { getApplicationById } from "@/lib/careers/server"
import { EXPERIENCE_OPTIONS, REFERRAL_OPTIONS, labelFor } from "@/lib/careers/constants"
import { isHttpUrl } from "@/lib/careers/validation"
import { AdminShell, StatusBadge } from "@/components/careers/admin/AdminShell"
import { StatusSelect } from "@/components/careers/admin/StatusSelect"

export const metadata: Metadata = {
  title: "Application — Careers admin",
  robots: { index: false, follow: false },
}

type PageProps = { params: Promise<{ id: string }> }

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="break-all text-[var(--color-lime)] underline underline-offset-4 decoration-[var(--color-lime)]/30 hover:decoration-[var(--color-lime)]"
    >
      {children}
    </a>
  )
}

export default async function ApplicationDetailPage({ params }: PageProps) {
  const admin = await getCareersAdmin()
  if (!admin) notFound()

  const { id } = await params
  const app = await getApplicationById(id)
  if (!app) notFound()

  const referral =
    app.referralSource === "other" && app.referralOther
      ? `Other: ${app.referralOther}`
      : labelFor(REFERRAL_OPTIONS, app.referralSource)

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Full name", value: app.fullName },
    { label: "Email", value: <a href={`mailto:${app.email}`} className="text-[var(--color-lime)] hover:underline break-all">{app.email}</a> },
    { label: "Phone", value: <a href={`tel:${app.phone.replace(/[^\d+]/g, "")}`} className="text-[var(--color-lime)] hover:underline">{app.phone}</a> },
    { label: "Location", value: app.location },
    { label: "Current job", value: app.currentJobTitle ?? "—" },
    { label: "Current company", value: app.currentCompany ?? "—" },
    { label: "Experience", value: labelFor(EXPERIENCE_OPTIONS, app.experience) },
    { label: "LinkedIn", value: app.linkedin && isHttpUrl(app.linkedin) ? <ExternalLink href={app.linkedin}>{app.linkedin}</ExternalLink> : "—" },
    { label: "Portfolio / GitHub", value: app.portfolioUrl && isHttpUrl(app.portfolioUrl) ? <ExternalLink href={app.portfolioUrl}>{app.portfolioUrl}</ExternalLink> : "—" },
    // Legacy optional field; only applications from before portfolioUrl have it.
    ...(app.github
      ? [{ label: "GitHub / Portfolio (legacy)", value: isHttpUrl(app.github) ? <ExternalLink href={app.github}>{app.github}</ExternalLink> : "—" }]
      : []),
    // Legacy CV link; no longer collected. Shown only for older applications.
    ...(app.cvFileUrl
      ? [{ label: "CV link (legacy)", value: isHttpUrl(app.cvFileUrl) ? <ExternalLink href={app.cvFileUrl}>{app.cvFileUrl}</ExternalLink> : "—" }]
      : []),
    { label: "Referral source", value: referral },
    {
      label: "Position",
      value:
        app.applicationType === "general" ? (
          "General application (talent pool)"
        ) : app.jobId ? (
          <Link href={`/admin/careers/jobs/${app.jobId}`} className="text-[var(--color-lime)] hover:underline">
            {app.jobTitle ?? "View job"}
          </Link>
        ) : (
          `${app.jobTitle ?? "Unknown"} (job since removed)`
        ),
    },
    { label: "Applied", value: <time dateTime={app.createdAt}>{format(new Date(app.createdAt), "MMM d, yyyy 'at' HH:mm")}</time> },
    { label: "Consent given", value: <time dateTime={app.consentAt}>{format(new Date(app.consentAt), "MMM d, yyyy 'at' HH:mm")}</time> },
  ]

  return (
    <AdminShell
      active="applications"
      title={app.fullName}
      actions={<Link href="/admin/careers" className="text-sm text-[var(--color-text-muted)] hover:text-white">← All applications</Link>}
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="details-h" className="min-w-0 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-7">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <h2 id="details-h" className="text-lg font-bold font-serif text-white">Applicant details</h2>
            <StatusBadge status={app.status} />
            <span className="font-mono text-xs text-[var(--color-text-muted)]">#{app.reference}</span>
          </div>
          <dl className="divide-y divide-[var(--color-border)]">
            {rows.map((r) => (
              <div key={r.label} className="grid gap-1 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
                <dt className="text-[13px] text-[var(--color-text-muted)]">{r.label}</dt>
                <dd className="min-w-0 text-sm text-white/85">{r.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 border-t border-[var(--color-border)] pt-5">
            <h3 className="text-[13px] text-[var(--color-text-muted)]">Why they&apos;re a fit</h3>
            {app.fitAnswer ? (
              <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-white/85">{app.fitAnswer}</p>
            ) : (
              <p className="mt-2 text-sm text-white/85">—</p>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <StatusSelect applicationId={app.id} initial={app.status} />
          </section>

        </aside>
      </div>
    </AdminShell>
  )
}
