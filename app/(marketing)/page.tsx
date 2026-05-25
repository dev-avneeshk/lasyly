import type { Metadata } from "next"
import Link from "next/link"
import { JsonLd } from "@/components/seo/JsonLd"
import { createAdminClient } from "@/lib/supabase/admin"

export const revalidate = 60

export const metadata: Metadata = {
  title: "Lasyly — Sports Betting Analytics, Rooms & Tipster Marketplace",
  description:
    "The all-in-one platform for sports bettors. Real-time betting rooms, NBA prop analytics with hit rates and matchup grades, live scores across 10+ sports, and a tipster marketplace where you earn 85% of every pick you sell.",
  alternates: {
    canonical: "https://lasyly.me",
    types: { "application/rss+xml": "https://lasyly.me/blog/feed.xml" },
  },
  openGraph: {
    title: "Lasyly — Sports Betting Analytics, Rooms & Tipster Marketplace",
    description:
      "Real-time betting rooms, prop analytics with hit rates, live scores, and a tipster marketplace. All free. All in one app.",
    type: "website",
    url: "https://lasyly.me",
  },
}

const stats = [
  { label: "Sports covered", value: "10+" },
  { label: "Tipster revenue share", value: "85%" },
  { label: "Data cost to you", value: "$0" },
  { label: "Apps replaced", value: "6" },
]

const features = [
  { color: "var(--color-lime)", title: "Prop Analytics", desc: "Hit rates, matchup grades A–F, confidence scores, trend arrows, correlations, line movement. Every metric computed from real scraped historical data.", href: "/analysis" },
  { color: "#6C63FF", title: "Betting Rooms", desc: "Real-time community spaces where bettors share picks, chat, and react to betslips. Public, private, and tipster-gated rooms.", href: "/explore" },
  { color: "#00D4AA", title: "Live Scores", desc: "10+ sports with real-time polling, ESPN team logos, match detail modals, and YouTube highlights.", href: "/scores" },
  { color: "#F59E0B", title: "Tipster Marketplace", desc: "Sell your picks and keep 85% of every sale. Build a verified track record your followers can trust.", href: "/tipsters" },
  { color: "#EC4899", title: "Bet Tracker", desc: "Log every pick, track win rate, ROI, and net profit. Find your actual edge over time.", href: "/bets" },
  { color: "#14B8A6", title: "Sports News", desc: "Curated news from ESPN across NFL, NBA, Soccer, UFC, Tennis, F1, and Cricket — served instantly from our own database.", href: "/news" },
]

const BASE_URL = "https://lasyly.me"

const FALLBACK_TRENDING = [
  { slug: "spurs-thunder-game-4-recap-2026", category: "NBA Playoffs", title: "Wembanyama 33 Pts: Spurs Rout Thunder 103-82, West Finals Tied 2-2", readTime: "7 min", accent: "#F59E0B" },
  { slug: "how-to-read-prop-analytics", category: "Analytics", title: "How to Read Prop Analytics: Hit Rates, Matchup Grades & Confidence Scores", readTime: "8 min", accent: "#6C63FF" },
  { slug: "nba-player-props-guide", category: "NBA", title: "The Complete Guide to NBA Player Props in 2026", readTime: "10 min", accent: "#F59E0B" },
]

