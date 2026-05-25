import type { Metadata } from "next"
import Link from "next/link"
import { JsonLd } from "@/components/seo/JsonLd"
import BlogPostBackButton from "@/components/blog/BlogPostBackButton"
import BlogNewspaperWrapper from "@/components/blog/BlogNewspaperWrapper"

export const metadata: Metadata = {
  title: "How to Read Prop Analytics: Hit Rates, Matchup Grades & Confidence Scores — Lasyly Blog",
  description:
    "A plain-English breakdown of every metric on a Lasyly prop card — hit rates, L5/L10/L20 splits, matchup grades A–F, confidence stars, trend arrows, and streak dots. Learn how to combine them to find real edge.",
  openGraph: {
    title: "How to Read Prop Analytics: Hit Rates, Matchup Grades & Confidence Scores",
    description:
      "A plain-English breakdown of every metric on a Lasyly prop card — hit rates, matchup grades, and confidence scores. Learn to find real edge.",
    type: "article",
    publishedTime: "2026-05-22",
  },
  alternates: {
    canonical: "https://lasyly.me/blog/how-to-read-prop-analytics",
  },
}

function MetricCard({ label, value, color, children }: { label: string; value: string; color: string; children: React.ReactNode }) {
  return (
    <div className="group relative rounded-[1.25rem] p-[1px] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
      style={{ background: `linear-gradient(135deg, ${color}30, transparent 60%)` }}>
      <div className="rounded-[calc(1.25rem-1px)] bg-[var(--color-surface)] p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
        <div className="flex items-start justify-between mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">{label}</p>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: `${color}15`, color }}>{value}</span>
        </div>
        <div className="text-sm text-[var(--color-text-muted)] leading-relaxed">{children}</div>
      </div>
    </div>
  )
}

function ConfidenceTier({ stars, description }: { stars: string; description: string }) {
  return (
    <div className="flex gap-4 items-start py-4 border-b border-[var(--color-border)] last:border-0">
      <span className="text-sm font-bold text-[var(--color-text-primary)] shrink-0 w-16">{stars}</span>
      <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{description}</p>
    </div>
  )
}

