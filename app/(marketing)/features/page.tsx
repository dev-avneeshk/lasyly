import type { Metadata } from "next"
import Link from "next/link"
import { JsonLd } from "@/components/seo/JsonLd"

export const metadata: Metadata = {
  title: "Features — Lasyly Sports Analytics Platform",
  description: "Everything inside Lasyly: prop analytics with hit rates and matchup grades, real-time rooms, live scores across 10+ sports, creator rooms, a pick tracker, and curated news.",
  openGraph: { title: "Features — Lasyly Sports Analytics Platform", description: "Prop analytics, real-time rooms, live scores, creator rooms, a pick tracker, and curated news. All free.", type: "website" },
  alternates: { canonical: "https://lasyly.me/features" },
}

type Spec = { k: string; v: string }
type Feature = {
  no: string
  label: string
  headline: string
  desc: string
  href: string
  specs: Spec[]
}

const features: Feature[] = [
  {
    no: "01",
    label: "Rooms",
    headline: "Real-time community",
    desc: "Topic-based rooms organized by sport. Share picks, react to slips, and talk through games as they happen, without leaving the app.",
    href: "/explore",
    specs: [
      { k: "Chat", v: "Realtime, Supabase-backed" },
      { k: "Slips", v: "Shared with emoji reactions" },
      { k: "Access", v: "Public, private, premium" },
      { k: "Metadata", v: "Live member counts, sport tags" },
    ],
  },
  {
    no: "02",
    label: "Props & analytics",
    headline: "Data-backed prop research",
    desc: "Every prop card is calculated in-house from historical sports statistics, so you work out your own edge instead of trusting a gut call.",
    href: "/analysis",
    specs: [
      { k: "Hit rates", v: "L5, L10, L15, L20, season" },
      { k: "Matchup grade", v: "A to F, from defensive splits" },
      { k: "Confidence", v: "1 to 5 stars" },
      { k: "Signals", v: "Trend, streak, line movement" },
      { k: "Parlays", v: "Correlated builder" },
    ],
  },
  {
    no: "03",
    label: "Live scores",
    headline: "10+ sports in one view",
    desc: "Date navigation across past, present, and upcoming fixtures, with ESPN logos and colors and a match detail view for every game.",
    href: "/scores",
    specs: [
      { k: "Polling", v: "Adaptive, faster on live games" },
      { k: "Dates", v: "Past, today, upcoming" },
      { k: "Detail", v: "Team stats, box score, odds" },
      { k: "Media", v: "YouTube highlights" },
    ],
  },
  {
    no: "04",
    label: "Pick tracker",
    headline: "Your performance ledger",
    desc: "Log every pick with player, stat, line, direction, odds, and stake. Over time it shows you where your edge actually is.",
    href: "/bets",
    specs: [
      { k: "Entry", v: "Full pick in seconds" },
      { k: "Metrics", v: "Win rate, ROI, net profit" },
      { k: "Insight", v: "Best-performing signals" },
      { k: "Filters", v: "Sport, date range, status" },
    ],
  },
  {
    no: "05",
    label: "Creator rooms",
    headline: "Share what you know",
    desc: "Independent creators run their own rooms and share their analysis and picks. Where creator monetization is available, members pay for access to a creator's content and community — not to place any bet. Availability varies by region.",
    href: "/tipsters",
    specs: [
      { k: "Discovery", v: "By creator stats and sport" },
      { k: "Track record", v: "Public and verifiable" },
      { k: "Payment", v: "For content access only" },
      { k: "Availability", v: "Varies by region" },
    ],
  },
  {
    no: "06",
    label: "Lasyly Daily",
    headline: "Curated news, no latency",
    desc: "Sports news from ESPN and other major sources, aggregated and served from our own database so it loads without a third-party round trip.",
    href: "/news",
    specs: [
      { k: "Sources", v: "ESPN and major outlets" },
      { k: "Categories", v: "8 sports" },
      { k: "Layout", v: "Editorial, newspaper-style" },
      { k: "Refresh", v: "Continuous" },
    ],
  },
]

