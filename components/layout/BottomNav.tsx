"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Compass, Trophy, Target, Newspaper, MoreHorizontal, MessageSquare, User, BarChart2, Wallet, X, Medal, Gamepad2, Store } from "lucide-react"
import { cn } from "@/lib/utils"

const primaryNav = [
  { icon: Compass, href: "/explore", label: "Explore" },
  { icon: Trophy, href: "/scores", label: "Scores" },
  { icon: Newspaper, href: "/news", label: "News" },
  { icon: Target, href: "/analysis?sport=NFL", label: "Props" },
]

const moreNav = [
  { icon: Medal, href: "/rankings", label: "Rankings" },
  { icon: Gamepad2, href: "/arena", label: "Arena" },
  { icon: BarChart2, href: "/bets", label: "Predictions" },
  { icon: MessageSquare, href: "/rooms", label: "Rooms" },
  { icon: Store, href: "/marketplace", label: "Experts" },
  { icon: Wallet, href: "/wallet", label: "Wallet" },
  { icon: User, href: "/profile", label: "Profile" },
]

/**
 * Longest of the two closing animations in globals.css
 * (`bottom-sheet-scrim-out` 180ms / `bottom-sheet-out` 200ms). The sheet stays
 * mounted for this long after a close so the exit animation can play — this is
 * the one job <AnimatePresence> was doing here.
 */
const SHEET_EXIT_MS = 200

export default function BottomNav() {
  const pathname = usePathname()
  const [showMore, setShowMore] = useState(false)
  const [closing, setClosing] = useState(false)
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const closeMore = useCallback(() => {
    setClosing(true)
    if (exitTimer.current) clearTimeout(exitTimer.current)
    exitTimer.current = setTimeout(() => {
      setShowMore(false)
      setClosing(false)
    }, SHEET_EXIT_MS)
  }, [])

  const openMore = useCallback(() => {
    if (exitTimer.current) clearTimeout(exitTimer.current)
    setClosing(false)
    setShowMore(true)
  }, [])

  // Clear the pending unmount if the component goes away mid-animation
  // (e.g. navigating to a room detail page, which returns null below).
  useEffect(() => () => {
    if (exitTimer.current) clearTimeout(exitTimer.current)
  }, [])

  const isRoomDetail = /^\/rooms\/[^/]+$/.test(pathname)

  if (isRoomDetail) {
    return null
  }

  const isMoreActive = moreNav.some((item) => pathname.startsWith(item.href))

  return (
    <div className="md:hidden">
      {/* More menu overlay */}
      {showMore && (
        <>
          <div
            data-closing={closing}
            className="bottom-sheet-scrim fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={closeMore}
          />
          <div
            data-closing={closing}
            className="bottom-sheet-panel fixed bottom-0 left-0 right-0 z-[101]"
          >
            <div className="mx-4 mb-[max(1.25rem,env(safe-area-inset-bottom))] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[0_-8px_32px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between mb-4 px-2">
                <span className="text-sm font-semibold text-[var(--color-text-muted)]">More</span>
                <button
                  onClick={closeMore}
                  aria-label="Close menu"
                  className="p-1.5 rounded-full hover:bg-[var(--color-border)]/30 text-[var(--color-text-muted)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {moreNav.map((item) => {
                  const isActive = pathname.startsWith(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeMore}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors",
                        isActive
                          ? "bg-[var(--color-lime)]/10 text-[var(--color-lime)]"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border)]/20"
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="text-[10px] font-medium">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Bottom nav bar — docked edge-to-edge, flush against the bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.35)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch justify-around px-2 pt-2 pb-1.5">
          {primaryNav.map((item) => {
            // hrefs may carry a query (e.g. "/analysis?sport=NFL"); match the
            // path portion only since pathname excludes the query string.
            const isActive = pathname.startsWith(item.href.split("?")[0])
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-1 py-1.5 transition-colors",
                  isActive ? "text-[var(--color-lime)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                )}
              >
                <item.icon className={cn("w-6 h-6 relative z-10", isActive && "drop-shadow-[0_0_8px_rgba(212,255,0,0.5)]")} />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </Link>
            )
          })}

          {/* More button */}
          <button
            onClick={openMore}
            aria-label="More"
            aria-expanded={showMore && !closing}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-1 py-1.5 transition-colors",
              isMoreActive ? "text-[var(--color-lime)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            )}
          >
            <MoreHorizontal className={cn("w-6 h-6 relative z-10", isMoreActive && "drop-shadow-[0_0_8px_rgba(212,255,0,0.5)]")} />
            <span className="text-[10px] font-medium leading-none">More</span>
          </button>
        </div>
      </div>
    </div>
  )
}
