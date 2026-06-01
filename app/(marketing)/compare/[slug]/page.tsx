import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { getComparisonBySlug, getAllComparisonSlugs, COMPARISONS } from "@/lib/data/comparisons"
import { JsonLd } from "@/components/seo/JsonLd"

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return getAllComparisonSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const comparison = getComparisonBySlug(slug)
  if (!comparison) return {}

  return {
    title: comparison.metaTitle,
    description: comparison.metaDescription,
    openGraph: {
      title: comparison.metaTitle,
      description: comparison.metaDescription,
      type: "article",
      url: `https://lasyly.me/compare/${slug}`,
    },
    alternates: { canonical: `https://lasyly.me/compare/${slug}` },
  }
}

export default async function ComparisonPage({ params }: Props) {
  const { slug } = await params
  const comparison = getComparisonBySlug(slug)
  if (!comparison) notFound()

  const lasylyWins = comparison.features.filter(
    (f) => f.lasyly === true && (f.competitor === false || f.competitor === "Limited")
  ).length
  const competitorWins = comparison.features.filter(
    (f) => f.competitor === true && f.lasyly === false
  ).length

  // Find related comparisons (exclude current)
  const related = COMPARISONS.filter((c) => c.slug !== slug).slice(0, 3)

  return (
    <div className="min-h-screen">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: comparison.heroHeadline,
          description: comparison.metaDescription,
          url: `https://lasyly.me/compare/${slug}`,
          publisher: { "@type": "Organization", name: "Lasyly", url: "https://lasyly.me" },
          datePublished: "2026-05-27",
          dateModified: "2026-05-27",
        }}
      />

      {/* Breadcrumb */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        <nav className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <Link href="/compare" className="hover:text-white transition-colors">
            Comparisons
          </Link>
          <span className="text-white/20">/</span>
          <span className="text-white/60">{comparison.competitorName}</span>
        </nav>
      </div>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-12 sm:pb-16">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-lime)] flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(212,255,0,0.3)]">
              <Image src="/lasyly_logo_128.png" alt="Lasyly" width={40} height={40} className="w-full h-full object-cover" />
            </div>
            <span className="text-2xl font-bold text-white/30">vs</span>
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
              <span className="text-sm font-bold text-white/60">
                {comparison.competitorName.charAt(0)}
              </span>
            </div>
          </div>

          <h1 className="text-[2.25rem] sm:text-[3rem] md:text-[3.5rem] font-bold font-serif tracking-tight text-white leading-[1.05] mb-5">
            {comparison.heroHeadline}
          </h1>
          <p className="text-lg text-white/50 max-w-[56ch] leading-relaxed mb-8">
            {comparison.heroSubheadline}
          </p>

          {/* Score badges */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 bg-[var(--color-lime)]/10 border border-[var(--color-lime)]/20 rounded-full px-4 py-2">
              <span className="text-[var(--color-lime)] font-black text-lg">{lasylyWins}</span>
              <span className="text-xs text-[var(--color-lime)]/70 font-medium">Lasyly advantages</span>
            </div>
            {competitorWins > 0 && (
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2">
                <span className="text-white/60 font-black text-lg">{competitorWins}</span>
                <span className="text-xs text-white/40 font-medium">{comparison.competitorName} advantages</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="h-[1px] bg-gradient-to-r from-[var(--color-border)] via-[var(--color-border)] to-transparent" />
      </div>

      {/* Screenshot / Platform Preview */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="rounded-[1.5rem] p-[1px] bg-gradient-to-b from-white/8 to-transparent overflow-hidden">
          <div className="rounded-[calc(1.5rem-1px)] bg-[var(--color-surface)] p-6 sm:p-8 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Lasyly side */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-lg bg-[var(--color-lime)] flex items-center justify-center overflow-hidden">
                    <Image src="/lasyly_logo_128.png" alt="Lasyly" width={24} height={24} className="w-full h-full object-cover" />
                  </div>
                  <span className="text-sm font-bold text-[var(--color-lime)]">Lasyly</span>
                  <span className="text-[10px] bg-[var(--color-lime)]/10 text-[var(--color-lime)] px-2 py-0.5 rounded-full font-bold">FREE</span>
                </div>
                <div className="rounded-xl overflow-hidden border border-[var(--color-lime)]/20 shadow-[0_0_30px_rgba(212,255,0,0.08)]">
                  <Image
                    src="/hero.png"
                    alt="Lasyly platform screenshot showing prop analytics dashboard"
                    width={600}
                    height={400}
                    className="w-full h-auto"
                  />
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mt-3">
                  Lasyly&apos;s prop analytics with hit rates, matchup grades, and confidence scores
                </p>
              </div>

              {/* Competitor side */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center border border-white/10">
                    <span className="text-[10px] font-bold text-white/60">
                      {comparison.competitorName.charAt(0)}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-white/60">{comparison.competitorName}</span>
                </div>
                <div className="rounded-xl overflow-hidden border border-white/10 bg-white/[0.02] flex items-center justify-center aspect-[3/2]">
                  <div className="text-center p-8">
                    <p className="text-sm text-white/30 font-medium mb-2">{comparison.competitorName}</p>
                    <p className="text-xs text-white/20">{comparison.competitorTagline}</p>
                  </div>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mt-3">
                  {comparison.competitorOverview}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <h2 className="text-2xl font-bold font-serif tracking-tight text-white mb-6">
          Feature-by-feature comparison
        </h2>
        <div className="rounded-[1.5rem] p-[1px] bg-gradient-to-b from-white/8 to-transparent overflow-hidden">
          <div className="rounded-[calc(1.5rem-1px)] bg-[var(--color-surface)] overflow-x-auto shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="text-left py-4 px-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                    Feature
                  </th>
                  <th className="py-4 px-5 text-[var(--color-lime)] font-bold text-[10px] uppercase tracking-[0.15em] border-b border-[var(--color-border)]">
                    Lasyly
                  </th>
                  <th className="py-4 px-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                    {comparison.competitorName}
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparison.features.map((f) => (
                  <tr key={f.feature} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-5 text-white/80 border-b border-[var(--color-border)]">
                      {f.feature}
                      {f.note && (
                        <span className="block text-[11px] text-white/30 mt-0.5">{f.note}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-center border-b border-[var(--color-border)]">
                      {f.lasyly === true ? (
                        <span className="text-[var(--color-lime)] font-bold">✓</span>
                      ) : f.lasyly === false ? (
                        <span className="text-[var(--color-text-muted)] opacity-30">✗</span>
                      ) : (
                        <span className="text-[var(--color-text-muted)] text-xs">{f.lasyly}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-center border-b border-[var(--color-border)]">
                      {f.competitor === true ? (
                        <span className="text-white/70 font-bold">✓</span>
                      ) : f.competitor === false ? (
                        <span className="text-[var(--color-text-muted)] opacity-30">✗</span>
                      ) : (
                        <span className="text-[var(--color-text-muted)] text-xs">{f.competitor}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Why Switch Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Why switch to Lasyly */}
          <div className="rounded-[1.5rem] p-[1px] bg-gradient-to-b from-[var(--color-lime)]/15 to-transparent">
            <div className="rounded-[calc(1.5rem-1px)] bg-[var(--color-surface)] p-6 sm:p-8 h-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
              <h3 className="text-lg font-bold text-white font-serif tracking-tight mb-4">
                Why choose Lasyly
              </h3>
              <ul className="space-y-3">
                {comparison.switchReasons.map((reason) => (
                  <li key={reason} className="flex items-start gap-2.5 text-sm text-[var(--color-text-muted)]">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--color-lime)] shrink-0" />
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Best for sections */}
          <div className="space-y-4">
            <div className="rounded-[1.5rem] p-[1px] bg-gradient-to-b from-white/6 to-transparent">
              <div className="rounded-[calc(1.5rem-1px)] bg-[var(--color-surface)] p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
                <h3 className="text-sm font-bold text-[var(--color-lime)] uppercase tracking-wider mb-2">
                  Lasyly is best for
                </h3>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                  {comparison.lasylyBestFor}
                </p>
              </div>
            </div>
            <div className="rounded-[1.5rem] p-[1px] bg-gradient-to-b from-white/6 to-transparent">
              <div className="rounded-[calc(1.5rem-1px)] bg-[var(--color-surface)] p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
                <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-2">
                  {comparison.competitorName} is best for
                </h3>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                  {comparison.competitorBestFor}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Verdict */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="rounded-[1.5rem] p-[1px] bg-gradient-to-b from-white/8 to-transparent">
          <div className="rounded-[calc(1.5rem-1px)] bg-[var(--color-surface)] p-6 sm:p-8 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
            <h2 className="text-xl font-bold text-white font-serif tracking-tight mb-4">
              The verdict
            </h2>
            <p className="text-[var(--color-text-muted)] leading-relaxed max-w-prose">
              {comparison.verdict}
            </p>
          </div>
        </div>
      </section>

      {/* Related Comparisons */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="h-[1px] bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent" />
      </div>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <h2 className="text-xl font-bold font-serif tracking-tight text-white mb-6">
          Other comparisons
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {related.map((comp) => (
            <Link
              key={comp.slug}
              href={`/compare/${comp.slug}`}
              className="group rounded-[1.25rem] p-[1px] bg-gradient-to-b from-white/6 to-transparent hover:from-[var(--color-lime)]/15 transition-all"
            >
              <div className="rounded-[calc(1.25rem-1px)] bg-[var(--color-surface)] p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-lime)] mb-1 block">
                  vs
                </span>
                <h3 className="text-sm font-bold text-white group-hover:text-[var(--color-lime)] transition-colors">
                  {comp.competitorName}
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">{comp.competitorTagline}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20 sm:pb-28">
        <div className="rounded-[2rem] p-[1px] bg-gradient-to-br from-[var(--color-lime)]/25 via-transparent to-[#6C63FF]/15">
          <div className="rounded-[calc(2rem-1px)] bg-[var(--color-surface)] p-10 sm:p-14 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
            <h2 className="text-3xl sm:text-4xl font-bold font-serif tracking-tight text-white mb-4">
              See for yourself
            </h2>
            <p className="text-[var(--color-text-muted)] max-w-md mx-auto mb-8">
              No credit card. No trial period. Create a free account and explore prop analytics, live scores, and community rooms.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 bg-[var(--color-lime)] text-black font-bold px-8 py-3.5 rounded-full text-sm hover:scale-[0.98] active:scale-[0.96] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
              >
                Get started free
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link
                href="/features"
                className="inline-block border border-[var(--color-border)] text-white font-medium text-sm px-6 py-3 rounded-full hover:border-white/20 transition-colors duration-300"
              >
                View all features
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
