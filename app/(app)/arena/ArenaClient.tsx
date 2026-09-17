"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"
import ArenaSetup, { type ArenaLaunch } from "./ArenaSetup"

/**
 * Route shell for /arena/nba.
 *
 * This used to be one component holding both the options screen and the whole
 * game. Because the game's imports (auction engine, AI, simulation, the season
 * player pool, framer-motion) were static, /arena/nba shipped ~1.78 MB of
 * uncompressed JS — 383 KB of which was every NBA player's ratings — before the
 * five option cards on the first screen could be clicked.
 *
 * Now the options screen stands alone and the game arrives on demand. The
 * download starts on the same click that starts the game, so there's no extra
 * round trip in the user's way that wasn't already there for a server match.
 */
const ArenaGame = dynamic(() => import("./ArenaGame"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto flex min-h-full max-w-lg flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--color-lime)]" />
      <p className="text-sm font-semibold text-[var(--color-text-muted)]">Loading the auction floor…</p>
    </div>
  ),
})

export default function ArenaClient() {
  const [launch, setLaunch] = useState<ArenaLaunch | null>(null)
  // Carried back from a failed server game so the setup screen can explain what
  // happened, which is where that message used to live.
  const [error, setError] = useState<string | null>(null)

  if (!launch) return <ArenaSetup onLaunch={(next) => { setError(null); setLaunch(next) }} initialError={error} />

  return (
    <ArenaGame
      launch={launch}
      onExit={(nextError) => {
        setError(nextError ?? null)
        setLaunch(null)
      }}
    />
  )
}
