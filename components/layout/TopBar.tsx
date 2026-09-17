"use client"

import { Suspense } from "react"
import NotificationBell from "@/components/notifications/NotificationBell"
import ThemeToggle from "@/components/ThemeToggle"
import CoinBalance from "@/components/layout/CoinBalance"
import TopBarSearch from "@/components/layout/TopBarSearch"
import TopBarSportTabs from "@/components/layout/TopBarSportTabs"
import TopBarAvatar from "@/components/layout/TopBarAvatar"

export default function TopBar() {
  return (
    <div className="sticky top-0 z-30 flex items-center gap-3 md:gap-6 px-4 md:px-6 py-2.5 bg-[var(--color-background)]/85 backdrop-blur-md border-b border-[var(--color-border)]">
      <TopBarSearch />

      {/* Sport switcher — reads the URL, so it needs a Suspense boundary to keep
          the rest of the shell prerenderable. */}
      <div className="flex-1 flex justify-center min-w-0">
        <Suspense fallback={<div className="h-6" />}>
          <TopBarSportTabs />
        </Suspense>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <NotificationBell collapsed />
        <CoinBalance />
        <ThemeToggle collapsed />
        <TopBarAvatar />
      </div>
    </div>
  )
}
