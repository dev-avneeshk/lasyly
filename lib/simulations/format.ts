import type { SimGame, SimSlate, SimTeam } from "./types"

// Pure helpers, safe for client components (no slate data imported here).

/** The side the simulations favour (home on an exact 50%). */
export function favouriteSide(game: SimGame): "home" | "away" {
  return game.prediction.pHome >= 0.5 ? "home" : "away"
}

/** true / false once the real result is known, null before. */
export function pickWasRight(game: SimGame): boolean | null {
  if (!game.final || game.final.home === game.final.away) return null
  const winner = game.final.home > game.final.away ? "home" : "away"
  return winner === favouriteSide(game)
}

export function slateRecord(slate: SimSlate): { right: number; decided: number } {
  let right = 0
  let decided = 0
  for (const g of slate.games) {
    const r = pickWasRight(g)
    if (r === null) continue
    decided += 1
    if (r) right += 1
  }
  return { right, decided }
}

export function teamLogoUrl(team: SimTeam): string {
  return `https://a.espncdn.com/i/teamlogos/nba/500/${team.espn}.png`
}

export function pct(p: number): string {
  return `${Math.round(p * 100)}%`
}

export function signed(x: number, digits = 1): string {
  const v = x.toFixed(digits)
  return x > 0 ? `+${v}` : v
}

/** "Sat, Oct 31" for a US game date (formatted in UTC so server and client agree). */
export function slateDateLabel(date: string, long = false): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: long ? "long" : "short",
    month: long ? "long" : "short",
    day: "numeric",
    timeZone: "UTC",
  })
}
