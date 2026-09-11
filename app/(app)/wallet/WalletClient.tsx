"use client"

import { useCallback, useEffect, useState } from "react"
import { ArrowDownRight, ArrowUpRight, Clock, RefreshCw } from "lucide-react"
import { CoinIcon } from "@/components/ui/CoinIcon"

type WalletTransaction = {
  id: string
  type: string
  amount: number
  status: string
  created_at: string
  betslip?: { sportsbook: string; bet_type: string; odds: number } | null
}

type WalletResponse = {
  wallet_balance: number
  transactions: WalletTransaction[]
}

// Human labels for the ledger `type` values written by the wallet RPCs.
const TYPE_LABEL: Record<string, string> = {
  TOP_UP: "Top up",
  EARNING: "Earned from a pick",
  PURCHASE: "Unlocked a pick",
  SIGNUP_BONUS: "Welcome bonus",
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function WalletClient() {
  const [data, setData] = useState<WalletResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/wallet", { cache: "no-store" })
      if (res.status === 401) {
        setError("Sign in to view your Coins.")
        setData(null)
        return
      }
      if (!res.ok) {
        setError("Couldn't load your wallet. Try again.")
        return
      }
      const json = (await res.json()) as WalletResponse
      setData(json)
    } catch {
      setError("Couldn't load your wallet. Try again.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const balance = data?.wallet_balance ?? 0
  const transactions = data?.transactions ?? []

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-10 md:py-16">
      {/* Balance card */}
      <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-8 md:p-10 text-center">
        <div className="w-14 h-14 rounded-full bg-[var(--color-lime)]/10 flex items-center justify-center mx-auto mb-5">
          <CoinIcon className="w-7 h-7 text-[var(--color-lime)]" />
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-2">
          Your Coins
        </p>

        {loading ? (
          <div className="h-10 w-32 mx-auto rounded-lg bg-white/5 animate-pulse" />
        ) : error ? (
          <p className="text-sm text-[var(--color-text-muted)]">{error}</p>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <CoinIcon className="w-7 h-7 text-[var(--color-lime)]" />
            <span className="text-4xl font-bold text-[var(--color-text-primary)] tabular-nums">
              {balance.toLocaleString()}
            </span>
          </div>
        )}

        <p className="text-[var(--color-text-muted)] text-sm max-w-md mx-auto mt-4">
          Coins are Lasyly&apos;s in-app currency for unlocking creator content and
          community access. They are not money and cannot be withdrawn as cash.
        </p>

        <button
          onClick={load}
          disabled={loading}
          className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-[var(--color-text-muted)] hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Top up — not yet available */}
      <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">Get more Coins</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Topping up Coins is coming soon, and availability depends on your region.
          </p>
        </div>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-3 py-1.5 rounded-full bg-[var(--color-border)]/40 text-[var(--color-text-muted)]">
          Coming soon
        </span>
      </div>

      {/* Transactions */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-[var(--color-text-muted)]" />
          Recent activity
        </h2>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-8 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">
              No Coins activity yet. Unlock a creator pick or earn Coins to see it here.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/40 divide-y divide-[var(--color-border)]/60 overflow-hidden">
            {transactions.map((t) => {
              const isPositive = Number(t.amount) >= 0
              const label = TYPE_LABEL[t.type] ?? t.type
              return (
                <div key={t.id} className="flex items-center gap-3 p-4">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      isPositive
                        ? "bg-[var(--color-lime)]/15 text-[var(--color-lime)]"
                        : "bg-[var(--color-border)]/40 text-[var(--color-text-muted)]"
                    }`}
                  >
                    {isPositive ? (
                      <ArrowDownRight className="w-4 h-4" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{label}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      {formatDate(t.created_at)}
                      {t.status && t.status !== "COMPLETED" ? ` · ${t.status.toLowerCase()}` : ""}
                    </p>
                  </div>
                  <div
                    className={`flex items-center gap-1 text-sm font-bold tabular-nums ${
                      isPositive ? "text-[var(--color-lime)]" : "text-[var(--color-text-primary)]"
                    }`}
                  >
                    <span>
                      {isPositive ? "+" : "-"}
                      {Math.abs(Number(t.amount)).toLocaleString()}
                    </span>
                    <CoinIcon className="w-3.5 h-3.5" />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
