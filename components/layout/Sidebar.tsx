"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Compass, MessageSquare, User, Wallet, LogOut, BarChart2, PieChart, Trophy, Target, Newspaper, ChevronsLeft, ChevronsRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

const navItems = [
  { icon: Compass, label: "Explore", href: "/explore", comingSoon: false },
  { icon: Trophy, label: "Live Scores", href: "/scores", comingSoon: false },
  { icon: Newspaper, label: "News", href: "/news", comingSoon: false },
  { icon: Target, label: "Props", href: "/analysis", comingSoon: false },
  { icon: BarChart2, label: "My Bets", href: "/bets", comingSoon: true },
  { icon: MessageSquare, label: "Rooms", href: "/rooms", comingSoon: true },
  { icon: PieChart, label: "Dashboard", href: "/dashboard", comingSoon: false },
  { icon: Wallet, label: "Wallet", href: "/wallet", comingSoon: true },
  { icon: User, label: "Profile", href: "/profile", comingSoon: true },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      await fetch("/api/auth/guest", { method: "DELETE" })
    } catch {
      // Even if the API call fails, proceed with client-side cleanup
    }
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <aside className={cn(
      "hidden md:flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]/50 backdrop-blur-xl h-full p-4 transition-all duration-300",
      collapsed ? "w-[72px]" : "w-64 p-6"
    )}>
      {/* Logo */}
      <div className={cn("flex items-center gap-3 mb-10", collapsed ? "justify-center px-0" : "px-2")}>
        <div className="w-9 h-9 rounded-xl bg-[var(--color-lime)] shadow-[0_0_20px_rgba(212,255,0,0.3)] flex items-center justify-center flex-shrink-0 overflow-hidden">
          <Image
            src="/lasyly_logo.png"
            alt="Lasyly"
            width={36}
            height={36}
            className="w-full h-full object-cover"
            priority
          />
        </div>
        {!collapsed && (
          <span className="text-lg font-black text-white tracking-tight">las<span className="text-[var(--color-lime)]">yly</span></span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-4 rounded-xl transition-all group relative overflow-hidden",
                collapsed ? "justify-center px-0 py-3" : "px-4 py-3",
                isActive 
                  ? "bg-[var(--color-lime)]/10 text-[var(--color-lime)] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]" 
                  : item.comingSoon
                  ? "text-[var(--color-text-muted)]/50 hover:text-white/60 hover:bg-white/5"
                  : "text-[var(--color-text-muted)] hover:text-white hover:bg-white/5"
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--color-lime)] shadow-[0_0_10px_rgba(212,255,0,0.6)]" />
              )}
              <item.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110 flex-shrink-0", isActive && "drop-shadow-[0_0_8px_rgba(212,255,0,0.5)]")} />
              {!collapsed && (
                <span className="flex items-center gap-2">
                  {item.label}
                  {item.comingSoon && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-white/40">Soon</span>
                  )}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="mt-auto space-y-2">
        {/* Logout */}
        <button
          type="button"
          onClick={handleLogout}
          className={cn(
            "flex items-center gap-4 w-full rounded-xl text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors group",
            collapsed ? "justify-center px-0 py-3" : "px-4 py-3"
          )}
          title={collapsed ? "Log Out" : undefined}
        >
          <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform flex-shrink-0" />
          {!collapsed && <span>Log Out</span>}
        </button>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex items-center gap-4 w-full rounded-xl text-[var(--color-text-muted)] hover:text-white hover:bg-white/5 transition-colors",
            collapsed ? "justify-center px-0 py-3" : "px-4 py-3"
          )}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronsRight className="w-5 h-5 flex-shrink-0" /> : <ChevronsLeft className="w-5 h-5 flex-shrink-0" />}
          {!collapsed && <span className="text-sm">Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
