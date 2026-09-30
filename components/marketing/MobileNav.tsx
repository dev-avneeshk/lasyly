"use client"

import Link from "next/link"
import { useState } from "react"

const NAV_ITEMS = [
  { href: "/blog", label: "Blog" },
  { href: "/features", label: "Features" },
  { href: "/tipsters", label: "Tipsters" },
  { href: "/scores", label: "Live Scores" },
]

export function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Hamburger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="md:hidden p-2 rounded-lg text-[var(--color-text-muted)] hover:text-white hover:bg-white/5 transition-colors"
        aria-label="Toggle menu"
        aria-expanded={open}
      >
        {open ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 md:hidden border-t border-[var(--color-border)] bg-[var(--color-background)]/95 backdrop-blur-md z-50">
          <nav className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="px-3 py-3 rounded-xl text-sm text-[var(--color-text-muted)] hover:text-white hover:bg-white/5 transition-colors"
              >
                {item.label}
              </Link>
            ))}
            <div className="border-t border-[var(--color-border)] mt-2 pt-3">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="block px-3 py-3 rounded-xl text-sm text-[var(--color-text-muted)] hover:text-white hover:bg-white/5 transition-colors"
              >
                Sign in
              </Link>
            </div>
          </nav>
        </div>
      )}
    </>
  )
}
