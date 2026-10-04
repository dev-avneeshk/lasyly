"use client"
import { useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Coins } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ServerArena } from "../ServerArena"
import { useArenaServer } from "../useArenaServer"
import { useWalletBalance } from "../useWalletBalance"
import type { TeamId } from "@/lib/arena/types"

/** Server-computed facts about an invite, so the joiner sees the stake before paying. */
export type JoinPreview = {
  /** Coins the joiner will be charged (the creator's stake). 0 = no stake. */
  stake: number
  /** What the winner is paid (stakePayout(stake)). */
  payout: number
  /** The house's actual cut (2 × stake − payout). 0 at small stakes after rounding. */
  commission: number
  /** The viewer already holds a seat: rejoining charges nothing. */
  seated: boolean
  /** Seat P2 is open on a human lobby. */
  joinable: boolean
}

/**
 * Join a shared 1v1 game by id. When joining costs coins, show the stake and
 * payout first and charge only on an explicit click. Otherwise (already seated,
 * no stake, or a game the server will refuse) auto-join on mount as before, so
 * ServerArena/useArenaServer surface the error.
 */
export default function JoinClient({ gameId, preview }: { gameId: string; preview: JoinPreview | null }) {
  const server = useArenaServer()
  const router = useRouter()
  const joined = useRef(false)
  const needsConfirm = !!preview && !preview.seated && preview.joinable && preview.stake > 0
  const { balance, status: balanceStatus } = useWalletBalance(needsConfirm)
  useEffect(() => {
    if (needsConfirm || joined.current) return
    joined.current = true
    server.join(gameId)
  }, [gameId, server, needsConfirm])
  const labelFor = (seat: TeamId) => (seat === server.viewer ? "You" : "Opponent")

  if (server.view) return <ServerArena server={server} labelFor={labelFor} />

  if (server.error) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p role="alert" className="text-[var(--color-text-muted)]">{server.error}</p>
        <div className="mt-4 flex items-center justify-center gap-4 text-sm">
          {server.errorCode === "INSUFFICIENT_FUNDS" && (
            <Link href="/wallet" className="font-semibold text-[var(--color-lime)] underline">Open wallet</Link>
          )}
          <button onClick={() => router.push("/arena")} className="text-[var(--color-lime)] underline">
            Back to lobby
          </button>
        </div>
      </div>
    )
  }

  if (!needsConfirm || !preview) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-[var(--color-text-muted)]">Joining game…</p>
      </div>
    )
  }

  const short = balanceStatus === "ready" && balance !== null && balance < preview.stake
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-5 px-4 py-16 text-center">
      <Coins className="h-8 w-8 text-[var(--color-lime)]" aria-hidden />
      <span className="text-xs font-bold uppercase tracking-[0.4em] text-[var(--color-lime)]">1v1 invite</span>
      <h1 className="text-2xl font-black text-[var(--color-text-primary)]">Stake: {preview.stake} coins each</h1>
      <p className="text-sm text-[var(--color-text-muted)]">
        Winner takes <span className="font-bold text-[var(--color-text-primary)]">{preview.payout} coins</span>{preview.commission > 0 && <> ({preview.commission}-coin commission)</>}. Lose and your stake is gone. You&apos;re charged when you join.
      </p>
      <p className="text-xs text-[var(--color-text-muted)]">
        {balanceStatus === "ready" && balance !== null
          ? <>Your balance: <span className="font-bold tabular-nums text-[var(--color-text-primary)]">{balance.toLocaleString()} coins</span></>
          : balanceStatus === "unavailable" ? "Balance unavailable" : "Loading balance…"}
      </p>
      <Button
        size="lg"
        className="w-full rounded-2xl font-black"
        disabled={server.connecting || short}
        aria-describedby={short ? "join-short" : undefined}
        onClick={() => { joined.current = true; void server.join(gameId) }}
      >
        {server.connecting ? "Joining…" : `Join for ${preview.stake} coins`}
      </Button>
      {short && (
        <p id="join-short" className="text-sm text-[var(--color-danger)]">
          You need {preview.stake} coins.{" "}
          <Link href="/wallet" className="font-semibold text-[var(--color-lime)] underline">Open wallet</Link>
        </p>
      )}
      <Link href="/arena" className="text-sm text-[var(--color-lime)] underline">Back to lobby</Link>
    </div>
  )
}
