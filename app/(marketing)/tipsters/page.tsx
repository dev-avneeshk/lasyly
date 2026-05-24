import type { Metadata } from "next"
import Link from "next/link"
import { JsonLd } from "@/components/seo/JsonLd"

export const metadata: Metadata = {
  title: "Become a Tipster on Lasyly — Monetize Your Sports Betting Picks",
  description:
    "Turn your edge into income. Lasyly lets skilled sports bettors sell their picks to followers, keep 85% of every sale, and build a verified track record. Join the tipster marketplace.",
  openGraph: {
    title: "Become a Tipster on Lasyly — Monetize Your Picks",
    description:
      "Sell your picks, keep 85% of every sale, and build a verified track record. The tipster marketplace for serious bettors.",
    type: "website",
  },
  alternates: {
    canonical: "https://lasyly.me/tipsters",
  },
}

const howItWorks = [
  {
    n: "01",
    title: "Build your track record",
    desc: "Log every pick in the Bet Tracker. Every shared betslip builds your public profile — win rate, ROI, and sport breakdown, automatically tracked.",
  },
  {
    n: "02",
    title: "Open a Tipster Room",
    desc: "Create a premium room with a monthly subscription price. Your followers join to get your picks, commentary, and exclusive analysis.",
  },
  {
    n: "03",
    title: "Share picks and get paid",
    desc: "Share betslips directly in your tipster room. Subscribers pay with Lasyly wallet credits. You get paid instantly — no waiting, no invoice.",
  },
  {
    n: "04",
    title: "Keep 85% of everything",
    desc: "Lasyly takes a 15% platform fee. You keep the rest. No setup fees, no monthly charges, no minimum payout threshold.",
  },
]

const faqs = [
  {
    q: "How do I become a tipster?",
    a: "Any verified Lasyly account can create a Tipster Room and start selling picks. You don't need approval or a minimum track record to start — but building a public record first is what drives subscription growth.",
  },
  {
    q: "How are my earnings paid out?",
    a: "Earnings accumulate as wallet credits and can be withdrawn via Stripe. Payouts are processed automatically once your balance exceeds the minimum threshold.",
  },
  {
    q: "Can followers see my full pick history?",
    a: "Yes. Your public profile shows every pick you've shared, including losses. This transparency is what builds trust and drives subscriptions. You can't hide or delete logged picks from your record.",
  },
  {
    q: "What if I'm in a bad run?",
    a: "Variance is part of betting. Your profile shows streaks alongside overall stats, so followers can see context. Many of the best tipsters on the platform have documented losing streaks — it's the long-term record that matters.",
  },
  {
    q: "Do I have to be profitable to start a tipster room?",
    a: "No. You can open a tipster room at any point. But follower acquisition is driven by your track record — the better your documented performance, the faster your subscriber base grows.",
  },
  {
    q: "What sports can I cover?",
    a: "Any sport supported on Lasyly: NBA, NFL, Soccer, Tennis, NHL, MLB, F1, UFC, Golf, and Cricket. You can also mix sports in a single tipster room.",
  },
]

