import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { getCareersAdmin } from "@/lib/careers/adminAuth"
import { listAllJobs, type Job } from "@/lib/careers/server"
import { AdminShell } from "@/components/careers/admin/AdminShell"
import { ActiveToggle } from "@/components/careers/admin/ActiveToggle"

export const metadata: Metadata = {
  title: "Jobs — Careers admin",
  robots: { index: false, follow: false },
}

export default async function CareersJobsAdminPage() {
  const admin = await getCareersAdmin()
  if (!admin) notFound()

  let jobs: Job[] | null = null
  try {
    jobs = await listAllJobs()
  } catch (err) {
    console.error("[careers/admin] jobs list failed:", err)
  }

  return (
    <AdminShell
      active="jobs"
      title="Jobs"
      actions={
        <Link
          href="/admin/careers/jobs/new"
          className="inline-flex min-h-10 items-center rounded-full bg-[var(--color-lime)] px-5 py-2 text-sm font-semibold text-black hover:opacity-90"
        >
          New job
        </Link>
      }
    >
      {!jobs ? (
        <p role="alert" className="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
          Couldn&apos;t load jobs. Check that the careers migration has been applied, then refresh.
        </p>
      ) : jobs.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-12 text-center text-sm text-[var(--color-text-muted)]">
          No jobs yet. Create one to show it on the careers page.
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          {jobs.map((job) => (
            <li key={job.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="min-w-0">
                <Link href={`/admin/careers/jobs/${job.id}`} className="font-medium text-white hover:text-[var(--color-lime)]">
                  {job.title}
                </Link>
                <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
                  {[job.department, job.location, job.employmentType].join(" · ")} · updated{" "}
                  <time dateTime={job.updatedAt}>{format(new Date(job.updatedAt), "MMM d, yyyy")}</time>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <ActiveToggle jobId={job.id} initial={job.isActive} title={job.title} />
                <Link href={`/admin/careers/jobs/${job.id}`} className="text-sm text-[var(--color-text-muted)] hover:text-white">
                  Edit
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  )
}
