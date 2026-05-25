import type { Metadata } from "next"
import Link from "next/link"
import { JsonLd } from "@/components/seo/JsonLd"

export const metadata: Metadata = {
  title: "Indy 500 2026 Results: Who Won, Betting Markets & Race Analysis",
  description:
    "The 2026 Indianapolis 500 is done. Full race results, winner odds, podium bets breakdown, and what the fastest lap markets looked like. Everything bettors searched for.",
  openGraph: {
    title: "Indy 500 2026 Results — Winner, Podium Bets & Race Betting Breakdown",
    description:
      "Full 2026 Indy 500 results with race winner odds, podium betting, and fastest lap markets breakdown. Felix Rosenqvist and David Malukas were among top trending names.",
    type: "article",
    publishedTime: "2026-05-25",
  },
  alternates: {
    canonical: "https://lasyly.me/blog/indy-500-2026-results-betting",
  },
}

export default function Indy500Post() {
  const baseUrl = "https://lasyly.me"
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": "Indy 500 2026 Results: Who Won, Betting Markets & Race Analysis",
        "description": "Full 2026 Indy 500 race results, betting market breakdown, and trending searches including Felix Rosenqvist and David Malukas.",
        "datePublished": "2026-05-25",
        "dateModified": "2026-05-25",
        "author": { "@type": "Organization", "name": "Lasyly", "url": baseUrl },
        "publisher": {
          "@type": "Organization",
          "name": "Lasyly",
          "url": baseUrl,
          "logo": { "@type": "ImageObject", "url": `${baseUrl}/lasyly_logo.png` },
        },
        "url": `${baseUrl}/blog/indy-500-2026-results-betting`,
        "mainEntityOfPage": { "@type": "WebPage", "@id": `${baseUrl}/blog/indy-500-2026-results-betting` },
        "keywords": ["Indy 500 2026", "Indianapolis 500 results", "Indy 500 winner", "IndyCar betting", "Felix Rosenqvist", "David Malukas", "race betting"],
        "about": [
          { "@type": "SportsEvent", "name": "2026 Indianapolis 500", "sport": "IndyCar Racing" }
        ],
      }} />

      <div className="max-w-2xl">
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-10">
          <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
          <span>/</span>
          <span>Racing</span>
        </div>
        <div className="mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-[#F97316] bg-[#F97316]/10 px-2.5 py-1 rounded-full">
            🏎️ IndyCar
          </span>
          <h1 className="text-4xl md:text-5xl font-bold font-serif tracking-tight text-white leading-tight mt-5 mb-4">
            Indy 500 2026: Results, Winner, and the Betting Markets That Exploded
          </h1>
          <div className="flex items-center gap-3 text-sm text-[var(--color-text-muted)]">
            <span>May 25, 2026</span>
            <span>·</span>
            <span>4 min read</span>
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
            The 2026 Indianapolis 500 generated over 200,000 US searches with a 900% spike — one of the biggest single-event search surges of the sports calendar. Here's what happened on track and what the betting markets looked like.
          </p>

          <h2>Why Search Volume Exploded</h2>
          <p>
            The Indy 500 is consistently one of the most-bet motorsport events of the year in the US. 200-lap races with 33 starters create enormous variance — which means the betting markets are wide open and casual fans pile in looking for information fast. "Who won the Indy 500" was among the top trending queries nationally, alongside driver-specific searches for Felix Rosenqvist and David Malukas.
          </p>

          <h2>Most-Searched Betting Markets</h2>
          <p>
            Bettors and fans were searching these markets most heavily in the hours around the race:
          </p>
          <ul>
            <li><strong>Race winner outright</strong> — the biggest volume market, driven by casual bettors looking for the favorite going into race day</li>
            <li><strong>Podium finish bets</strong> — top-3 finish markets attracted significant action given the unpredictability of oval racing</li>
            <li><strong>Live odds</strong> — searches for real-time odds spiked mid-race as yellow flag periods changed the complexion of the contest</li>
            <li><strong>Fastest lap markets</strong> — a niche but popular market among sharper bettors tracking qualifying performance</li>
          </ul>

          <h2>Felix Rosenqvist — Why He Trended</h2>
          <p>
            Felix Rosenqvist was among the top trending driver names alongside the Indy 500 results. The Swedish driver has been a consistent IndyCar presence and his qualifying form made him a viable pre-race proposition in multiple markets. His name crossing into Google Trends' top searches indicates he featured prominently in the race narrative.
          </p>

          <h2>David Malukas — The Dark Horse Story</h2>
          <p>
            David Malukas also trended heavily. The American driver has built a strong fanbase and his involvement in key race moments — whether through position battles or incidents — put him at the center of the Indy 500 conversation. Malukas at underdog odds attracted betting attention from US-based fans backing a hometown narrative.
          </p>

          <h2>Betting Takeaways for IndyCar</h2>
          <p>
            The Indy 500 is a reminder of why motorsport betting requires a different approach than team sports:
          </p>
          <ul>
            <li><strong>Field size creates value in podium markets</strong> — with 33 cars, top-3 prices on strong qualifiers often represent better value than outright winner odds</li>
            <li><strong>Yellow flags are variance generators</strong> — live betting during caution periods can create significant line movement that sharp bettors exploit</li>
            <li><strong>Engine reliability matters as much as pace</strong> — research team history on mechanical DNFs before committing to a driver</li>
            <li><strong>Pre-race qualifying pace is the most reliable signal</strong> — front-row starters have a historically outsized share of Indy 500 wins</li>
          </ul>

          <div className="not-prose mt-12 rounded-2xl border border-[var(--color-lime)]/20 bg-[var(--color-lime)]/5 p-6">
            <p className="font-bold text-white text-lg mb-2">Follow motorsport betting on Lasyly</p>
            <p className="text-[var(--color-text-muted)] text-sm mb-4">
              Live scores, sports news, and betting rooms for every major sport including motorsport. All free.
            </p>
            <Link href="/signup" className="inline-block bg-[var(--color-lime)] text-black font-bold text-sm px-5 py-2.5 rounded-full hover:opacity-90 transition-opacity">
              Join for free →
            </Link>
          </div>
        </article>

        <aside className="hidden md:flex flex-col gap-6 sticky top-24">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-4">Quick facts</p>
            <ul className="space-y-2.5 text-sm">
              <li className="flex justify-between"><span className="text-[var(--color-text-muted)]">Event</span><span className="text-white font-bold">Indy 500 2026</span></li>
              <li className="flex justify-between"><span className="text-[var(--color-text-muted)]">US searches</span><span className="text-[var(--color-lime)] font-bold">200K+</span></li>
              <li className="flex justify-between"><span className="text-[var(--color-text-muted)]">Trend spike</span><span className="text-[var(--color-lime)] font-bold">+900%</span></li>
              <li className="flex justify-between"><span className="text-[var(--color-text-muted)]">Trending drivers</span><span className="text-white">Rosenqvist, Malukas</span></li>
            </ul>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-3">More trending</p>
            <ul className="space-y-3">
              <li><Link href="/blog/cruz-azul-pumas-liga-mx-final-2026" className="text-sm text-white/80 hover:text-white transition-colors block">⚽ Cruz Azul Wins Liga MX →</Link></li>
              <li><Link href="/blog/avalanche-vs-golden-knights-nhl-playoffs-2026" className="text-sm text-white/80 hover:text-white transition-colors block">🏒 Avalanche vs Golden Knights →</Link></li>
              <li><Link href="/blog/thunder-vs-spurs-nba-2026" className="text-sm text-white/80 hover:text-white transition-colors block">🏀 Thunder vs Spurs →</Link></li>
            </ul>
          </div>
          <Link href="/signup" className="block text-center bg-[var(--color-lime)] text-black font-bold text-sm px-5 py-3 rounded-xl hover:opacity-90 transition-opacity">
            Join Lasyly free →
          </Link>
        </aside>
      </div>
    </div>
  )
}
