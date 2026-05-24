import type { Metadata } from "next"
import Link from "next/link"
import { JsonLd } from "@/components/seo/JsonLd"

export const metadata: Metadata = {
  title: "Features — Lasyly Sports Betting Platform",
  description:
    "Explore every feature inside Lasyly — prop analytics with hit rates and matchup grades, real-time betting rooms, live scores across 10+ sports, a tipster marketplace, bet tracker, and curated news. All in one app.",
  openGraph: {
    title: "Features — Lasyly Sports Betting Platform",
    description:
      "Prop analytics, real-time rooms, live scores, tipster marketplace, bet tracker, and curated news. All free. All in one app.",
    type: "website",
  },
  alternates: {
    canonical: "https://lasyly.com/features",
  },
}

const features = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    color: "var(--color-lime)",
    label: "Rooms",
    headline: "Real-time betting community",
    desc: "Join or create topic-based rooms organized by sport. Share picks, react to betslips, and chat with other bettors in real-time. Public rooms are open to everyone. Private rooms are invite-only. Tipster rooms are gated behind a subscription.",
    bullets: ["Real-time chat via Supabase", "Betslip sharing with emoji reactions", "Public, private, and tipster-gated rooms", "Live member indicators and sport tags"],
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
    color: "#6C63FF",
    label: "Props & Analytics",
    headline: "Data-backed prop research",
    desc: "Every player prop card is powered by real scraped historical data. Compute your own edge instead of relying on gut feel. Hit rates across L5, L10, L15, L20, and season-long windows. Matchup grades from A to F.",
    bullets: ["Hit rates: L5, L10, L15, L20, season", "Matchup grades A–F (defensive stats)", "Confidence scores 1–5 stars", "Trend arrows, streak dots, line movement", "Correlated parlay builder", "AI-generated writeups"],
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    color: "#00D4AA",
    label: "Live Scores",
    headline: "10+ sports, real-time",
    desc: "A SofaScore-style live scores experience with date navigation, real-time polling, ESPN team logos and colors, match detail modals, and YouTube highlights integration. Covers soccer, basketball, football, tennis, hockey, baseball, F1, MMA, golf, and cricket.",
    bullets: ["Adaptive polling — faster when live", "Past, today, future date navigation", "ESPN team logos and colors", "Match detail modals + highlights", "Historical match cache for instant loading"],
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    ),
    color: "#F59E0B",
    label: "Bet Tracker",
    headline: "Your personal performance ledger",
    desc: "Log every pick with player, stat type, line, direction, odds, and stake. Track it from pending to won, lost, or push. See your win rate, ROI, net profit, and which signal combinations are actually working for you.",
    bullets: ["Log picks in seconds", "Track win rate, ROI, net profit", "Best signals analysis — your edge, not ours", "Filter by sport, date range, status"],
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
      </svg>
    ),
    color: "#EC4899",
    label: "Tipster Marketplace",
    headline: "Buy and sell premium picks",
    desc: "A Stripe-backed credits system that powers the pick economy. Bettors load credits to purchase premium picks from vetted tipsters. Tipsters earn 85% of every sale and build a verified track record automatically.",
    bullets: ["Top up via Stripe ($10–$100+)", "Browse picks by tipster stats and sport", "Tipsters keep 85% — we take 15%", "Full transaction history and earnings tracking"],
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v2"/><path d="M2 15h10"/><path d="M9 18l3-3-3-3"/>
      </svg>
    ),
    color: "#14B8A6",
    label: "Lasyly Daily",
    headline: "Curated sports news, instantly",
    desc: "Sports news aggregated from ESPN and major sources, scraped and served from our own database. Zero third-party latency. Categories across football, NBA, NFL, UFC, tennis, F1, and cricket.",
    bullets: ["ESPN and major source aggregation", "8 sport categories", "Clean editorial newspaper layout", "Updated continuously via automated scrapers"],
  },
]

