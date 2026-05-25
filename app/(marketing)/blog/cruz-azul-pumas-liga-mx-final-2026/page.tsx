import type { Metadata } from "next"
import Link from "next/link"
import { JsonLd } from "@/components/seo/JsonLd"

export const metadata: Metadata = {
  title: "Cruz Azul Wins Liga MX Clausura 2026: Pumas vs Cruz Azul Final Recap & Betting Analysis",
  description:
    "Cruz Azul won the Liga MX Clausura 2026 title with a stoppage-time winner from Rodolfo Rotondi. Full match recap, betting odds breakdown, and what bettors need to know.",
  openGraph: {
    title: "Cruz Azul Wins Liga MX Clausura 2026 Final — Pumas vs Cruz Azul Recap",
    description:
      "Cruz Azul beat Pumas UNAM 2-1 in the Liga MX Clausura Final. Rodolfo Rotondi scored the stoppage-time winner. Betting breakdown inside.",
    type: "article",
    publishedTime: "2026-05-25",
  },
  alternates: {
    canonical: "https://lasyly.me/blog/cruz-azul-pumas-liga-mx-final-2026",
  },
}

export default function CruzAzulPumasPost() {
  const baseUrl = "https://lasyly.me"
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": "Cruz Azul Wins Liga MX Clausura 2026: Pumas vs Cruz Azul Final Recap & Betting Analysis",
        "description": "Cruz Azul beat Pumas UNAM 2-1 with a Rodolfo Rotondi stoppage-time winner to clinch the Liga MX Clausura 2026 title.",
        "datePublished": "2026-05-25",
        "dateModified": "2026-05-25",
        "author": { "@type": "Organization", "name": "Lasyly", "url": baseUrl },
        "publisher": {
          "@type": "Organization",
          "name": "Lasyly",
          "url": baseUrl,
          "logo": { "@type": "ImageObject", "url": `${baseUrl}/lasyly_logo.png` },
        },
        "url": `${baseUrl}/blog/cruz-azul-pumas-liga-mx-final-2026`,
        "mainEntityOfPage": { "@type": "WebPage", "@id": `${baseUrl}/blog/cruz-azul-pumas-liga-mx-final-2026` },
        "keywords": ["Liga MX Final 2026", "Cruz Azul", "Pumas UNAM", "Rodolfo Rotondi", "Liga MX betting", "Liga MX Clausura"],
        "about": [
          { "@type": "SportsEvent", "name": "Liga MX Clausura Final 2026", "sport": "Soccer" }
        ],
      }} />

      <div className="max-w-2xl">
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-10">
          <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
          <span>/</span>
          <span>Soccer</span>
        </div>
        <div className="mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-[#4ADE80] bg-[#4ADE80]/10 px-2.5 py-1 rounded-full">
            ⚽ Liga MX
          </span>
          <h1 className="text-4xl md:text-5xl font-bold font-serif tracking-tight text-white leading-tight mt-5 mb-4">
            Cruz Azul Wins Liga MX Clausura 2026: Pumas Final Recap & Betting Breakdown
          </h1>
          <div className="flex items-center gap-3 text-sm text-[var(--color-text-muted)]">
            <span>May 25, 2026</span>
            <span>·</span>
            <span>5 min read</span>
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
            Cruz Azul are Liga MX Clausura 2026 champions. Rodolfo Rotondi's stoppage-time winner gave La Máquina a 2-1 victory over Pumas UNAM in the second leg, sealing the title on aggregate after a goalless first leg.
          </p>

          <h2>What Happened — Match Recap</h2>
          <p>
            The first leg at Estadio Azteca ended 0-0, leaving everything open for the return fixture. In the second leg, Pumas drew first blood and briefly looked like they might pull off the upset. Cruz Azul responded through an own goal to level proceedings, setting up a tense finale.
          </p>
          <p>
            With the match seemingly heading to extra time, Rodolfo Rotondi — who had been one of Cruz Azul's most consistent performers across the Clausura — latched onto a late chance and drove it home in stoppage time. The stadium erupted. Cruz Azul had their title.
          </p>
          <p>
            Pumas ended the night with 10 men after a red card in the closing stages, compounding their misery and snuffing out any hope of a late equalizer.
          </p>

          <h2>Key Moments</h2>
          <ul>
            <li><strong>First leg:</strong> 0-0 at Estadio Azteca — a tight, tactical affair with few clear chances</li>
            <li><strong>Second leg:</strong> Pumas scored first to take the lead on the night</li>
            <li><strong>Cruz Azul equalizer:</strong> An own goal brought La Máquina level</li>
            <li><strong>Rotondi winner:</strong> Stoppage-time goal clinched the Clausura title for Cruz Azul</li>
            <li><strong>Red card:</strong> Pumas reduced to 10 men late, ending their hopes of a comeback</li>
          </ul>

          <h2>Why This Was the Biggest US Sports Trend</h2>
          <p>
            Pumas vs Cruz Azul generated over 200K+ searches in the US with a 1,000% search volume spike, making it the top trending sports event nationally. Liga MX consistently pulls massive engagement in the US — the sport's fanbase stretches coast to coast, and finals between Mexico City clubs always capture mainstream attention.
          </p>
          <p>
            Cruz Azul's status as a historically dominant club combined with Pumas' underdog narrative made this one of the most-watched Liga MX finals in recent years.
          </p>

          <h2>Betting Markets — What the Odds Said</h2>
          <p>
            Going into the second leg, the betting markets reflected the tight nature of the tie:
          </p>
          <ul>
            <li><strong>Cruz Azul were slight favorites</strong> to win the leg on most books, with Pumas available at solid underdog prices</li>
            <li><strong>Draw odds were considered valuable</strong> — given the first leg ended 0-0 and both teams were cautious tactically</li>
            <li><strong>Under 2.5 goals</strong> was the sharpest market play — low-scoring games were expected given the stakes and both teams' defensive discipline in the first leg</li>
            <li><strong>Both Teams to Score (BTTS)</strong> was split roughly 50/50 heading in, but cautious bettors leaned "No BTTS" given the cagey first leg</li>
          </ul>
          <p>
            The final result — 2-1 with a stoppage-time goal — paid out Cruz Azul moneyline bettors and satisfied the Over 1.5 goals market, but caught out those who had backed Under 1.5.
          </p>

          <h2>Rodolfo Rotondi — The Hero</h2>
          <p>
            Rotondi's winner cements his place in Cruz Azul folklore. The Argentine had been a consistent performer throughout the Clausura, and his ability to stay composed in the biggest moment of the season defined Cruz Azul's championship run. Expect his name to trend heavily in prop markets for Cruz Azul's next campaign.
          </p>

          <h2>What Bettors Should Track Next</h2>
          <p>
            Cruz Azul will enter the Apertura as defending champions and likely favorites in many markets. Key angles to monitor:
          </p>
          <ul>
            <li>Cruz Azul to retain the title in Apertura 2026 — expect this futures market to open with competitive odds</li>
            <li>Rotondi anytime scorer prices in early Apertura fixtures</li>
            <li>Whether Pumas rebuild significantly — their squad depth will determine their next title odds</li>
          </ul>

          <div className="not-prose mt-12 rounded-2xl border border-[var(--color-lime)]/20 bg-[var(--color-lime)]/5 p-6">
            <p className="font-bold text-white text-lg mb-2">Track Liga MX prop bets on Lasyly</p>
            <p className="text-[var(--color-text-muted)] text-sm mb-4">
              Get hit rates, matchup grades, and live scores for soccer across Liga MX, MLS, La Liga and more.
            </p>
            <Link href="/signup" className="inline-block bg-[var(--color-lime)] text-black font-bold text-sm px-5 py-2.5 rounded-full hover:opacity-90 transition-opacity">
              Start for free →
            </Link>
          </div>
        </article>

        <aside className="hidden md:flex flex-col gap-6 sticky top-24">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-4">Quick facts</p>
            <ul className="space-y-2.5 text-sm">
              <li className="flex justify-between"><span className="text-[var(--color-text-muted)]">Result</span><span className="text-white font-bold">Cruz Azul 2-1 Pumas</span></li>
              <li className="flex justify-between"><span className="text-[var(--color-text-muted)]">First leg</span><span className="text-white">0-0</span></li>
              <li className="flex justify-between"><span className="text-[var(--color-text-muted)]">Winner</span><span className="text-white">Rotondi (90+)</span></li>
              <li className="flex justify-between"><span className="text-[var(--color-text-muted)]">US searches</span><span className="text-[var(--color-lime)] font-bold">200K+</span></li>
              <li className="flex justify-between"><span className="text-[var(--color-text-muted)]">Trend spike</span><span className="text-[var(--color-lime)] font-bold">+1,000%</span></li>
            </ul>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-3">More trending</p>
            <ul className="space-y-3">
              <li><Link href="/blog/indy-500-2026-results-betting" className="text-sm text-white/80 hover:text-white transition-colors block">🏎️ Indy 500 2026 Results →</Link></li>
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
