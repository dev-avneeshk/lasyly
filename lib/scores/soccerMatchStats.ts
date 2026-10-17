/**
 * Shape our own Big-5 soccer DB rows (`soccer_matches` + `soccer_match_stats`
 * + `espn_teams`) into the match-stats payload the analysis-page popup renders.
 * ESPN is not consulted.
 *
 * Pure and client-safe (no server imports): the route
 * (app/api/soccer/match-stats/[league]/[season]/[matchNo]) calls
 * `shapeSoccerMatchStats`, and the page calls `buildSoccerModalData` to feed the
 * existing `MatchDetailModal` through its `presuppliedSummary` path. Display
 * text is computed here, so `PeriodStatsTab` renders it verbatim.
 */

import type { LiveMatch, MatchSummary } from "@/types"
import { normalizeTeamName } from "@/lib/scores/alignTeams"
import {
  BIG5_LEAGUES,
  PERIOD_LABELS,
  PERIOD_ORDER,
  STAT_GROUP_ORDER,
  STAT_ORDER,
  buildMatchKey,
  type SoccerPeriod,
} from "@/lib/soccer/big5"

/** The `soccer_matches` columns the route selects. */
export interface SoccerMatchRow {
  league: string
  season: string
  match_no: number | string
  round: number | string | null
  match_date: string
  home_team: string
  away_team: string
  home_score: number | string | null
  away_score: number | string | null
  source: string
  has_stats: boolean
}

/** The `soccer_match_stats` columns the route selects. `numeric` may arrive as a string. */
export interface SoccerMatchStatRow {
  period: string
  stat_group: string
  stat_name: string
  home_value: number | string | null
  away_value: number | string | null
  home_pct?: number | string | null
  away_pct?: number | string | null
  home_raw: string | null
  away_raw: string | null
}

/** The `espn_teams` columns the route selects. */
export interface SoccerTeamRow {
  name: string
  logo_url: string | null
  color: string | null
}

export interface SoccerStatLine {
  label: string
  home: string
  away: string
  homeValue: number | null
  awayValue: number | null
}

export interface SoccerStatGroup {
  group: string
  stats: SoccerStatLine[]
}

export interface SoccerPeriodStats {
  period: "FT" | "1H" | "2H"
  label: string
  groups: SoccerStatGroup[]
}

export interface SoccerMatchStats {
  matchKey: string
  league: string
  leagueName: string
  season: string
  matchNo: number
  round: number | null
  matchDate: string
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  homeLogo: string | null
  awayLogo: string | null
  homeColor: string | null
  awayColor: string | null
  source: string
  hasStats: boolean
  periods: SoccerPeriodStats[]
}

/** Raw values with a percentage, e.g. "298 (78%)". */
const PCT_RAW_RE = /\(\s*-?\d+(?:\.\d+)?\s*%\s*\)/

/** Source distances are in meters; shown in km. */
const DISTANCE_STATS = new Set(["Distance covered", "Running distance", "Sprinting distance"])

/** Raw text that means "no value". */
function isEmptyRaw(raw: string | null | undefined): boolean {
  const text = (raw ?? "").trim()
  return text === "" || text === "-" || text.toLowerCase() === "n/a"
}

/** `Number(v)`, or null when missing or not finite. */
function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Display text for one side of a stat. */
export function formatStatDisplay(statName: string, value: number | null, raw: string | null): string {
  if (value === null) return "–"
  const text = (raw ?? "").trim()
  if (PCT_RAW_RE.test(text)) return text
  if (statName === "Ball possession") return `${value}%`
  if (DISTANCE_STATS.has(statName)) return `${(value / 1000).toFixed(1)} km`
  return text || String(value)
}

/** Sort by a known order; unknown entries go last, alphabetically. */
function compareByOrder(order: readonly string[], a: string, b: string): number {
  const ia = order.indexOf(a)
  const ib = order.indexOf(b)
  if (ia !== -1 && ib !== -1) return ia - ib
  if (ia !== -1) return -1
  if (ib !== -1) return 1
  return a.localeCompare(b)
}

/** Find a team's espn_teams row: exact name first, then normalized. */
function findTeam(teams: SoccerTeamRow[], name: string): SoccerTeamRow | undefined {
  const exact = teams.find((t) => t.name === name)
  if (exact) return exact
  const normalized = normalizeTeamName(name)
  return teams.find((t) => normalizeTeamName(t.name) === normalized)
}