const sports = ["NBA", "NFL", "Soccer", "Tennis", "NHL", "MLB", "Formula 1", "UFC", "Golf", "Cricket"]

const comparisonRows: [string, string, string, string, string][] = [
  ["Prop analytics with hit rates", "yes", "partial", "no", "no"],
  ["Matchup grades (A to F)", "yes", "no", "no", "no"],
  ["Real-time rooms", "yes", "no", "yes", "no"],
  ["Slip sharing and reactions", "yes", "no", "no", "no"],
  ["Creator rooms (where available)", "yes", "no", "no", "no"],
  ["Live scores, 10+ sports", "yes", "partial", "no", "no"],
  ["Correlated parlay builder", "yes", "no", "no", "no"],
  ["Pick tracker with ROI", "yes", "yes", "no", "no"],
  ["Free to use", "yes", "freemium", "yes", "no"],
]

function Cell({ value }: { value: string }) {
  if (value === "yes") return <span className="text-[var(--color-lime)] font-semibold">Yes</span>
  if (value === "no") return <span className="text-white/20">No</span>
  return <span className="text-[var(--color-text-muted)] text-xs capitalize">{value}</span>
}

export default function FeaturesPage() {
  const baseUrl = "https://lasyly.me"
  return (
    <main className="min-h-screen">
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "SoftwareApplication", "name": "Lasyly", "url": baseUrl,
        "applicationCategory": "SportsApplication", "operatingSystem": "Web",
        "description": "Real-time social platform for sports fans: prop analytics, community rooms, live scores, creator rooms, and curated news.",
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
        "featureList": features.map((f) => f.headline),
        "publisher": { "@type": "Organization", "name": "Lasyly", "url": baseUrl },
      }} />

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-5 sm:px-6 pt-20 sm:pt-28 pb-14">
        <p className="text-[13px] font-medium text-[var(--color-lime)] mb-6">Features</p>
        <h1 className="text-[2.4rem] sm:text-[3.25rem] md:text-[4rem] font-bold font-serif tracking-tight text-white leading-[1.04] max-w-[16ch]">
          Six tools most people pay for, in one place
        </h1>
        <p className="mt-6 text-lg text-white/55 max-w-[58ch] leading-relaxed">
          Most fans run four to six apps to research a single informed pick. Lasyly folds analytics, community, live scores, news, and creator rooms into one product, and none of it sits behind a paywall.
        </p>
        <div className="mt-9 flex items-center gap-6 flex-wrap">
          <Link href="/signup" className="inline-flex items-center gap-2 bg-[var(--color-lime)] text-black font-semibold text-sm px-6 py-3 rounded-full hover:scale-[0.98] active:scale-[0.96] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]">
            Get started free
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
          <Link href="/explore" className="text-sm font-medium text-white/70 hover:text-white transition-colors duration-200 underline underline-offset-4 decoration-white/20 hover:decoration-white/50">
            Explore rooms
          </Link>
        </div>
      </section>

      {/* Feature index — editorial, numbered, hairline dividers */}
      <section className="max-w-5xl mx-auto px-5 sm:px-6 pb-8">
        <div className="border-t border-[var(--color-border)]">
          {features.map((f) => (
            <article
              key={f.no}
              className="group grid md:grid-cols-[auto_1fr_minmax(0,22rem)] gap-x-8 gap-y-4 py-10 sm:py-12 border-b border-[var(--color-border)]"
            >
              {/* Number + label */}
              <div className="flex md:flex-col items-baseline md:items-start gap-3 md:gap-2 md:w-24">
                <span className="font-serif text-3xl sm:text-4xl font-bold text-white/15 tabular-nums leading-none">{f.no}</span>
                <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{f.label}</span>
              </div>

              {/* Headline + description */}
              <div className="max-w-[46ch]">
                <h2 className="text-xl sm:text-2xl font-bold font-serif tracking-tight text-white mb-3">
                  <Link href={f.href} className="hover:text-[var(--color-lime)] transition-colors duration-200">
                    {f.headline}
                  </Link>
                </h2>
                <p className="text-[15px] text-[var(--color-text-muted)] leading-relaxed">{f.desc}</p>
                <Link
                  href={f.href}
                  className="mt-4 inline-block text-[13px] font-medium text-white/50 group-hover:text-[var(--color-lime)] transition-colors duration-200"
                >
                  Open {f.label.toLowerCase()} →
                </Link>
              </div>

              {/* Spec rows — key/value, not bullet dots */}
              <dl className="md:pt-1">
                {f.specs.map((s, i) => (
                  <div
                    key={s.k}
                    className={`flex items-baseline justify-between gap-4 py-2 text-[13px] ${i < f.specs.length - 1 ? "border-b border-white/[0.05]" : ""}`}
                  >
                    <dt className="text-white/40 shrink-0">{s.k}</dt>
                    <dd className="text-white/75 text-right font-medium">{s.v}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      </section>

      {/* Sports coverage — inline typographic list, not pill soup */}
      <section className="max-w-5xl mx-auto px-5 sm:px-6 py-16 sm:py-20">
        <div className="grid md:grid-cols-[minmax(0,20rem)_1fr] gap-8 md:gap-16 items-start">
          <div>
            <p className="text-[13px] font-medium text-[var(--color-lime)] mb-3">Coverage</p>
            <h2 className="text-2xl sm:text-3xl font-bold font-serif tracking-tight text-white leading-tight">
              Analytics and scores across every major sport
            </h2>
          </div>
          <ul className="flex flex-wrap gap-x-8 gap-y-3 md:pt-2">
            {sports.map((sport) => (
              <li key={sport} className="text-base text-white/70 font-medium">
                {sport}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Comparison — plain, confident table */}
      <section className="max-w-5xl mx-auto px-5 sm:px-6 py-16 sm:py-24">
        <p className="text-[13px] font-medium text-[var(--color-lime)] mb-3">The honest comparison</p>
        <h2 className="text-2xl sm:text-3xl font-bold font-serif tracking-tight text-white mb-10">
          How we stack up
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[560px]">
            <thead>
              <tr className="text-left">
                <th className="py-3 pr-4 font-medium text-[var(--color-text-muted)] text-xs">Capability</th>
                <th className="py-3 px-4 font-bold text-[var(--color-lime)] text-center">Lasyly</th>
                <th className="py-3 px-4 font-medium text-[var(--color-text-muted)] text-xs text-center">Action Network</th>
                <th className="py-3 px-4 font-medium text-[var(--color-text-muted)] text-xs text-center">Discord</th>
                <th className="py-3 px-4 font-medium text-[var(--color-text-muted)] text-xs text-center">PrizePicks</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map(([feat, ...vals]) => (
                <tr key={feat} className="border-t border-[var(--color-border)]">
                  <td className="py-3.5 pr-4 text-white/80">{feat}</td>
                  {vals.map((v, i) => (
                    <td key={i} className="py-3.5 px-4 text-center">
                      <Cell value={v} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* CTA — restrained, no gradient-border card */}
      <section className="max-w-5xl mx-auto px-5 sm:px-6 pb-24 sm:pb-32">
        <div className="border-t border-[var(--color-border)] pt-16 sm:pt-20">
          <h2 className="text-3xl sm:text-4xl font-bold font-serif tracking-tight text-white max-w-[18ch] leading-tight">
            All of it, free
          </h2>
          <p className="mt-5 text-[var(--color-text-muted)] max-w-[52ch] text-base leading-relaxed">
            No subscription, no paywall on analytics. Create an account and research your first prop in under a minute.
          </p>
          <Link href="/signup" className="mt-8 inline-flex items-center gap-2 bg-[var(--color-lime)] text-black font-semibold px-7 py-3.5 rounded-full text-sm hover:scale-[0.98] active:scale-[0.96] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]">
            Create free account
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
        </div>
      </section>
    </main>
  )
}
