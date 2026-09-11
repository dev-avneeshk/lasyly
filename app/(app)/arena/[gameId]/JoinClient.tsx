"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { ServerArena } from "../ServerArena"
import { useArenaServer } from "../useArenaServer"
import type { TeamId } from "@/lib/arena/types"

/**
 * Join a shared 1v1 game by id. Auto-joins on mount, then renders the same
 * server-authoritative arena as the creator sees. If the game is a CPU game or
 * full, ServerArena/useArenaServer surface the error.
 */
export default function JoinClient({ gameId }: { gameId: string }) {
  const server = useArenaServer()
  const router = useRouter()
  const joined = useRef(false)

  useEffect(() => {
    if (joined.current) return
    joined.current = true
    server.join(gameId)
  }, [gameId, server])

  const labelFor = (seat: TeamId) => (seat === server.viewer ? "You" : "Opponent")

  if (!server.view) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-[var(--color-text-muted)]">{server.error ? server.error : "Joining game…"}</p>
        {server.error && (
          <button onClick={() => router.push("/arena")} className="mt-4 text-sm text-[var(--color-lime)] underline">
            Back to lobby
          </button>
        )}
      </div>
    )
  }

  return <ServerArena server={server} labelFor={labelFor} />
}
