import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Data Sources & Attribution — Lasyly",
  description:
    "How Lasyly analytics are produced and attribution for the publicly available sports statistics and third-party services we rely on.",
}

export default function DataSourcesPage() {
  return (
    <article className="prose prose-invert prose-sm max-w-none">
      <h1 className="text-3xl font-bold tracking-tight">Data Sources &amp; Attribution</h1>
      <p className="text-[var(--color-text-muted)]">Last updated: September 9, 2026</p>

      <p>
        Lasyly&apos;s analytics are calculated in-house from publicly available historical sports
        statistics. Metrics such as hit rates, matchup grades, confidence scores, trends, streaks,
        and correlations are derived by our own models from historical player and team performance.
        Lasyly does not resell raw third-party datasets, and all analytics are provided for
        informational purposes only.
      </p>

      <h2>Analytics</h2>
      <ul>
        <li>Player and team performance metrics are computed in-house from historical box score statistics.</li>
        <li>Prop lines are estimates produced by our models, not odds sourced from any sportsbook.</li>
        <li>We do not use paid odds feeds.</li>
      </ul>

      <h2>Live Scores, Logos &amp; News</h2>
      <ul>
        <li>
          Live scores, team logos, and sports news are provided via the{" "}
          <a href="https://www.espn.com" target="_blank" rel="noopener noreferrer">ESPN</a>{" "}
          public API. ESPN and its marks are the property of their respective owners.
        </li>
        <li>News headlines link back to their original publishers, who retain all rights to their content.</li>
      </ul>

      <h2>Trademarks</h2>
      <p>
        Team names, league names, and logos are trademarks of their respective owners. Lasyly is not
        affiliated with, endorsed by, or sponsored by any league, team, or data provider.
      </p>

      <h2>Corrections &amp; Requests</h2>
      <p>
        If you are a rights holder and have a question about attribution or data usage, please reach
        out via our <Link href="/">contact channels</Link> and we will respond promptly.
      </p>

      <p className="text-[var(--color-text-muted)]">
        See also our <Link href="/terms">Terms of Service</Link> and{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </article>
  )
}
