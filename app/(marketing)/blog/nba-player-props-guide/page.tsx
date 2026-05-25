import type { Metadata } from "next"
import Link from "next/link"
import { JsonLd } from "@/components/seo/JsonLd"
import BlogPostBackButton from "@/components/blog/BlogPostBackButton"
import BlogNewspaperWrapper from "@/components/blog/BlogNewspaperWrapper"

export const metadata: Metadata = {
  title: "The Complete Guide to NBA Player Props in 2026 — Lasyly Blog",
  description:
    "Points, rebounds, assists, 3-pointers, and beyond. Everything you need to approach NBA player props in 2026 — how to read defensive matchups, find line value, use L10 hit rates, and build smarter parlays.",
  openGraph: {
    title: "The Complete Guide to NBA Player Props in 2026",
    description:
      "Everything you need to approach NBA player props — defensive matchups, line value, hit rates, and smarter parlays.",
    type: "article",
    publishedTime: "2026-05-20",
  },
  alternates: {
    canonical: "https://lasyly.me/blog/nba-player-props-guide",
  },
}

function PropTypeCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[1.25rem] p-[1px] bg-gradient-to-b from-[var(--color-border)] to-transparent">
      <div className="rounded-[calc(1.25rem-1px)] bg-[var(--color-surface)] p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
        <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-3">{title}</h3>
        <div className="text-sm text-[var(--color-text-muted)] leading-relaxed space-y-3">{children}</div>
      </div>
    </div>
  )
}

