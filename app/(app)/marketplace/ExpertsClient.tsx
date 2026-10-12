"use client"

import { useState } from "react"
import { Store, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"
import TipstersClient from "./TipstersClient"
import LeaderboardTable from "./LeaderboardTable"

type Tab = "marketplace" | "leaderboard"

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "marketplace", label: "Marketplace", icon: <Store className="w-4 h-4" /> },
  { id: "leaderboard", label: "Leaderboard", icon: <Trophy className="w-4 h-4" /> },
]

export default function ExpertsClient() {
  const [tab, setTab] = useState<Tab>("marketplace")

  return (
    <div className="w-full">
      <div className="w-full max-w-6xl mx-auto px-4 pt-8 md:pt-12">
        <div className="flex gap-1 p-1 rounded-xl bg-[var(--color-surface)]/60 border border-[var(--color-border)]">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                tab === t.id
                  ? "bg-[var(--color-lime)]/10 text-[var(--color-lime)] border border-[var(--color-lime)]/20"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border)]/20"
              )}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {tab === "marketplace" ? <TipstersClient /> : <LeaderboardTable />}
    </div>
  )
}