export default function TipstersPage() {
  const baseUrl = "https://lasyly.me"
  return (
    <div>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faqs.map((faq) => ({
          "@type": "Question",
          "name": faq.q,
          "acceptedAnswer": { "@type": "Answer", "text": faq.a },
        })),
      }} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Service",
        "name": "Lasyly Tipster Marketplace",
        "url": `${baseUrl}/tipsters`,
        "description": "Sell sports betting picks to followers, keep 85% of every sale, and build a verified track record on Lasyly.",
        "provider": { "@type": "Organization", "name": "Lasyly", "url": baseUrl },
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "description": "Free to join. 15% platform fee on pick sales.",
        },
      }} />
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-lime)] mb-4">Tipster Marketplace</p>
            <h1 className="text-5xl md:text-6xl font-bold font-serif tracking-tight text-white leading-tight mb-6">
              Your edge.<br />Your income.
            </h1>
            <p className="text-lg text-[var(--color-text-muted)] leading-relaxed mb-8">
              Lasyly is the platform where skilled sports bettors turn their track record into a real business. Sell picks, build a following, and keep 85% of every sale.
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <Link
                href="/signup"
                className="inline-block bg-[var(--color-lime)] text-black font-bold text-sm px-6 py-3 rounded-full hover:opacity-90 transition-opacity"
              >
                Start as a tipster →
              </Link>
              <Link
                href="/explore"
                className="inline-block border border-[var(--color-border)] text-white font-medium text-sm px-6 py-3 rounded-full hover:border-white/30 transition-colors"
              >
                Browse tipsters
              </Link>
            </div>
          </div>

          {/* Stats panel */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Tipster revenue split", value: "85%", note: "You keep — we take 15%" },
              { label: "Setup cost", value: "$0", note: "Free to start, no monthly fee" },
              { label: "Sports supported", value: "10+", note: "NBA, NFL, Soccer, Tennis & more" },
              { label: "Payout speed", value: "Instant", note: "Credits settle in real-time" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">{s.label}</p>
                <p className="text-3xl font-bold font-serif text-[var(--color-lime)] leading-none mb-1">{s.value}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{s.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)] py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-lime)] mb-3">Simple process</p>
            <h2 className="text-4xl font-bold font-serif text-white">How it works</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {howItWorks.map((step) => (
              <div key={step.n} className="flex flex-col gap-3 pt-5 border-t border-[var(--color-border)]">
                <p className="font-serif font-bold text-4xl text-white/10">{step.n}</p>
                <h3 className="font-bold text-white text-base">{step.title}</h3>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Lasyly for tipsters */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-lime)] mb-4">Why Lasyly</p>
            <h2 className="text-4xl font-bold font-serif text-white leading-tight mb-6">
              The first platform built for how bettors actually operate
            </h2>
            <div className="space-y-5">
              {[
                {
                  title: "Verified track record, automatically",
                  desc: "Your pick history is logged publicly and can't be altered. No cherry-picking wins. Followers can see your full record — which is exactly what builds trust.",
                },
                {
                  title: "Built-in audience",
                  desc: "Lasyly has active bettors already searching for good picks. You don't need an existing following to start building one.",
                },
                {
                  title: "Better margin than any alternative",
                  desc: "Twitter (no monetization), Discord (no payments), Substack (10–30% fees). Lasyly: 15% platform fee and you keep the rest.",
                },
                {
                  title: "Analytics make you look better",
                  desc: "Your picks come with hit rates, matchup grades, and confidence scores visible to subscribers. Good picks are backed by data, not just opinions.",
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-4">
                  <div className="mt-1 w-5 h-5 rounded-full bg-[var(--color-lime)]/15 flex items-center justify-center flex-shrink-0">
                    <span className="text-[var(--color-lime)] text-xs font-bold">✓</span>
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm mb-1">{item.title}</p>
                    <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-lime)]/20 bg-[var(--color-lime)]/5 p-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-lime)] mb-4">Revenue calculator</p>
            <p className="text-white font-bold text-xl mb-1">Simple math</p>
            <p className="text-[var(--color-text-muted)] text-sm mb-6">If 50 followers pay $20/month for your picks:</p>
            <div className="space-y-3">
              {[
                { label: "Gross revenue", value: "$1,000 / mo" },
                { label: "Platform fee (15%)", value: "−$150" },
                { label: "Your earnings", value: "$850 / mo", highlight: true },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-center py-2.5 border-b border-[var(--color-lime)]/10">
                  <span className="text-sm text-[var(--color-text-muted)]">{row.label}</span>
                  <span className={`font-bold text-sm ${row.highlight ? "text-[var(--color-lime)] text-base" : "text-white"}`}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-4">
              Scale to 200 subscribers at $20: $3,400/month. No caps, no limits.
            </p>
            <Link
              href="/signup"
              className="mt-6 block text-center bg-[var(--color-lime)] text-black font-bold text-sm px-5 py-3 rounded-full hover:opacity-90 transition-opacity"
            >
              Start building your following →
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-[var(--color-border)] py-20">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold font-serif text-white">Frequently asked questions</h2>
          </div>
          <div className="space-y-0">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className={`py-6 ${i < faqs.length - 1 ? "border-b border-[var(--color-border)]" : ""}`}
              >
                <h3 className="font-bold text-white mb-2 text-base">{faq.q}</h3>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center">
          <h2 className="text-4xl font-bold font-serif text-white mb-4">Ready to monetize your edge?</h2>
          <p className="text-[var(--color-text-muted)] max-w-md mx-auto mb-8">
            Create your free account, log your first picks, share them, and open your tipster room. No setup fee. No minimum track record required.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-[var(--color-lime)] text-black font-bold px-8 py-3.5 rounded-full text-sm hover:opacity-90 transition-opacity"
          >
            Become a tipster →
          </Link>
        </div>
      </section>
    </div>
  )
}
