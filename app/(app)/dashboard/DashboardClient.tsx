"use client"

import { Search, Plus, Bell, Clock, DollarSign, Users, Activity, Hash, Star } from "lucide-react"
import { GaugeChart, DualLineChart, ProgressBar } from "@/components/dashboard/DashboardCharts"
import { MetricSquare, PillMetric, TransactionList } from "@/components/dashboard/DashboardWidgets"
import type {
  DashboardData,
  SportCategory,
  FundsDay,
  Transaction,
} from "@/lib/data/dashboard"

const SPORT_COLORS = ["var(--color-lime)", "#4ADE80", "#3B82F6", "#EF4444", "#F97316"]
const SPORT_ICONS: Record<string, string> = {
  Football: "⚽", Basketball: "🏀", Tennis: "🎾", Mixed: "🔥", Other: "🎯", Cricket: "🏏"
}

type Props = {
  initialData: DashboardData
  initialSports: SportCategory[]
  initialFunds: { income: FundsDay[]; spending: FundsDay[] }
  initialTransactions: Transaction[]
}

export default function DashboardClient({
  initialData,
  initialSports,
  initialFunds,
  initialTransactions,
}: Props) {
  // Server-rendered data is already final; no client-side fetching needed.
  // Keeping these as locals (rather than state) means React skips an extra
  // render pass on hydration.
  const data = initialData
  const sports = initialSports
  const funds = initialFunds
  const transactions = initialTransactions

  // Build chart data from real funds activity
  const lineChartData = {
    labels: funds.income.map((d) => d.day),
    datasets: [
      { label: "Income", data: funds.income.map((d) => d.amount), color: "var(--color-lime)" },
      { label: "Spending", data: funds.spending.map((d) => d.amount), color: "#FBBF24" },
    ],
  }

  // Build gauge segments from sport categories
  const gaugeSegments = sports.length > 0
    ? sports.map((s, i) => ({
        label: s.category,
        value: s.total_betslips,
        color: SPORT_COLORS[i % SPORT_COLORS.length],
        icon: SPORT_ICONS[s.category] ?? "🎯",
      }))
    : [{ label: "No data", value: 1, color: "rgba(255,255,255,0.1)", icon: "—" }]

  // Format transactions for the TransactionList component
  const formattedTransactions = transactions.map((t) => ({
    id: t.id,
    type: t.type === "EARNING" ? "Income" : t.type === "PURCHASE" ? "Lost" : "Income",
    amount: Math.abs(t.amount),
    date: new Date(t.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
    isPositive: t.amount > 0,
    avatars: [] as string[],
    badge: t.betslip?.bet_type ?? t.type,
  }))

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-4 md:p-6 lg:p-8 font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--color-lime)] flex items-center justify-center text-black font-bold">$</div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
            <input type="text" placeholder="Search" className="w-full h-10 bg-[var(--color-dash-surface)] border-none rounded-full pl-9 pr-4 text-sm text-white placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-lime)] transition-all" />
          </div>
          <button className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-black hover:bg-gray-200 transition-colors shrink-0">
            <Plus className="w-5 h-5" />
          </button>
          <button className="w-10 h-10 rounded-full bg-[var(--color-dash-surface)] flex items-center justify-center text-white hover:bg-white/10 transition-colors shrink-0">
            <Bell className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Secondary Nav */}
      <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
        <div className="flex items-center gap-6 min-w-max">
          <button className="flex items-center gap-2 text-[var(--color-lime)] border-b-2 border-[var(--color-lime)] pb-1 px-1 font-semibold text-sm">
            <span className="text-[10px]">✨</span> Overview
          </button>
          <button className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-white pb-1 px-1 font-semibold text-sm transition-colors">
            <Star className="w-4 h-4" /> Favorites
          </button>
          <button className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-white pb-1 px-1 font-semibold text-sm transition-colors">
            <Activity className="w-4 h-4" /> Performance
          </button>
          <button className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-white pb-1 px-1 font-semibold text-sm transition-colors">
            <Hash className="w-4 h-4" /> Customize
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
        {/* Left Column */}
        <div className="lg:col-span-4 flex flex-col gap-4 md:gap-6">
          <div className="grid grid-cols-3 gap-2 md:gap-4">
            <MetricSquare title="Total Income" value={`$${data.total_income.toFixed(0)}`} icon={DollarSign} colorVar="--color-dash-green" />
            <MetricSquare title="Total Picks" value={String(data.total_picks_count)} icon={Users} colorVar="--color-dash-orange" />
            <MetricSquare title="Win Rate" value={`${data.win_rate}%`} icon={Clock} colorVar="--color-dash-red" />
          </div>

          {/* Sport Categories */}
          <div className="bg-[var(--color-dash-surface)] rounded-2xl p-5 border border-white/5 flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold text-white">Sport Breakdown</h2>
            </div>
            <GaugeChart segments={gaugeSegments} totalLabel="Total profit" />
            <div className="flex justify-between items-center bg-black/30 rounded-full px-3 py-2 mt-auto">
              {gaugeSegments.map((s) => (
                <div key={s.label} className="w-6 h-6 rounded-full flex items-center justify-center text-[10px]" style={{ backgroundColor: s.color === "var(--color-lime)" ? s.color : "rgba(255,255,255,0.05)", color: s.color === "var(--color-lime)" ? "black" : "rgba(255,255,255,0.5)" }}>
                  {s.icon}
                </div>
              ))}
            </div>
          </div>

          {/* Sport Win Rates */}
          <div className="bg-[var(--color-dash-surface)] rounded-2xl p-5 border border-white/5">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-semibold text-white">Win Rate by Sport</h2>
            </div>
            <div className="space-y-4">
              {sports.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">No data yet. Place some bets to see your breakdown.</p>
              ) : (
                sports.map((s, i) => (
                  <div key={s.category} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">{SPORT_ICONS[s.category] ?? "🎯"}</div>
                    <div className="flex-1"><ProgressBar label={s.category} percentage={s.win_rate} color={SPORT_COLORS[i % SPORT_COLORS.length]} /></div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Middle Column */}
        <div className="lg:col-span-4 flex flex-col gap-4 md:gap-6">
          <div className="flex flex-col gap-3">
            <PillMetric title="Total Wagered" value={`$${data.total_wagered.toFixed(0)}`} trend={`${data.win_rate}% WR`} icon={DollarSign} iconBg="bg-[var(--color-lime)]" />
            <PillMetric title="Average Odds" value={`${data.average_odds}x`} trend={`${data.total_picks_count} picks`} icon={Activity} iconBg="bg-white" />
            <PillMetric title="Won / Lost" value={`${data.won_count} / ${data.lost_count}`} trend={`${data.pending_count} pending`} icon={Star} iconBg="bg-[#F97316]" />
          </div>

          {/* Performance Summary */}
          <div className="bg-[var(--color-dash-surface)] rounded-2xl p-5 border border-white/5 flex-1">
            <h2 className="text-lg font-semibold text-white mb-4">Performance Summary</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-[var(--color-text-muted)]">Total Picks</span>
                <span className="text-sm font-bold text-white">{data.total_picks_count}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-[var(--color-text-muted)]">Won</span>
                <span className="text-sm font-bold text-[var(--color-success)]">{data.won_count}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-[var(--color-text-muted)]">Lost</span>
                <span className="text-sm font-bold text-[var(--color-danger)]">{data.lost_count}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-[var(--color-text-muted)]">Pending</span>
                <span className="text-sm font-bold text-[var(--color-warning)]">{data.pending_count}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-white/5">
                <span className="text-sm text-[var(--color-text-muted)]">Win Rate</span>
                <span className="text-sm font-bold text-[var(--color-lime)]">{data.win_rate}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-[var(--color-text-muted)]">Avg Odds</span>
                <span className="text-sm font-bold text-white">{data.average_odds}x</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-4 flex flex-col gap-4 md:gap-6">
          {/* Earned / Lost */}
          <div className="grid grid-cols-2 gap-4">
            <MetricSquare title="Earned" value={`$${data.total_income.toFixed(0)}`} icon={DollarSign} colorVar="--color-dash-green" />
            <MetricSquare title="Wagered" value={`$${data.total_wagered.toFixed(0)}`} icon={Activity} colorVar="--color-dash-red" />
          </div>

          {/* Funds Activity Chart */}
          <div className="bg-black/20 border border-white/5 rounded-2xl p-4 pt-3 relative overflow-hidden flex-1 min-h-[220px]">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-[var(--color-lime)]/5 rounded-full blur-[40px] pointer-events-none" />
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-white">Funds Activity</h3>
            </div>
            <DualLineChart data={lineChartData} />
            <div className="flex justify-center gap-8 mt-6 border-t border-white/5 pt-3">
              {lineChartData.datasets.map((d) => (
                <div key={d.label} className="text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-[10px] text-[var(--color-text-muted)]">{d.label}</span>
                  </div>
                  <div className="text-sm font-bold text-white">${(d.data[d.data.length - 1] ?? 0).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Transactions */}
          <TransactionList transactions={formattedTransactions} />
        </div>
      </div>
    </div>
  )
}
