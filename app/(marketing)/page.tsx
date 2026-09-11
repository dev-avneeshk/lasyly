import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { JsonLd } from "@/components/seo/JsonLd"
import { createAdminClient } from "@/lib/supabase/admin"
// Static import so Next infers intrinsic width/height (669x1200) at build time —
// no CLS, and no need to hand-maintain the dimensions.
import heroImage from "@/public/hero-optimized.png"

export const revalidate = 60

export const metadata: Metadata = {
  title: "Lasyly — Sports Prop Analytics, Rooms & Creator Picks",
  description:
    "Sports research the lazy way. Real-time rooms, NBA prop analytics with hit rates and matchup grades, live scores across 10+ sports, and independent creator analysis. All free.",
  alternates: {
    canonical: "https://lasyly.me",
    types: { "application/rss+xml": "https://lasyly.me/blog/feed.xml" },
  },
  openGraph: {
    title: "Lasyly — Sports Prop Analytics, Rooms & Creator Picks",
    description:
      "Real-time rooms, prop analytics with hit rates, live scores, and independent creator analysis. All free. All in one app.",
    type: "website",
    url: "https://lasyly.me",
  },
}

const stats = [
  { label: "Sports covered", value: "10+" },
  { label: "Cost to research", value: "$0" },
  { label: "Analytics access", value: "Free" },
  { label: "Apps replaced", value: "6" },
]

