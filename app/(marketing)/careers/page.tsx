import type { Metadata } from "next"
import Link from "next/link"
import { JobCard } from "@/components/careers/JobCard"
import { getActiveJobs, type Job } from "@/lib/careers/server"
import { GENERAL_APPLICATION_SLUG } from "@/lib/careers/constants"

// Listings change rarely; admin edits call revalidatePath("/careers").
// force-static (like /news): the data layer's no-store fetches would otherwise
// opt this page into per-request rendering. It reads no cookies/headers.
export const dynamic = "force-static"
export const revalidate = 86400

const DESCRIPTION =
  "Explore career opportunities and join our team. View open positions and submit your application."

export const metadata: Metadata = {
  title: "Careers",
  description: DESCRIPTION,
  openGraph: { title: "Careers | Lasyly", description: DESCRIPTION, type: "website" },
  twitter: { card: "summary_large_image", title: "Careers | Lasyly", description: DESCRIPTION },
  alternates: { canonical: "https://lasyly.me/careers" },
}

const GENERAL_HREF = `/careers/apply/${GENERAL_APPLICATION_SLUG}`

const reasons = [
  {
    no: "01",
    title: "Work on a live product",
    desc: "What you build ships to real sports fans using analytics, live scores and community rooms every day.",
  },
  {
    no: "02",
    title: "Own what you build",
    desc: "Small teams mean clear ownership. You take ideas from a rough sketch through to production.",
  },
  {
    no: "03",
    title: "Learn across the stack",
    desc: "Data pipelines, realtime systems, product design and growth sit close together, so you see how it all connects.",
  },
  {
    no: "04",
    title: "Grow with the team",
    desc: "As the product grows, so does the scope of every role. We invest in people who want to take on more.",
  },
]

const primaryCta =
  "inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--color-lime)] px-6 py-3 text-sm font-semibold text-black transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-[0.98] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-lime)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]"

const secondaryCta =
  "inline-flex min-h-11 items-center rounded-full border border-[var(--color-border)] px-6 py-3 text-sm font-medium text-white/80 transition-colors duration-200 hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-lime)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]"

export default async function CareersPage() {
  let jobs: Job[] = []
  let loadFailed = false
  try {
    jobs = await getActiveJobs()
  } catch (err) {
    console.error("[careers] failed to load jobs:", err)
    loadFailed = true
  }

  return (
    <div className="careers-page">
      {/* Hero */}
      <section aria-labelledby="careers-hero" className="max-w-5xl mx-auto px-5 sm:px-6 pt-20 sm:pt-28 pb-16">
        <p className="careers-rise text-[13px] font-medium text-[var(--color-lime)] mb-6">Careers</p>
        <h1
          id="careers-hero"
          className="careers-rise text-[2.4rem] sm:text-[3.25rem] md:text-[4rem] font-bold font-serif tracking-tight text-white leading-[1.04] max-w-[16ch]"
          style={{ animationDelay: "60ms" }}
        >
          Build Your Future With Us
        </h1>
        <p
          className="careers-rise mt-6 text-lg text-white/55 max-w-[58ch] leading-relaxed"
          style={{ animationDelay: "120ms" }}
        >
          Explore opportunities, join a growing team, and build meaningful work with us.
        </p>
        <div className="careers-rise mt-9 flex flex-wrap items-center gap-4" style={{ animationDelay: "180ms" }}>
          <a href="#open-positions" className={primaryCta}>
            View Open Positions
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 3v10M4 9l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          <Link href={GENERAL_HREF} className={secondaryCta}>
            Submit Your Resume
          </Link>
        </div>
      </section>

      {/* Open positions */}
      <section
        id="open-positions"
        aria-labelledby="open-positions-heading"
        className="scroll-mt-24 max-w-5xl mx-auto px-5 sm:px-6 py-12 sm:py-16 border-t border-[var(--color-border)]"
      >
        <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="open-positions-heading" className="text-2xl sm:text-3xl font-bold font-serif tracking-tight text-white">
              Open Positions
            </h2>
            <p className="mt-3 text-[15px] text-[var(--color-text-muted)]">
              Find your next opportunity and become part of our team.
            </p>
          </div>
          {jobs.length > 0 && (
            <p className="text-[13px] text-[var(--color-text-muted)] tabular-nums">
              {jobs.length} {jobs.length === 1 ? "role" : "roles"} open
            </p>
          )}
        </div>

        {loadFailed ? (
          <div role="status" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-12 text-center">
            <h3 className="text-xl font-bold font-serif text-white">We couldn&apos;t load open positions</h3>
            <p className="mt-3 text-[15px] text-[var(--color-text-muted)] max-w-[50ch] mx-auto">
              Please refresh the page in a moment. You can still send us your resume in the meantime.
            </p>
            <Link href={GENERAL_HREF} className={`${primaryCta} mt-7`}>
              Submit Your Resume
            </Link>
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-14 text-center">
            <h3 className="text-xl sm:text-2xl font-bold font-serif tracking-tight text-white">No Open Positions Right Now</h3>
            <p className="mt-3 text-[15px] text-[var(--color-text-muted)] max-w-[52ch] mx-auto leading-relaxed">
              We don&apos;t have any open positions at the moment, but we&apos;re always interested in talented people.
            </p>
            <Link href={GENERAL_HREF} className={`${primaryCta} mt-8`}>
              Submit Your Resume
            </Link>
          </div>
        ) : (
          <ul className="grid gap-5 md:grid-cols-2">
            {jobs.map((job) => (
              <li key={job.id} className="min-w-0">
                <JobCard job={job} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Why work with us */}
      <section aria-labelledby="why-heading" className="max-w-5xl mx-auto px-5 sm:px-6 py-16 sm:py-20">
        <div className="grid gap-10 md:grid-cols-[minmax(0,20rem)_1fr] md:gap-16">
          <div>
            <p className="text-[13px] font-medium text-[var(--color-lime)] mb-3">Why Lasyly</p>
            <h2 id="why-heading" className="text-2xl sm:text-3xl font-bold font-serif tracking-tight text-white leading-tight">
              Why work with us
            </h2>
          </div>
          <div className="border-t border-[var(--color-border)]">
            {reasons.map((r) => (
              <article key={r.no} className="grid grid-cols-[auto_1fr] gap-x-5 border-b border-[var(--color-border)] py-6">
                <span className="font-serif text-2xl font-bold leading-none text-white/15 tabular-nums" aria-hidden="true">
                  {r.no}
                </span>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold font-serif tracking-tight text-white">{r.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-text-muted)]">{r.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* General resume */}
      <section aria-labelledby="general-heading" className="max-w-5xl mx-auto px-5 sm:px-6 pb-8">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-10 sm:px-10 sm:py-12 md:flex md:items-center md:justify-between md:gap-10">
          <div className="max-w-[52ch]">
            <h2 id="general-heading" className="text-2xl sm:text-3xl font-bold font-serif tracking-tight text-white">
              Don&apos;t See the Right Role?
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-text-muted)]">
              We&apos;re always interested in meeting talented people. Send us your resume and we&apos;ll keep you in mind for future opportunities.
            </p>
          </div>
          <Link href={GENERAL_HREF} className={`${primaryCta} mt-7 shrink-0 md:mt-0`}>
            Submit Your Resume
          </Link>
        </div>
      </section>
    </div>
  )
}
