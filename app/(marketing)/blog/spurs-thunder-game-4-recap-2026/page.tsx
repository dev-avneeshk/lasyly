import type { Metadata } from "next"
import Link from "next/link"
import { JsonLd } from "@/components/seo/JsonLd"
import BlogPostBackButton from "@/components/blog/BlogPostBackButton"
import BlogNewspaperWrapper from "@/components/blog/BlogNewspaperWrapper"

export const metadata: Metadata = {
  title: "Spurs Beat Thunder Game 4: Wembanyama 33 Pts, OKC Series Tied 2-2 — Lasyly",
  description:
    "Victor Wembanyama scores 33 points, 8 rebounds, 5 assists and 3 blocks as the San Antonio Spurs rout the Oklahoma City Thunder 103-82 in Game 4. Western Conference Finals series tied 2-2. Full recap, box score analysis, and betting takeaways.",
  openGraph: {
    title: "Spurs Beat Thunder 103-82 in Game 4 — Wembanyama 33 Pts, Series Tied 2-2",
    description:
      "Wembanyama drops 33 points as San Antonio dominates OKC 103-82 to even the West Finals at 2-2. Full Game 4 recap, player grades, and NBA prop betting angles for Game 5.",
    type: "article",
    publishedTime: "2026-05-25",
  },
  alternates: {
    canonical: "https://lasyly.me/blog/spurs-thunder-game-4-recap-2026",
  },
  keywords: [
    "Spurs Thunder Game 4",
    "Wembanyama 33 points",
    "OKC vs Spurs Game 4 recap",
    "NBA Western Conference Finals 2026",
    "Thunder Spurs series 2-2",
    "Shai Gilgeous-Alexander",
    "NBA playoffs 2026",
    "Victor Wembanyama props",
    "Game 5 betting",
    "NBA betting recap",
  ],
}

const boxScore = [
  { player: "V. Wembanyama (SAS)", pts: 33, reb: 8, ast: 5, pm: "+29", highlight: true },
  { player: "S. Castle (SAS)", pts: 13, reb: 3, ast: 6, pm: "+25", highlight: false },
  { player: "D. Vassell (SAS)", pts: 13, reb: 6, ast: 3, pm: "+27", highlight: false },
  { player: "D. Fox (SAS)", pts: 12, reb: 10, ast: 5, pm: "-3", highlight: false },
  { player: "SGA (OKC)", pts: 19, reb: 4, ast: 7, pm: "-18", highlight: false },
  { player: "I. Hartenstein (OKC)", pts: 12, reb: 7, ast: 3, pm: "-16", highlight: false },
  { player: "C. Holmgren (OKC)", pts: 10, reb: 9, ast: 2, pm: "+2", highlight: false },
]

const schedule = [
  { g: "Game 1", r: "SAS 122 – OKC 115 (2OT)", done: true },
  { g: "Game 2", r: "OKC 122 – SAS 113", done: true },
  { g: "Game 3", r: "OKC 123 – SAS 108", done: true },
  { g: "Game 4", r: "SAS 103 – OKC 82", done: true },
  { g: "Game 5", r: "Tue 8:30 PM ET @ OKC", done: false },
  { g: "Game 6", r: "Thu 8:30 PM ET @ SAS", done: false },
  { g: "Game 7", r: "Sat 8 PM ET @ OKC (if needed)", done: false },
]