export default function NbaPropsGuidePost() {
  const baseUrl = "https://lasyly.me"
  return (
    <BlogNewspaperWrapper>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "The Complete Guide to NBA Player Props in 2026",
        "description": "Points, rebounds, assists, 3-pointers, and beyond. Everything you need to approach NBA player props — defensive matchups, line value, hit rates, and correlated parlays.",
        "datePublished": "2026-05-20",
        "dateModified": "2026-05-20",
        "author": { "@type": "Organization", "name": "Lasyly", "url": baseUrl },
        "publisher": {
          "@type": "Organization",
          "name": "Lasyly",
          "url": baseUrl,
          "logo": { "@type": "ImageObject", "url": `${baseUrl}/lasyly_logo.png` },
        },
        "url": `${baseUrl}/blog/nba-player-props-guide`,
        "mainEntityOfPage": { "@type": "WebPage", "@id": `${baseUrl}/blog/nba-player-props-guide` },
        "keywords": ["NBA player props", "NBA betting guide", "prop analytics", "parlay builder", "defensive matchup"],
      }} />

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-16 md:pt-20 md:pb-24">
        <div className="max-w-3xl">
          <BlogPostBackButton sport="NBA" />

          <div className="mb-6">
            <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.2em] text-[#F59E0B] bg-[#F59E0B]/8 px-3 py-1.5 rounded-full border border-[#F59E0B]/15">
              NBA
            </span>
          </div>

          <h1 className="text-[2.5rem] md:text-[3.5rem] lg:text-[4rem] font-bold font-serif tracking-tight text-[var(--color-text-primary)] leading-[1.08] mb-6">
            The Complete Guide to NBA Player Props
          </h1>

          <p className="text-lg md:text-xl text-[var(--color-text-primary)]/60 leading-relaxed max-w-[52ch] mb-8">
            Points, rebounds, assists, 3-pointers, and beyond. Everything you need to approach NBA player props with a data-driven edge.
          </p>

          <div className="flex items-center gap-4 text-sm text-[var(--color-text-muted)]">
            <div className="w-8 h-8 rounded-full bg-[var(--color-surface-elevated)] flex items-center justify-center text-[10px] font-bold text-[var(--color-text-primary)]/60">
              LT
            </div>
            <span>Lasyly Team</span>
            <span className="w-1 h-1 rounded-full bg-[var(--color-text-muted)]" />
            <span>May 20, 2026</span>
            <span className="w-1 h-1 rounded-full bg-[var(--color-text-muted)]" />
            <span>10 min read</span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="h-[1px] bg-gradient-to-r from-[var(--color-border)] via-[var(--color-border)] to-transparent" />
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24">
        <div className="grid md:grid-cols-[1fr_260px] lg:grid-cols-[1fr_300px] gap-12 lg:gap-20 items-start">

          <article className="max-w-none">

            <p className="text-lg text-[var(--color-text-primary)]/70 leading-relaxed mb-16 max-w-[60ch]">
              NBA player props are one of the best betting markets available. High volume, deep data, and a soft market relative to spreads make them consistently exploitable — if you know how to approach them. This guide covers everything from the basics to advanced frameworks.
            </p>

            {/* Why NBA Props */}
            <section className="mb-20">
              <h2 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-[var(--color-text-primary)] mb-4">
                Why NBA Props Are Worth Your Attention
              </h2>
              <div className="w-12 h-[2px] bg-[var(--color-lime)] mb-8 rounded-full" />

              <div className="space-y-5 text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch]">
                <p>
                  The NBA has 82 games per team per season, which means massive historical data sets for every player. Unlike NFL point spreads — where sharp money is concentrated and lines are efficient — the NBA props market is spread thin across hundreds of player-stat combinations per night. That inefficiency creates opportunity.
                </p>
                <p>
                  Sportsbooks set hundreds of player prop lines per game day. They can&apos;t analyze every single one with the same rigor as a game spread. A well-researched bettor with good data has a genuine edge.
                </p>
              </div>
            </section>

            {/* Core Prop Types */}
            <section className="mb-20">
              <h2 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-[var(--color-text-primary)] mb-4">
                The Core Prop Types
              </h2>
              <div className="w-12 h-[2px] bg-[var(--color-lime)] mb-8 rounded-full" />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <PropTypeCard title="Points">
                  <p>
                    The most liquid prop type. Lines are set close to a player&apos;s season average, with adjustment for pace, matchup, and injury. Because it&apos;s the most popular prop, it&apos;s also the most efficiently priced.
                  </p>
                  <p>
                    To find edge: focus on back-to-back games, home/away splits, and pace of play. A player who scores 26 per game but faces a team that plays at the league&apos;s slowest pace is a genuine under candidate.
                  </p>
                </PropTypeCard>
                <PropTypeCard title="Rebounds">
                  <p>
                    More volatile than scoring but often undervalued. The key variable is teammate availability. If a team&apos;s second-best rebounder is out, the starter&apos;s rebound total can jump significantly.
                  </p>
                  <p>
                    Defensive matchup matters less here. What matters most is team rebound share and opposing offensive rebounding rates.
                  </p>
                </PropTypeCard>
                <PropTypeCard title="Assists">
                  <p>
                    Highly sensitive to whether a player&apos;s primary targets are available. If a playmaker&apos;s main scoring options are healthy, his assist potential is strong. If a key shooter is out, his assist line is suspect.
                  </p>
                  <p>
                    Check injury reports obsessively for assist props. The line can become completely wrong within 24 hours of a late-breaking injury.
                  </p>
                </PropTypeCard>
                <PropTypeCard title="3-Pointers Made">
                  <p>
                    High variance, full stop. Even elite shooters will fail to hit a line a significant percentage of the time due to simple variance in a small counting number.
                  </p>
                  <p>
                    Best approach: use 3-PM props as parlay legs for players with extremely high volume of attempts. Also check whether the opposing team gives up corner threes.
                  </p>
                </PropTypeCard>
              </div>
            </section>

            {/* Defensive Matchups */}
            <section className="mb-20">
              <h2 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-[var(--color-text-primary)] mb-4">
                Reading Defensive Matchups
              </h2>
              <div className="w-12 h-[2px] bg-[var(--color-lime)] mb-8 rounded-full" />

              <div className="space-y-5 text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch]">
                <p>
                  This is where most casual bettors leave money on the table. Not all defenses are equal against every position or stat type.
                </p>
                <p>
                  A team that ranks 28th in points allowed to small forwards is a dream matchup for an SF&apos;s points prop — but might be fine against centers. Aggregate defensive stats don&apos;t capture this. Position-specific defensive splits do.
                </p>
                <p>
                  On Lasyly, every prop card shows a matchup grade (A–F) derived from exactly this data — how the opposing team defends that specific player&apos;s position and stat type. An A-grade matchup is a sportsbook pricing in a player&apos;s average without fully adjusting for how bad the opposing defense is against that stat.
                </p>
              </div>
            </section>

            {/* Home/Away */}
            <section className="mb-20">
              <h2 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-[var(--color-text-primary)] mb-4">
                Home/Away Splits
              </h2>
              <div className="w-12 h-[2px] bg-[var(--color-lime)] mb-8 rounded-full" />

              <div className="space-y-5 text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch]">
                <p>
                  Some players have significant home/away splits. Role players on good offensive teams can post inflated home numbers because they&apos;re in better offensive rhythm in front of the home crowd.
                </p>
                <p>
                  The Lasyly prop filters let you isolate home or away game data specifically — so you can build a hit rate using only the relevant context.
                </p>
              </div>
            </section>

            {/* Line Value */}
            <section className="mb-20">
              <h2 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-[var(--color-text-primary)] mb-4">
                Line Value — Finding When a Line Is Wrong
              </h2>
              <div className="w-12 h-[2px] bg-[var(--color-lime)] mb-8 rounded-full" />

              <div className="space-y-5 text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch]">
                <p>
                  A line is &ldquo;wrong&rdquo; when it doesn&apos;t reflect the available information. The most common scenarios:
                </p>
              </div>

              <div className="rounded-[1.5rem] p-[1px] bg-gradient-to-b from-[var(--color-border)] to-transparent mt-8 max-w-[56ch]">
                <div className="rounded-[calc(1.5rem-1px)] bg-[var(--color-surface)] p-6 md:p-8 space-y-5">
                  <div className="border-b border-[var(--color-border)] pb-5">
                    <p className="text-sm font-bold text-[var(--color-text-primary)] mb-2">Late injury scratches</p>
                    <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                      If a key player is ruled out within a few hours of tip-off, related props for teammates often don&apos;t move fast enough.
                    </p>
                  </div>
                  <div className="border-b border-[var(--color-border)] pb-5">
                    <p className="text-sm font-bold text-[var(--color-text-primary)] mb-2">Slow adjustment after role changes</p>
                    <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                      Players who recently moved into starting roles are sometimes still being priced on their season average.
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--color-text-primary)] mb-2">Blowout context</p>
                    <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                      Players in blowout wins play fewer minutes in the fourth quarter. Their prop line might be set for 36 minutes when they&apos;ll play 28.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Correlated Parlays */}
            <section className="mb-20">
              <h2 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-[var(--color-text-primary)] mb-4">
                Building Correlated NBA Parlays
              </h2>
              <div className="w-12 h-[2px] bg-[var(--color-lime)] mb-8 rounded-full" />

              <div className="space-y-5 text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch]">
                <p>
                  Standard parlays assume independence between legs. But in basketball, many outcomes are correlated.
                </p>
                <p>
                  A fast-paced, high-scoring game benefits all players in it. When a team has a slow start, their playmaker tends to run more sets — which boosts assist counts. When a team&apos;s defensive focus is on a star scorer, role players get more open looks.
                </p>
                <p>
                  The Lasyly correlations feature surfaces historically co-occurring props — props that have hit together more often than chance would predict. These are the best candidates for parlay legs because the correlation reduces the &ldquo;true&rdquo; variance of the combined bet.
                </p>
              </div>
            </section>

            {/* Historical vs Recent */}
            <section className="mb-20">
              <h2 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-[var(--color-text-primary)] mb-4">
                Using Historical Data vs. Recent Form
              </h2>
              <div className="w-12 h-[2px] bg-[var(--color-lime)] mb-8 rounded-full" />

              <div className="space-y-5 text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch]">
                <p>
                  There&apos;s a constant tension between season-long baselines and recent form. Here&apos;s the framework:
                </p>
              </div>

              <ul className="mt-6 space-y-4 max-w-[56ch]">
                {[
                  "If season-long and recent form agree — lean in, it's a clean setup.",
                  "If a player is below his season average in L10 — ask whether something fundamental changed (role change, injury, system change) or if it's just variance.",
                  "If a player is above his season average in L10 — same question. Step-change in role? If yes, the higher numbers might persist. If not, the under may have value.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[var(--color-lime)] shrink-0" />
                    <span className="text-sm text-[var(--color-text-muted)] leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Tracking Results */}
            <section className="mb-20">
              <h2 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-[var(--color-text-primary)] mb-4">
                Tracking Your NBA Prop Results
              </h2>
              <div className="w-12 h-[2px] bg-[var(--color-lime)] mb-8 rounded-full" />

              <div className="space-y-5 text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch]">
                <p>
                  The only way to know if your NBA prop strategy has edge is to track it systematically over a sample size large enough to separate luck from skill. A winning month can be variance. A winning year is harder to dismiss.
                </p>
                <p>
                  Log every bet in Lasyly&apos;s tracker — player, stat type, line, direction, odds, and your reasoning. After 100+ bets, the platform will surface your best-performing signals automatically: which confidence score tiers, matchup grades, and stat types are actually returning profit for you specifically.
                </p>
                <p>
                  Everyone&apos;s edge is different. The data will show you yours.
                </p>
              </div>
            </section>

            {/* CTA */}
            <div className="rounded-[2rem] p-[1px] bg-gradient-to-br from-[#F59E0B]/30 via-transparent to-[var(--color-lime)]/20 max-w-[56ch]">
              <div className="rounded-[calc(2rem-1px)] bg-[var(--color-surface)] p-8 md:p-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
                <p className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Research today&apos;s NBA props</p>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-6 max-w-[44ch]">
                  Every game on tonight&apos;s NBA slate. Hit rates, matchup grades, and confidence scores — all computed from real data.
                </p>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 bg-[var(--color-lime)] text-black font-bold text-sm px-6 py-3 rounded-full hover:scale-[0.98] active:scale-[0.96] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
                >
                  View NBA props
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
                    "Why NBA props",
                    "Points, Rebounds, Assists, 3PM",
                    "Reading defensive matchups",
                    "Home / Away splits",
                    "Finding line value",
                    "Correlated parlays",
                    "Historical vs. recent form",
                    "Tracking your results",
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
                    <Link href="/blog/how-to-read-prop-analytics" className="text-[13px] text-[var(--color-text-primary)]/70 hover:text-[var(--color-text-primary)] transition-colors duration-300 leading-snug block">
                      How to Read Prop Analytics
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
