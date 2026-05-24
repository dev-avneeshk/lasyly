import type { Metadata } from "next"
import { PieChart, BarChart2, TrendingUp, Wallet, Lock } from "lucide-react"

export const metadata: Metadata = {
  title: "Dashboard — Coming Soon | Lasyly",
  robots: { index: false },
}

// Static page — no auth queries, no DB calls, renders instantly
export default function DashboardPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-20">
      <div className="max-w-lg w-full text-center">
        {/* Icon */}
        <div className="mx-auto mb-6 w-20 h-20 rounded-2xl bg-[var(--color-lime)]/10 border border-[var(--color-lime)]/20 flex items-center justify-center shadow-[0_0_40px_rgba(212,255,0,0.1)]">
          <PieChart className="w-9 h-9 text-[var(--color-lime)]" />
        </div>

        {/* Badge */}
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full bg-[var(--color-lime)]/10 text-[var(--color-lime)] border border-[var(--color-lime)]/20 mb-5">
          <Lock className="w-3 h-3" />
          Coming Soon
        </span>

        <h1 className="text-4xl font-bold font-serif text-white mb-4 leading-tight">
          Your betting dashboard<br />
          <span className="text-[var(--color-lime)]">is on the way.</span>
        </h1>

        <p className="text-[var(--color-text-muted)] text-base leading-relaxed mb-10 max-w-sm mx-auto">
          We&apos;re building a full performance dashboard — win rates, profit/loss, sport breakdowns, funds activity, and more. All in one place.
        </p>

        {/* Feature preview cards */}
        <div className="grid grid-cols-2 gap-3 text-left mb-10">
          {[
            { icon: TrendingUp, label: "Win Rate Tracking", desc: "See your hit rate across sports and bet types" },
            { icon: BarChart2, label: "P&L Breakdown", desc: "Income vs spending over time with daily charts" },
            { icon: PieChart, label: "Sport Analysis", desc: "Which sports you actually make money on" },
            { icon: Wallet, label: "Wallet Activity", desc: "Full transaction history and balance tracking" },
          ].map((f) => (
            <div
              key={f.label}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 opacity-60"
            >
              <f.icon className="w-4 h-4 text-[var(--color-lime)] mb-2" />
              <p className="text-xs font-semibold text-white mb-1">{f.label}</p>
              <p className="text-[11px] text-[var(--color-text-muted)] leading-snug">{f.desc}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-[var(--color-text-muted)]">
          In the meantime, head to{" "}
          <a href="/bets" className="text-[var(--color-lime)] hover:underline">My Bets</a>{" "}
          to log your picks.
        </p>
      </div>
    </div>
  )
}