function shapePeriods(rows: SoccerMatchStatRow[]): SoccerPeriodStats[] {
  // period -> group -> stat lines
  const byPeriod = new Map<string, Map<string, SoccerStatLine[]>>()

  for (const row of rows) {
    if (!(PERIOD_ORDER as readonly string[]).includes(row.period)) continue
    const homeValue = toNumber(row.home_value)
    const awayValue = toNumber(row.away_value)
    if (homeValue === null && awayValue === null && isEmptyRaw(row.home_raw) && isEmptyRaw(row.away_raw)) {
      continue
    }

    let groups = byPeriod.get(row.period)
    if (!groups) {
      groups = new Map()
      byPeriod.set(row.period, groups)
    }
    let stats = groups.get(row.stat_group)
    if (!stats) {
      stats = []
      groups.set(row.stat_group, stats)
    }
    stats.push({
      label: row.stat_name,
      home: formatStatDisplay(row.stat_name, homeValue, row.home_raw),
      away: formatStatDisplay(row.stat_name, awayValue, row.away_raw),
      homeValue,
      awayValue,
    })
  }

  const periods: SoccerPeriodStats[] = []
  for (const period of PERIOD_ORDER) {
    const groups = byPeriod.get(period)
    if (!groups) continue
    const groupNames = [...groups.keys()].sort((a, b) => compareByOrder(STAT_GROUP_ORDER, a, b))
    const shapedGroups: SoccerStatGroup[] = []
    for (const group of groupNames) {
      const order = STAT_ORDER[group] ?? []
      const stats = groups.get(group)!.slice().sort((a, b) => compareByOrder(order, a.label, b.label))
      if (stats.length > 0) shapedGroups.push({ group, stats })
    }
    if (shapedGroups.length === 0) continue
    periods.push({ period, label: PERIOD_LABELS[period as SoccerPeriod], groups: shapedGroups })
  }
  return periods
}

/**
 * Build the popup payload from a `soccer_matches` row, its stat rows and the
 * two teams' `espn_teams` rows. A match without stats gets `periods: []`.
 */
export function shapeSoccerMatchStats(
  match: SoccerMatchRow,
  rows: SoccerMatchStatRow[],
  teams: SoccerTeamRow[],
): SoccerMatchStats {
  const matchNo = Number(match.match_no)
  const home = findTeam(teams, match.home_team)
  const away = findTeam(teams, match.away_team)
  const leagueName = BIG5_LEAGUES.find((l) => l.code === match.league)?.name ?? match.league

  return {
    matchKey: buildMatchKey(match.league, match.season, matchNo),
    league: match.league,
    leagueName,
    season: match.season,
    matchNo,
    round: toNumber(match.round),
    matchDate: match.match_date,
    homeTeam: match.home_team,
    awayTeam: match.away_team,
    homeScore: toNumber(match.home_score) ?? 0,
    awayScore: toNumber(match.away_score) ?? 0,
    homeLogo: home?.logo_url ?? null,
    awayLogo: away?.logo_url ?? null,
    homeColor: home?.color ?? null,
    awayColor: away?.color ?? null,
    source: match.source,
    hasStats: match.has_stats,
    periods: match.has_stats ? shapePeriods(rows) : [],
  }
}

/** The modal header (`LiveMatch`) and presupplied summary for a soccer match. */
export function buildSoccerModalData(data: SoccerMatchStats): { match: LiveMatch; summary: MatchSummary } {
  const match: LiveMatch = {
    id: `soccer-${data.matchKey}`,
    league: data.leagueName,
    sport: "Soccer",
    status: "Finished",
    homeTeam: data.homeTeam,
    awayTeam: data.awayTeam,
    homeScore: data.homeScore,
    awayScore: data.awayScore,
    homeLogo: data.homeLogo ?? undefined,
    awayLogo: data.awayLogo ?? undefined,
    homeColor: data.homeColor ?? undefined,
    awayColor: data.awayColor ?? undefined,
  }
  const summary: MatchSummary = {
    eventId: match.id,
    boxscore: { teams: [], players: [] },
    periodStats: data.periods,
  }
  return { match, summary }
}