export default function PropAnalyticsGuidePost() {
  const baseUrl = "https://lasyly.me"
  return (
    <BlogNewspaperWrapper>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "How to Read Prop Analytics: Hit Rates, Matchup Grades, and Confidence Scores Explained",
        "description": "A plain-English breakdown of every metric on a Lasyly prop card — hit rates, matchup grades, confidence scores, trend arrows, streak dots, correlations, and line movement.",
        "datePublished": "2026-05-22",
        "dateModified": "2026-05-22",
        "author": { "@type": "Organization", "name": "Lasyly", "url": baseUrl },
        "publisher": {
          "@type": "Organization",
          "name": "Lasyly",
          "url": baseUrl,
          "logo": { "@type": "ImageObject", "url": `${baseUrl}/lasyly_logo.png` },
        },
        "url": `${baseUrl}/blog/how-to-read-prop-analytics`,
        "mainEntityOfPage": { "@type": "WebPage", "@id": `${baseUrl}/blog/how-to-read-prop-analytics` },
        "keywords": ["prop analytics", "hit rate", "matchup grade", "confidence score", "sports betting"],
      }} />

      {/* Hero — asymmetric left-aligned */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-16 md:pt-20 md:pb-24">
        <div className="max-w-3xl">
          <BlogPostBackButton sport="Analytics" />

          <div className="mb-6">
            <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6C63FF] bg-[#6C63FF]/8 px-3 py-1.5 rounded-full border border-[#6C63FF]/15">
              Analytics Guide
            </span>
          </div>

          <h1 className="text-[2.5rem] md:text-[3.5rem] lg:text-[4rem] font-bold font-serif tracking-tight text-[var(--color-text-primary)] leading-[1.08] mb-6">
            How to Read Prop Analytics
          </h1>

          <p className="text-lg md:text-xl text-[var(--color-text-primary)]/60 leading-relaxed max-w-[52ch] mb-8">
            Hit rates, matchup grades, confidence scores, trend arrows, streak dots, correlations, and line movement — decoded.
          </p>

          <div className="flex items-center gap-4 text-sm text-[var(--color-text-muted)]">
            <div className="w-8 h-8 rounded-full bg-[var(--color-surface-elevated)] flex items-center justify-center text-[10px] font-bold text-[var(--color-text-primary)]/60">
              LT
            </div>
            <span>Lasyly Team</span>
            <span className="w-1 h-1 rounded-full bg-[var(--color-text-muted)]" />
            <span>May 22, 2026</span>
            <span className="w-1 h-1 rounded-full bg-[var(--color-text-muted)]" />
            <span>8 min read</span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="h-[1px] bg-gradient-to-r from-[var(--color-border)] via-[var(--color-border)] to-transparent" />
      </div>

      {/* Content grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24">
        <div className="grid md:grid-cols-[1fr_260px] lg:grid-cols-[1fr_300px] gap-12 lg:gap-20 items-start">

          {/* Article */}
          <article className="max-w-none">

            <p className="text-lg text-[var(--color-text-primary)]/70 leading-relaxed mb-16 max-w-[60ch]">
              Lasyly surfaces a lot of numbers on every player prop card. If you&apos;ve ever stared at a card and wondered what half of it means, this guide is for you. We&apos;ll break down every metric — what it measures, how it&apos;s calculated, and how to weight it in your decision.
            </p>

            {/* Hit Rate */}
            <section className="mb-20">
              <h2 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-[var(--color-text-primary)] mb-4">
                The Hit Rate — Your Starting Point
              </h2>
              <div className="w-12 h-[2px] bg-[var(--color-lime)] mb-8 rounded-full" />

              <div className="space-y-5 text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch]">
                <p>
                  The hit rate is the percentage of recent games where a player went over (or under) a given stat line. It&apos;s the most fundamental number on any prop card.
                </p>
                <p>
                  Lasyly shows hit rates across five time windows: the last 5 games (L5), 10 games (L10), 15 games (L15), 20 games (L20), and the full season. Each window tells a different part of the story.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
                <MetricCard label="L5 Hit Rate" value="Last 5" color="#D4FF00">
                  The most reactive signal. A high L5 means the player is hot right now, but it&apos;s also the noisiest — 5 games is a small sample. Use it to confirm a trend, not to establish one.
                </MetricCard>
                <MetricCard label="L10 Hit Rate" value="Last 10" color="#6C63FF">
                  The sweet spot. 10 games smooths out noise while staying recent. Most analytics-focused bettors weight L10 most heavily.
                </MetricCard>
                <MetricCard label="L20 / Season" value="Long-term" color="#F59E0B">
                  The baseline. What a player does on average, regardless of form or matchup. Low L20 hit rates are hard to overcome even with favorable recent trends.
                </MetricCard>
              </div>

              <p className="text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch] mt-8">
                When L5, L10, and season-long rates all point in the same direction — that&apos;s a convergence signal. When they diverge, dig deeper into why.
              </p>
            </section>

            {/* Matchup Grade */}
            <section className="mb-20">
              <h2 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-[var(--color-text-primary)] mb-4">
                Matchup Grade (A–F)
              </h2>
              <div className="w-12 h-[2px] bg-[var(--color-lime)] mb-8 rounded-full" />

              <div className="space-y-5 text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch]">
                <p>
                  The matchup grade rates the opposing team&apos;s defensive ability against the specific stat type you&apos;re looking at. An <strong className="text-[var(--color-text-primary)]">A</strong> means the opposing defense is terrible at stopping that stat. An <strong className="text-[var(--color-text-primary)]">F</strong> means they shut it down.
                </p>
                <p>
                  Grades are calculated from the opponent&apos;s defensive stats against the position over the season. For NBA props, this uses points, rebounds, assists, and 3-pointers allowed per game broken down by defensive rating and position-specific matchups.
                </p>
                <p>
                  The matchup grade is most valuable when it&apos;s consistent with the hit rate. A player with a 70% L10 hit rate on points + an A grade from the opponent = a strong setup. A player with a 70% L10 but an F grade suggests the recent stretch may not continue.
                </p>
              </div>
            </section>

            {/* Confidence Score */}
            <section className="mb-20">
              <h2 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-[var(--color-text-primary)] mb-4">
                Confidence Score (1–5 Stars)
              </h2>
              <div className="w-12 h-[2px] bg-[var(--color-lime)] mb-8 rounded-full" />

              <div className="space-y-5 text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch] mb-10">
                <p>
                  The confidence score combines hit rate, matchup grade, and recent trend signals into a single composite number. It&apos;s an algorithm, not an opinion — but it&apos;s useful as a quick filter.
                </p>
              </div>

              <div className="rounded-[1.5rem] p-[1px] bg-gradient-to-b from-[var(--color-border)] to-transparent max-w-[56ch]">
                <div className="rounded-[calc(1.5rem-1px)] bg-[var(--color-surface)] p-6 md:p-8">
                  <ConfidenceTier stars="5 stars" description="Hit rate is strong across all windows, matchup is favorable, trend is positive. High-priority research target." />
                  <ConfidenceTier stars="4 stars" description="Most signals align. One weak point (e.g., soft matchup but slightly declining trend). Still worth a close look." />
                  <ConfidenceTier stars="3 stars" description="Mixed signals. Some favorable, some not. Requires more manual research." />
                  <ConfidenceTier stars="1–2 stars" description="Hit rate is weak, matchup is unfavorable, or signals conflict significantly. Usually worth skipping." />
                </div>
              </div>

              <p className="text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch] mt-8">
                The confidence score is a research prioritization tool, not a betting instruction. A 5-star prop can lose. A 2-star prop can hit. Use it to decide where to spend your analysis time.
              </p>
            </section>

            {/* Trend Arrow */}
            <section className="mb-20">
              <h2 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-[var(--color-text-primary)] mb-4">
                Trend Arrow
              </h2>
              <div className="w-12 h-[2px] bg-[var(--color-lime)] mb-8 rounded-full" />

              <div className="space-y-5 text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch]">
                <p>
                  The trend arrow shows the direction of a player&apos;s recent performance relative to the prop line. An upward arrow means their actual numbers have been trending above the line. A downward arrow means below.
                </p>
                <p>
                  This is most useful combined with the L5 hit rate. A strong upward trend alongside a high L5 suggests the line may not have fully adjusted yet — which is where value lives.
                </p>
              </div>
            </section>

            {/* Streak Dots */}
            <section className="mb-20">
              <h2 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-[var(--color-text-primary)] mb-4">
                Streak Dots
              </h2>
              <div className="w-12 h-[2px] bg-[var(--color-lime)] mb-8 rounded-full" />

              <div className="space-y-5 text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch]">
                <p>
                  The streak dots are a visual game-by-game record — green for over, red for under — reading left to right from oldest to most recent. They let you see the shape of a player&apos;s performance at a glance.
                </p>
                <p>
                  What to look for: alternating patterns can suggest mean reversion opportunities. Long green streaks may indicate a genuine step-up in play. Long red streaks against a high season-long hit rate might be buying opportunities — or they might indicate injury impact. Always check injury reports alongside the dots.
                </p>
              </div>
            </section>

            {/* Correlations */}
            <section className="mb-20">
              <h2 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-[var(--color-text-primary)] mb-4">
                Correlations
              </h2>
              <div className="w-12 h-[2px] bg-[var(--color-lime)] mb-8 rounded-full" />

              <div className="space-y-5 text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch]">
                <p>
                  The correlations feature shows which other props historically hit at the same time as the one you&apos;re looking at. If Player A goes over his assist line 80% of the time when Player B also goes over his points line, that&apos;s a correlation worth knowing.
                </p>
                <p>
                  Use correlations when building parlays. Correlated legs reduce the independent variance of a parlay — if one hits, the conditions that made it hit are likely to also benefit the correlated leg.
                </p>
              </div>
            </section>

            {/* Line Movement */}
            <section className="mb-20">
              <h2 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-[var(--color-text-primary)] mb-4">
                Line Movement
              </h2>
              <div className="w-12 h-[2px] bg-[var(--color-lime)] mb-8 rounded-full" />

              <div className="space-y-5 text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch]">
                <p>
                  Prop lines move based on bet volume and sharp action. Lasyly tracks line history so you can see where a line started and where it is now.
                </p>
                <p>
                  A line that moved in your favor (e.g., you wanted the over and the line dropped) suggests public money is on the under — which often means there&apos;s value on the over side, since sharp bettors tend to move lines. A line that moved against you adds caution.
                </p>
              </div>
            </section>

            {/* Putting It Together */}
            <section className="mb-20">
              <h2 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-[var(--color-text-primary)] mb-4">
                Putting It All Together
              </h2>
              <div className="w-12 h-[2px] bg-[var(--color-lime)] mb-8 rounded-full" />

              <div className="space-y-5 text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch]">
                <p>
                  The best props emerge when multiple signals converge without contradicting each other.
                </p>
              </div>

              <div className="rounded-[1.5rem] p-[1px] bg-gradient-to-br from-[var(--color-lime)]/20 to-transparent mt-8 max-w-[56ch]">
                <div className="rounded-[calc(1.5rem-1px)] bg-[var(--color-surface)] p-6 md:p-8">
                  <ul className="space-y-4">
                    {[
                      "L10 hit rate ≥ 60%",
                      "Matchup grade B or better",
                      "Trend arrow pointing the same direction as your bet",
                      "Streak dots showing consistent recent form",
                      "Line movement neutral or in your favor",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--color-lime)] shrink-0" />
                        <span className="text-sm text-[var(--color-text-primary)]/80 leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="space-y-5 text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch] mt-8">
                <p>
                  A prop checking all five boxes is rare. Three or four is a solid setup. Two or fewer is usually noise.
                </p>
                <p>
                  Track every prop you bet using the Bet Tracker. Over time, you&apos;ll learn which signal combinations actually perform for you — the platform will surface your personal best-signal analysis automatically.
                </p>
              </div>
            </section>

            {/* CTA — double-bezel */}
            <div className="rounded-[2rem] p-[1px] bg-gradient-to-br from-[#6C63FF]/30 via-transparent to-[var(--color-lime)]/20 max-w-[56ch]">
              <div className="rounded-[calc(2rem-1px)] bg-[var(--color-surface)] p-8 md:p-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
                <p className="text-xl font-bold text-[var(--color-text-primary)] mb-2">See these metrics in action</p>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-6 max-w-[44ch]">
                  Every player prop card on Lasyly shows all the metrics above — updated from real scraped data. Free to explore.
                </p>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 bg-[var(--color-lime)] text-black font-bold text-sm px-6 py-3 rounded-full hover:scale-[0.98] active:scale-[0.96] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
                >
                  Explore prop analytics
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </div>
            </div>
          </article>

          {/* Sidebar */}
          <aside className="hidden md:flex flex-col gap-5 sticky top-24">
            <div className="rounded-[1.25rem] p-[1px] bg-gradient-to-b from-[var(--color-border)] to-transparent">
              <div className="rounded-[calc(1.25rem-1px)] bg-[var(--color-surface)] p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-4">In this post</p>
                <ul className="space-y-2.5">
                  {[
                    "Hit Rate",
                    "Matchup Grade (A–F)",
                    "Confidence Score",
                    "Trend Arrow",
                    "Streak Dots",
                    "Correlations",
                    "Line Movement",
                    "Putting it together",
                  ].map((item) => (
                    <li key={item} className="text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-[1.25rem] p-[1px] bg-gradient-to-b from-[var(--color-border)] to-transparent">
              <div className="rounded-[calc(1.25rem-1px)] bg-[var(--color-surface)] p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-4">More posts</p>
                <ul className="space-y-3">
                  <li>
                    <Link href="/blog/why-share-your-betslip" className="text-[13px] text-[var(--color-text-primary)]/70 hover:text-[var(--color-text-primary)] transition-colors duration-300 leading-snug block">
                      Why Share Your Betslip
                    </Link>
                  </li>
                  <li>
                    <Link href="/blog/nba-player-props-guide" className="text-[13px] text-[var(--color-text-primary)]/70 hover:text-[var(--color-text-primary)] transition-colors duration-300 leading-snug block">
                      The Complete NBA Props Guide
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            <Link
              href="/signup"
              className="block text-center bg-[var(--color-lime)] text-black font-bold text-sm px-5 py-3.5 rounded-full hover:scale-[0.98] active:scale-[0.96] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            >
              Try Lasyly free
            </Link>
          </aside>
        </div>
      </div>
    </BlogNewspaperWrapper>
  )
}
