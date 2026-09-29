import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { getCareersAdmin } from "@/lib/careers/adminAuth"
import { getApplicationById } from "@/lib/careers/server"
import { EXPERIENCE_OPTIONS, REFERRAL_OPTIONS, labelFor } from "@/lib/careers/constants"
import { isFileXLUrl, isHttpUrl } from "@/lib/careers/validation"
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
    { label: "GitHub / Portfolio", value: app.github && isHttpUrl(app.github) ? <ExternalLink href={app.github}>{app.github}</ExternalLink> : "—" },
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

  const cvLink = app.cvFileUrl && isFileXLUrl(app.cvFileUrl) ? app.cvFileUrl : null

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
        </section>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <StatusSelect applicationId={app.id} initial={app.status} />
          </section>

          <section aria-labelledby="cv-h" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 id="cv-h" className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">CV</h2>
            <p className="mt-3 text-sm text-white/85">CV uploaded via FileXL</p>
            {cvLink ? (
              <>
                <a
                  href={cvLink}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="mt-4 inline-flex min-h-10 items-center rounded-full bg-[var(--color-lime)] px-5 py-2 text-sm font-semibold text-black hover:opacity-90"
                >
                  View CV
                </a>
                <p className="mt-3 break-all font-mono text-[11px] text-[var(--color-text-muted)]">{cvLink}</p>
                <p className="mt-3 text-xs leading-relaxed text-[var(--color-text-muted)]">
                  Opens the FileXL download link the applicant pasted after uploading. If they enabled
                  FileXL&apos;s self-destruct option, the file is deleted after the first open, so download it
                  the first time you view it.
                </p>
              </>
            ) : (
              <p className="mt-3 text-xs leading-relaxed text-[var(--color-text-muted)]">
                No FileXL link was stored with this application. FileXL&apos;s embed does not report
                uploads back to this site, so the file can only be retrieved with the link the applicant
                received. Contact the applicant by email to request it.
              </p>
            )}
          </section>
        </aside>
      </div>
    </AdminShell>
  )
}
