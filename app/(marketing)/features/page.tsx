import type { Metadata } from "next"
import Link from "next/link"
import { JsonLd } from "@/components/seo/JsonLd"

export const metadata: Metadata = {
  title: "Features — Lasyly Sports Betting Platform",
  description: "Explore every feature inside Lasyly — prop analytics with hit rates and matchup grades, real-time betting rooms, live scores across 10+ sports, a tipster marketplace, bet tracker, and curated news.",
  openGraph: { title: "Features — Lasyly Sports Betting Platform", description: "Prop analytics, real-time rooms, live scores, tipster marketplace, bet tracker, and curated news. All free.", type: "website" },
  alternates: { canonical: "https://lasyly.me/features" },
}

const features = [
  { color: "var(--color-lime)", label: "Rooms", headline: "Real-time betting community", desc: "Join or create topic-based rooms organized by sport. Share picks, react to betslips, and chat with other bettors in real-time.", bullets: ["Real-time chat via Supabase", "Betslip sharing with emoji reactions", "Public, private, and tipster-gated rooms", "Live member indicators and sport tags"] },
  { color: "#6C63FF", label: "Props & Analytics", headline: "Data-backed prop research", desc: "Every player prop card is powered by real scraped historical data. Compute your own edge instead of relying on gut feel.", bullets: ["Hit rates: L5, L10, L15, L20, season", "Matchup grades A–F (defensive stats)", "Confidence scores 1–5 stars", "Trend arrows, streak dots, line movement", "Correlated parlay builder", "AI-generated writeups"] },
  { color: "#00D4AA", label: "Live Scores", headline: "10+ sports, real-time", desc: "A SofaScore-style live scores experience with date navigation, real-time polling, ESPN team logos, and YouTube highlights.", bullets: ["Adaptive polling — faster when live", "Past, today, future date navigation", "ESPN team logos and colors", "Match detail modals + highlights", "Historical match cache"] },
  { color: "#F59E0B", label: "Bet Tracker", headline: "Your personal performance ledger", desc: "Log every pick with player, stat type, line, direction, odds, and stake. Track win rate, ROI, net profit.", bullets: ["Log picks in seconds", "Track win rate, ROI, net profit", "Best signals analysis — your edge", "Filter by sport, date range, status"] },
  { color: "#EC4899", label: "Tipster Marketplace", headline: "Buy and sell premium picks", desc: "A Stripe-backed credits system that powers the pick economy. Bettors load credits to purchase premium picks from vetted tipsters.", bullets: ["Top up via Stripe ($10–$100+)", "Browse picks by tipster stats and sport", "Tipsters keep 85% — we take 15%", "Full transaction history and earnings"] },
  { color: "#14B8A6", label: "Lasyly Daily", headline: "Curated sports news, instantly", desc: "Sports news aggregated from ESPN and major sources, scraped and served from our own database. Zero third-party latency.", bullets: ["ESPN and major source aggregation", "8 sport categories", "Clean editorial newspaper layout", "Updated continuously via scrapers"] },
]