export default async function LandingPage() {
  const supabase = createAdminClient()
  const { data: dbPosts } = await supabase
    .from("blog_posts")
    .select("slug, title, category, read_time, accent")
    .eq("published", true)
    .order("published_at", { ascending: false })
    .limit(3)

  const trendingPosts =
    dbPosts && dbPosts.length > 0
      ? dbPosts.map((p: { slug: string; title: string; category: string; read_time: string; accent: string }) => ({
          slug: p.slug, category: p.category, title: p.title, readTime: p.read_time, accent: p.accent,
        }))
      : FALLBACK_TRENDING

  return (
    <>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Lasyly",
        "url": BASE_URL,
        "logo": `${BASE_URL}/lasyly_logo.png`,
        "description": "Real-time social platform for sports bettors — prop analytics, betting rooms, live scores, tipster marketplace.",
        "sameAs": [],
        "contactPoint": { "@type": "ContactPoint", "email": "dev.avneeshkumar@gmail.com", "contactType": "customer support" },
      }} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          { "@type": "Question", "name": "What is Lasyly?", "acceptedAnswer": { "@type": "Answer", "text": "Lasyly is a real-time social platform for sports bettors that combines prop analytics, betting rooms, live scores, curated news, and a tipster marketplace in one free app." } },
          { "@type": "Question", "name": "Is Lasyly a sportsbook?", "acceptedAnswer": { "@type": "Answer", "text": "No. Lasyly is an analytics and social platform — not a sportsbook or gambling operator. We do not accept bets, offer odds, or pay out winnings." } },
          { "@type": "Question", "name": "How does the tipster marketplace work?", "acceptedAnswer": { "@type": "Answer", "text": "Tipsters create premium rooms and sell their picks to subscribers using Lasyly wallet credits. Tipsters keep 85% of every sale. Lasyly takes a 15% platform fee." } },
          { "@type": "Question", "name": "Is Lasyly free to use?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. The core platform — prop analytics, rooms, live scores, bet tracker, and news — is completely free. Wallet credits are only needed to purchase premium picks from tipsters." } },
        ],
      }} />

      {/* Hero — left-aligned, asymmetric */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 sm:pb-20">
        <div className="max-w-3xl">
          <div className="mb-5">
            <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--color-lime)] bg-[var(--color-lime)]/8 px-3 py-1.5 rounded-full border border-[var(--color-lime)]/15">
              Sports betting, finally in one place
            </span>
          </div>
          <h1 className="text-[2.75rem] sm:text-[3.5rem] md:text-[4.5rem] font-bold font-serif tracking-tight text-white leading-[1.05] mb-6">
            Where bettors<br />
            <span className="text-[var(--color-lime)]">win together.</span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-white/50 leading-relaxed max-w-[52ch] mb-10">
            Prop analytics with real hit rates. Real-time betting rooms. Live scores across 10+ sports. A tipster marketplace where you keep 85%. All free.
          </p>
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-[var(--color-lime)] text-black font-bold px-7 py-3.5 rounded-full text-sm hover:scale-[0.98] active:scale-[0.96] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] shadow-[0_0_40px_rgba(212,255,0,0.25)]"
            >
              Get started free
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>
            <Link
              href="/features"
              className="inline-block border border-[var(--color-border)] text-white font-medium px-7 py-3.5 rounded-full text-sm hover:border-white/20 transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            >
              See all features
            </Link>
          </div>
        </div>
      </section>

      {/* Stats strip — double-bezel */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
        <div className="rounded-[1.5rem] p-[1px] bg-gradient-to-r from-[var(--color-lime)]/20 via-white/5 to-transparent">
          <div className="rounded-[calc(1.5rem-1px)] bg-[var(--color-surface)] py-8 px-6 grid grid-cols-2 md:grid-cols-4 gap-8 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-3xl sm:text-4xl font-bold font-serif text-[var(--color-lime)] leading-none mb-1.5">{s.value}</p>
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="h-[1px] bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent" />
      </div>

      {/* Problem / Solution */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-start">
          <div>
            <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-4">The problem</span>
            <h2 className="text-2xl sm:text-[2rem] font-bold font-serif tracking-tight text-white leading-tight mb-8">
              You&apos;re juggling 4–6 apps just to place one informed bet.
            </h2>
            <div className="space-y-4">
              {[
                "Analytics on PropShark or StatMuse",
                "Community on Discord, disconnected from data",
                "Scores on ESPN or SofaScore",
                "News in a browser tab",
                "Picks from an unverified Twitter account",
                "Paying $30–100/month for tools that should be free",
              ].map((pain) => (
                <div key={pain} className="flex items-start gap-3">
                  <span className="mt-0.5 w-4 h-4 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  </span>
                  <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{pain}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] p-[1px] bg-gradient-to-br from-[var(--color-lime)]/25 to-transparent">
            <div className="rounded-[calc(1.5rem-1px)] bg-[var(--color-surface)] p-8 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
              <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--color-lime)] mb-4">The solution</span>
              <h3 className="text-xl font-bold font-serif text-white mb-6">One app. No more switching.</h3>
              <div className="space-y-4">
                {[
                  "Prop analytics with real historical data — free",
                  "Real-time community rooms with betslip sharing",
                  "Live scores across 10+ sports in one view",
                  "News aggregated and ready, no tab switching",
                  "Tipsters with verified public track records",
                  "Build your record and earn from your picks",
                ].map((sol) => (
                  <div key={sol} className="flex items-start gap-3">
                    <span className="mt-0.5 w-4 h-4 rounded-full bg-[var(--color-lime)]/10 flex items-center justify-center shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-lime)]" />
                    </span>
                    <p className="text-sm text-white/80 leading-relaxed">{sol}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features — asymmetric bento layout, not identical grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <div className="mb-10">
          <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--color-lime)] mb-3">Platform features</span>
          <h2 className="text-2xl sm:text-3xl font-bold font-serif tracking-tight text-white">Everything a bettor needs</h2>
        </div>
        {/* Row 1: featured large + two stacked small */}
        <div className="grid md:grid-cols-[1.4fr_1fr] gap-4 mb-4">
          <Link href={features[0].href} className="group block rounded-[1.25rem] p-[1px] bg-gradient-to-b from-white/6 to-transparent hover:from-white/12 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]">
            <div className="rounded-[calc(1.25rem-1px)] bg-[var(--color-surface)] p-7 md:p-8 h-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
              <div className="w-2 h-2 rounded-full mb-5" style={{ background: features[0].color, boxShadow: `0 0 12px ${features[0].color}60` }} />
              <h3 className="text-lg font-bold text-white mb-2 group-hover:text-[var(--color-lime)] transition-colors duration-300">{features[0].title}</h3>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed max-w-[48ch]">{features[0].desc}</p>
            </div>
          </Link>
          <div className="grid gap-4">
            {features.slice(1, 3).map((f) => (
              <Link key={f.title} href={f.href} className="group block rounded-[1.25rem] p-[1px] bg-gradient-to-b from-white/6 to-transparent hover:from-white/12 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]">
                <div className="rounded-[calc(1.25rem-1px)] bg-[var(--color-surface)] p-6 h-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
                  <div className="w-2 h-2 rounded-full mb-4" style={{ background: f.color, boxShadow: `0 0 12px ${f.color}60` }} />
                  <h3 className="font-bold text-white mb-1.5 group-hover:text-[var(--color-lime)] transition-colors duration-300">{f.title}</h3>
                  <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{f.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
        {/* Row 2: three equal but different from row 1 */}
        <div className="grid sm:grid-cols-3 gap-4">
          {features.slice(3).map((f) => (
            <Link key={f.title} href={f.href} className="group block rounded-[1.25rem] p-[1px] bg-gradient-to-b from-white/6 to-transparent hover:from-white/12 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]">
              <div className="rounded-[calc(1.25rem-1px)] bg-[var(--color-surface)] p-6 h-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
                <div className="w-2 h-2 rounded-full mb-4" style={{ background: f.color, boxShadow: `0 0 12px ${f.color}60` }} />
                <h3 className="font-bold text-white mb-1.5 group-hover:text-[var(--color-lime)] transition-colors duration-300">{f.title}</h3>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{f.desc}</p>
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-8">
          <Link href="/features" className="text-sm text-[var(--color-lime)] hover:underline transition-colors">
            See full feature breakdown →
          </Link>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="h-[1px] bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent" />
      </div>

      {/* Tipster section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-24 sm:py-32">
        <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
          <div>
            <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-lime)] mb-4">For tipsters</span>
            <h2 className="text-3xl sm:text-4xl font-bold font-serif tracking-tight text-white leading-tight mb-5">
              Your edge is worth money. Start earning it.
            </h2>
            <p className="text-base text-[var(--color-text-muted)] leading-relaxed mb-8 max-w-[48ch]">
              Build a verified track record. Open a tipster room. Sell your picks. Keep 85% of every sale — no setup fees, no monthly charges.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {[
                { label: "Your cut", v: "85%" },
                { label: "Setup cost", v: "$0" },
                { label: "Platform fee", v: "15%" },
                { label: "Min. payout", v: "None" },
              ].map((s) => (
                <div key={s.label} className="rounded-[1rem] p-[1px] bg-gradient-to-b from-white/8 to-transparent">
                  <div className="rounded-[calc(1rem-1px)] bg-[var(--color-surface)] p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
                    <p className="text-2xl font-bold font-serif text-white mb-0.5">{s.v}</p>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-text-muted)]">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link
              href="/tipsters"
              className="inline-flex items-center gap-2 bg-[var(--color-lime)] text-black font-bold text-sm px-6 py-3 rounded-full hover:scale-[0.98] active:scale-[0.96] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            >
              Become a tipster
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>
          </div>
          <div className="space-y-3">
            {[
              { n: "01", t: "Log your picks", d: "Use the Bet Tracker to build a public, tamper-proof performance record." },
              { n: "02", t: "Share in rooms", d: "Post betslips to your community. Reactions and comments build your reputation." },
              { n: "03", t: "Open a tipster room", d: "Set a price for your picks. Subscribers join using wallet credits." },
              { n: "04", t: "Get paid", d: "Earnings settle in real-time. Withdraw anytime via Stripe." },
            ].map((step) => (
              <div key={step.n} className="flex gap-4 rounded-[1rem] p-[1px] bg-gradient-to-r from-white/5 to-transparent">
                <div className="flex gap-4 rounded-[calc(1rem-1px)] bg-[var(--color-surface)] p-5 w-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)]">
                  <span className="font-serif font-bold text-2xl text-white/8 shrink-0">{step.n}</span>
                  <div>
                    <p className="font-bold text-white text-sm mb-1">{step.t}</p>
                    <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{step.d}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="h-[1px] bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent" />
      </div>

      {/* Trending */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="flex items-end justify-between mb-10">
          <div>
            <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-lime)] mb-3">Trending now</span>
            <h2 className="text-2xl sm:text-3xl font-bold font-serif tracking-tight text-white">What bettors are reading</h2>
          </div>
          <Link href="/blog" className="text-sm text-[var(--color-lime)] hover:underline hidden md:block">All posts →</Link>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {trendingPosts.map((p, i) => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              className="group block rounded-[1.25rem] p-[1px] bg-gradient-to-b from-white/6 to-transparent hover:from-white/12 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
            >
              <div className="rounded-[calc(1.25rem-1px)] bg-[var(--color-surface)] p-6 h-full relative overflow-hidden shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
                <span className="absolute top-3 right-4 text-6xl font-serif font-bold leading-none select-none pointer-events-none" style={{ color: `${p.accent}08` }}>
                  {i + 1}
                </span>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 rounded-full" style={{ background: `${p.accent}15`, color: p.accent }}>
                    {p.category}
                  </span>
                  <span className="text-[11px] text-[var(--color-text-muted)]">{p.readTime}</span>
                </div>
                <h3 className="font-bold text-white text-sm leading-snug group-hover:text-[var(--color-lime)] transition-colors duration-300 mb-4">
                  {p.title}
                </h3>
                <span className="text-xs font-semibold text-[var(--color-lime)] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  Read post →
                </span>
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-5 text-center md:hidden">
          <Link href="/blog" className="text-sm text-[var(--color-lime)] hover:underline">See all posts →</Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20 sm:pb-28">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold font-serif tracking-tight text-white text-center mb-12">Common questions</h2>
          <div className="space-y-0">
            {[
              { q: "What is Lasyly?", a: "Lasyly is a real-time social platform for sports bettors that combines prop analytics, betting rooms, live scores, curated sports news, and a tipster marketplace in one free app." },
              { q: "Is Lasyly a sportsbook?", a: "No. Lasyly is an analytics and social platform — not a sportsbook or gambling operator. We do not accept bets, offer odds, or pay out winnings. All analytics are for informational purposes only." },
              { q: "How does the tipster marketplace work?", a: "Tipsters create premium rooms and sell their picks to subscribers using Lasyly wallet credits. Tipsters keep 85% of every sale. Lasyly takes a 15% platform fee. Earnings withdraw via Stripe." },
              { q: "Is Lasyly free to use?", a: "Yes. Prop analytics, rooms, live scores, bet tracker, and news are all completely free. Wallet credits are only needed to purchase premium picks from tipsters." },
              { q: "Where does the data come from?", a: "We scrape basketball-reference.com for NBA stats, tennisabstract.com for tennis, fbref.com for soccer, and use the ESPN public API for live scores, team logos, and news. All data is computed in-house." },
            ].map((faq, i, arr) => (
              <div key={faq.q} className={`py-6 ${i < arr.length - 1 ? "border-b border-[var(--color-border)]" : ""}`}>
                <h3 className="font-bold text-white mb-2">{faq.q}</h3>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20 sm:pb-28">
        <div className="rounded-[2rem] p-[1px] bg-gradient-to-br from-[var(--color-lime)]/25 via-transparent to-[#6C63FF]/15">
          <div className="rounded-[calc(2rem-1px)] bg-[var(--color-surface)] p-10 sm:p-14 md:p-20 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold font-serif tracking-tight text-white mb-4 leading-tight">
              Stop betting blind.<br />Start winning smarter.
            </h2>
            <p className="text-[var(--color-text-muted)] max-w-md mx-auto mb-8 text-base sm:text-lg">
              Join free. No credit card. Research your first prop in under a minute.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-[var(--color-lime)] text-black font-bold px-8 py-4 rounded-full text-sm hover:scale-[0.98] active:scale-[0.96] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] shadow-[0_0_50px_rgba(212,255,0,0.2)]"
            >
              Create free account
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
