import type { Metadata } from "next"
import Link from "next/link"
import { JsonLd } from "@/components/seo/JsonLd"

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

export default function SpursThunderGame4Post() {
  const baseUrl = "https://lasyly.me"
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          headline:
            "Spurs Beat Thunder 103-82 in Game 4: Wembanyama 33 Points, Western Conference Finals Tied 2-2",
          description:
            "Victor Wembanyama scores 33 points with 8 rebounds, 5 assists, and 3 blocks as the San Antonio Spurs rout the Oklahoma City Thunder 103-82 in Game 4 of the Western Conference Finals, evening the series at 2-2.",
          datePublished: "2026-05-25",
          dateModified: "2026-05-25",
          author: { "@type": "Organization", name: "Lasyly", url: baseUrl },
          publisher: {
            "@type": "Organization",
            name: "Lasyly",
            url: baseUrl,
            logo: {
              "@type": "ImageObject",
              url: `${baseUrl}/lasyly_logo.png`,
            },
          },
          url: `${baseUrl}/blog/spurs-thunder-game-4-recap-2026`,
          mainEntityOfPage: {
            "@type": "WebPage",
            "@id": `${baseUrl}/blog/spurs-thunder-game-4-recap-2026`,
          },
          keywords: [
            "Spurs Thunder Game 4",
            "Wembanyama 33 points",
            "NBA Western Conference Finals 2026",
            "Shai Gilgeous-Alexander",
            "OKC vs Spurs recap",
            "NBA playoffs 2026",
          ],
          about: [
            {
              "@type": "SportsEvent",
              name: "San Antonio Spurs vs Oklahoma City Thunder — WCF Game 4",
              sport: "Basketball",
              startDate: "2026-05-25",
              location: {
                "@type": "Place",
                name: "Frost Bank Center",
                address: "San Antonio, TX",
              },
            },
          ],
        }}
      />

      <div className="max-w-2xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-10">
          <Link href="/blog" className="hover:text-white transition-colors">
            Blog
          </Link>
          <span>/</span>
          <span>NBA</span>
        </div>

        {/* Header */}
        <div className="mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-[#F59E0B] bg-[#F59E0B]/10 px-2.5 py-1 rounded-full">
            🏀 NBA Playoffs
          </span>
          <h1 className="text-4xl md:text-5xl font-bold font-serif tracking-tight text-white leading-tight mt-5 mb-4">
            Wembanyama 33 Pts: Spurs Rout Thunder 103-82, Even West Finals at 2-2
          </h1>
          <div className="flex items-center gap-3 text-sm text-[var(--color-text-muted)]">
            <span>May 25, 2026</span>
            <span>·</span>
            <span>7 min read</span>
            <span>·</span>
            <span>Lasyly Team</span>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr_280px] gap-16 items-start">
        {/* Article body */}
        <article
          className="prose prose-invert prose-lg max-w-none
          prose-headings:font-serif prose-headings:font-bold prose-headings:tracking-tight
          prose-p:text-[var(--color-text-muted)] prose-p:leading-relaxed
          prose-li:text-[var(--color-text-muted)]
          prose-strong:text-white
          prose-a:text-[var(--color-lime)] prose-a:no-underline hover:prose-a:underline
        "
        >
          <p className="text-xl text-white/80 leading-relaxed not-prose mb-8">
            Victor Wembanyama was dominant, the Spurs&#39; defense was suffocating, and the Oklahoma City Thunder had their worst offensive showing in years. San Antonio beats OKC 103-82 in Game 4 of the Western Conference Finals to level the series at 2-2. Game 5 is Tuesday in Oklahoma City.
          </p>

          {/* Score summary card */}
          <div className="not-prose mb-10 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-4">
              Game 4 Final — May 25, 2026 · Frost Bank Center
            </p>
            <div className="flex items-center justify-between gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">82</p>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">OKC Thunder</p>
                <p className="text-xs text-[var(--color-text-muted)]">64-18 season</p>
              </div>
              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                  FINAL
                </p>
                <p className="text-xs text-[var(--color-lime)] font-bold mt-1">Series 2-2</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-[var(--color-lime)]">103</p>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">SA Spurs</p>
                <p className="text-xs text-[var(--color-text-muted)]">62-20 season</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-[var(--color-border)] grid grid-cols-4 gap-2 text-center text-xs">
              {[
                { label: "Q1", okc: "19", sa: "28" },
                { label: "Q2", okc: "19", sa: "22" },
                { label: "Q3", okc: "22", sa: "28" },
                { label: "Q4", okc: "22", sa: "25" },
              ].map((q) => (
                <div key={q.label}>
                  <p className="text-[var(--color-text-muted)] mb-1">{q.label}</p>
                  <p className="text-white/70">{q.okc}</p>
                  <p className="text-[var(--color-lime)] font-bold">{q.sa}</p>
                </div>
              ))}
            </div>
          </div>

          <h2>Wembanyama Was on Another Level</h2>
          <p>
            Victor Wembanyama finished with <strong>33 points, 8 rebounds, 5 assists, 2 steals, and 3 blocks</strong> on 11-of-22 shooting, including 3-of-7 from three. He also hit a remarkable 42-foot buzzer-beater to close the first half — a shot that encapsulated what makes him generationally unique.
          </p>
          <p>
            Wembanyama said after Game 3 that he needed to be better to make his teammates better. He delivered. His performance followed an honest self-assessment after OKC&#39;s 123-108 win on Friday, and the Spurs&#39; entire operation reset around him.
          </p>
          <p>
            Across the Western Conference Finals, Wembanyama is now averaging more than 30 points per game — a threshold no other player in the NBA&#39;s final four has crossed this postseason, including MVP Shai Gilgeous-Alexander. For the full playoffs, he&#39;s averaging 23.1 points, 9.2 rebounds, and a league-leading 3.8 blocks per game — nearly double the next closest player.
          </p>

          <h2>Spurs&#39; Defense Shut Down the Thunder</h2>
          <p>
            San Antonio held Oklahoma City to <strong>33% shooting from the field and 18% from three (6-of-33)</strong>. For context: entering Game 4, OKC&#39;s worst 3-point performance of the playoffs was 30.4% against Phoenix in the first round. Sunday night was 12 percentage points worse.
          </p>
          <p>
            The key adjustment was the Spurs abandoning their high trap on Shai Gilgeous-Alexander in favor of collapsing nearby defenders at the nail. The result: no more wide-open corner threes for OKC role players, and SGA forced into contested pull-ups.
          </p>
          <p>
            Devin Vassell explained it plainly: <em>&ldquo;Those two games that they won, we just weren&apos;t ourselves. We weren&apos;t playing at the level we could. We were leaving them open way too much.&rdquo;</em> Game 4 was the correction.
          </p>
          <p>
            San Antonio also had <strong>11 steals and 10 blocks</strong> — an extraordinary combined stat for a single playoff game. The Thunder scored 50 points with 3:28 left in the game; that&apos;s how thoroughly the defense dominated.
          </p>

          <h2>SGA Held to 19 Points — The Line That Broke This Game</h2>
          <p>
            Shai Gilgeous-Alexander, the NBA&#39;s MVP candidate, finished with just 19 points on 6-of-15 shooting. He was the eighth-highest scorer in the game. OKC bettors who had the over on SGA&#39;s points prop (typically set at 28.5-30.5) were torched.
          </p>
          <p>
            The Spurs&#39; defensive scheme specifically targeted SGA&#39;s downhill drives and stifled his rhythm from the opening tip. He acknowledged it directly: <em>&ldquo;They just punched us in our face early. It&apos;s two games in a row they&apos;ve come out the aggressor.&rdquo;</em>
          </p>
          <p>
            For Game 5, the over on SGA points is likely to see significant public money. He has the talent to respond — but the under has genuine value if San Antonio repeats this defensive scheme in Oklahoma City.
          </p>

          <h2>Gregg Popovich&apos;s Locker Room Speech</h2>
          <p>
            One of the most notable storylines coming out of Game 4: legendary former Spurs head coach Gregg Popovich walked into the San Antonio locker room immediately after Game 3 and delivered a direct message to the team. De&#39;Aaron Fox relayed it on NBC&#39;s postgame show: <em>&ldquo;Pop&apos;s been around throughout the course of the season, but that was the first time he walked into the locker room and was like, &lsquo;Nah, that&apos;s BS, that&apos;s not how we play basketball.&rsquo;&rdquo;</em>
          </p>
          <p>
            Multiple players confirmed the speech. San Antonio went out and played their best game of the series.
          </p>

          <h2>Key Performers — Box Score Breakdown</h2>
          <div className="not-prose overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] mb-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
                    Player
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
                    PTS
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
                    REB
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
                    AST
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
                    +/-
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {[
                  { player: "V. Wembanyama (SAS)", pts: 33, reb: 8, ast: 5, pm: "+29", highlight: true },
                  { player: "S. Castle (SAS)", pts: 13, reb: 3, ast: 6, pm: "+25", highlight: false },
                  { player: "D. Vassell (SAS)", pts: 13, reb: 6, ast: 3, pm: "+27", highlight: false },
                  { player: "D. Fox (SAS)", pts: 12, reb: 10, ast: 5, pm: "-3", highlight: false },
                  { player: "SGA (OKC)", pts: 19, reb: 4, ast: 7, pm: "-18", highlight: false },
                  { player: "I. Hartenstein (OKC)", pts: 12, reb: 7, ast: 3, pm: "-16", highlight: false },
                  { player: "C. Holmgren (OKC)", pts: 10, reb: 9, ast: 2, pm: "+2", highlight: false },
                ].map((row) => (
                  <tr key={row.player} className={row.highlight ? "bg-[var(--color-lime)]/5" : ""}>
                    <td className={`px-4 py-3 ${row.highlight ? "text-white font-bold" : "text-white/80"}`}>
                      {row.player}
                    </td>
                    <td
                      className={`px-4 py-3 text-right ${row.highlight ? "text-[var(--color-lime)] font-bold" : "text-white/70"}`}
                    >
                      {row.pts}
                    </td>
                    <td className="px-4 py-3 text-right text-white/70">{row.reb}</td>
                    <td className="px-4 py-3 text-right text-white/70">{row.ast}</td>
                    <td
                      className={`px-4 py-3 text-right text-xs font-bold ${row.pm.startsWith("+") ? "text-[var(--color-lime)]" : "text-red-400"}`}
                    >
                      {row.pm}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-[var(--color-text-muted)] mb-8">
            Selected key performers. De&apos;Aaron Fox had the game-high 10 rebounds — remarkable for a 6&apos;3&quot; point guard.
          </p>

          <h2>Thunder Bench Collapsed After Game 3 Heroics</h2>
          <p>
            OKC&apos;s bench scored 76 points in Game 3. In Game 4 they were held to 34 — and key reserves shot a combined 4-of-29 from the field:
          </p>
          <ul>
            <li>
              <strong>Jared McCain:</strong> 4 pts, 1-of-10 FG (after a breakout Game 3)
            </li>
            <li>
              <strong>Jaylin Williams:</strong> 3 pts, 1-of-7 FG
            </li>
            <li>
              <strong>Aaron Wiggins:</strong> 4 pts, 2-of-11 FG
            </li>
            <li>
              <strong>Alex Caruso:</strong> 0 pts, 0-of-1 FG, -22 in just 14 minutes
            </li>
          </ul>
          <p>
            The Thunder also committed 20 turnovers — tied for their season high. San Antonio turned those into 25 points. OKC bettors who had bench scoring props or Jared McCain points props after his Game 3 performance were caught badly on the wrong side.
          </p>
          <p>
            Both Jalen Williams and Ajay Mitchell remained sidelined with injury, which significantly depleted OKC&apos;s depth and their ability to recover.
          </p>

          <h2>Series Context &amp; What Happened So Far</h2>
          <ul>
            <li>
              <strong>Game 1:</strong> Spurs 122, Thunder 115 (2OT)
            </li>
            <li>
              <strong>Game 2:</strong> Thunder 122, Spurs 113
            </li>
            <li>
              <strong>Game 3:</strong> Thunder 123, Spurs 108
            </li>
            <li>
              <strong>Game 4:</strong> Spurs 103, Thunder 82
            </li>
          </ul>
          <p>
            The Spurs have not lost three consecutive games all season. They answered every OKC run in this series with a response. San Antonio is 32-8 at home; Oklahoma City is 30-10 away. The home team has won every game.
          </p>

          <h2>Betting Angles for Game 5 (Tuesday, OKC)</h2>
          <p>
            Game 5 tips off Tuesday at 8:30 PM ET from the Paycom Center. Here are the angles that matter heading into it:
          </p>
          <ul>
            <li>
              <strong>SGA bounce-back:</strong> He was held to 19 points and will be highly motivated. His scoring prop for Game 5 will likely open at 27.5-28.5. The public will hammer the over; consider whether San Antonio can replicate the same defensive scheme on the road.
            </li>
            <li>
              <strong>Wembanyama props:</strong> Averaging 30+ in the series and 23.1 across the playoffs. The 30+ points line on Lasyly has strong supporting data — his blocks (2.5 line) and rebounds (10.5) are the secondary props to layer.
            </li>
            <li>
              <strong>Stephon Castle:</strong> Just 1 turnover in Game 4 after committing 20 in the first two games. Castle&apos;s assists prop (6-7 range) and points are worth tracking if the turnovers stay controlled.
            </li>
            <li>
              <strong>OKC home crowd + home team trend:</strong> Home team has won every game in this series. OKC at home is a different animal than playing in San Antonio.
            </li>
            <li>
              <strong>Total:</strong> Both teams shooting below their averages in a tight defensive series. Game 1 went to 2OT and still ended at 237; Games 2-4 have all been under 240. The under on a 220-225 total has a reasonable case.
            </li>
          </ul>

          <div className="not-prose mt-12 rounded-2xl border border-[var(--color-lime)]/20 bg-[var(--color-lime)]/5 p-6">
            <p className="font-bold text-white text-lg mb-2">
              Check Wembanyama &amp; SGA props on Lasyly
            </p>
            <p className="text-[var(--color-text-muted)] text-sm mb-4">
              Hit rates, matchup grades, streak data, and confidence scores for every NBA prop — updated for Game 5. Free to use.
            </p>
            <Link
              href="/analysis"
              className="inline-block bg-[var(--color-lime)] text-black font-bold text-sm px-5 py-2.5 rounded-full hover:opacity-90 transition-opacity"
            >
              View player props →
            </Link>
          </div>
        </article>

        {/* Sidebar */}
        <aside className="hidden md:flex flex-col gap-6 sticky top-24">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-4">
              Quick facts
            </p>
            <ul className="space-y-2.5 text-sm">
              <li className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Final score</span>
                <span className="text-white font-bold">SAS 103 — OKC 82</span>
              </li>
              <li className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Series</span>
                <span className="text-[var(--color-lime)] font-bold">Tied 2-2</span>
              </li>
              <li className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Wemby</span>
                <span className="text-white">33 pts / 8 reb / 3 blk</span>
              </li>
              <li className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">SGA</span>
                <span className="text-white">19 pts (6-15 FG)</span>
              </li>
              <li className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">OKC FG%</span>
                <span className="text-red-400 font-bold">33.0%</span>
              </li>
              <li className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">OKC 3P%</span>
                <span className="text-red-400 font-bold">18.2% (6-33)</span>
              </li>
              <li className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Game 5</span>
                <span className="text-white">Tue, 8:30 PM ET @ OKC</span>
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-3">
              WCF Schedule
            </p>
            <ul className="space-y-2 text-sm">
              {[
                { g: "Game 1", r: "SAS 122 – OKC 115 (2OT)", done: true },
                { g: "Game 2", r: "OKC 122 – SAS 113", done: true },
                { g: "Game 3", r: "OKC 123 – SAS 108", done: true },
                { g: "Game 4", r: "SAS 103 – OKC 82", done: true },
                { g: "Game 5", r: "Tue 8:30 PM ET @ OKC", done: false },
                { g: "Game 6", r: "Thu 8:30 PM ET @ SAS", done: false },
                { g: "Game 7", r: "Sat 8 PM ET @ OKC (if needed)", done: false },
              ].map((item) => (
                <li key={item.g} className="flex gap-2">
                  <span className="text-[var(--color-text-muted)] w-14 shrink-0">{item.g}</span>
                  <span className={item.done ? "text-white/80" : "text-[var(--color-text-muted)]"}>
                    {item.r}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-3">
              More trending
            </p>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/blog/thunder-vs-spurs-nba-2026"
                  className="text-sm text-white/80 hover:text-white transition-colors block"
                >
                  🏀 OKC vs Spurs — Pre-Series Betting Breakdown →
                </Link>
              </li>
              <li>
                <Link
                  href="/blog/avalanche-vs-golden-knights-nhl-playoffs-2026"
                  className="text-sm text-white/80 hover:text-white transition-colors block"
                >
                  🏒 Avalanche vs Golden Knights NHL Playoffs →
                </Link>
              </li>
              <li>
                <Link
                  href="/blog/nba-player-props-guide"
                  className="text-sm text-white/80 hover:text-white transition-colors block"
                >
                  📖 Complete Guide to NBA Player Props →
                </Link>
              </li>
            </ul>
          </div>

          <Link
            href="/signup"
            className="block text-center bg-[var(--color-lime)] text-black font-bold text-sm px-5 py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            Join Lasyly free →
          </Link>
        </aside>
      </div>
    </div>
  )
}
