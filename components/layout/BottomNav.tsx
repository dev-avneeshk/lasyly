"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Compass, Trophy, Target, Newspaper, MoreHorizontal, MessageSquare, User, BarChart2, Wallet, PieChart, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"

const primaryNav = [
  { icon: Compass, href: "/explore", label: "Explore" },
  { icon: Trophy, href: "/scores", label: "Scores" },
  { icon: Newspaper, href: "/news", label: "News" },
  { icon: Target, href: "/analysis", label: "Props" },
]

const moreNav = [
  { icon: BarChart2, href: "/bets", label: "My Bets" },
  { icon: MessageSquare, href: "/rooms", label: "Rooms" },
  { icon: PieChart, href: "/dashboard", label: "Dashboard" },
  { icon: Wallet, href: "/wallet", label: "Wallet" },
  { icon: User, href: "/profile", label: "Profile" },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [showMore, setShowMore] = useState(false)
  const isRoomDetail = /^\/rooms\/[^/]+$/.test(pathname)

  if (isRoomDetail) {
    return null
  }

  const isMoreActive = moreNav.some((item) => pathname.startsWith(item.href))

  return (
    <div className="md:hidden">
      {/* More menu overlay */}
      <AnimatePresence>
        {showMore && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
              onClick={() => setShowMore(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-[101]"
            >
              <div className="mx-4 mb-[max(1.25rem,env(safe-area-inset-bottom))] rounded-2xl border border-white/10 bg-[var(--color-surface)] p-4 shadow-[0_-8px_32px_rgba(0,0,0,0.5)]">
                <div className="flex items-center justify-between mb-4 px-2">
                  <span className="text-sm font-semibold text-white/70">More</span>
                  <button
                    onClick={() => setShowMore(false)}
                    className="p-1.5 rounded-full hover:bg-white/10 text-white/60"
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
                        onClick={() => setShowMore(false)}
                        className={cn(
                          "flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors",
                          isActive
                            ? "bg-[var(--color-lime)]/10 text-[var(--color-lime)]"
                            : "text-[var(--color-text-muted)] hover:text-white hover:bg-white/5"
                        )}
                      >
                        <item.icon className="w-5 h-5" />
                        <span className="text-[10px] font-medium">{item.label}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom nav bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-8 pointer-events-none">
        <div className="pointer-events-auto flex items-center justify-between rounded-2xl border border-white/10 bg-[var(--color-surface)]/90 px-6 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
          {primaryNav.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative p-2 flex items-center justify-center transition-colors",
                  isActive ? "text-[var(--color-lime)]" : "text-[var(--color-text-muted)] hover:text-white"
                )}
              >
                <item.icon className={cn("w-6 h-6 z-10 relative", isActive && "drop-shadow-[0_0_8px_rgba(212,255,0,0.5)]")} />
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-active"
                    className="absolute inset-0 bg-[var(--color-lime)]/20 rounded-full blur-sm"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </Link>
            )
          })}

          {/* More button */}
          <button
            onClick={() => setShowMore(true)}
            className={cn(
              "relative p-2 flex items-center justify-center transition-colors",
              isMoreActive ? "text-[var(--color-lime)]" : "text-[var(--color-text-muted)] hover:text-white"
            )}
          >
            <MoreHorizontal className={cn("w-6 h-6 z-10 relative", isMoreActive && "drop-shadow-[0_0_8px_rgba(212,255,0,0.5)]")} />
            {isMoreActive && (
              <motion.div
                layoutId="bottom-nav-active"
                className="absolute inset-0 bg-[var(--color-lime)]/20 rounded-full blur-sm"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
