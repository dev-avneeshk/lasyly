"use client"

import { useState } from "react"
import {
  TrendingUp,
  TrendingDown,
  Trophy,
  Target,
  DollarSign,
  Filter,
  CheckCircle,
  XCircle,
  MinusCircle,
  Clock,
  Star,
  Award,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────────

interface BetRecord {
  id: string
  player_name: string
  sport: string
  stat_category: string
  prop_line: number
  direction: string
  confidence_score: number
  matchup_grade: string
  odds: number
  stake: number
  status: string
  created_at: string
  resolved_at?: string | null
}

interface BetTrackerStats {
  totalPicks: number
  wins: number
  losses: number
  pushes: number
  winRate: number
  roi: number
  netProfit: number
  bestSignals: { confidence: number; grade: string; winRate: number; count: number }[]
}

interface BetTrackerViewProps {
  bets: BetRecord[]
  stats: BetTrackerStats
  onUpdateStatus: (betId: string, status: "won" | "lost" | "push") => void
  isUpdating?: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const STATUS_CONFIG = {
  pending: { label: "Pending", icon: Clock, color: "text-yellow-400", bg: "bg-yellow-400/10" },
  won: { label: "Won", icon: CheckCircle, color: "text-green-400", bg: "bg-green-400/10" },
  lost: { label: "Lost", icon: XCircle, color: "text-red-400", bg: "bg-red-400/10" },
  push: { label: "Push", icon: MinusCircle, color: "text-blue-400", bg: "bg-blue-400/10" },
} as const

const GRADE_COLORS: Record<string, string> = {
  A: "text-green-400 bg-green-400/10",
  B: "text-green-400 bg-green-400/10",
  C: "text-yellow-400 bg-yellow-400/10",
  D: "text-red-400 bg-red-400/10",
  F: "text-red-400 bg-red-400/10",
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BetTrackerView({ bets, stats, onUpdateStatus, isUpdating }: BetTrackerViewProps) {
  const [sportFilter, setSportFilter] = useState<string | null>(null)
  const [statFilter, setStatFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)

  // Derive unique sports and stat categories from bets
  const sports = Array.from(new Set(bets.map((b) => b.sport)))
  const statCategories = Array.from(new Set(bets.map((b) => b.stat_category)))

  // Apply local filters
  const filteredBets = bets.filter((b) => {
    if (sportFilter && b.sport !== sportFilter) return false
    if (statFilter && b.stat_category !== statFilter) return false
    if (statusFilter && b.status !== statusFilter) return false
    return true
  })

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={Target}
          label="Total Picks"
          value={String(stats.totalPicks)}
          color="text-white"
        />
        <StatCard
          icon={Trophy}
          label="Win Rate"
          value={`${stats.winRate.toFixed(1)}%`}
          color="text-[var(--color-lime)]"
          subtitle={`${stats.wins}W - ${stats.losses}L - ${stats.pushes}P`}
        />
        <StatCard
          icon={stats.roi >= 0 ? TrendingUp : TrendingDown}
          label="ROI"
          value={`${stats.roi >= 0 ? "+" : ""}${stats.roi.toFixed(1)}%`}
          color={stats.roi >= 0 ? "text-green-400" : "text-red-400"}
        />
        <StatCard
          icon={DollarSign}
          label="Net Profit"
          value={`${stats.netProfit >= 0 ? "+" : ""}$${stats.netProfit.toFixed(2)}`}
          color={stats.netProfit >= 0 ? "text-green-400" : "text-red-400"}
        />
      </div>

      {/* Best Signals Section */}
      {stats.bestSignals.length > 0 && (
        <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-4 h-4 text-[var(--color-lime)]" />
            <h3 className="text-sm font-semibold text-white">Best Signals</h3>
            <span className="text-xs text-[var(--color-text-muted)]">
              (min 5 picks)
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {stats.bestSignals.map((signal, i) => (
              <div
                key={`${signal.confidence}-${signal.grade}`}
                className="flex items-center gap-3 bg-white/5 rounded-lg p-3"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--color-lime)]/10 text-[var(--color-lime)] text-xs font-bold">
                  #{i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: signal.confidence }, (_, j) => (
                        <Star key={j} className="w-3 h-3 fill-[var(--color-lime)] text-[var(--color-lime)]" />
                      ))}
                    </div>
                    <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded", GRADE_COLORS[signal.grade] || "text-white/60")}>
                      {signal.grade}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {signal.winRate.toFixed(0)}% win rate · {signal.count} picks
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-[var(--color-text-muted)]" />

        {/* Sport filters */}
        {sports.map((sport) => (
          <button
            key={sport}
            onClick={() => setSportFilter(sportFilter === sport ? null : sport)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              sportFilter === sport
                ? "bg-[var(--color-lime)] text-black"
                : "bg-white/5 text-[var(--color-text-muted)] hover:bg-white/10 hover:text-white"
            )}
          >
            {sport}
          </button>
        ))}

        {/* Divider */}
        {sports.length > 0 && statCategories.length > 0 && (
          <div className="w-px h-4 bg-[var(--color-border)]" />
        )}

        {/* Stat category filters */}
        {statCategories.map((stat) => (
          <button
            key={stat}
            onClick={() => setStatFilter(statFilter === stat ? null : stat)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              statFilter === stat
                ? "bg-[var(--color-lime)] text-black"
                : "bg-white/5 text-[var(--color-text-muted)] hover:bg-white/10 hover:text-white"
            )}
          >
            {stat}
          </button>
        ))}

        {/* Divider */}
        {statCategories.length > 0 && (
          <div className="w-px h-4 bg-[var(--color-border)]" />
        )}

        {/* Status filters */}
        {(["pending", "won", "lost", "push"] as const).map((status) => {
          const config = STATUS_CONFIG[status]
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? null : status)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                statusFilter === status
                  ? "bg-[var(--color-lime)] text-black"
                  : "bg-white/5 text-[var(--color-text-muted)] hover:bg-white/10 hover:text-white"
              )}
            >
              {config.label}
            </button>
          )
        })}

        {/* Clear filters */}
        {(sportFilter || statFilter || statusFilter) && (
          <button
            onClick={() => {
              setSportFilter(null)
              setStatFilter(null)
              setStatusFilter(null)
            }}
            className="px-3 py-1.5 rounded-full text-xs font-medium text-red-400 hover:bg-red-400/10 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Bets List */}
      <div className="space-y-3">
        {filteredBets.length === 0 ? (
          <div className="text-center py-12">
            <Target className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3" />
            <p className="text-sm text-[var(--color-text-muted)]">
              {bets.length === 0
                ? "No picks logged yet. Log your first pick from the Analysis page."
                : "No picks match the current filters."}
            </p>
          </div>
        ) : (
          filteredBets.map((bet) => (
            <BetCard
              key={bet.id}
              bet={bet}
              onUpdateStatus={onUpdateStatus}
              isUpdating={isUpdating === bet.id}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  color: string
  subtitle?: string
}) {
  return (
    <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-[var(--color-text-muted)]" />
        <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
      </div>
      <p className={cn("text-xl font-bold", color)}>{value}</p>
      {subtitle && (
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{subtitle}</p>
      )}
    </div>
  )
}

function BetCard({
  bet,
  onUpdateStatus,
  isUpdating,
}: {
  bet: BetRecord
  onUpdateStatus: (betId: string, status: "won" | "lost" | "push") => void
  isUpdating: boolean
}) {
  const statusConfig = STATUS_CONFIG[bet.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending
  const StatusIcon = statusConfig.icon

  return (
    <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        {/* Left: Player info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-white truncate">
              {bet.player_name}
            </h4>
            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", statusConfig.bg, statusConfig.color)}>
              <StatusIcon className="w-3 h-3" />
              {statusConfig.label}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <span className="capitalize">{bet.direction}</span>
            <span>·</span>
            <span>{bet.stat_category} {bet.prop_line}</span>
            <span>·</span>
            <span>{bet.sport}</span>
          </div>

          <div className="flex items-center gap-3 mt-2 text-xs">
            <span className="text-[var(--color-text-muted)]">
              Odds: <span className="text-white font-medium">{formatOdds(bet.odds)}</span>
            </span>
            <span className="text-[var(--color-text-muted)]">
              Stake: <span className="text-white font-medium">${Number(bet.stake).toFixed(2)}</span>
            </span>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: bet.confidence_score }, (_, i) => (
                <Star key={i} className="w-3 h-3 fill-[var(--color-lime)] text-[var(--color-lime)]" />
              ))}
            </div>
            <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded", GRADE_COLORS[bet.matchup_grade] || "text-white/60")}>
              {bet.matchup_grade}
            </span>
          </div>

          <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
            {formatDate(bet.created_at)}
            {bet.resolved_at && ` · Resolved ${formatDate(bet.resolved_at)}`}
          </p>
        </div>

        {/* Right: Action buttons for pending bets */}
        {bet.status === "pending" && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => onUpdateStatus(bet.id, "won")}
              disabled={isUpdating}
              className="p-2 rounded-lg bg-green-400/10 text-green-400 hover:bg-green-400/20 transition-colors disabled:opacity-50"
              aria-label="Mark as won"
              title="Won"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
            <button
              onClick={() => onUpdateStatus(bet.id, "lost")}
              disabled={isUpdating}
              className="p-2 rounded-lg bg-red-400/10 text-red-400 hover:bg-red-400/20 transition-colors disabled:opacity-50"
              aria-label="Mark as lost"
              title="Lost"
            >
              <XCircle className="w-4 h-4" />
            </button>
            <button
              onClick={() => onUpdateStatus(bet.id, "push")}
              disabled={isUpdating}
              className="p-2 rounded-lg bg-blue-400/10 text-blue-400 hover:bg-blue-400/20 transition-colors disabled:opacity-50"
              aria-label="Mark as push"
              title="Push"
            >
              <MinusCircle className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