export default function FeaturesPage() {
  const baseUrl = "https://lasyly.me"
  return (
    <div className="min-h-screen">
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "SoftwareApplication", "name": "Lasyly", "url": baseUrl,
        "applicationCategory": "SportsApplication", "operatingSystem": "Web",
        "description": "Real-time social platform for sports bettors — prop analytics, betting rooms, live scores, tipster marketplace, and curated news.",
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
        "featureList": features.map((f) => f.headline),
        "publisher": { "@type": "Organization", "name": "Lasyly", "url": baseUrl },
      }} />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 sm:pb-20">
        <div className="max-w-3xl">
          <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--color-lime)] bg-[var(--color-lime)]/8 px-3 py-1.5 rounded-full border border-[var(--color-lime)]/15 mb-5">
            Everything in one place
          </span>
          <h1 className="text-[2.5rem] sm:text-[3.5rem] md:text-[4.5rem] font-bold font-serif tracking-tight text-white leading-[1.05] mb-6">
            Every tool a bettor needs
          </h1>
          <p className="text-lg text-white/50 max-w-[52ch] leading-relaxed mb-10">
            No more juggling 4–6 apps to make one informed bet. Lasyly combines real-time analytics, community, live scores, news, and a pick marketplace — all free.
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <Link href="/signup" className="inline-flex items-center gap-2 bg-[var(--color-lime)] text-black font-bold text-sm px-6 py-3 rounded-full hover:scale-[0.98] active:scale-[0.96] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]">
              Get started free
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>
            <Link href="/explore" className="inline-block border border-[var(--color-border)] text-white font-medium text-sm px-6 py-3 rounded-full hover:border-white/20 transition-colors duration-300">
              Explore rooms
            </Link>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6"><div className="h-[1px] bg-gradient-to-r from-[var(--color-border)] via-[var(--color-border)] to-transparent" /></div>

      {/* Feature grid — varied layout to break monotony */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        {/* Row 1: one wide feature */}
        <div className="mb-4">
          <div className="rounded-[1.5rem] p-[1px] bg-gradient-to-b from-white/6 to-transparent">
            <div className="rounded-[calc(1.5rem-1px)] bg-[var(--color-surface)] p-7 md:p-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
              <div className="grid md:grid-cols-[1fr_1.2fr] gap-8 items-start">
                <div>
                  <div className="w-2.5 h-2.5 rounded-full mb-5" style={{ background: features[0].color, boxShadow: `0 0 12px ${features[0].color}60` }} />
                  <span className="text-[11px] font-bold uppercase tracking-[0.15em] mb-2 block" style={{ color: features[0].color }}>{features[0].label}</span>
                  <h2 className="text-xl font-bold text-white font-serif tracking-tight mb-3">{features[0].headline}</h2>
                  <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{features[0].desc}</p>
                </div>
                <ul className="space-y-2 md:pt-8">
                  {features[0].bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-sm text-[var(--color-text-muted)]">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--color-lime)] shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: two cards */}
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          {features.slice(1, 3).map((f) => (
            <div key={f.label} className="rounded-[1.5rem] p-[1px] bg-gradient-to-b from-white/6 to-transparent">
              <div className="rounded-[calc(1.5rem-1px)] bg-[var(--color-surface)] p-7 h-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
                <div className="w-2.5 h-2.5 rounded-full mb-5" style={{ background: f.color, boxShadow: `0 0 12px ${f.color}60` }} />
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] mb-2 block" style={{ color: f.color }}>{f.label}</span>
                <h2 className="text-lg font-bold text-white font-serif tracking-tight mb-3">{f.headline}</h2>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-5">{f.desc}</p>
                <ul className="space-y-2">
                  {f.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-sm text-[var(--color-text-muted)]">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--color-lime)] shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Row 3: three compact cards */}
        <div className="grid sm:grid-cols-3 gap-4">
          {features.slice(3).map((f) => (
            <div key={f.label} className="rounded-[1.5rem] p-[1px] bg-gradient-to-b from-white/6 to-transparent">
              <div className="rounded-[calc(1.5rem-1px)] bg-[var(--color-surface)] p-6 h-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
                <div className="w-2.5 h-2.5 rounded-full mb-4" style={{ background: f.color, boxShadow: `0 0 12px ${f.color}60` }} />
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] mb-2 block" style={{ color: f.color }}>{f.label}</span>
                <h2 className="text-base font-bold text-white font-serif tracking-tight mb-2">{f.headline}</h2>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-4">{f.desc}</p>
                <ul className="space-y-1.5">
                  {f.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-[13px] text-[var(--color-text-muted)]">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-[var(--color-lime)] shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Sports coverage */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6"><div className="h-[1px] bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent" /></div>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
        <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-4">Sports covered</span>
        <h2 className="text-3xl font-bold font-serif tracking-tight text-white mb-10">Analytics and live scores across every major sport</h2>
        <div className="flex flex-wrap justify-center gap-3">
          {["NBA", "NFL", "Soccer", "Tennis", "NHL", "MLB", "Formula 1", "UFC / MMA", "Golf", "Cricket"].map((sport) => (
            <span key={sport} className="px-4 py-2.5 rounded-full border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] font-medium hover:border-white/15 hover:text-white/80 transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]">
              {sport}
            </span>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6"><div className="h-[1px] bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent" /></div>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-24 sm:py-32">
        <div className="mb-12">
          <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--color-lime)] mb-3">The honest comparison</span>
          <h2 className="text-3xl sm:text-4xl font-bold font-serif tracking-tight text-white">vs. everything else</h2>
        </div>
        <div className="rounded-[1.5rem] p-[1px] bg-gradient-to-b from-white/8 to-transparent overflow-hidden">
          <div className="rounded-[calc(1.5rem-1px)] bg-[var(--color-surface)] overflow-x-auto shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="text-left py-4 px-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)] border-b border-[var(--color-border)]">Feature</th>
                  <th className="py-4 px-5 text-[var(--color-lime)] font-bold text-[10px] uppercase tracking-[0.15em] border-b border-[var(--color-border)]">Lasyly</th>
                  <th className="py-4 px-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)] border-b border-[var(--color-border)]">Action Network</th>
                  <th className="py-4 px-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)] border-b border-[var(--color-border)]">Discord</th>
                  <th className="py-4 px-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)] border-b border-[var(--color-border)]">PrizePicks</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Prop analytics + hit rates", "Y", "Partial", "—", "—"],
                  ["Matchup grades (A–F)", "Y", "—", "—", "—"],
                  ["Real-time betting rooms", "Y", "—", "Y", "—"],
                  ["Betslip sharing + reactions", "Y", "—", "—", "—"],
                  ["Tipster monetization (85%)", "Y", "—", "—", "—"],
                  ["Live scores (10+ sports)", "Y", "Partial", "—", "—"],
                  ["Correlated parlay builder", "Y", "—", "—", "—"],
                  ["Bet tracker + ROI", "Y", "Y", "—", "—"],
                  ["Free to use", "Y", "Freemium", "Y", "—"],
                ].map(([feat, ...vals]) => (
                  <tr key={feat as string} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-5 text-white/80 border-b border-[var(--color-border)]">{feat}</td>
                    {(vals as string[]).map((v, i) => (
                      <td key={i} className="py-3.5 px-5 text-center border-b border-[var(--color-border)]">
                        <span className={v === "Y" ? "text-[var(--color-lime)] font-bold" : v === "—" ? "text-[var(--color-text-muted)] opacity-30" : "text-[var(--color-text-muted)] text-xs"}>
                          {v === "Y" ? "✓" : v}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20 sm:pb-28">
        <div className="rounded-[2rem] p-[1px] bg-gradient-to-br from-[var(--color-lime)]/25 via-transparent to-[#6C63FF]/15">
          <div className="rounded-[calc(2rem-1px)] bg-[var(--color-surface)] p-10 sm:p-14 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
            <h2 className="text-3xl sm:text-4xl font-bold font-serif tracking-tight text-white mb-4">All of it. Free.</h2>
            <p className="text-[var(--color-text-muted)] max-w-md mx-auto mb-8">
              No subscription. No paywall on analytics. Create an account and start researching props in under a minute.
            </p>
            <Link href="/signup" className="inline-flex items-center gap-2 bg-[var(--color-lime)] text-black font-bold px-8 py-3.5 rounded-full text-sm hover:scale-[0.98] active:scale-[0.96] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]">
              Create free account
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
