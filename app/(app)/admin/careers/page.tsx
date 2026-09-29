import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { getCareersAdmin } from "@/lib/careers/adminAuth"
import { listApplications, APPLICATIONS_PAGE_SIZE, type ApplicationSummary } from "@/lib/careers/server"
import { APPLICATION_STATUSES, EXPERIENCE_OPTIONS, labelFor, type ApplicationStatus } from "@/lib/careers/constants"
import { AdminShell, StatusBadge } from "@/components/careers/admin/AdminShell"

export const metadata: Metadata = {
  title: "Applications — Careers admin",
  robots: { index: false, follow: false },
}

type PageProps = { searchParams: Promise<{ status?: string; page?: string }> }

const STATUS_VALUES = APPLICATION_STATUSES.map((s) => s.value) as string[]

export default async function CareersAdminPage({ searchParams }: PageProps) {
  // Non-admins get a 404, not a hint that the page exists.
  const admin = await getCareersAdmin()
  if (!admin) notFound()

  const sp = await searchParams
  const status = sp.status && STATUS_VALUES.includes(sp.status) ? (sp.status as ApplicationStatus) : undefined
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1)

  let result: { items: ApplicationSummary[]; total: number } | null = null
  try {
    result = await listApplications({ status, page })
  } catch (err) {
    console.error("[careers/admin] list failed:", err)
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / APPLICATIONS_PAGE_SIZE)) : 1
  const qs = (next: { status?: string; page?: number }) => {
    const p = new URLSearchParams()
    if (next.status) p.set("status", next.status)
    if (next.page && next.page > 1) p.set("page", String(next.page))
    const s = p.toString()
    return s ? `/admin/careers?${s}` : "/admin/careers"
  }

  return (
    <AdminShell active="applications" title="Applications">
      {/* Status filter */}
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {[{ value: undefined, label: "All" }, ...APPLICATION_STATUSES].map((s) => (
          <Link
            key={s.label}
            href={qs({ status: s.value })}
            aria-current={status === s.value ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              status === s.value
                ? "border-[var(--color-lime)]/40 bg-[var(--color-lime)]/10 text-[var(--color-lime)]"
                : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white"
            )}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {!result ? (
        <p role="alert" className="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
          Couldn&apos;t load applications. Check that the careers migration has been applied, then refresh.
        </p>
      ) : result.items.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-12 text-center text-sm text-[var(--color-text-muted)]">
          {status ? "No applications with this status." : "No applications yet."}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">Job applications, newest first</caption>
              <thead className="border-b border-[var(--color-border)] text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Applicant</th>
                  <th scope="col" className="px-4 py-3 font-medium">Position</th>
                  <th scope="col" className="px-4 py-3 font-medium">Experience</th>
                  <th scope="col" className="px-4 py-3 font-medium">Submitted</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((a) => (
                  <tr key={a.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/careers/applications/${a.id}`}
                        className="font-medium text-white hover:text-[var(--color-lime)] transition-colors focus-visible:outline-none focus-visible:underline"
                      >
                        {a.fullName}
                      </Link>
                      <div className="font-mono text-[11px] text-[var(--color-text-muted)]">#{a.reference}</div>
                    </td>
                    <td className="px-4 py-3 text-white/80">
                      {a.applicationType === "general" ? (
                        <span className="text-[var(--color-text-muted)]">General application</span>
                      ) : (
                        a.jobTitle ?? "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/80">{labelFor(EXPERIENCE_OPTIONS, a.experience)}</td>
                    <td className="px-4 py-3 text-white/80 tabular-nums">
                      <time dateTime={a.createdAt}>{format(new Date(a.createdAt), "MMM d, yyyy")}</time>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-[var(--color-text-muted)]">
            <span className="tabular-nums">
              {result.total} total · page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={qs({ status, page: page - 1 })} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 hover:text-white">
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link href={qs({ status, page: page + 1 })} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 hover:text-white">
                  Next
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </AdminShell>
  )
}
