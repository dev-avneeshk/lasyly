import type { Metadata } from "next"
import Link from "next/link"
import { JsonLd } from "@/components/seo/JsonLd"

export const metadata: Metadata = {
  title: "Become a Tipster on Lasyly — Monetize Your Sports Betting Picks",
  description: "Turn your edge into income. Lasyly lets skilled sports bettors sell their picks to followers, keep 85% of every sale, and build a verified track record.",
  openGraph: { title: "Become a Tipster on Lasyly — Monetize Your Picks", description: "Sell your picks, keep 85% of every sale, and build a verified track record.", type: "website" },
  alternates: { canonical: "https://lasyly.me/tipsters" },
}

const howItWorks = [
  { n: "01", title: "Build your track record", desc: "Log every pick in the Bet Tracker. Every shared betslip builds your public profile — win rate, ROI, and sport breakdown, automatically tracked." },
  { n: "02", title: "Open a Tipster Room", desc: "Create a premium room with a monthly subscription price. Your followers join to get your picks, commentary, and exclusive analysis." },
  { n: "03", title: "Share picks and get paid", desc: "Share betslips directly in your tipster room. Subscribers pay with Lasyly wallet credits. You get paid instantly." },
  { n: "04", title: "Keep 85% of everything", desc: "Lasyly takes a 15% platform fee. You keep the rest. No setup fees, no monthly charges, no minimum payout threshold." },
]

const faqs = [
  { q: "How do I become a tipster?", a: "Any verified Lasyly account can create a Tipster Room and start selling picks. You don't need approval or a minimum track record to start." },
  { q: "How are my earnings paid out?", a: "Earnings accumulate as wallet credits and can be withdrawn via Stripe. Payouts are processed automatically once your balance exceeds the minimum threshold." },
  { q: "Can followers see my full pick history?", a: "Yes. Your public profile shows every pick you've shared, including losses. This transparency is what builds trust and drives subscriptions." },
  { q: "What if I'm in a bad run?", a: "Variance is part of betting. Your profile shows streaks alongside overall stats, so followers can see context. It's the long-term record that matters." },
  { q: "Do I have to be profitable to start?", a: "No. You can open a tipster room at any point. But follower acquisition is driven by your track record — the better your documented performance, the faster your subscriber base grows." },
  { q: "What sports can I cover?", a: "Any sport supported on Lasyly: NBA, NFL, Soccer, Tennis, NHL, MLB, F1, UFC, Golf, and Cricket. You can mix sports in a single tipster room." },
]

