import type { Metadata } from "next"
import Link from "next/link"
import { JsonLd } from "@/components/seo/JsonLd"
import BlogPostBackButton from "@/components/blog/BlogPostBackButton"

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

export default function NbaPropsGuidePost() {
  const baseUrl = "https://lasyly.me"
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
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
      <div className="max-w-2xl">
        {/* Back navigation — context-aware */}
        <BlogPostBackButton sport="NBA" />

        {/* Header */}
        <div className="mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-[#F59E0B] bg-[#F59E0B]/10 px-2.5 py-1 rounded-full">
            NBA
          </span>
          <h1 className="text-4xl md:text-5xl font-bold font-serif tracking-tight text-white leading-tight mt-5 mb-4">
            The Complete Guide to NBA Player Props in 2026
          </h1>
          <div className="flex items-center gap-3 text-sm text-[var(--color-text-muted)]">
            <span>May 20, 2026</span>
            <span>·</span>
            <span>10 min read</span>
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
            NBA player props are one of the best betting markets available. High volume, deep data, and a soft market relative to spreads make them consistently exploitable — if you know how to approach them. This guide covers everything from the basics to advanced frameworks.
          </p>

          <h2>Why NBA Props Are Worth Your Attention</h2>
          <p>
            The NBA has 82 games per team per season, which means massive historical data sets for every player. Unlike NFL point spreads — where sharp money is concentrated and lines are efficient — the NBA props market is spread thin across hundreds of player-stat combinations per night. That inefficiency creates opportunity.
          </p>
          <p>
            Sportsbooks set hundreds of player prop lines per game day. They can&apos;t analyze every single one with the same rigor as a game spread. A well-researched bettor with good data has a genuine edge.
          </p>

          <h2>The Core Prop Types — and How to Approach Each</h2>

          <h3>Points</h3>
          <p>
            The most liquid prop type. Lines are set close to a player&apos;s season average, with adjustment for pace, matchup, and injury. Because it&apos;s the most popular prop, it&apos;s also the most efficiently priced.
          </p>
          <p>
            To find edge in points props, focus on situational factors: back-to-back games (players often underperform in the second leg), home/away splits for certain players, and pace of play. A player who scores 26 per game but faces a team that plays at the league&apos;s slowest pace is a genuine under candidate regardless of his season average.
          </p>

          <h3>Rebounds</h3>
          <p>
            Rebounding props are more volatile than scoring but often undervalued. The key variable is teammate availability. If a team&apos;s second-best rebounder is out, the starter&apos;s rebound total can jump significantly — and sportsbooks don&apos;t always adjust lines fast enough.
          </p>
          <p>
            Defensive matchup matters less here than it does for scoring. What matters most is team rebound share and whether opposing big men have good offensive rebounding rates.
          </p>

          <h3>Assists</h3>
          <p>
            Assist props are highly sensitive to whether a player&apos;s primary targets are available. If a playmaker&apos;s main scoring options are healthy, his assist potential is strong. If a key shooter is out, his assist line is suspect.
          </p>
          <p>
            Check injury reports obsessively for assist props. The line can become completely wrong within 24 hours of a late-breaking injury.
          </p>

          <h3>3-Pointers Made</h3>
          <p>
            3-PM props are high variance, full stop. Even shooters with elite hit rates on 3-PM props will fail to hit a line a significant percentage of the time due to simple variance in a small counting number.
          </p>
          <p>
            The best approach: use 3-PM props as parlay legs for players who have an extremely high volume of 3-point attempts. High volume absorbs some variance. Also check whether the opposing team gives up corner threes — some defenses shade toward the arc, inflating catch-and-shoot opportunities.
          </p>

          <h2>Reading Defensive Matchups</h2>
          <p>
            This is where most casual bettors leave money on the table. Not all defenses are equal against every position or stat type.
          </p>
          <p>
            A team that ranks 28th in points allowed to small forwards is a dream matchup for an SF&apos;s points prop — but might be fine against centers. Aggregate defensive stats (points allowed per game) don&apos;t capture this. Position-specific defensive splits do.
          </p>
          <p>
            On Lasyly, every prop card shows a matchup grade (A–F) derived from exactly this data — how the opposing team defends that specific player&apos;s position and stat type. An A-grade matchup is a sportsbook pricing in a player&apos;s average without fully adjusting for how bad the opposing defense is against that stat.
          </p>

          <h2>Home/Away Splits</h2>
          <p>
            Some players have significant home/away splits. Role players on good offensive teams can post inflated home numbers because they&apos;re in better offensive rhythm in front of the home crowd. Travel affects some players more than others.
          </p>
          <p>
            The Lasyly prop filters let you isolate home or away game data specifically — so you can build a hit rate using only the relevant context.
          </p>

          <h2>Line Value — Finding When a Line Is Wrong</h2>
          <p>
            A line is "wrong" when it doesn&apos;t reflect the available information. Here are the most common scenarios where props are mispriced:
          </p>
          <ul>
            <li>
              <strong>Late injury scratches:</strong> If a key player is ruled out within a few hours of tip-off, related props for teammates often don&apos;t move fast enough. A playmaker&apos;s assist line might be set at 6.5 before his primary scorer&apos;s injury is confirmed.
            </li>
            <li>
              <strong>Slow line adjustment after role changes:</strong> Players who recently moved into starting roles or had usage changes in the last 5–7 games are sometimes still being priced on their season average.
            </li>
            <li>
              <strong>Blowout context:</strong> Players in wins that get out of hand early often play fewer minutes in the fourth quarter. Their raw per-game averages include garbage time and competitive games — but if a player consistently plays fewer minutes in uncompetitive games, his prop line might be set for 36 minutes when he&apos;ll play 28.
            </li>
          </ul>

          <h2>Building Correlated NBA Parlays</h2>
          <p>
            Standard parlays assume independence between legs — each leg has no relationship to the others. But in basketball, many outcomes are correlated.
          </p>
          <p>
            A fast-paced, high-scoring game benefits all players in it. When a team has a slow start, their playmaker tends to run more sets — which boosts assist counts. When a team&apos;s defensive focus is on a star scorer, role players in that team&apos;s opponent get more open looks.
          </p>
          <p>
            The Lasyly correlations feature surfaces historically co-occurring props — props that have hit together more often than chance would predict. These are the best candidates for parlay legs because the correlation reduces the "true" variance of the combined bet.
          </p>

          <h2>Using Historical Data vs. Recent Form</h2>
          <p>
            There&apos;s a constant tension between season-long baselines and recent form. Here&apos;s the framework:
          </p>
          <ul>
            <li>If season-long and recent form agree — lean in, it&apos;s a clean setup.</li>
            <li>If a player is below his season average in L10 — ask whether something fundamental changed (role change, injury, system change) or if it&apos;s just variance. If it&apos;s variance, consider the under as a fading-hot-player opportunity.</li>
            <li>If a player is above his season average in L10 — same question. Step-change in role? If yes, the higher numbers might persist. If not, the line may have overcorrected and the under has value.</li>
          </ul>

          <h2>Tracking Your NBA Prop Results</h2>
          <p>
            The only way to know if your NBA prop strategy has edge is to track it systematically over a sample size large enough to separate luck from skill. A winning month can be variance. A winning year is harder to dismiss.
          </p>
          <p>
            Log every bet in Lasyly&apos;s tracker — player, stat type, line, direction, odds, and your reasoning. After 100+ bets, the platform will surface your best-performing signals automatically: which confidence score tiers, matchup grades, and stat types are actually returning profit for you specifically.
          </p>
          <p>
            Everyone&apos;s edge is different. The data will show you yours.
          </p>

          <div className="not-prose mt-12 rounded-2xl border border-[#F59E0B]/20 bg-[#F59E0B]/5 p-6">
            <p className="font-bold text-white text-lg mb-2">Research today&apos;s NBA props</p>
            <p className="text-[var(--color-text-muted)] text-sm mb-4">
              Every game on tonight&apos;s NBA slate. Hit rates, matchup grades, and confidence scores — all computed from real data.
            </p>
            <Link
              href="/signup"
              className="inline-block bg-[var(--color-lime)] text-black font-bold text-sm px-5 py-2.5 rounded-full hover:opacity-90 transition-opacity"
            >
              View NBA props →
            </Link>
          </div>
        </article>

        {/* Sidebar */}
        <aside className="hidden md:flex flex-col gap-6 sticky top-24">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-4">In this post</p>
            <ul className="space-y-2.5 text-sm text-[var(--color-text-muted)]">
              <li className="hover:text-white cursor-pointer transition-colors">Why NBA props</li>
              <li className="hover:text-white cursor-pointer transition-colors">Points, Rebounds, Assists, 3PM</li>
              <li className="hover:text-white cursor-pointer transition-colors">Reading defensive matchups</li>
              <li className="hover:text-white cursor-pointer transition-colors">Home / Away splits</li>
              <li className="hover:text-white cursor-pointer transition-colors">Finding line value</li>
              <li className="hover:text-white cursor-pointer transition-colors">Correlated parlays</li>
              <li className="hover:text-white cursor-pointer transition-colors">Historical vs. recent form</li>
              <li className="hover:text-white cursor-pointer transition-colors">Tracking your results</li>
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
                <Link href="/blog/how-to-read-prop-analytics" className="text-sm text-white/80 hover:text-white transition-colors leading-snug block">
                  How to Read Prop Analytics →
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
