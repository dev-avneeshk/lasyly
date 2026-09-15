'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export const COOKIE_CONSENT_KEY = 'lasyly_cookie_consent'

/**
 * Cookie notice.
 *
 * PERFORMANCE-CRITICAL RENDER TIMING — read before changing.
 * ----------------------------------------------------------
 * This banner was the single worst Core Web Vitals problem on the site. It used
 * to start with `visible = false` and flip to `true` on a `setTimeout` after
 * hydration, which meant it was absent from the server HTML and painted only
 * once the client had booted. Measured with Lighthouse (mobile throttling)
 * against a production build, it was the Largest Contentful Paint element on
 * `/`, `/explore` and `/onboarding`, at 10.3s / 9.8s / 8.4s.
 *
 * Why it won LCP: LCP only considers text blocks and images. The big cards on
 * these pages are divs with background gradients (not candidates), the team
 * logos are ~20px, and the one large image (Top Story) frequently 404s. That
 * left this paragraph as the largest text block on the page — and because it
 * painted after hydration, LCP was pinned to hydration time.
 *
 * The fix is to render it in the SERVER HTML so that, if it shows at all, it
 * paints with the first contentful paint rather than seconds later. It cannot be
 * driven by a server-read cookie: reading cookies in the root layout would opt
 * every page out of static ISR (see the `await connection()` note in
 * app/layout.tsx), trading an LCP problem for a worse TTFB one.
 *
 * So: the markup is always server-rendered, and a tiny blocking script in
 * <head> (see app/layout.tsx) adds `.consent-given` to <html> before first
 * paint when localStorage already holds a choice. The CSS rule in globals.css
 * then hides this banner with zero flash and zero late paint. This component's
 * effect afterwards unmounts it for good so the DOM does not keep dead nodes.
 */
export default function CookieConsent() {
  // Starts `false` on BOTH server and client so the first client render matches
  // the server HTML exactly (no hydration mismatch). The pre-paint script in
  // <head> is what visually hides the banner for returning visitors; this state
  // then removes it from the DOM once the effect runs.
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(COOKIE_CONSENT_KEY)) setDismissed(true)
    } catch {
      // localStorage can throw in private-mode / storage-partitioned contexts.
      // Leaving the banner up is the safe outcome there.
    }
  }, [])

  function choose(value: 'accepted' | 'declined') {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, value)
    } catch {
      // Persisting failed; still dismiss for this session.
    }
    // Keep the pre-paint script's signal in sync for any in-session navigation.
    document.documentElement.classList.add('consent-given')
    setDismissed(true)
  }

  if (dismissed) return null

  return (
    <div
      id="cookie-consent"
      className="fixed bottom-0 left-0 right-0 z-[9999] border-t border-white/10 bg-[#111318]/95 backdrop-blur-md px-4 py-4 md:px-6"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-slate-300">
          We use essential cookies to keep you logged in and provide core functionality.
          See our{' '}
          <Link href="/privacy" className="text-[var(--color-lime)] underline underline-offset-2 hover:opacity-80">
            Privacy Policy
          </Link>{' '}
          for details.
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => choose('declined')}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5"
          >
            Decline
          </button>
          <button
            onClick={() => choose('accepted')}
            className="rounded-full bg-[var(--color-lime)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