const features = [
  { no: "01", title: "Prop analytics", desc: "Hit rates, matchup grades from A to F, confidence scores, trend and streak signals, correlations, and line movement. Every metric is calculated in-house from historical sports statistics.", href: "/analysis" },
  { no: "02", title: "Rooms", desc: "Real-time spaces where people share picks, talk through games, and react to slips. Public, private, and premium rooms.", href: "/explore" },
  { no: "03", title: "Live scores", desc: "Ten-plus sports with adaptive polling, ESPN logos, a match detail view, and YouTube highlights.", href: "/scores" },
  { no: "04", title: "Creator picks", desc: "Independent creators share their own analysis and picks in their rooms. Follow the track records you trust.", href: "/tipsters" },
  { no: "05", title: "Pick tracker", desc: "Log your own picks, then track your hit rate, ROI, and net result over time. See where your edge is.", href: "/bets" },
  { no: "06", title: "Sports news", desc: "Curated news from ESPN across NFL, NBA, soccer, UFC, tennis, F1, and cricket, served straight from our own database.", href: "/news" },
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
        "description": "Real-time social platform for sports fans — prop analytics, community rooms, live scores, and independent creator analysis.",
        "sameAs": [],
        "contactPoint": { "@type": "ContactPoint", "email": "dev.avneeshkumar@gmail.com", "contactType": "customer support" },
      }} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          { "@type": "Question", "name": "What is Lasyly?", "acceptedAnswer": { "@type": "Answer", "text": "Lasyly is a real-time social platform for sports fans that combines prop analytics, community rooms, live scores, curated news, and independent creator analysis in one free app." } },
          { "@type": "Question", "name": "Is Lasyly a sportsbook?", "acceptedAnswer": { "@type": "Answer", "text": "No. Lasyly is an analytics and community platform — not a sportsbook or gambling operator. We do not accept, hold, or settle wagers, offer odds, or pay out winnings." } },
          { "@type": "Question", "name": "What are creator picks?", "acceptedAnswer": { "@type": "Answer", "text": "Creators can run rooms and share their own analysis and picks. Where creator monetization is available, members pay for access to that creator's content and community — not to place any bet. Availability varies by region." } },
          { "@type": "Question", "name": "Is Lasyly free to use?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. The core platform — prop analytics, rooms, live scores, pick tracker, and news — is completely free." } },
        ],
      }} />

      {/* Hero — two-column with phone mockup */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 sm:pb-20">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* Left — text */}
          <div className="flex flex-col flex-1 max-w-2xl">
            <div className="mb-5">
              <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--color-lime)] bg-[var(--color-lime)]/8 px-3 py-1.5 rounded-full border border-[var(--color-lime)]/15">
                Sports analytics, the lazy way
              </span>
            </div>
            <h1 className="text-[2.75rem] sm:text-[3.5rem] md:text-[4.5rem] font-bold font-serif tracking-tight text-white leading-[1.05] mb-6">
              Know more.<br />
              <span className="text-[var(--color-lime)]">Do less.</span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-white/50 leading-relaxed max-w-[52ch] mb-10">
              Prop analytics with real hit rates. Real-time rooms. Live scores across 10+ sports. Independent creator analysis. All free.
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

          {/* Right — phone mockup */}
          <div className="flex-shrink-0 relative w-[280px] sm:w-[320px] lg:w-[360px]">
            {/* Glow effect behind phone */}
            <div className="absolute inset-0 -inset-x-8 -inset-y-8 bg-[var(--color-lime)]/5 rounded-[3rem] blur-3xl pointer-events-none" />
            {/* This is the LCP element on desktop. It was a raw <img> pointing at
                the 842 KB source PNG, which shipped every one of those bytes to
                every visitor to fill a slot that is never wider than 360 CSS px.
                Routing it through next/image serves AVIF/WebP at the actual
                rendered width instead. `sizes` mirrors the wrapper's responsive
                widths below (Tailwind sm=640, lg=1024) so the browser picks the
                right candidate before layout; `priority` emits the preload link
                that the eager/fetchPriority pair used to provide. */}
            <Image
              src={heroImage}
              alt="Lasyly app showing player prop analytics with hit rates and matchup grades"
              sizes="(max-width: 639px) 280px, (max-width: 1023px) 320px, 360px"
              priority
              className="relative w-full h-auto drop-shadow-2xl"
            />
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
              You&apos;re juggling four to six apps just to make one informed pick.
            </h2>
            <div className="space-y-4">
              {[
                "Analytics on PropShark or StatMuse",
                "Community on Discord, disconnected from data",
                "Scores on ESPN or SofaScore",
                "News in a browser tab",
                "Picks from an unverified Twitter account",
                "Paying $30 to $100 a month for tools that should be free",
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
                  "Prop analytics with real historical data, free",
                  "Real-time community rooms with slip sharing",
                  "Live scores across 10+ sports in one view",
                  "News aggregated and ready, no tab switching",
                  "Creators with verified public track records",
                  "Build your record and grow your own audience",
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

      {/* Features — editorial numbered index */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-[13px] font-medium text-[var(--color-lime)] mb-3">What you get</p>
            <h2 className="text-2xl sm:text-3xl font-bold font-serif tracking-tight text-white max-w-[20ch]">Everything you need, nothing you don&apos;t</h2>
          </div>
          <Link href="/features" className="hidden sm:inline-block text-sm font-medium text-white/50 hover:text-[var(--color-lime)] transition-colors duration-200 whitespace-nowrap">
            Full breakdown →
          </Link>
        </div>
        <div className="border-t border-[var(--color-border)]">
          {features.map((f) => (
            <Link
              key={f.no}
              href={f.href}
              className="group grid grid-cols-[auto_1fr] sm:grid-cols-[auto_14rem_1fr] items-baseline gap-x-6 gap-y-1 py-6 border-b border-[var(--color-border)] hover:bg-white/[0.015] transition-colors duration-200"
            >
              <span className="font-serif text-2xl font-bold text-white/15 tabular-nums leading-none">{f.no}</span>
              <h3 className="text-lg font-bold text-white group-hover:text-[var(--color-lime)] transition-colors duration-200 col-start-2">
                {f.title}
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed col-start-2 sm:col-start-3 sm:row-start-1 max-w-[56ch]">
                {f.desc}
              </p>
            </Link>
          ))}
        </div>
        <Link href="/features" className="mt-6 inline-block sm:hidden text-sm font-medium text-[var(--color-lime)]">
          Full breakdown →
        </Link>
      </section>

      {/* Divider */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="h-[1px] bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent" />
      </div>

      {/* Seller section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-24 sm:py-32">
        <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
          <div>
            <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-lime)] mb-4">For creators</span>
            <h2 className="text-3xl sm:text-4xl font-bold font-serif tracking-tight text-white leading-tight mb-5">
              Your analysis. Your audience.
            </h2>
            <p className="text-base text-[var(--color-text-muted)] leading-relaxed mb-8 max-w-[48ch]">
              Build a public track record and open your own room. Where creator monetization is available in your region, members can pay for access to your content — and you keep the majority. Availability varies by region.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {[
                { label: "You keep", v: "Most" },
                { label: "Setup cost", v: "$0" },
                { label: "Track record", v: "Public" },
                { label: "Your content", v: "Yours" },
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
              Become a creator
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>
          </div>
          <div className="space-y-3">
            {[
              { n: "01", t: "Log your picks", d: "Use the Pick Tracker to build a public, tamper-proof performance record." },
              { n: "02", t: "Share in rooms", d: "Post your analysis to your community. Reactions and comments build your reputation." },
              { n: "03", t: "Open your own room", d: "Run a public or private room for your followers and share your picks and commentary." },
              { n: "04", t: "Grow your audience", d: "Where creator monetization is available in your region, members can pay for access to your content. Availability varies by region." },
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
            <h2 className="text-2xl sm:text-3xl font-bold font-serif tracking-tight text-white">What people are reading</h2>
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
              { q: "What is Lasyly?", a: "Lasyly is a real-time social platform for sports fans that combines prop analytics, community rooms, live scores, curated sports news, and independent creator analysis in one free app." },
              { q: "Is Lasyly a sportsbook?", a: "No. Lasyly is an analytics and community platform, not a sportsbook or gambling operator. We do not accept, hold, or settle wagers, offer odds, or pay out winnings, and we are not affiliated with any sportsbook. All analytics are for informational purposes only." },
              { q: "What are creator picks?", a: "Creators can open rooms and share their own analysis and picks. Where creator monetization is available, members pay for access to that creator's content and community — not to place any bet through Lasyly. Availability varies by region." },
              { q: "Is Lasyly free to use?", a: "Yes. Prop analytics, rooms, live scores, pick tracker, and news are all completely free." },
              { q: "Where does the data come from?", a: "Our analytics are calculated in-house from publicly available historical sports statistics. Live scores, team logos, and news are provided via the ESPN public API. See our Data Sources page for attribution." },
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
              Stop guessing.<br />Start researching.
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