export default function FeaturesPage() {
  const baseUrl = "https://lasyly.com"
  return (
    <div>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "Lasyly",
        "url": baseUrl,
        "applicationCategory": "SportsApplication",
        "operatingSystem": "Web",
        "description": "Real-time social platform for sports bettors — prop analytics, betting rooms, live scores, tipster marketplace, and curated news.",
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
        "featureList": features.map((f) => f.headline),
        "publisher": { "@type": "Organization", "name": "Lasyly", "url": baseUrl },
      }} />
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-lime)] mb-4">Everything in one place</p>
        <h1 className="text-5xl md:text-7xl font-bold font-serif tracking-tight text-white leading-none mb-6">
          Every tool a bettor needs
        </h1>
        <p className="text-lg text-[var(--color-text-muted)] max-w-2xl mx-auto leading-relaxed mb-10">
          No more juggling 4–6 apps to make one informed bet. Lasyly combines real-time analytics, community, live scores, news, and a pick marketplace — all free.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/signup"
            className="inline-block bg-[var(--color-lime)] text-black font-bold text-sm px-6 py-3 rounded-full hover:opacity-90 transition-opacity"
          >
            Get started free →
          </Link>
          <Link
            href="/explore"
            className="inline-block border border-[var(--color-border)] text-white font-medium text-sm px-6 py-3 rounded-full hover:border-white/30 transition-colors"
          >
            Explore rooms
          </Link>
        </div>
      </section>

      {/* Feature grid */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-2 gap-6">
          {features.map((f) => (
            <div
              key={f.label}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 hover:border-white/15 transition-colors"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                style={{ background: `${f.color}18`, color: f.color }}
              >
                {f.icon}
              </div>
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: f.color }}>
                {f.label}
              </p>
              <h2 className="text-xl font-bold text-white font-serif tracking-tight mb-3">{f.headline}</h2>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-5">{f.desc}</p>
              <ul className="space-y-2">
                {f.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-[var(--color-text-muted)]">
                    <span className="mt-0.5 text-[var(--color-lime)] flex-shrink-0">✓</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Sports coverage */}
      <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)] py-16">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-4">Sports covered</p>
          <h2 className="text-3xl font-bold font-serif text-white mb-8">Analytics and live scores across every major sport</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {["NBA", "NFL", "Soccer", "Tennis", "NHL", "MLB", "Formula 1", "UFC / MMA", "Golf", "Cricket"].map((sport) => (
              <span
                key={sport}
                className="px-4 py-2 rounded-full border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] font-medium"
              >
                {sport}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-lime)] mb-3">The honest comparison</p>
          <h2 className="text-4xl font-bold font-serif text-white">vs. everything else</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="text-left py-4 px-5 text-[var(--color-text-muted)] font-semibold text-xs uppercase tracking-wider border-b border-[var(--color-border)]">Feature</th>
                <th className="py-4 px-5 text-[var(--color-lime)] font-bold text-xs uppercase tracking-wider border-b border-[var(--color-border)]">Lasyly</th>
                <th className="py-4 px-5 text-[var(--color-text-muted)] font-semibold text-xs uppercase tracking-wider border-b border-[var(--color-border)]">Action Network</th>
                <th className="py-4 px-5 text-[var(--color-text-muted)] font-semibold text-xs uppercase tracking-wider border-b border-[var(--color-border)]">Discord</th>
                <th className="py-4 px-5 text-[var(--color-text-muted)] font-semibold text-xs uppercase tracking-wider border-b border-[var(--color-border)]">PrizePicks</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Prop analytics + hit rates", "✓", "Partial", "—", "—"],
                ["Matchup grades (A–F)", "✓", "—", "—", "—"],
                ["Real-time betting rooms", "✓", "—", "✓", "—"],
                ["Betslip sharing + reactions", "✓", "—", "—", "—"],
                ["Tipster monetization (85% cut)", "✓", "—", "—", "—"],
                ["Live scores (10+ sports)", "✓", "Partial", "—", "—"],
                ["Correlated parlay builder", "✓", "—", "—", "—"],
                ["Bet tracker + ROI", "✓", "✓", "—", "—"],
                ["Free to use", "✓", "Freemium", "✓", "—"],
              ].map(([feat, ...vals]) => (
                <tr key={feat as string} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 px-5 text-white/80 border-b border-[var(--color-border)]">{feat}</td>
                  {(vals as string[]).map((v, i) => (
                    <td key={i} className="py-3.5 px-5 text-center border-b border-[var(--color-border)]">
                      <span className={
                        v === "✓" ? "text-[var(--color-lime)] font-bold text-base"
                        : v === "—" ? "text-[var(--color-text-muted)] opacity-40"
                        : "text-[var(--color-text-muted)] text-xs uppercase tracking-wider"
                      }>{v}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="rounded-2xl border border-[var(--color-lime)]/20 bg-[var(--color-lime)]/5 p-12 text-center">
          <h2 className="text-4xl font-bold font-serif text-white mb-4">All of it. Free.</h2>
          <p className="text-[var(--color-text-muted)] max-w-md mx-auto mb-8">
            No subscription. No paywall on analytics. Create an account and start researching props in under a minute.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-[var(--color-lime)] text-black font-bold px-8 py-3.5 rounded-full text-sm hover:opacity-90 transition-opacity"
          >
            Create free account →
          </Link>
        </div>
      </section>
    </div>
  )
}
