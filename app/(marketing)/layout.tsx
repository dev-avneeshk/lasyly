import Link from "next/link"
import Image from "next/image"
import type { Metadata } from "next"

export const metadata: Metadata = {
  alternates: {
    types: {
      "application/rss+xml": "https://lasyly.com/blog/feed.xml",
    },
  },
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text-primary)]">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-background)]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--color-lime)] flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(212,255,0,0.4)]">
              <Image src="/lasyly_logo.png" alt="Lasyly" width={32} height={32} className="w-full h-full object-cover" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">Lasyly</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-[var(--color-text-muted)]">
            <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
            <Link href="/features" className="hover:text-white transition-colors">Features</Link>
            <Link href="/tipsters" className="hover:text-white transition-colors">Tipsters</Link>
            <Link href="/scores" className="hover:text-white transition-colors">Live Scores</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-[var(--color-text-muted)] hover:text-white transition-colors hidden md:block">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-semibold bg-[var(--color-lime)] text-black px-4 py-2 rounded-full hover:opacity-90 transition-opacity"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] mt-24">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-[var(--color-lime)] flex items-center justify-center overflow-hidden">
                  <Image src="/lasyly_logo.png" alt="Lasyly" width={28} height={28} className="w-full h-full object-cover" />
                </div>
                <span className="font-bold text-white">Lasyly</span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                Where sports bettors win together.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-4">Product</p>
              <ul className="space-y-2.5 text-sm text-[var(--color-text-muted)]">
                <li><Link href="/features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="/tipsters" className="hover:text-white transition-colors">Tipsters</Link></li>
                <li><Link href="/scores" className="hover:text-white transition-colors">Live Scores</Link></li>
                <li><Link href="/explore" className="hover:text-white transition-colors">Explore</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-4">Learn</p>
              <ul className="space-y-2.5 text-sm text-[var(--color-text-muted)]">
                <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
                <li><Link href="/blog/why-share-your-betslip" className="hover:text-white transition-colors">Why Share Betslips</Link></li>
                <li><Link href="/blog/how-to-read-prop-analytics" className="hover:text-white transition-colors">Prop Analytics Guide</Link></li>
                <li><Link href="/blog/nba-player-props-guide" className="hover:text-white transition-colors">NBA Props Guide</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-4">Company</p>
              <ul className="space-y-2.5 text-sm text-[var(--color-text-muted)]">
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-[var(--color-border)] pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-xs text-[var(--color-text-muted)]">© 2026 Lasyly. All rights reserved.</p>
            <p className="text-xs text-[var(--color-text-muted)]">Not a sportsbook. For entertainment and analytics purposes only.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
