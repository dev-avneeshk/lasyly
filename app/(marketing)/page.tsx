import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { JsonLd } from "@/components/seo/JsonLd"

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
  {
    color: "var(--color-lime)",
    title: "Prop Analytics",
    desc: "Hit rates, matchup grades A–F, confidence scores, trend arrows, correlations, line movement. Every metric computed from real scraped historical data.",
    href: "/analysis",
  },
  {
    color: "#6C63FF",
    title: "Betting Rooms",
    desc: "Real-time community spaces where bettors share picks, chat, and react to betslips. Public, private, and tipster-gated rooms.",
    href: "/explore",
  },
  {
    color: "#00D4AA",
    title: "Live Scores",
    desc: "10+ sports with real-time polling, ESPN team logos, match detail modals, and YouTube highlights.",
    href: "/scores",
  },
  {
    color: "#F59E0B",
    title: "Tipster Marketplace",
    desc: "Sell your picks and keep 85% of every sale. Build a verified track record your followers can trust.",
    href: "/tipsters",
  },
  {
    color: "#EC4899",
    title: "Bet Tracker",
    desc: "Log every pick, track win rate, ROI, and net profit. Find your actual edge over time.",
    href: "/bets",
  },
  {
    color: "#14B8A6",
    title: "Sports News",
    desc: "Curated news from ESPN across NFL, NBA, Soccer, UFC, Tennis, F1, and Cricket — served instantly from our own database.",
    href: "/news",
  },
]

const BASE_URL = "https://lasyly.me"

