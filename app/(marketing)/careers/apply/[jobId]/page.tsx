import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ApplicationForm } from "@/components/careers/ApplicationForm"
import { getActiveJobById, type Job } from "@/lib/careers/server"
import { GENERAL_APPLICATION_SLUG } from "@/lib/careers/constants"

// Rendered on first request per job, then cached (ISR). Reads no cookies.
export const dynamic = "force-static"
export const revalidate = 300

export function generateStaticParams() {
  return [{ jobId: GENERAL_APPLICATION_SLUG }]
}

type PageProps = { params: Promise<{ jobId: string }> }

type Resolved =
  | { kind: "general" }
  | { kind: "job"; job: Job }
  | { kind: "missing" }
  | { kind: "error" }

async function resolve(jobId: string): Promise<Resolved> {
  if (jobId === GENERAL_APPLICATION_SLUG) return { kind: "general" }
  try {
    const job = await getActiveJobById(jobId)
    return job ? { kind: "job", job } : { kind: "missing" }
  } catch (err) {
    console.error("[careers/apply] failed to load job:", err)
    return { kind: "error" }
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { jobId } = await params
  const r = await resolve(jobId)
  // Application forms are not landing pages; /careers is the indexed page.
  const robots = { index: false, follow: true }
  if (r.kind === "job") {
    return {
      title: `Apply for ${r.job.title} — Careers`,
      description: `Apply for the ${r.job.title} role (${r.job.department}, ${r.job.location}) at Lasyly.`,
      robots,
    }
  }
  return {
    title: "Submit Your Resume — Careers",
    description: "Send us your resume and we'll keep you in mind for future opportunities at Lasyly.",
    robots,
  }
}

export default async function ApplyPage({ params }: PageProps) {
  const { jobId } = await params
  const r = await resolve(jobId)
  if (r.kind === "missing") notFound()

  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-6 pt-10 sm:pt-14 pb-8">
      <nav aria-label="Breadcrumb" className="mb-8 text-[13px] text-[var(--color-text-muted)]">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/careers" className="hover:text-white transition-colors">Careers</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-white/70">
            {r.kind === "job" ? r.job.title : "Submit your resume"}
          </li>
        </ol>
      </nav>

      {r.kind === "error" ? (
        <div role="status" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-12 text-center">
          <h1 className="text-2xl font-bold font-serif text-white">We couldn&apos;t load this position</h1>
          <p className="mt-3 text-[15px] text-[var(--color-text-muted)]">Please refresh the page in a moment.</p>
          <Link href="/careers" className="mt-7 inline-flex min-h-11 items-center rounded-full bg-[var(--color-lime)] px-6 py-3 text-sm font-semibold text-black">
            Back to Careers
          </Link>
        </div>
      ) : (
        <>
          <header className="careers-rise mb-10">
            {r.kind === "job" ? (
              <>
                <p className="text-[13px] font-medium text-[var(--color-lime)] mb-3">Apply for</p>
                <h1 className="text-[2rem] sm:text-[2.75rem] font-bold font-serif tracking-tight text-white leading-[1.08]">
                  {r.job.title}
                </h1>
                <p className="mt-4 text-[15px] text-white/60">
                  {[r.job.department, r.job.location, r.job.employmentType].join(" · ")}
                </p>
              </>
            ) : (
              <>
                <p className="text-[13px] font-medium text-[var(--color-lime)] mb-3">Talent pool</p>
                <h1 className="text-[2rem] sm:text-[2.75rem] font-bold font-serif tracking-tight text-white leading-[1.08]">
                  Submit Your Resume
                </h1>
                <p className="mt-4 text-[15px] leading-relaxed text-white/60 max-w-[58ch]">
                  Don&apos;t see a position that matches your experience? Send us your resume and we&apos;ll keep you in mind for future opportunities.
                </p>
              </>
            )}
            <p className="mt-6 text-[13px] text-[var(--color-text-muted)]">
              Fields marked <span className="text-[var(--color-lime)]" aria-hidden="true">*</span>
              <span className="sr-only">with an asterisk</span> are required.
            </p>
          </header>

          <ApplicationForm jobId={r.kind === "job" ? r.job.id : null} />
        </>
      )}
    </div>
  )
}
