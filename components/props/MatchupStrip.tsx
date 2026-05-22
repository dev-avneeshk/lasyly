"use client"

import { TodayGame } from "@/lib/analytics/engine-v2"

export interface MatchupStripProps {
  games: TodayGame[]
  selectedMatchup: string | null
  onSelectMatchup: (matchup: string | null) => void
}

/**
 * Formats a game time ISO string to a short time display (e.g., "7:30 PM").
 */
function formatGameTime(gameTime: string): string {
  try {
    const date = new Date(gameTime)
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  } catch {
    return ""
  }
}

/**
 * Returns a display label for the game status.
 */
function formatStatus(status: TodayGame["status"]): string | null {
  switch (status) {
    case "live":
      return "LIVE"
    case "final":
      return "FINAL"
    default:
      return null
  }
}

/**
 * Builds the matchup key from a game (e.g., "LAL-GSW").
 */
function getMatchupKey(game: TodayGame): string {
  return `${game.homeTeam}-${game.awayTeam}`
}

export function MatchupStrip({
  games,
  selectedMatchup,
  onSelectMatchup,
}: MatchupStripProps) {
  if (games.length === 0) {
    return (
      <div className="text-sm text-[var(--color-text-muted)] py-3 text-center">
        No games scheduled
      </div>
    )
  }

  const displayGames = games.slice(0, 15)

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
      role="list"
      aria-label="Today's matchups"
    >
      {displayGames.map((game) => {
        const matchupKey = getMatchupKey(game)
        const isSelected = selectedMatchup === matchupKey
        const statusLabel = formatStatus(game.status)

        return (
          <button
            key={matchupKey}
            role="listitem"
            onClick={() => onSelectMatchup(isSelected ? null : matchupKey)}
            className={`
              flex-shrink-0 flex flex-col items-center justify-center
              min-w-[88px] min-h-[44px] px-3 py-2
              rounded-lg border text-xs font-medium
              transition-colors duration-150 cursor-pointer
              ${
                isSelected
                  ? "border-[var(--color-lime)] bg-[var(--color-lime)]/10 text-[var(--color-lime)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:border-[var(--color-lime)]/50"
              }
            `}
            aria-pressed={isSelected}
            aria-label={`${game.homeTeam} vs ${game.awayTeam}${isSelected ? ", selected" : ""}`}
          >
            <span className="font-semibold whitespace-nowrap">
              {game.homeTeam} vs {game.awayTeam}
            </span>
            {statusLabel ? (
              <span
                className={`text-[10px] mt-0.5 font-bold ${
                  game.status === "live" ? "text-red-400" : "text-[var(--color-text-muted)]"
                }`}
              >
                {statusLabel}
              </span>
            ) : (
              <span className="text-[10px] mt-0.5 text-[var(--color-text-muted)]" suppressHydrationWarning>
                {formatGameTime(game.gameTime)}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
