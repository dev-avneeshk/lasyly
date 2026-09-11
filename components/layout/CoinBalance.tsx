"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CoinIcon } from "@/components/ui/CoinIcon"

/**
 * Header pill showing the signed-in user's Coins balance. Hides itself for
 * guests / unauthenticated users (the balance endpoint returns 401). Links
 * to the Wallet page. Kept intentionally lightweight — it reads the
 * balance-only endpoint, not the full transactions list.
 */
export default function CoinBalance() {
  const [balance, setBalance] = useState<number | null>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch("/api/wallet/balance", { cache: "no-store" })
        if (!active) return
        if (res.status === 401) {
          setHidden(true)
          return
        }
        if (!res.ok) return
        const json = (await res.json()) as { balance: number }
        setBalance(Number(json.balance ?? 0))
      } catch {
        // Silent — the pill just won't render a number.
      }
    })()
    return () => {
      active = false
    }
  }, [])

  if (hidden) return null

  return (
    <Link
      href="/wallet"
      aria-label={`Coins balance: ${balance ?? 0}`}
      className="inline-flex items-center gap-1.5 h-8 pl-2 pr-3 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/60 hover:border-white/20 transition-colors"
    >
      <CoinIcon className="w-4 h-4 text-[var(--color-lime)]" />
      <span className="text-sm font-semibold text-[var(--color-text-primary)] tabular-nums">
        {balance === null ? "—" : balance.toLocaleString()}
      </span>
    </Link>
  )
}
