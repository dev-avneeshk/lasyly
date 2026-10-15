/**
 * Shape our own NBA DB rows (`nba_games` + `nba_player_stats`) into the boxscore
 * payload the player-analysis boxscore popup renders. ESPN is not consulted.
 *
 * Output choice: a `MatchSummary`-compatible `boxscore.players` array (two teams,
 * each with `labels` + `athletes[].stats`, plus a `homeAway` flag) so it can feed
 * the existing `MatchDetailModal` / `BoxScoreTab` via `orderHomeFirst` with no new
 * modal. The route (app/api/nba/boxscore/[gameId]) also returns the final score and
 * team identity so the page can build the modal's `LiveMatch` header.
 *
 * Team-name<->tri-code mapping is reused from `NBA_TEAM_FULL_NAME`
 * (lib/constants/teams.ts) — no new mapping is created. nba_games stores FULL team
 * names; nba_player_stats.team is a tri-code.
 */

import { NBA_TEAM_FULL_NAME } from "@/lib/constants/teams"
import { normalizeTeamName } from "@/lib/scores/alignTeams"

/** The `nba_games` columns this helper needs. */
export interface NbaGameRow {
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  game_date?: string | null
  status?: string | null
}

/** The `nba_player_stats` columns this helper needs (one row per player per game). */
export interface NbaPlayerStatRow {
  player_name: string
  team: string
  position?: string | null
  minutes?: string | number | null
  pts?: number | null
  trb?: number | null
  ast?: number | null
  tp?: number | null
  stl?: number | null
  blk?: number | null
  tov?: number | null
  fg?: number | null
  fga?: number | null
  ft?: number | null
  fta?: number | null
}

export interface NbaBoxscoreTeam {
  team: string
  homeAway: "home" | "away"
  labels: string[]
  athletes: Array<{ name: string; position?: string; stats: string[] }>
}

export interface NbaBoxscore {
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  status: string
  gameDate: string | null
  /** Two teams (home first), each with its player stat lines. */
  players: NbaBoxscoreTeam[]
}

/** Reverse of NBA_TEAM_FULL_NAME: full name (normalized) -> tri-code. */
const FULL_NAME_TO_ABBR: Record<string, string> = Object.fromEntries(
  Object.entries(NBA_TEAM_FULL_NAME).map(([abbr, full]) => [normalizeTeamName(full), abbr.toUpperCase()])
)

/** Resolve a full team name to its tri-code, falling back to the input. */
function toAbbr(fullName: string): string {
  const normalized = normalizeTeamName(fullName)
  return FULL_NAME_TO_ABBR[normalized] ?? fullName.toUpperCase()
}

/** Stat columns shown in the boxscore table, in order. */
const STAT_LABELS = ["MIN", "PTS", "REB", "AST", "STL", "BLK", "TO", "FG", "FT"] as const

/** Minutes may be stored as a plain number or "MM:SS" text; show whole minutes. */
function formatMinutes(raw: string | number | null | undefined): string {
  if (raw == null) return "0"
  if (typeof raw === "number") return String(Math.round(raw))
  const text = String(raw).trim()
  if (text.includes(":")) return text.split(":")[0]
  const num = Number(text)
  return Number.isFinite(num) ? String(Math.round(num)) : text
}

function num(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function statLine(row: NbaPlayerStatRow): string[] {
  return [
    formatMinutes(row.minutes),
    String(num(row.pts)),
    String(num(row.trb)),
    String(num(row.ast)),
    String(num(row.stl)),
    String(num(row.blk)),
    String(num(row.tov)),
    `${num(row.fg)}-${num(row.fga)}`,
    `${num(row.ft)}-${num(row.fta)}`,
  ]
}

function buildTeam(
  rows: NbaPlayerStatRow[],
  teamFullName: string,
  homeAway: "home" | "away"
): NbaBoxscoreTeam {
  // Highest scorer first so the leader shows at the top of the table.
  const athletes = rows
    .slice()
    .sort((a, b) => num(b.pts) - num(a.pts))
    .map((row) => ({
      name: row.player_name,
      position: row.position ?? undefined,
      stats: statLine(row),
    }))

  return {
    team: toAbbr(teamFullName),
    homeAway,
    labels: [...STAT_LABELS],
    athletes,
  }
}

/**
 * Partition player rows into home/away teams by tri-code and produce the boxscore.
 *
 * A row belongs to the home team when its `team` tri-code matches the home full
 * name's resolved tri-code; everything else is treated as the away team. This
 * keeps both teams present even if one row carries an unexpected tri-code.
 */
export function shapeNbaBoxscore(game: NbaGameRow, players: NbaPlayerStatRow[]): NbaBoxscore {
  const homeAbbr = toAbbr(game.home_team)
  const awayAbbr = toAbbr(game.away_team)

  const homeRows: NbaPlayerStatRow[] = []
  const awayRows: NbaPlayerStatRow[] = []

  for (const row of players) {
    const rowAbbr = (row.team ?? "").toUpperCase()
    if (rowAbbr === homeAbbr) {
      homeRows.push(row)
    } else if (rowAbbr === awayAbbr) {
      awayRows.push(row)
    } else if (normalizeTeamName(row.team) === normalizeTeamName(game.home_team)) {
      // Fall back to a normalized full-name comparison if the tri-code is off.
      homeRows.push(row)
    } else {
      awayRows.push(row)
    }
  }

  return {
    homeTeam: game.home_team,
    awayTeam: game.away_team,
    homeScore: num(game.home_score),
    awayScore: num(game.away_score),
    status: game.status ?? "Finished",
    gameDate: game.game_date ?? null,
    players: [
      buildTeam(homeRows, game.home_team, "home"),
      buildTeam(awayRows, game.away_team, "away"),
    ],
  }
}
