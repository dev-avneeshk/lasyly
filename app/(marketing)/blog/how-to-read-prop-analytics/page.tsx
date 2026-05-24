import type { Metadata } from "next"
import Link from "next/link"
import { JsonLd } from "@/components/seo/JsonLd"

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
    canonical: "https://lasyly.com/blog/how-to-read-prop-analytics",
  },
}

function MetricCard({ label, value, color, children }: { label: string; value: string; color: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 not-prose">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">{label}</p>
        <span className="text-sm font-bold px-2 py-0.5 rounded-md" style={{ background: `${color}20`, color }}>{value}</span>
      </div>
      <div className="text-sm text-[var(--color-text-muted)] leading-relaxed">{children}</div>
    </div>
  )
}

export default function PropAnalyticsGuidePost() {
  const baseUrl = "https://lasyly.com"
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
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
      <div className="max-w-2xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-10">
          <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
          <span>/</span>
          <span>Analytics</span>
        </div>

        {/* Header */}
        <div className="mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-[#6C63FF] bg-[#6C63FF]/10 px-2.5 py-1 rounded-full">
            Analytics
          </span>
          <h1 className="text-4xl md:text-5xl font-bold font-serif tracking-tight text-white leading-tight mt-5 mb-4">
            How to Read Prop Analytics: Hit Rates, Matchup Grades, and Confidence Scores Explained
          </h1>
          <div className="flex items-center gap-3 text-sm text-[var(--color-text-muted)]">
            <span>May 22, 2026</span>
            <span>·</span>
            <span>8 min read</span>
            <span>·</span>
            <span>Lasyly Team</span>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr_280px] gap-16 items-start">
        <article className="prose prose-invert prose-lg max-w-none
          prose-headings:font-serif prose-headings:font-bold prose-headings:tracking-tight
          prose-p:text-[var(--color-text-muted)] prose-p:leading-relaxed
          prose-li:text-[var(--color-text-muted)]
          prose-strong:text-white
          prose-a:text-[var(--color-lime)] prose-a:no-underline hover:prose-a:underline
        ">
          <p className="text-xl text-white/80 leading-relaxed not-prose mb-8">
            Lasyly surfaces a lot of numbers on every player prop card. If you&apos;ve ever stared at a card and wondered what half of it means, this guide is for you. We&apos;ll break down every metric — what it measures, how it&apos;s calculated, and how to weight it in your decision.
          </p>

          <h2>The Hit Rate — Your Starting Point</h2>
          <p>
            The hit rate is the percentage of recent games where a player went over (or under) a given stat line. It&apos;s the most fundamental number on any prop card.
          </p>
          <p>
            Lasyly shows hit rates across five time windows: the last 5 games (L5), 10 games (L10), 15 games (L15), 20 games (L20), and the full season. Each window tells a different part of the story.
          </p>

          {/* Metric cards */}
          <div className="not-prose grid grid-cols-1 gap-3 my-8">
            <MetricCard label="L5 Hit Rate" value="Last 5 games" color="#D4FF00">
              The most reactive signal. A high L5 means the player is hot right now, but it&apos;s also the noisiest — 5 games is a small sample. Use it to confirm a trend, not to establish one.
            </MetricCard>
            <MetricCard label="L10 Hit Rate" value="Last 10 games" color="#6C63FF">
              The sweet spot. 10 games is enough to smooth out one-game noise while still being recent enough to be relevant. Most analytics-focused bettors weight L10 most heavily.
            </MetricCard>
            <MetricCard label="L20 / Season Hit Rate" value="Long-term" color="#F59E0B">
              The baseline. This tells you what a player does on average, regardless of form or matchup. Low L20 hit rates are hard to overcome even with favorable recent trends.
            </MetricCard>
          </div>

          <p>
            When L5, L10, and season-long rates all point in the same direction — that&apos;s a convergence signal. When they diverge, dig deeper into why.
          </p>

          <h2>Matchup Grade (A–F)</h2>
          <p>
            The matchup grade rates the opposing team&apos;s defensive ability against the specific stat type you&apos;re looking at. An A means the opposing defense is terrible at stopping that stat. An F means they shut it down.
          </p>
          <p>
            Grades are calculated from the opponent&apos;s defensive stats against the position over the season. For NBA props, this uses points, rebounds, assists, and 3-pointers allowed per game broken down by defensive rating and position-specific matchups.
          </p>
          <p>
            The matchup grade is most valuable when it&apos;s consistent with the hit rate. A player with a 70% L10 hit rate on points + an A grade from the opponent = a strong setup. A player with a 70% L10 but an F grade suggests the recent stretch may not continue.
          </p>

          <h2>Confidence Score (1–5 Stars)</h2>
          <p>
            The confidence score combines hit rate, matchup grade, and recent trend signals into a single composite number. It&apos;s an algorithm, not an opinion — but it&apos;s useful as a quick filter.
          </p>
          <p>
            Here&apos;s roughly how to interpret each tier:
          </p>
          <ul>
            <li><strong>5 stars:</strong> Hit rate is strong across all windows, matchup is favorable, trend is positive. High-priority research target.</li>
            <li><strong>4 stars:</strong> Most signals align. One weak point (e.g., soft matchup but slightly declining trend). Still worth a close look.</li>
            <li><strong>3 stars:</strong> Mixed signals. Some favorable, some not. Requires more manual research.</li>
            <li><strong>1–2 stars:</strong> Hit rate is weak, matchup is unfavorable, or signals conflict significantly. Usually worth skipping.</li>
          </ul>
          <p>
            The confidence score is a research prioritization tool, not a betting instruction. A 5-star prop can lose. A 2-star prop can hit. Use it to decide where to spend your analysis time.
          </p>

          <h2>Trend Arrow</h2>
          <p>
            The trend arrow shows the direction of a player&apos;s recent performance relative to the prop line. An upward arrow means their actual numbers have been trending above the line. A downward arrow means below.
          </p>
          <p>
            This is most useful combined with the L5 hit rate. A strong upward trend alongside a high L5 suggests the line may not have fully adjusted yet — which is where value lives.
          </p>

          <h2>Streak Dots</h2>
          <p>
            The streak dots are a visual game-by-game record — green for over, red for under — reading left to right from oldest to most recent. They let you see the shape of a player&apos;s performance at a glance.
          </p>
          <p>
            What to look for: alternating patterns can suggest mean reversion opportunities. Long green streaks may indicate a genuine step-up in play. Long red streaks against a high season-long hit rate might be buying opportunities — or they might indicate injury impact. Always check injury reports alongside the dots.
          </p>

          <h2>Correlations</h2>
          <p>
            The correlations feature shows which other props historically hit at the same time as the one you&apos;re looking at. If Player A goes over his assist line 80% of the time when Player B also goes over his points line, that&apos;s a correlation worth knowing.
          </p>
          <p>
            Use correlations when building parlays. Correlated legs reduce the independent variance of a parlay — if one hits, the conditions that made it hit are likely to also benefit the correlated leg.
          </p>

          <h2>Line Movement</h2>
          <p>
            Prop lines move based on bet volume and sharp action. Lasyly tracks line history so you can see where a line started and where it is now.
          </p>
          <p>
            A line that moved in your favor (e.g., you wanted the over and the line dropped) suggests public money is on the under — which often means there&apos;s value on the over side, since sharp bettors tend to move lines. A line that moved against you adds caution.
          </p>

          <h2>Putting It All Together</h2>
          <p>
            The best props emerge when multiple signals converge without contradicting each other. Here&apos;s a quick checklist:
          </p>
          <ul>
            <li>L10 hit rate ≥ 60%</li>
            <li>Matchup grade B or better</li>
            <li>Trend arrow pointing the same direction as your bet</li>
            <li>Streak dots showing consistent recent form</li>
            <li>Line movement neutral or in your favor</li>
          </ul>
          <p>
            A prop checking all five boxes is rare. Three or four is a solid setup. Two or fewer is usually noise.
          </p>
          <p>
            Track every prop you bet using the Bet Tracker. Over time, you&apos;ll learn which signal combinations actually perform for you — the platform will surface your personal best-signal analysis automatically.
          </p>

          <div className="not-prose mt-12 rounded-2xl border border-[#6C63FF]/20 bg-[#6C63FF]/5 p-6">
            <p className="font-bold text-white text-lg mb-2">See these metrics in action</p>
            <p className="text-[var(--color-text-muted)] text-sm mb-4">
              Every player prop card on Lasyly shows all the metrics above — updated from real scraped data. Free to explore.
            </p>
            <Link
              href="/signup"
              className="inline-block bg-[var(--color-lime)] text-black font-bold text-sm px-5 py-2.5 rounded-full hover:opacity-90 transition-opacity"
            >
              Explore prop analytics →
            </Link>
          </div>
        </article>

        {/* Sidebar */}
        <aside className="hidden md:flex flex-col gap-6 sticky top-24">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-4">In this post</p>
            <ul className="space-y-2.5 text-sm text-[var(--color-text-muted)]">
              <li className="hover:text-white cursor-pointer transition-colors">Hit Rate</li>
              <li className="hover:text-white cursor-pointer transition-colors">Matchup Grade (A–F)</li>
              <li className="hover:text-white cursor-pointer transition-colors">Confidence Score</li>
              <li className="hover:text-white cursor-pointer transition-colors">Trend Arrow</li>
              <li className="hover:text-white cursor-pointer transition-colors">Streak Dots</li>
              <li className="hover:text-white cursor-pointer transition-colors">Correlations</li>
              <li className="hover:text-white cursor-pointer transition-colors">Line Movement</li>
              <li className="hover:text-white cursor-pointer transition-colors">Putting it together</li>
            </ul>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-3">More posts</p>
            <ul className="space-y-3">
              <li>
                <Link href="/blog/why-share-your-betslip" className="text-sm text-white/80 hover:text-white transition-colors leading-snug block">
                  Why Share Your Betslip →
                </Link>
              </li>
              <li>
                <Link href="/blog/nba-player-props-guide" className="text-sm text-white/80 hover:text-white transition-colors leading-snug block">
                  The Complete NBA Props Guide →
                </Link>
              </li>
            </ul>
          </div>

          <Link
            href="/signup"
            className="block text-center bg-[var(--color-lime)] text-black font-bold text-sm px-5 py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            Try Lasyly free →
          </Link>
        </aside>
      </div>
    </div>
  )
}
