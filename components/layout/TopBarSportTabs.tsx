"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export const TOP_BAR_SPORTS = ["NFL", "NBA", "Soccer", "NHL", "Tennis"] as const

/** Sections surfaced under the "More" overflow menu. */
const MORE_LINKS: { label: string; href: string }[] = [
  { label: "Rankings", href: "/rankings" },
  { label: "Live Scores", href: "/scores" },
  { label: "Predictions", href: "/bets" },
  { label: "News", href: "/news" },
  { label: "Arena", href: "/arena" },
]

/**
 * Sport switcher in the top bar. Each tab is a real link into the Props page so
 * the active sport is shareable and survives a reload.
 */
export default function TopBarSportTabs() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  const onProps = pathname.startsWith("/analysis")
  const activeSport = onProps ? (searchParams.get("sport") ?? "NFL") : null

  useEffect(() => {
    if (!moreOpen) return
    function onPointerDown(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [moreOpen])

  return (
    <nav
      aria-label="Sports"
      className="hidden md:flex items-center gap-5 lg:gap-7 overflow-x-auto scrollbar-hide"
    >
      {TOP_BAR_SPORTS.map((sport) => {
        const isActive = activeSport?.toLowerCase() === sport.toLowerCase()
        return (
          <Link
            key={sport}
            href={`/analysis?sport=${sport}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative shrink-0 py-1 text-[13px] font-semibold tracking-wide whitespace-nowrap transition-colors",
              isActive
                ? "text-[var(--color-text-primary)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            )}
          >
            {sport}
            {isActive && (
              <span
                aria-hidden
                className="absolute -bottom-1.5 left-0 right-0 h-[2px] rounded-full bg-[var(--color-lime)] shadow-[0_0_8px_rgba(212,255,0,0.5)]"
              />
            )}
          </Link>
        )
      })}

      <div ref={moreRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          aria-haspopup="menu"
          className="flex items-center gap-1 py-1 text-[13px] font-semibold tracking-wide text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          More
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", moreOpen && "rotate-180")} />
        </button>

        {moreOpen && (
          <div
            role="menu"
            className="absolute top-full left-1/2 -translate-x-1/2 mt-3 z-50 min-w-[168px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
          >
            {MORE_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                role="menuitem"
                onClick={() => setMoreOpen(false)}
                className="block rounded-lg px-3 py-2 text-[13px] font-medium text-[var(--color-text-muted)] hover:bg-white/5 hover:text-[var(--color-text-primary)] transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}
