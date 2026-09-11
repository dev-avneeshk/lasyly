"use client"

import NotificationBell from "@/components/notifications/NotificationBell"
import ThemeToggle from "@/components/ThemeToggle"
import CoinBalance from "@/components/layout/CoinBalance"

export default function TopBar() {
  return (
    <div className="sticky top-0 z-30 flex items-center justify-end gap-2 px-4 md:px-6 py-2 bg-[var(--color-background)]/80 backdrop-blur-md">
      <CoinBalance />
      <NotificationBell collapsed />
      <ThemeToggle collapsed />
    </div>
  )
}
