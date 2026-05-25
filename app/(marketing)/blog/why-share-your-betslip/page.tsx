import type { Metadata } from "next"
import Link from "next/link"
import { JsonLd } from "@/components/seo/JsonLd"
import BlogPostBackButton from "@/components/blog/BlogPostBackButton"
import BlogNewspaperWrapper from "@/components/blog/BlogNewspaperWrapper"

export const metadata: Metadata = {
  title: "Why You Should Share Your Betslip (Even When You Lose) — Lasyly Blog",
  description:
    "Sharing your betslip isn't just about showing off wins. It builds a verified track record, sharpens your decision-making, and can turn your edge into real income. Here's why every serious bettor should do it.",
  openGraph: {
    title: "Why You Should Share Your Betslip (Even When You Lose)",
    description:
      "Sharing your betslip isn't just about showing off wins. It builds a verified track record, sharpens your decision-making, and can turn your edge into real income.",
    type: "article",
    publishedTime: "2026-05-24",
  },
  alternates: {
    canonical: "https://lasyly.me/blog/why-share-your-betslip",
  },
}

export default function WhyShareBetslipPost() {
  const baseUrl = "https://lasyly.me"
  return (
    <BlogNewspaperWrapper>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "Why You Should Share Your Betslip (Even When You Lose)",
        "description": "Sharing your betslip publicly builds your track record, sharpens decision-making, and can turn your edge into real income.",
        "datePublished": "2026-05-24",
        "dateModified": "2026-05-24",
        "author": { "@type": "Organization", "name": "Lasyly", "url": baseUrl },
        "publisher": { "@type": "Organization", "name": "Lasyly", "url": baseUrl, "logo": { "@type": "ImageObject", "url": `${baseUrl}/lasyly_logo.png` } },
        "url": `${baseUrl}/blog/why-share-your-betslip`,
        "mainEntityOfPage": { "@type": "WebPage", "@id": `${baseUrl}/blog/why-share-your-betslip` },
        "keywords": ["betslip sharing", "sports betting community", "tipster track record", "betting accountability"],
      }} />

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-16 md:pt-20 md:pb-24">
        <div className="max-w-3xl">
          <BlogPostBackButton sport="Community" />

          <div className="mb-6">
            <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-lime)] bg-[var(--color-lime)]/8 px-3 py-1.5 rounded-full border border-[var(--color-lime)]/15">
              Community
            </span>
          </div>

          <h1 className="text-[2.5rem] md:text-[3.5rem] lg:text-[4rem] font-bold font-serif tracking-tight text-[var(--color-text-primary)] leading-[1.08] mb-6">
            Why You Should Share Your Betslip (Even When You Lose)
          </h1>

          <p className="text-lg md:text-xl text-[var(--color-text-primary)]/60 leading-relaxed max-w-[52ch] mb-8">
            It builds a verified track record, sharpens your decision-making, and can turn your edge into real income.
          </p>

          <div className="flex items-center gap-4 text-sm text-[var(--color-text-muted)]">
            <div className="w-8 h-8 rounded-full bg-[var(--color-surface-elevated)] flex items-center justify-center text-[10px] font-bold text-[var(--color-text-primary)]/60">
              LT
            </div>
            <span>Lasyly Team</span>
            <span className="w-1 h-1 rounded-full bg-[var(--color-text-muted)]" />
            <span>May 24, 2026</span>
            <span className="w-1 h-1 rounded-full bg-[var(--color-text-muted)]" />
            <span>6 min read</span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="h-[1px] bg-gradient-to-r from-[var(--color-border)] via-[var(--color-border)] to-transparent" />
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24">
        <div className="grid md:grid-cols-[1fr_260px] lg:grid-cols-[1fr_300px] gap-12 lg:gap-20 items-start">

          <article className="max-w-none">

            <p className="text-lg text-[var(--color-text-primary)]/70 leading-relaxed mb-6 max-w-[60ch]">
              Most bettors keep their picks to themselves. They&apos;ll post the winners on Twitter after the fact, but never the full slip — definitely not the losers. That&apos;s a mistake, and it&apos;s holding you back.
            </p>
            <p className="text-base text-[var(--color-text-muted)] leading-relaxed mb-16 max-w-[60ch]">
              Sharing your betslip publicly — wins, losses, and all — is one of the highest-leverage things you can do as a sports bettor. Here&apos;s why.
            </p>

            {/* Section 1 */}
            <section className="mb-20">
              <h2 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-[var(--color-text-primary)] mb-4">
                1. It forces you to think harder before you place
              </h2>
              <div className="w-12 h-[2px] bg-[var(--color-lime)] mb-8 rounded-full" />

              <div className="space-y-5 text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch]">
                <p>
                  There&apos;s a well-documented psychological shift that happens when you know people are watching. When a bet is private, you can rationalize almost anything. &ldquo;LeBron always goes off after a back-to-back.&rdquo; &ldquo;The line feels off.&rdquo; &ldquo;I just have a feeling.&rdquo;
                </p>
                <p>
                  When you know you&apos;re going to post the slip, those justifications get stress-tested differently. You start asking whether you&apos;d be comfortable explaining the reasoning out loud. You check the matchup grade. You look at the L10 hit rate before committing.
                </p>
                <p>
                  The act of sharing creates a tiny accountability loop that improves your process — every single time.
                </p>
              </div>
            </section>

            {/* Section 2 */}
            <section className="mb-20">
              <h2 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-[var(--color-text-primary)] mb-4">
                2. Your track record becomes a real asset
              </h2>
              <div className="w-12 h-[2px] bg-[var(--color-lime)] mb-8 rounded-full" />

              <div className="space-y-5 text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch]">
                <p>
                  Right now, there are thousands of tipsters on Twitter and in Discord servers with zero verifiable history. They post picks, but the losers quietly disappear. The wins get screenshotted and amplified. There&apos;s no way to know if someone is actually good.
                </p>
                <p>
                  On Lasyly, every shared betslip is logged. Your win rate, ROI, and sport breakdown build up over time into a profile that&apos;s honest — because you can&apos;t cherry-pick it. Followers can see your full history, not a curated highlight reel.
                </p>
                <p>
                  That track record has real monetary value. Once it&apos;s there, people will pay for your picks. We built the tipster marketplace specifically so that a proven record translates directly into income.
                </p>
              </div>
            </section>

            {/* Section 3 */}
            <section className="mb-20">
              <h2 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-[var(--color-text-primary)] mb-4">
                3. The community gets smarter when individuals share
              </h2>
              <div className="w-12 h-[2px] bg-[var(--color-lime)] mb-8 rounded-full" />

              <div className="space-y-5 text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch]">
                <p>
                  Every betslip you post in a room does something useful for everyone else. It surfaces an angle someone might have missed. It sparks a conversation about a matchup. It shows that a prop line is getting action — which can itself be signal.
                </p>
                <p>
                  Betting has historically been a zero-sum game between bettors and sportsbooks. The sharing dynamic on Lasyly tips that balance slightly. When five people in a room are independently reaching the same prop from different angles, that convergence matters.
                </p>
              </div>
            </section>

            {/* Section 4 */}
            <section className="mb-20">
              <h2 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-[var(--color-text-primary)] mb-4">
                4. The reactions keep you honest about variance
              </h2>
              <div className="w-12 h-[2px] bg-[var(--color-lime)] mb-8 rounded-full" />

              <div className="space-y-5 text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch]">
                <p>
                  One of the hardest mental challenges in sports betting is separating results from process. A bad bet can win. A good bet can lose. The community reaction to a shared betslip helps anchor that.
                </p>
                <p>
                  When you post a well-reasoned 5-leg parlay and people react with fire even before the result, that&apos;s validation of your process. When a sloppy pick loses and nobody bats an eye, that&apos;s useful feedback too. Over time, community reactions calibrate your confidence in ways that solo betting can&apos;t.
                </p>
              </div>
            </section>

            {/* Section 5 */}
            <section className="mb-20">
              <h2 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-[var(--color-text-primary)] mb-4">
                5. Losing slips matter more than winning ones
              </h2>
              <div className="w-12 h-[2px] bg-[var(--color-lime)] mb-8 rounded-full" />

              <div className="space-y-5 text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch]">
                <p>
                  Here&apos;s a counterintuitive truth: your bad picks teach more than your good ones — to you and to people watching you.
                </p>
                <p>
                  Posting a loser shows intellectual honesty. It says you&apos;re not gaming your public record. It shows that you understand variance is part of the game. Paradoxically, people who post losses are trusted more than people who only post wins.
                </p>
                <p>
                  The best tipsters on any platform are the ones with the most transparent records — including the bad stretches. That consistency is what converts followers into paying subscribers.
                </p>
              </div>
            </section>

            {/* How to get started */}
            <section className="mb-20">
              <h2 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-[var(--color-text-primary)] mb-4">
                How to get started on Lasyly
              </h2>
              <div className="w-12 h-[2px] bg-[var(--color-lime)] mb-8 rounded-full" />

              <div className="space-y-5 text-base text-[var(--color-text-muted)] leading-relaxed max-w-[60ch]">
                <p>
                  Sharing betslips on Lasyly takes about 10 seconds. After you log a pick in the Bet Tracker, you can post it directly to any room you&apos;re in. The community sees it in real-time, can react, and can comment.
                </p>
                <p>
                  Your profile page shows your cumulative stats — win rate, total picks, sport breakdown — automatically built from every slip you share. No manual updating. No spreadsheets.
                </p>
                <p>
                  When your track record grows, the option to monetize opens up. Set a price for your picks, share them in a Tipster Room, and earn 85% of every purchase.
                </p>
                <p>
                  The best time to start building your record was when you started betting. The second best time is now.
                </p>
              </div>
            </section>

            {/* CTA */}
            <div className="rounded-[2rem] p-[1px] bg-gradient-to-br from-[var(--color-lime)]/30 via-transparent to-[#6C63FF]/20 max-w-[56ch]">
              <div className="rounded-[calc(2rem-1px)] bg-[var(--color-surface)] p-8 md:p-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
                <p className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Start building your track record</p>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-6 max-w-[44ch]">
                  Create your free account, log your first pick, and share it in a room. Your betting career starts now.
                </p>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 bg-[var(--color-lime)] text-black font-bold text-sm px-6 py-3 rounded-full hover:scale-[0.98] active:scale-[0.96] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
                >
                  Get started free
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </div>
            </div>
          </article>

          {/* Sidebar */}
          <aside className="hidden md:flex flex-col gap-5 sticky top-24">
            <div className="rounded-[1.25rem] p-[1px] bg-gradient-to-b from-[var(--color-border)] to-transparent">
              <div className="rounded-[calc(1.25rem-1px)] bg-[var(--color-surface)] p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-4">In this post</p>
                <ul className="space-y-2.5">
                  {[
                    "1. It forces better thinking",
                    "2. Your record becomes an asset",
                    "3. The community gets smarter",
                    "4. Reactions keep you honest",
                    "5. Losing slips matter most",
                    "How to get started",
                  ].map((item) => (
                    <li key={item} className="text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-[1.25rem] p-[1px] bg-gradient-to-b from-[var(--color-border)] to-transparent">
              <div className="rounded-[calc(1.25rem-1px)] bg-[var(--color-surface)] p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-4">More posts</p>
                <ul className="space-y-3">
                  <li>
                    <Link href="/blog/how-to-read-prop-analytics" className="text-[13px] text-[var(--color-text-primary)]/70 hover:text-[var(--color-text-primary)] transition-colors duration-300 leading-snug block">
                      How to Read Prop Analytics
                    </Link>
                  </li>
                  <li>
                    <Link href="/blog/nba-player-props-guide" className="text-[13px] text-[var(--color-text-primary)]/70 hover:text-[var(--color-text-primary)] transition-colors duration-300 leading-snug block">
                      The Complete NBA Props Guide
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            <Link
              href="/signup"
              className="block text-center bg-[var(--color-lime)] text-black font-bold text-sm px-5 py-3.5 rounded-full hover:scale-[0.98] active:scale-[0.96] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            >
              Join Lasyly free
            </Link>
          </aside>
        </div>
      </div>
    </BlogNewspaperWrapper>
  )
}