export default function TipstersPage() {
  const baseUrl = "https://lasyly.me"
  return (
    <div className="min-h-screen">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": faqs.map((faq) => ({ "@type": "Question", "name": faq.q, "acceptedAnswer": { "@type": "Answer", "text": faq.a } })) }} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Service", "name": "Lasyly Tipster Marketplace", "url": `${baseUrl}/tipsters`, "description": "Sell sports betting picks to followers, keep 85% of every sale.", "provider": { "@type": "Organization", "name": "Lasyly", "url": baseUrl }, "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD", "description": "Free to join. 15% platform fee on pick sales." } }} />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 sm:pb-20">
        <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
          <div>
            <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-lime)] bg-[var(--color-lime)]/8 px-3 py-1.5 rounded-full border border-[var(--color-lime)]/15 mb-5">
              Tipster Marketplace
            </span>
            <h1 className="text-[2.5rem] sm:text-[3.5rem] md:text-[4rem] font-bold font-serif tracking-tight text-white leading-[1.08] mb-6">
              Your edge.<br />Your income.
            </h1>
            <p className="text-lg text-white/50 leading-relaxed mb-8 max-w-[48ch]">
              Lasyly is the platform where skilled sports bettors turn their track record into a real business. Sell picks, build a following, and keep 85% of every sale.
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <Link href="/signup" className="inline-flex items-center gap-2 bg-[var(--color-lime)] text-black font-bold text-sm px-6 py-3 rounded-full hover:scale-[0.98] active:scale-[0.96] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]">
                Start as a tipster
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
              <Link href="/explore" className="inline-block border border-[var(--color-border)] text-white font-medium text-sm px-6 py-3 rounded-full hover:border-white/20 transition-colors duration-300">
                Browse tipsters
              </Link>
            </div>
          </div>
          {/* Stats panel */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Tipster revenue split", value: "85%", note: "You keep — we take 15%" },
              { label: "Setup cost", value: "$0", note: "Free to start, no monthly fee" },
              { label: "Sports supported", value: "10+", note: "NBA, NFL, Soccer, Tennis & more" },
              { label: "Payout speed", value: "Instant", note: "Credits settle in real-time" },
            ].map((s) => (
              <div key={s.label} className="rounded-[1.25rem] p-[1px] bg-gradient-to-b from-white/8 to-transparent">
                <div className="rounded-[calc(1.25rem-1px)] bg-[var(--color-surface)] p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-2">{s.label}</p>
                  <p className="text-3xl font-bold font-serif text-[var(--color-lime)] leading-none mb-1">{s.value}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{s.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6"><div className="h-[1px] bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent" /></div>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <div className="mb-12">
          <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-lime)] mb-3">Simple process</span>
          <h2 className="text-3xl sm:text-4xl font-bold font-serif tracking-tight text-white">How it works</h2>
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          {howItWorks.map((step) => (
            <div key={step.n} className="rounded-[1.25rem] p-[1px] bg-gradient-to-b from-white/6 to-transparent">
              <div className="rounded-[calc(1.25rem-1px)] bg-[var(--color-surface)] p-6 h-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
                <p className="font-serif font-bold text-3xl text-white/8 mb-3">{step.n}</p>
                <h3 className="font-bold text-white text-sm mb-2">{step.title}</h3>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6"><div className="h-[1px] bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent" /></div>

      {/* Why Lasyly */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-start">
          <div>
            <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-lime)] mb-4">Why Lasyly</span>
            <h2 className="text-3xl sm:text-4xl font-bold font-serif tracking-tight text-white leading-tight mb-8">
              The first platform built for how bettors actually operate
            </h2>
            <div className="space-y-6">
              {[
                { title: "Verified track record, automatically", desc: "Your pick history is logged publicly and can't be altered. No cherry-picking wins. Followers see your full record." },
                { title: "Built-in audience", desc: "Lasyly has active bettors already searching for good picks. You don't need an existing following to start building one." },
                { title: "Better margin than any alternative", desc: "Twitter (no monetization), Discord (no payments), Substack (10–30% fees). Lasyly: 15% platform fee and you keep the rest." },
                { title: "Analytics make you look better", desc: "Your picks come with hit rates, matchup grades, and confidence scores visible to subscribers. Good picks are backed by data." },
              ].map((item) => (
                <div key={item.title} className="flex gap-4">
                  <span className="mt-1 w-5 h-5 rounded-full bg-[var(--color-lime)]/10 flex items-center justify-center shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-lime)]" />
                  </span>
                  <div>
                    <p className="font-bold text-white text-sm mb-1">{item.title}</p>
                    <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Revenue calculator */}
          <div className="rounded-[1.5rem] p-[1px] bg-gradient-to-br from-[var(--color-lime)]/25 to-transparent">
            <div className="rounded-[calc(1.5rem-1px)] bg-[var(--color-surface)] p-8 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
              <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-lime)] mb-4">Revenue calculator</span>
              <p className="text-white font-bold text-xl mb-1">Simple math</p>
              <p className="text-[var(--color-text-muted)] text-sm mb-6">If 50 followers pay $20/month for your picks:</p>
              <div className="space-y-0">
                {[
                  { label: "Gross revenue", value: "$1,000 / mo", highlight: false },
                  { label: "Platform fee (15%)", value: "−$150", highlight: false },
                  { label: "Your earnings", value: "$850 / mo", highlight: true },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between items-center py-3 border-b border-[var(--color-border)] last:border-0">
                    <span className="text-sm text-[var(--color-text-muted)]">{row.label}</span>
                    <span className={`font-bold text-sm ${row.highlight ? "text-[var(--color-lime)] text-lg" : "text-white"}`}>{row.value}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-5">Scale to 200 subscribers at $20: $3,400/month. No caps.</p>
              <Link href="/signup" className="mt-6 block text-center bg-[var(--color-lime)] text-black font-bold text-sm px-5 py-3 rounded-full hover:scale-[0.98] active:scale-[0.96] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]">
                Start building your following
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6"><div className="h-[1px] bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent" /></div>
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <h2 className="text-3xl sm:text-4xl font-bold font-serif tracking-tight text-white text-center mb-12">Frequently asked questions</h2>
        <div className="space-y-0">
          {faqs.map((faq, i) => (
            <div key={i} className={`py-6 ${i < faqs.length - 1 ? "border-b border-[var(--color-border)]" : ""}`}>
              <h3 className="font-bold text-white mb-2">{faq.q}</h3>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20 sm:pb-28">
        <div className="rounded-[2rem] p-[1px] bg-gradient-to-br from-[var(--color-lime)]/25 via-transparent to-[#6C63FF]/15">
          <div className="rounded-[calc(2rem-1px)] bg-[var(--color-surface)] p-10 sm:p-14 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
            <h2 className="text-3xl sm:text-4xl font-bold font-serif tracking-tight text-white mb-4">Ready to monetize your edge?</h2>
            <p className="text-[var(--color-text-muted)] max-w-md mx-auto mb-8">
              Create your free account, log your first picks, share them, and open your tipster room. No setup fee.
            </p>
            <Link href="/signup" className="inline-flex items-center gap-2 bg-[var(--color-lime)] text-black font-bold px-8 py-3.5 rounded-full text-sm hover:scale-[0.98] active:scale-[0.96] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]">
              Become a tipster
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