export default function LandingPage() {
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
        "contactPoint": { "@type": "ContactPoint", "email": "team@lasyly.com", "contactType": "customer support" },
      }} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "What is Lasyly?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Lasyly is a real-time social platform for sports bettors that combines prop analytics, betting rooms, live scores, curated news, and a tipster marketplace in one free app.",
            },
          },
          {
            "@type": "Question",
            "name": "Is Lasyly a sportsbook?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "No. Lasyly is an analytics and social platform — not a sportsbook or gambling operator. We do not accept bets, offer odds, or pay out winnings.",
            },
          },
          {
            "@type": "Question",
            "name": "How does the tipster marketplace work?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Tipsters create premium rooms and sell their picks to subscribers using Lasyly wallet credits. Tipsters keep 85% of every sale. Lasyly takes a 15% platform fee.",
            },
          },
          {
            "@type": "Question",
            "name": "Is Lasyly free to use?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. The core platform — prop analytics, rooms, live scores, bet tracker, and news — is completely free. Wallet credits are only needed to purchase premium picks from tipsters.",
            },
          },
        ],
      }} />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-lime)] mb-5">
            Sports betting, finally in one place
          </p>
          <h1 className="text-5xl md:text-7xl font-bold font-serif tracking-tight text-white leading-none mb-6">
            Where bettors<br />
            <span className="text-[var(--color-lime)]">win together.</span>
          </h1>
          <p className="text-lg md:text-xl text-[var(--color-text-muted)] leading-relaxed max-w-2xl mb-10">
            Prop analytics with real hit rates. Real-time betting rooms. Live scores across 10+ sports. A tipster marketplace where you keep 85%. All free. All in one app.
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <Link
              href="/signup"
              className="inline-block bg-[var(--color-lime)] text-black font-bold px-7 py-3.5 rounded-full text-sm hover:opacity-90 transition-opacity shadow-[0_0_30px_rgba(212,255,0,0.3)]"
            >
              Get started free →
            </Link>
            <Link
              href="/features"
              className="inline-block border border-[var(--color-border)] text-white font-medium px-7 py-3.5 rounded-full text-sm hover:border-white/30 transition-colors"
            >
              See all features
            </Link>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-4xl font-bold font-serif text-[var(--color-lime)] leading-none mb-1">{s.value}</p>
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Problem section */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-4">The problem</p>
            <h2 className="text-4xl font-bold font-serif text-white leading-tight mb-6">
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
                  <span className="mt-1 text-[var(--color-danger)] flex-shrink-0 text-sm font-bold">✕</span>
                  <p className="text-sm text-[var(--color-text-muted)]">{pain}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--color-lime)]/20 bg-[var(--color-lime)]/5 p-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-lime)] mb-4">The solution</p>
            <h3 className="text-2xl font-bold font-serif text-white mb-5">One app. No more switching.</h3>
            <div className="space-y-3">
              {[
                "Prop analytics with real historical data — free",
                "Real-time community rooms with betslip sharing",
                "Live scores across 10+ sports in one view",
                "News aggregated and ready, no tab switching",
                "Tipsters with verified public track records",
                "Build your record and earn from your picks",
              ].map((sol) => (
                <div key={sol} className="flex items-start gap-3">
                  <span className="mt-1 text-[var(--color-lime)] flex-shrink-0 text-sm font-bold">✓</span>
                  <p className="text-sm text-white/80">{sol}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-lime)] mb-3">Platform features</p>
          <h2 className="text-4xl font-bold font-serif text-white">Everything a bettor needs</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {features.map((f) => (
            <Link
              key={f.title}
              href={f.href}
              className="group block rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 hover:border-white/15 transition-colors"
            >
              <div
                className="w-2 h-2 rounded-full mb-4"
                style={{ background: f.color, boxShadow: `0 0 8px ${f.color}` }}
              />
              <h3 className="font-bold text-white mb-2 group-hover:text-[var(--color-lime)] transition-colors" style={{ color: f.color.startsWith('#') ? undefined : undefined }}>
                {f.title}
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{f.desc}</p>
            </Link>
          ))}
        </div>
        <div className="text-center mt-8">
          <Link href="/features" className="text-sm text-[var(--color-lime)] hover:underline">
            See full feature breakdown →
          </Link>
        </div>
      </section>

      {/* Tipster section */}
      <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)] py-20">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-lime)] mb-4">For tipsters</p>
            <h2 className="text-4xl font-bold font-serif text-white leading-tight mb-4">
              Your edge is worth money. Start earning it.
            </h2>
            <p className="text-[var(--color-text-muted)] leading-relaxed mb-6">
              Build a verified track record. Open a tipster room. Sell your picks. Keep 85% of every sale — no setup fees, no monthly charges.
            </p>
            <div className="grid grid-cols-2 gap-4 mb-8">
              {[
                { label: "Your cut", v: "85%" },
                { label: "Setup cost", v: "$0" },
                { label: "Platform fee", v: "15%" },
                { label: "Min. payout", v: "None" },
              ].map((s) => (
                <div key={s.label} className="border border-[var(--color-border)] rounded-xl p-4">
                  <p className="text-2xl font-bold font-serif text-white mb-1">{s.v}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{s.label}</p>
                </div>
              ))}
            </div>
            <Link
              href="/tipsters"
              className="inline-block bg-[var(--color-lime)] text-black font-bold text-sm px-6 py-3 rounded-full hover:opacity-90 transition-opacity"
            >
              Become a tipster →
            </Link>
          </div>
          <div className="space-y-4">
            {[
              { n: "01", t: "Log your picks", d: "Use the Bet Tracker to build a public, tamper-proof performance record." },
              { n: "02", t: "Share in rooms", d: "Post betslips to your community. Reactions and comments build your reputation." },
              { n: "03", t: "Open a tipster room", d: "Set a price for your picks. Subscribers join using wallet credits." },
              { n: "04", t: "Get paid", d: "Earnings settle in real-time. Withdraw anytime via Stripe." },
            ].map((step) => (
              <div key={step.n} className="flex gap-4 p-4 rounded-xl border border-[var(--color-border)]">
                <span className="font-serif font-bold text-2xl text-white/10 flex-shrink-0">{step.n}</span>
                <div>
                  <p className="font-bold text-white text-sm mb-1">{step.t}</p>
                  <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{step.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Blog preview */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="flex items-center justify-between mb-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-lime)] mb-2">From the blog</p>
            <h2 className="text-3xl font-bold font-serif text-white">Learn to bet smarter</h2>
          </div>
          <Link href="/blog" className="text-sm text-[var(--color-lime)] hover:underline hidden md:block">
            All posts →
          </Link>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { slug: "why-share-your-betslip", cat: "Community", title: "Why You Should Share Your Betslip (Even When You Lose)", time: "6 min" },
            { slug: "how-to-read-prop-analytics", cat: "Analytics", title: "How to Read Prop Analytics: Hit Rates, Matchup Grades & Confidence Scores", time: "8 min" },
            { slug: "nba-player-props-guide", cat: "NBA", title: "The Complete Guide to NBA Player Props in 2026", time: "10 min" },
          ].map((p) => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              className="group block rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 hover:border-white/15 transition-colors"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-lime)]">{p.cat}</span>
                <span className="text-xs text-[var(--color-text-muted)]">{p.time} read</span>
              </div>
              <h3 className="font-bold text-white text-sm leading-snug group-hover:text-[var(--color-lime)] transition-colors">
                {p.title}
              </h3>
            </Link>
          ))}
        </div>
      </section>

      {/* FAQ (matches JSON-LD above) */}
      <section className="border-t border-[var(--color-border)] py-20">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold font-serif text-white">Common questions</h2>
          </div>
          <div className="space-y-0">
            {[
              { q: "What is Lasyly?", a: "Lasyly is a real-time social platform for sports bettors that combines prop analytics, betting rooms, live scores, curated sports news, and a tipster marketplace in one free app." },
              { q: "Is Lasyly a sportsbook?", a: "No. Lasyly is an analytics and social platform — not a sportsbook or gambling operator. We do not accept bets, offer odds, or pay out winnings. All analytics are for informational purposes only." },
              { q: "How does the tipster marketplace work?", a: "Tipsters create premium rooms and sell their picks to subscribers using Lasyly wallet credits. Tipsters keep 85% of every sale. Lasyly takes a 15% platform fee. Earnings withdraw via Stripe." },
              { q: "Is Lasyly free to use?", a: "Yes. Prop analytics, rooms, live scores, bet tracker, and news are all completely free. Wallet credits are only needed to purchase premium picks from tipsters." },
              { q: "Where does the data come from?", a: "We scrape basketball-reference.com for NBA stats, tennisabstract.com for tennis, fbref.com for soccer, and use the ESPN public API for live scores, team logos, and news. All data is computed in-house — no paid odds feeds." },
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
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="rounded-2xl border border-[var(--color-lime)]/20 bg-[var(--color-lime)]/5 p-12 md:p-16 text-center">
          <h2 className="text-4xl md:text-5xl font-bold font-serif text-white mb-4 leading-tight">
            Stop betting blind.<br />Start winning smarter.
          </h2>
          <p className="text-[var(--color-text-muted)] max-w-md mx-auto mb-8 text-lg">
            Join free. No credit card. Research your first prop in under a minute.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-[var(--color-lime)] text-black font-bold px-8 py-4 rounded-full text-base hover:opacity-90 transition-opacity shadow-[0_0_40px_rgba(212,255,0,0.25)]"
          >
            Create free account →
          </Link>
        </div>
      </section>
    </>
  )
}