export default function SpursThunderGame4Post() {
  const baseUrl = "https://lasyly.me"
  return (
    <BlogNewspaperWrapper>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          headline: "Spurs Beat Thunder 103-82 in Game 4: Wembanyama 33 Points, Western Conference Finals Tied 2-2",
          description: "Victor Wembanyama scores 33 points with 8 rebounds, 5 assists, and 3 blocks as the San Antonio Spurs rout the Oklahoma City Thunder 103-82 in Game 4 of the Western Conference Finals, evening the series at 2-2.",
          datePublished: "2026-05-25",
          dateModified: "2026-05-25",
          author: { "@type": "Organization", name: "Lasyly", url: baseUrl },
          publisher: { "@type": "Organization", name: "Lasyly", url: baseUrl, logo: { "@type": "ImageObject", url: `${baseUrl}/lasyly_logo.png` } },
          url: `${baseUrl}/blog/spurs-thunder-game-4-recap-2026`,
          mainEntityOfPage: { "@type": "WebPage", "@id": `${baseUrl}/blog/spurs-thunder-game-4-recap-2026` },
          keywords: ["Spurs Thunder Game 4", "Wembanyama 33 points", "NBA Western Conference Finals 2026", "Shai Gilgeous-Alexander", "OKC vs Spurs recap", "NBA playoffs 2026"],
          about: [{ "@type": "SportsEvent", name: "San Antonio Spurs vs Oklahoma City Thunder — WCF Game 4", sport: "Basketball", startDate: "2026-05-25", location: { "@type": "Place", name: "Frost Bank Center", address: "San Antonio, TX" } }],
        }}
      />

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-16 md:pt-20 md:pb-24">
        <div className="max-w-3xl">
          <BlogPostBackButton sport="NBA" />

          <div className="mb-6">
            <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.2em] text-[#F59E0B] bg-[#F59E0B]/8 px-3 py-1.5 rounded-full border border-[#F59E0B]/15">
              NBA Playoffs
            </span>
          </div>

          <h1 className="text-[2.5rem] md:text-[3.5rem] lg:text-[4rem] font-bold font-serif tracking-tight text-[var(--color-text-primary)] leading-[1.08] mb-6">
            Wembanyama 33 Pts: Spurs Rout Thunder 103-82, Even West Finals at 2-2
          </h1>

          <p className="text-lg md:text-xl text-[var(--color-text-primary)]/60 leading-relaxed max-w-[52ch] mb-8">
            Victor Wembanyama was dominant, the Spurs&#39; defense was suffocating, and OKC had their worst offensive showing in years.
          </p>

          <div className="flex items-center gap-4 text-sm text-[var(--color-text-muted)]">
            <div className="w-8 h-8 rounded-full bg-[var(--color-surface-elevated)] flex items-center justify-center text-[10px] font-bold text-[var(--color-text-primary)]/60">
              LT
            </div>
            <span>Lasyly Team</span>
            <span className="w-1 h-1 rounded-full bg-[var(--color-text-muted)]" />
            <span>May 25, 2026</span>
            <span className="w-1 h-1 rounded-full bg-[var(--color-text-muted)]" />
            <span>7 min read</span>
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

          <article className="max-w-none">

            <p className="text-lg text-[var(--color-text-primary)]/70 leading-relaxed mb-12 max-w-[60ch]">
              Victor Wembanyama was dominant, the Spurs&#39; defense was suffocating, and the Oklahoma City Thunder had their worst offensive showing in years. San Antonio beats OKC 103-82 in Game 4 of the Western Conference Finals to level the series at 2-2. Game 5 is Tuesday in Oklahoma City.
            </p>

            {/* Score card */}
            <div className="rounded-[1.5rem] p-[1px] bg-gradient-to-br from-[var(--color-lime)]/20 via-transparent to-[#F59E0B]/15 mb-16 max-w-[56ch]">
              <div className="rounded-[calc(1.5rem-1px)] bg-[var(--color-surface)] p-6 md:p-8 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-5">
                  Game 4 Final — May 25, 2026 — Frost Bank Center
                </p>
                <div className="flex items-center justify-between gap-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-[var(--color-text-primary)]/60">82</p>
                    <p className="text-sm text-[var(--color-text-muted)] mt-1">OKC Thunder</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">FINAL</p>
                    <p className="text-xs text-[var(--color-lime)] font-bold mt-1">Series 2-2</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-[var(--color-lime)]">103</p>
                    <p className="text-sm text-[var(--color-text-muted)] mt-1">SA Spurs</p>
                  </div>
                </div>
                <div className="mt-5 pt-5 border-t border-[var(--color-border)] grid grid-cols-4 gap-2 text-center text-xs">
                  {[{ label: "Q1", okc: "19", sa: "28" }, { label: "Q2", okc: "19", sa: "22" }, { label: "Q3", okc: "22", sa: "28" }, { label: "Q4", okc: "22", sa: "25" }].map((q) => (
                    <div key={q.label}>
                      <p className="text-[var(--color-text-muted)] mb-1">{q.label}</p>
                      <p className="text-[var(--color-text-primary)]/50">{q.okc}</p>
                      <p className="text-[var(--color-lime)] font-bold">{q.sa}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Wembanyama section */}
            <section className="mb-20">
              <h2 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-[var(--color-text-primary)] mb-4">
                Wembanyama Was on Another Level
              </h2>
              <div className="w-12 h-[2px] bg-[var(--color-lime)] mb-8 rounded-full" />

              <div className="space-y-5 text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch]">
                <p>
                  Victor Wembanyama finished with <strong className="text-[var(--color-text-primary)]">33 points, 8 rebounds, 5 assists, 2 steals, and 3 blocks</strong> on 11-of-22 shooting, including 3-of-7 from three. He also hit a remarkable 42-foot buzzer-beater to close the first half.
                </p>
                <p>
                  Wembanyama said after Game 3 that he needed to be better to make his teammates better. He delivered. His performance followed an honest self-assessment after OKC&#39;s 123-108 win on Friday, and the Spurs&#39; entire operation reset around him.
                </p>
                <p>
                  Across the Western Conference Finals, Wembanyama is now averaging more than 30 points per game — a threshold no other player in the NBA&#39;s final four has crossed this postseason, including MVP Shai Gilgeous-Alexander.
                </p>
              </div>
            </section>

            {/* Defense section */}
            <section className="mb-20">
              <h2 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-[var(--color-text-primary)] mb-4">
                Spurs&#39; Defense Shut Down the Thunder
              </h2>
              <div className="w-12 h-[2px] bg-[var(--color-lime)] mb-8 rounded-full" />

              <div className="space-y-5 text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch]">
                <p>
                  San Antonio held Oklahoma City to <strong className="text-[var(--color-text-primary)]">33% shooting from the field and 18% from three (6-of-33)</strong>. For context: entering Game 4, OKC&#39;s worst 3-point performance of the playoffs was 30.4% against Phoenix in the first round. Sunday night was 12 percentage points worse.
                </p>
                <p>
                  The key adjustment was the Spurs abandoning their high trap on Shai Gilgeous-Alexander in favor of collapsing nearby defenders at the nail. The result: no more wide-open corner threes for OKC role players, and SGA forced into contested pull-ups.
                </p>
                <p>
                  San Antonio also had <strong className="text-[var(--color-text-primary)]">11 steals and 10 blocks</strong> — an extraordinary combined stat for a single playoff game.
                </p>
              </div>
            </section>

            {/* SGA section */}
            <section className="mb-20">
              <h2 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-[var(--color-text-primary)] mb-4">
                SGA Held to 19 Points
              </h2>
              <div className="w-12 h-[2px] bg-[var(--color-lime)] mb-8 rounded-full" />

              <div className="space-y-5 text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch]">
                <p>
                  Shai Gilgeous-Alexander finished with just 19 points on 6-of-15 shooting. He was the eighth-highest scorer in the game. OKC bettors who had the over on SGA&#39;s points prop (typically set at 28.5-30.5) were torched.
                </p>
                <p>
                  The Spurs&#39; defensive scheme specifically targeted SGA&#39;s downhill drives and stifled his rhythm from the opening tip.
                </p>
                <p>
                  For Game 5, the over on SGA points is likely to see significant public money. He has the talent to respond — but the under has genuine value if San Antonio repeats this defensive scheme in Oklahoma City.
                </p>
              </div>
            </section>

            {/* Pop speech */}
            <section className="mb-20">
              <h2 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-[var(--color-text-primary)] mb-4">
                Gregg Popovich&apos;s Locker Room Speech
              </h2>
              <div className="w-12 h-[2px] bg-[var(--color-lime)] mb-8 rounded-full" />

              <div className="space-y-5 text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch]">
                <p>
                  Legendary former Spurs head coach Gregg Popovich walked into the San Antonio locker room immediately after Game 3 and delivered a direct message. Multiple players confirmed the speech. San Antonio went out and played their best game of the series.
                </p>
              </div>
            </section>

            {/* Box score */}
            <section className="mb-20">
              <h2 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-[var(--color-text-primary)] mb-4">
                Key Performers
              </h2>
              <div className="w-12 h-[2px] bg-[var(--color-lime)] mb-8 rounded-full" />

              <div className="rounded-[1.25rem] p-[1px] bg-gradient-to-b from-[var(--color-border)] to-transparent overflow-hidden max-w-[56ch]">
                <div className="rounded-[calc(1.25rem-1px)] bg-[var(--color-surface)] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)]">
                        <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Player</th>
                        <th className="text-right px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">PTS</th>
                        <th className="text-right px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">REB</th>
                        <th className="text-right px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">AST</th>
                        <th className="text-right px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">+/-</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {boxScore.map((row) => (
                        <tr key={row.player} className={row.highlight ? "bg-[var(--color-lime)]/5" : ""}>
                          <td className={`px-4 py-3 ${row.highlight ? "text-[var(--color-text-primary)] font-bold" : "text-[var(--color-text-primary)]/80"}`}>{row.player}</td>
                          <td className={`px-3 py-3 text-right ${row.highlight ? "text-[var(--color-lime)] font-bold" : "text-[var(--color-text-primary)]/70"}`}>{row.pts}</td>
                          <td className="px-3 py-3 text-right text-[var(--color-text-primary)]/70">{row.reb}</td>
                          <td className="px-3 py-3 text-right text-[var(--color-text-primary)]/70">{row.ast}</td>
                          <td className={`px-4 py-3 text-right text-xs font-bold ${row.pm.startsWith("+") ? "text-[var(--color-lime)]" : "text-red-400"}`}>{row.pm}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Bench collapse */}
            <section className="mb-20">
              <h2 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-[var(--color-text-primary)] mb-4">
                Thunder Bench Collapsed
              </h2>
              <div className="w-12 h-[2px] bg-[var(--color-lime)] mb-8 rounded-full" />

              <div className="space-y-5 text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch]">
                <p>
                  OKC&#39;s bench scored 76 points in Game 3. In Game 4 they were held to 34 — and key reserves shot a combined 4-of-29 from the field.
                </p>
              </div>

              <ul className="mt-6 space-y-3 max-w-[56ch]">
                {[
                  "Jared McCain: 4 pts, 1-of-10 FG (after a breakout Game 3)",
                  "Jaylin Williams: 3 pts, 1-of-7 FG",
                  "Aaron Wiggins: 4 pts, 2-of-11 FG",
                  "Alex Caruso: 0 pts, 0-of-1 FG, -22 in just 14 minutes",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                    <span className="text-sm text-[var(--color-text-muted)] leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>

              <div className="space-y-5 text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch] mt-6">
                <p>
                  The Thunder also committed 20 turnovers — tied for their season high. San Antonio turned those into 25 points. Both Jalen Williams and Ajay Mitchell remained sidelined with injury.
                </p>
              </div>
            </section>

            {/* Series context */}
            <section className="mb-20">
              <h2 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-[var(--color-text-primary)] mb-4">
                Series Context
              </h2>
              <div className="w-12 h-[2px] bg-[var(--color-lime)] mb-8 rounded-full" />

              <div className="space-y-5 text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch]">
                <p>
                  The Spurs have not lost three consecutive games all season. They answered every OKC run in this series with a response. San Antonio is 32-8 at home; Oklahoma City is 30-10 away. The home team has won every game.
                </p>
              </div>
            </section>

            {/* Betting angles */}
            <section className="mb-20">
              <h2 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-[var(--color-text-primary)] mb-4">
                Betting Angles for Game 5
              </h2>
              <div className="w-12 h-[2px] bg-[var(--color-lime)] mb-8 rounded-full" />

              <div className="space-y-5 text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch] mb-8">
                <p>
                  Game 5 tips off Tuesday at 8:30 PM ET from the Paycom Center. Here are the angles that matter:
                </p>
              </div>

              <div className="rounded-[1.5rem] p-[1px] bg-gradient-to-b from-[var(--color-border)] to-transparent max-w-[56ch]">
                <div className="rounded-[calc(1.5rem-1px)] bg-[var(--color-surface)] p-6 md:p-8 space-y-5">
                  {[
                    { title: "SGA bounce-back", desc: "His scoring prop for Game 5 will likely open at 27.5-28.5. The public will hammer the over; consider whether San Antonio can replicate the same defensive scheme on the road." },
                    { title: "Wembanyama props", desc: "Averaging 30+ in the series. The 30+ points line has strong supporting data — his blocks (2.5 line) and rebounds (10.5) are the secondary props to layer." },
                    { title: "Stephon Castle", desc: "Just 1 turnover in Game 4 after committing 20 in the first two games. Castle's assists prop (6-7 range) and points are worth tracking." },
                    { title: "Home team trend", desc: "Home team has won every game in this series. OKC at home is a different animal than playing in San Antonio." },
                    { title: "Total", desc: "Games 2-4 have all been under 240. The under on a 220-225 total has a reasonable case." },
                  ].map((angle, i) => (
                    <div key={angle.title} className={i < 4 ? "border-b border-[var(--color-border)] pb-5" : ""}>
                      <p className="text-sm font-bold text-[var(--color-text-primary)] mb-2">{angle.title}</p>
                      <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{angle.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* CTA */}
            <div className="rounded-[2rem] p-[1px] bg-gradient-to-br from-[var(--color-lime)]/30 via-transparent to-[#F59E0B]/20 max-w-[56ch]">
              <div className="rounded-[calc(2rem-1px)] bg-[var(--color-surface)] p-8 md:p-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
                <p className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Check Wembanyama &amp; SGA props on Lasyly</p>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-6 max-w-[44ch]">
                  Hit rates, matchup grades, streak data, and confidence scores for every NBA prop — updated for Game 5. Free to use.
                </p>
                <Link
                  href="/analysis"
                  className="inline-flex items-center gap-2 bg-[var(--color-lime)] text-black font-bold text-sm px-6 py-3 rounded-full hover:scale-[0.98] active:scale-[0.96] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
                >
                  View player props
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </div>
            </div>
          </article>

          {/* Sidebar */}
          <aside className="hidden md:flex flex-col gap-5 sticky top-24">
            {/* Quick facts */}
            <div className="rounded-[1.25rem] p-[1px] bg-gradient-to-b from-[var(--color-border)] to-transparent">
              <div className="rounded-[calc(1.25rem-1px)] bg-[var(--color-surface)] p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-4">Quick facts</p>
                <ul className="space-y-2.5 text-sm">
                  <li className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Final</span>
                    <span className="text-[var(--color-text-primary)] font-bold">SAS 103 – OKC 82</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Series</span>
                    <span className="text-[var(--color-lime)] font-bold">Tied 2-2</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Wemby</span>
                    <span className="text-[var(--color-text-primary)]">33/8/5/3blk</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">SGA</span>
                    <span className="text-[var(--color-text-primary)]">19 pts (6-15)</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">OKC FG%</span>
                    <span className="text-red-400 font-bold">33.0%</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">OKC 3P%</span>
                    <span className="text-red-400 font-bold">18.2%</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Game 5</span>
                    <span className="text-[var(--color-text-primary)]">Tue 8:30 ET</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Schedule */}
            <div className="rounded-[1.25rem] p-[1px] bg-gradient-to-b from-[var(--color-border)] to-transparent">
              <div className="rounded-[calc(1.25rem-1px)] bg-[var(--color-surface)] p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-4">WCF Schedule</p>
                <ul className="space-y-2 text-sm">
                  {schedule.map((item) => (
                    <li key={item.g} className="flex gap-2">
                      <span className="text-[var(--color-text-muted)] w-14 shrink-0 text-xs">{item.g}</span>
                      <span className={item.done ? "text-[var(--color-text-primary)]/80 text-xs" : "text-[var(--color-text-muted)] text-xs"}>{item.r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* More posts */}
            <div className="rounded-[1.25rem] p-[1px] bg-gradient-to-b from-[var(--color-border)] to-transparent">
              <div className="rounded-[calc(1.25rem-1px)] bg-[var(--color-surface)] p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-4">More posts</p>
                <ul className="space-y-3">
                  <li>
                    <Link href="/blog/nba-player-props-guide" className="text-[13px] text-[var(--color-text-primary)]/70 hover:text-[var(--color-text-primary)] transition-colors duration-300 leading-snug block">
                      Complete Guide to NBA Player Props
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
              Join Lasyly free
            </Link>
          </aside>
        </div>
      </div>
    </BlogNewspaperWrapper>
  )
}
