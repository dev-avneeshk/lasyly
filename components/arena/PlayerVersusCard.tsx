"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

/** One seat's public card, as returned by GET /api/arena/[gameId]/players. */
interface SeatCard {
  seat: "P1" | "P2"
  isAI: boolean
  userId: string | null
  username: string | null
  display_name: string | null
  avatar_url: string | null
  is_verified?: boolean
  level: number | null
  record: { wins: number; losses: number; played: number } | null
}

interface PlayersResponse {
  gameId: string
  players: { P1: SeatCard; P2: SeatCard }
}

/**
 * The "VS" header shown during a 1v1: each player's avatar, name, level and
 * arena win/loss record. Data comes from GET /api/arena/[gameId]/players, which
 * derives the record from the coin ledger. `viewerSeat` highlights which side
 * is "you".
 *
 * Fetched once on mount (and whenever the game id changes) — the cards are
 * stable for the life of a game, so there's no need to poll them alongside the
 * game state.
 */
export function PlayerVersusCard({
  gameId,
  viewerSeat,
  className,
}: {
  gameId: string
  viewerSeat?: "P1" | "P2"
  className?: string
}) {
  const [data, setData] = useState<PlayersResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/arena/${gameId}/players`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json?.players) setData(json as PlayersResponse)
      })
      .catch(() => {
        /* best-effort: the card just doesn't render if this fails */
      })
    return () => {
      cancelled = true
    }
  }, [gameId])

  if (!data) return null

  return (
    <div
      className={cn(
        "flex items-stretch gap-2 rounded-[1.1rem] border border-white/[0.08] bg-[#11141e]/90 p-3 shadow-[0_18px_34px_rgba(0,0,0,0.16)]",
        className
      )}
    >
      <Seat card={data.players.P1} isYou={viewerSeat === "P1"} align="left" />
      <div className="flex shrink-0 items-center px-1">
        <span className="text-[11px] font-black uppercase tracking-[0.1em] text-[#d4ff00]">VS</span>
      </div>
      <Seat card={data.players.P2} isYou={viewerSeat === "P2"} align="right" />
    </div>
  )
}

function Seat({ card, isYou, align }: { card: SeatCard; isYou: boolean; align: "left" | "right" }) {
  const name = card.isAI ? "CPU" : card.display_name ?? card.username ?? "Player"
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2.5",
        align === "right" && "flex-row-reverse text-right"
      )}
    >
      <Avatar url={card.avatar_url} initials={initials} isAI={card.isAI} />
      <div className={cn("flex min-w-0 flex-col", align === "right" && "items-end")}>
        <div className={cn("flex items-center gap-1.5", align === "right" && "flex-row-reverse")}>
          <span className="truncate text-[12px] font-black text-[#f1f4fb]">{name}</span>
          {isYou && (
            <span className="rounded bg-[#d4ff00] px-1 py-0.5 text-[7px] font-black uppercase leading-none text-[#151a0a]">
              You
            </span>
          )}
        </div>
        {!card.isAI && (
          <div className={cn("mt-0.5 flex items-center gap-2 text-[9px]", align === "right" && "flex-row-reverse")}>
            <span className="rounded bg-[#5442c7]/40 px-1.5 py-0.5 font-bold uppercase tracking-wide text-[#c3bdff]">
              Lvl {card.level ?? 1}
            </span>
            {card.record && (
              <span className="tabular-nums font-semibold text-[#9ba6ba]">
                {card.record.wins}W · {card.record.losses}L
              </span>
            )}
          </div>
        )}
        {card.isAI && (
          <span className="mt-0.5 rounded bg-[#5442c7]/40 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-[#c3bdff]">
            AI Opponent
          </span>
        )}
      </div>
    </div>
  )
}

function Avatar({ url, initials, isAI }: { url: string | null; initials: string; isAI: boolean }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
      {url && !failed && !isAI ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="text-[11px] font-black text-[#b5bfd3]">{isAI ? "AI" : initials}</span>
      )}
    </span>
  )
}
