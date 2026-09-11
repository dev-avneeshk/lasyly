import type { Metadata } from "next"
import Link from "next/link"
import { JsonLd } from "@/components/seo/JsonLd"

export const metadata: Metadata = {
  title: "Become a Creator on Lasyly — Share Your Sports Analysis",
  description: "Build a public track record, run your own room, and grow an audience for your sports analysis and picks. Creator content is your own opinion; Lasyly does not accept or settle wagers.",
  openGraph: { title: "Become a Creator on Lasyly — Share Your Analysis", description: "Build a public track record, run your own room, and grow an audience for your sports analysis.", type: "website" },
  alternates: { canonical: "https://lasyly.me/tipsters" },
}

const howItWorks = [
  { n: "01", title: "Build your track record", desc: "Log every pick in the Pick Tracker. Every shared pick builds your public profile — hit rate, ROI, and sport breakdown, automatically tracked." },
  { n: "02", title: "Open your own room", desc: "Create a public or private room. Your followers join to get your picks, commentary, and analysis." },
  { n: "03", title: "Share your analysis", desc: "Post your picks and reasoning directly in your room. Reactions and comments build your reputation." },
  { n: "04", title: "Grow your audience", desc: "Where creator monetization is available in your region, members can pay for access to your content and community — not to place any bet. Availability varies by region." },
]

const faqs = [
  { q: "How do I become a creator?", a: "Any verified Lasyly account can create a room and start sharing analysis and picks. You don't need approval or a minimum track record to start." },
  { q: "Is creator monetization available now?", a: "Creator monetization is rolling out and its availability depends on your region and local law. Where it's available, members pay for access to your content and community — this is not a wager, and Lasyly does not accept, hold, or settle bets." },
  { q: "Can followers see my full pick history?", a: "Yes. Your public profile shows every pick you've shared, including losses. That transparency is what builds trust." },
  { q: "What if I'm in a bad run?", a: "Variance is part of sports. Your profile shows streaks alongside overall stats, so followers can see context. It's the long-term record that matters." },
  { q: "Are my picks a guarantee?", a: "No. Your picks are your own analysis and opinion. Past performance doesn't guarantee future results, and neither you nor Lasyly can promise any outcome." },
  { q: "What sports can I cover?", a: "Any sport supported on Lasyly: NBA, NFL, Soccer, Tennis, NHL, MLB, F1, UFC, Golf, and Cricket. You can mix sports in a single room." },
]

export default function TipstersPage() {
  const baseUrl = "https://lasyly.me"
  return (
    <div className="min-h-screen">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": faqs.map((faq) => ({ "@type": "Question", "name": faq.q, "acceptedAnswer": { "@type": "Answer", "text": faq.a } })) }} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Service", "name": "Lasyly Creator Rooms", "url": `${baseUrl}/tipsters`, "description": "Share sports analysis and picks with followers and build a public track record. Creator content is the creator's own opinion; Lasyly does not accept or settle wagers.", "provider": { "@type": "Organization", "name": "Lasyly", "url": baseUrl }, "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD", "description": "Free to join. Creator monetization availability varies by region." } }} />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 sm:pb-20">
        <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
          <div>
            <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-lime)] bg-[var(--color-lime)]/8 px-3 py-1.5 rounded-full border border-[var(--color-lime)]/15 mb-5">
              For creators
            </span>
            <h1 className="text-[2.5rem] sm:text-[3.5rem] md:text-[4rem] font-bold font-serif tracking-tight text-white leading-[1.08] mb-6">
              Your analysis.<br />Your audience.
            </h1>
            <p className="text-lg text-white/50 leading-relaxed mb-8 max-w-[48ch]">
              Lasyly is where sports fans build a public track record and grow an audience for their own analysis. Share your picks, build a following, and — where creator monetization is available in your region — earn from access to your content.
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <Link href="/signup" className="inline-flex items-center gap-2 bg-[var(--color-lime)] text-black font-bold text-sm px-6 py-3 rounded-full hover:scale-[0.98] active:scale-[0.96] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]">
                Become a creator
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
              <Link href="/explore" className="inline-block border border-[var(--color-border)] text-white font-medium text-sm px-6 py-3 rounded-full hover:border-white/20 transition-colors duration-300">
                Browse creators
              </Link>
            </div>
          </div>
          {/* Stats panel */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Setup cost", value: "$0", note: "Free to start, no monthly fee" },
              { label: "Track record", value: "Public", note: "Logged and verifiable" },
              { label: "Sports supported", value: "10+", note: "NBA, NFL, Soccer, Tennis & more" },
              { label: "Your content", value: "Yours", note: "You keep ownership of your posts" },
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
              A platform built for how sports fans actually share analysis
            </h2>
            <div className="space-y-6">
              {[
                { title: "Verified track record, automatically", desc: "Your pick history is logged publicly and can't be altered. No cherry-picking wins. Followers see your full record." },
                { title: "Built-in audience", desc: "Lasyly has active sports fans already searching for good analysis. You don't need an existing following to start building one." },
                { title: "Your content stays yours", desc: "You own what you post. Run a public or private room and build your community on your terms." },
                { title: "Analytics make you look better", desc: "Your picks come with hit rates, matchup grades, and confidence scores visible to followers. Good analysis is backed by data." },
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

          {/* How creator access works */}
          <div className="rounded-[1.5rem] p-[1px] bg-gradient-to-br from-[var(--color-lime)]/25 to-transparent">
            <div className="rounded-[calc(1.5rem-1px)] bg-[var(--color-surface)] p-8 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
              <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-lime)] mb-4">How creator access works</span>
              <p className="text-white font-bold text-xl mb-4">Content, not wagers</p>
              <div className="space-y-4">
                {[
                  "Where creator monetization is available in your region, members pay for access to your room and content — analysis, commentary, and picks.",
                  "Paying for access is not a wager. No bet is placed, held, or settled through Lasyly, and no betting account is created.",
                  "You keep the majority of what members pay; a platform fee applies. Exact terms and availability are shown in-product and depend on your region.",
                ].map((line) => (
                  <div key={line} className="flex gap-3">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--color-lime)] shrink-0" />
                    <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{line}</p>
                  </div>
                ))}
              </div>
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
            <h2 className="text-3xl sm:text-4xl font-bold font-serif tracking-tight text-white mb-4">Ready to grow your audience?</h2>
            <p className="text-[var(--color-text-muted)] max-w-md mx-auto mb-8">
              Create your free account, log your first picks, share them, and open your own room. No setup fee.
            </p>
            <Link href="/signup" className="inline-flex items-center gap-2 bg-[var(--color-lime)] text-black font-bold px-8 py-3.5 rounded-full text-sm hover:scale-[0.98] active:scale-[0.96] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]">
              Become a creator
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
