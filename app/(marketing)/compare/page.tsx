import type { Metadata } from "next"
import Link from "next/link"
import { COMPARISONS } from "@/lib/data/comparisons"
import { JsonLd } from "@/components/seo/JsonLd"

export const metadata: Metadata = {
  title: "Lasyly vs Competitors — Free Prop Analytics Comparison",
  description:
    "See how Lasyly compares to Props.cash, PropShark, PrizePicks, Action Network, OddsJam, and BetStamp. Free prop analytics, community rooms, and live scores.",
  openGraph: {
    title: "Lasyly vs Competitors — Free Prop Analytics Comparison",
    description:
      "Compare Lasyly with the top sports betting tools. Hit rates, matchup grades, community, and live scores — all free.",
  },
  alternates: { canonical: "https://lasyly.me/compare" },
}

export default function ComparePage() {
  return (
    <div className="min-h-screen">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Lasyly Comparisons",
          url: "https://lasyly.me/compare",
          description: "Compare Lasyly with other sports betting analytics tools.",
          publisher: { "@type": "Organization", name: "Lasyly", url: "https://lasyly.me" },
        }}
      />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-12 sm:pb-16">
        <div className="max-w-3xl">
          <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--color-lime)] bg-[var(--color-lime)]/8 px-3 py-1.5 rounded-full border border-[var(--color-lime)]/15 mb-5">
            Honest comparisons
          </span>
          <h1 className="text-[2.5rem] sm:text-[3.5rem] font-bold font-serif tracking-tight text-white leading-[1.05] mb-6">
            How Lasyly stacks up
          </h1>
          <p className="text-lg text-white/50 max-w-[52ch] leading-relaxed">
            We built Lasyly because existing tools were either too expensive, too limited, or too scattered. Here&apos;s how we compare to the alternatives.
          </p>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="h-[1px] bg-gradient-to-r from-[var(--color-border)] via-[var(--color-border)] to-transparent" />
      </div>

      {/* Comparison Cards Grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {COMPARISONS.map((comp) => {
            const lasylyWins = comp.features.filter(
              (f) => f.lasyly === true && (f.competitor === false || f.competitor === "Limited")
            ).length

            return (
              <Link
                key={comp.slug}
                href={`/compare/${comp.slug}`}
                className="group rounded-[1.5rem] p-[1px] bg-gradient-to-b from-white/6 to-transparent hover:from-[var(--color-lime)]/20 hover:to-transparent transition-all duration-300"
              >
                <div className="rounded-[calc(1.5rem-1px)] bg-[var(--color-surface)] p-6 h-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--color-lime)]">
                      vs
                    </span>
                    <span className="text-[10px] font-bold text-white/30 bg-white/5 px-2 py-1 rounded-full">
                      {lasylyWins} advantages
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-white font-serif tracking-tight mb-2 group-hover:text-[var(--color-lime)] transition-colors">
                    {comp.competitorName}
                  </h2>
                  <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-4 flex-1">
                    {comp.competitorTagline}
                  </p>

                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                    <span className="group-hover:text-[var(--color-lime)] transition-colors font-medium">
                      Read comparison →
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Summary Table */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="h-[1px] bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent" />
      </div>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <h2 className="text-2xl font-bold font-serif tracking-tight text-white mb-8">
          Quick comparison
        </h2>
        <div className="rounded-[1.5rem] p-[1px] bg-gradient-to-b from-white/8 to-transparent overflow-hidden">
          <div className="rounded-[calc(1.5rem-1px)] bg-[var(--color-surface)] overflow-x-auto shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="text-left py-4 px-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                    Platform
                  </th>
                  <th className="py-4 px-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                    Free
                  </th>
                  <th className="py-4 px-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                    Hit Rates
                  </th>
                  <th className="py-4 px-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                    Matchup Grades
                  </th>
                  <th className="py-4 px-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                    Community
                  </th>
                  <th className="py-4 px-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                    Live Scores
                  </th>
                  <th className="py-4 px-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                    Parlay Builder
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: "Lasyly", free: true, hits: true, grades: true, community: true, scores: true, parlay: true, highlight: true },
                  { name: "Props.cash", free: "Freemium", hits: true, grades: false, community: false, scores: false, parlay: false },
                  { name: "PropShark", free: false, hits: true, grades: false, community: false, scores: false, parlay: false },
                  { name: "Action Network", free: "Freemium", hits: "PRO", grades: false, community: false, scores: true, parlay: false },
                  { name: "PrizePicks", free: "N/A", hits: false, grades: false, community: false, scores: false, parlay: false },
                  { name: "OddsJam", free: false, hits: false, grades: false, community: false, scores: false, parlay: false },
                  { name: "BetStamp", free: "Freemium", hits: false, grades: false, community: false, scores: false, parlay: false },
                ].map((row) => (
                  <tr
                    key={row.name}
                    className={
                      row.highlight
                        ? "bg-[var(--color-lime)]/[0.03]"
                        : "hover:bg-white/[0.02] transition-colors"
                    }
                  >
                    <td className="py-3.5 px-5 border-b border-[var(--color-border)]">
                      <span className={row.highlight ? "font-bold text-[var(--color-lime)]" : "text-white/80"}>
                        {row.name}
                      </span>
                    </td>
                    {[row.free, row.hits, row.grades, row.community, row.scores, row.parlay].map(
                      (val, i) => (
                        <td key={i} className="py-3.5 px-4 text-center border-b border-[var(--color-border)]">
                          {val === true ? (
                            <span className="text-[var(--color-lime)] font-bold">✓</span>
                          ) : val === false ? (
                            <span className="text-[var(--color-text-muted)] opacity-30">✗</span>
                          ) : (
                            <span className="text-[var(--color-text-muted)] text-xs">{val}</span>
                          )}
                        </td>
                      )
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20 sm:pb-28">
        <div className="rounded-[2rem] p-[1px] bg-gradient-to-br from-[var(--color-lime)]/25 via-transparent to-[#6C63FF]/15">
          <div className="rounded-[calc(2rem-1px)] bg-[var(--color-surface)] p-10 sm:p-14 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
            <h2 className="text-3xl sm:text-4xl font-bold font-serif tracking-tight text-white mb-4">
              Try it yourself
            </h2>
            <p className="text-[var(--color-text-muted)] max-w-md mx-auto mb-8">
              No credit card. No subscription. Sign up and start researching props with real data in under a minute.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-[var(--color-lime)] text-black font-bold px-8 py-3.5 rounded-full text-sm hover:scale-[0.98] active:scale-[0.96] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            >
              Get started free
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
