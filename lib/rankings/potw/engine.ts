/**
 * Player of the Week — 7-day scoring engine.
 *
 * SEPARATE formula from the season-long LPI ranking. Where LPI answers "how
 * valuable is this player over a season?", POTW answers "who was the hottest
 * player over the last 7 days?".
 *
 * POTW score (0-100) =
 *   0.45 * production   — raw box-score output per game (pts/trb/ast/stocks),
 *                         percentile-ranked against everyone active in the window
 *   0.25 * efficiency   — true shooting % over the window
 *   0.15 * availability — games played in the window (a 4-game week beats a
 *                         2-game week at equal per-game output)
 *   0.15 * team_success — share of the player's window games that were wins
 *                         (POTW conventionally rewards winning)
 *
 * Pure functions, no I/O. The loader/cron supply PotwPlayerWindow[].
 */

import { percentileRank, clampScore } from "../normalize"
import type {
  PotwGameLine,
  PotwPlayerWindow,
  PotwPlayerScore,
  PotwResult,
  PotwConfig,
} from "./types"

const WEIGHTS = {
  production: 0.45,
  efficiency: 0.25,
  availability: 0.15,
  team_success: 0.15,
} as const

/** Parse Basketball-Reference "MM:SS" minutes into decimal minutes. */
export function parseMinutes(raw: string | number | null | undefined): number {
  if (raw == null) return 0
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0
  const parts = String(raw).split(":")
  if (parts.length === 2) {
    const m = Number(parts[0]), s = Number(parts[1])
    return Number.isFinite(m) && Number.isFinite(s) ? m + s / 60 : 0
  }
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

function sum<T>(rows: T[], get: (r: T) => number): number {
  return rows.reduce((s, r) => s + (get(r) || 0), 0)
}

/** True shooting % from window totals: PTS / (2 * (FGA + 0.44 * FTA)). */
function trueShooting(games: PotwGameLine[]): number {
  const pts = sum(games, (g) => g.pts)
  const fga = sum(games, (g) => g.fga)
  const fta = sum(games, (g) => g.fta)
  const denom = 2 * (fga + 0.44 * fta)
  return denom > 0 ? pts / denom : 0
}

/**
 * A single "production value" per game, blending the box score into one number.
 * Weighted toward scoring/creation but crediting defense (stocks) and docking
 * turnovers. This is a within-window raw figure that is then percentile-ranked.
 */
function productionPerGame(w: PotwPlayerWindow): number {
  const n = w.games.length
  if (n === 0) return 0
  const raw = sum(w.games, (g) =>
    g.pts + 1.2 * g.ast + 1.0 * g.trb + 1.6 * g.stl + 1.6 * g.blk - 1.0 * g.tov
  )
  return raw / n
}

/**
 * Compute POTW scores for every eligible player in the window.
 * Returns the full ranked list (winner first).
 */
export function scorePotwWindow(
  players: PotwPlayerWindow[],
  config: PotwConfig
): PotwPlayerScore[] {
  // Eligibility: enough games AND minutes in the window.
  const eligible = players.filter((w) => {
    const minutes = sum(w.games, (g) => g.minutes)
    return w.games.length >= config.min_games_in_window && minutes >= config.min_minutes_in_window
  })

  if (eligible.length === 0) return []

  // Build percentile populations from the eligible field.
  const productionPop = eligible.map(productionPerGame)
  const tsPop = eligible.map((w) => trueShooting(w.games))
  const maxGamesInWindow = Math.max(...eligible.map((w) => w.games.length))

  const scored: PotwPlayerScore[] = eligible.map((w) => {
    const n = w.games.length
    const production_raw = productionPerGame(w)
    const ts = trueShooting(w.games)

    const production_score = percentileRank(production_raw, productionPop)
    const efficiency_score = percentileRank(ts, tsPop)

    // Availability: games played vs the busiest schedule in the window.
    const availability_score = maxGamesInWindow > 0
      ? clampScore((n / maxGamesInWindow) * 100)
      : 50

    // Team success: share of window games the player's team won.
    const wins = w.games.filter((g) => g.won).length
    const team_success_score = clampScore((wins / n) * 100)

    const potw_score = clampScore(
      production_score * WEIGHTS.production +
      efficiency_score * WEIGHTS.efficiency +
      availability_score * WEIGHTS.availability +
      team_success_score * WEIGHTS.team_success
    )

    return {
      player_name: w.player_name,
      player_id: w.player_id,
      team: w.team,
      position: w.position,
      potw_score,
      production_score,
      efficiency_score,
      availability_score,
      team_success_score,
      games_in_window: n,
      team_wins_in_window: wins,
      pts_per_g: round1(sum(w.games, (g) => g.pts) / n),
      trb_per_g: round1(sum(w.games, (g) => g.trb) / n),
      ast_per_g: round1(sum(w.games, (g) => g.ast) / n),
      stl_per_g: round1(sum(w.games, (g) => g.stl) / n),
      blk_per_g: round1(sum(w.games, (g) => g.blk) / n),
      ts_pct: Math.round(ts * 1000) / 1000,
    }
  })

  // Deterministic sort: score, then production, then win share, then name.
  scored.sort((a, b) =>
    b.potw_score - a.potw_score ||
    b.production_score - a.production_score ||
    b.team_success_score - a.team_success_score ||
    a.player_name.localeCompare(b.player_name)
  )

  return scored
}

/** Build the final award object (winner + runners-up + headline). */
export function buildPotwResult(
  scored: PotwPlayerScore[],
  window_start: string,
  window_end: string,
  season: string,
  conference: "ALL" | "East" | "West" = "ALL"
): PotwResult | null {
  if (scored.length === 0) return null
  const winner = scored[0]
  const runners_up = scored.slice(1, 5).map((s) => ({
    player_name: s.player_name,
    team: s.team,
    potw_score: s.potw_score,
  }))

  const headline =
    `${winner.player_name} — ${winner.pts_per_g} PPG, ${winner.trb_per_g} RPG, ` +
    `${winner.ast_per_g} APG on ${(winner.ts_pct * 100).toFixed(1)}% TS across ` +
    `${winner.games_in_window} game${winner.games_in_window === 1 ? "" : "s"} ` +
    `(${winner.team_wins_in_window}-${winner.games_in_window - winner.team_wins_in_window})`

  return { window_start, window_end, season, conference, winner, runners_up, headline }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
