"use client"

import { useEffect, useState } from "react"

export type BalanceStatus = "idle" | "loading" | "ready" | "unavailable"

/**
 * The signed-in user's coin balance, for showing what a 1v1 stake leaves them
 * with. Fetched once, lazily: nothing is requested until `enabled` is true, so
 * the vs-CPU setup screen makes no extra call. Same endpoint and no-store fetch
 * as the header pill (components/layout/CoinBalance.tsx).
 *
 * Display only. The stake routes check the real balance when they charge.
 */
export function useWalletBalance(enabled: boolean): { balance: number | null; status: BalanceStatus } {
  const [result, setResult] = useState<{ balance: number | null; status: "ready" | "unavailable" } | null>(null)

  useEffect(() => {
    if (!enabled || result) return
    let active = true
    ;(async () => {
      try {
        const res = await fetch("/api/wallet/balance", { cache: "no-store" })
        if (!active) return
        if (!res.ok) {
          setResult({ balance: null, status: "unavailable" })
          return
        }
        const json = (await res.json()) as { balance?: number }
        if (!active) return
        const balance = Number(json.balance ?? 0)
        setResult(Number.isFinite(balance) ? { balance, status: "ready" } : { balance: null, status: "unavailable" })
      } catch {
        if (active) setResult({ balance: null, status: "unavailable" })
      }
    })()
    return () => {
      active = false
    }
  }, [enabled, result])

  if (result) return result
  return { balance: null, status: enabled ? "loading" : "idle" }
}
