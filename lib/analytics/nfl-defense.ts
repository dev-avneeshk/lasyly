/**
 * NFL Positional Defense-Allowed Data Layer
 *
 * Computes, for every NFL team, what that team's defense ALLOWS to opposing
 * players — split by position (QB / RB / WR / TE) and stat — as a per-game
 * average, plus the league average and the team's rank (1 = softest / most
 * allowed, 32 = toughest) for each (position, stat).
 *
 * Source: nfl_player_stats (rows where opponent = <team> describe what that
 * team's defense faced/allowed). No extra scraping required — everything is
 * derived from data we already store.
 *
 * This mirrors the NBA nba_team_defense_stats concept but is computed live and
 * cached (the data volume — 32 teams × ~20 games — is tiny).
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { cached } from "@/lib/cache"
import { fetchPagedParallel } from "@/lib/supabase/paged"

// ─── Types ──────────────────────────────────────────────────────────────────

export type NFLDefensePosition = "QB" | "RB" | "WR" | "TE"

/** Column keys we aggregate from nfl_player_stats. */
export type NFLDefenseStatKey =
  | "carries" | "rush_yds" | "rush_td" | "rush_long" | "rush_first_downs"
  | "targets" | "receptions" | "rec_yds" | "rec_td" | "rec_long"
  | "pass_yds" | "pass_td" | "pass_int" | "completions" | "attempts"

export interface DefenseStatCell {
  key: NFLDefenseStatKey
  label: string
  /** Per-game value this defense allows to the position. */
  perGame: number
  /** League average per-game allowed to the position. */
  leagueAvg: number
  /** Rank 1..N. 1 = softest (allows the most) → best for the offense. */
  rank: number
  /** Total number of ranked teams (usually 32). */
  rankOf: number
  /**
   * Softer/tougher percentile in [0,1]. 0 = toughest (allows least),
   * 1 = softest (allows most). Used to position the bar.
   */
  percentile: number
  /** Whether more of this stat helps the OFFENSE (true) or the DEFENSE. */
  offenseFriendly: boolean
}

export interface DefenseAllowedResult {
  team: string
  position: NFLDefensePosition
  split: DefenseSplit
  season: number | "all"
  gamesFaced: number
  /** Grouped stat cells, keyed by group name (rushing / receiving / passing). */
  groups: Record<string, DefenseStatCell[]>
  /** Flat lookup by stat key for engine consumption. */
  byStat: Record<string, DefenseStatCell>
}

export type DefenseSplit = "all" | "home" | "away"

// ─── Stat configuration ───────────────────────────────────────────────────────

interface StatDef {
  key: NFLDefenseStatKey
  label: string
  group: "rushing" | "receiving" | "passing"
  /** Source columns on nfl_player_stats to read (summed per player-game). */
  sourceCol: string
  /** "sum" aggregates across the position group per game; "max" takes the max (e.g. LONGEST). */
  agg: "sum" | "max"
  /** Positions this stat applies to. */
  positions: NFLDefensePosition[]
  /** More = better for the offense (true) — nearly all volume/scoring stats. */
  offenseFriendly: boolean
}

const STAT_DEFS: StatDef[] = [
  // Rushing
  { key: "carries", label: "Carries", group: "rushing", sourceCol: "rush_att", agg: "sum", positions: ["RB", "QB"], offenseFriendly: true },
  { key: "rush_yds", label: "Rush Yards", group: "rushing", sourceCol: "rush_yds", agg: "sum", positions: ["RB", "QB"], offenseFriendly: true },
  { key: "rush_td", label: "Rush TD", group: "rushing", sourceCol: "rush_td", agg: "sum", positions: ["RB", "QB"], offenseFriendly: true },
  { key: "rush_long", label: "Longest", group: "rushing", sourceCol: "rush_long", agg: "max", positions: ["RB", "QB"], offenseFriendly: true },
  // Receiving
  { key: "targets", label: "Targets", group: "receiving", sourceCol: "targets", agg: "sum", positions: ["WR", "TE", "RB"], offenseFriendly: true },
  { key: "receptions", label: "Receptions", group: "receiving", sourceCol: "rec", agg: "sum", positions: ["WR", "TE", "RB"], offenseFriendly: true },
  { key: "rec_yds", label: "Rec Yards", group: "receiving", sourceCol: "rec_yds", agg: "sum", positions: ["WR", "TE", "RB"], offenseFriendly: true },
  { key: "rec_td", label: "Rec TD", group: "receiving", sourceCol: "rec_td", agg: "sum", positions: ["WR", "TE", "RB"], offenseFriendly: true },
  { key: "rec_long", label: "Longest", group: "receiving", sourceCol: "rec_long", agg: "max", positions: ["WR", "TE", "RB"], offenseFriendly: true },
  // Passing (QB)
  { key: "pass_yds", label: "Pass Yards", group: "passing", sourceCol: "pass_yds", agg: "sum", positions: ["QB"], offenseFriendly: true },
  { key: "pass_td", label: "Pass TD", group: "passing", sourceCol: "pass_td", agg: "sum", positions: ["QB"], offenseFriendly: true },
  // INT thrown: more = better for the DEFENSE (they force turnovers)
  { key: "pass_int", label: "INT", group: "passing", sourceCol: "pass_int", agg: "sum", positions: ["QB"], offenseFriendly: false },
]

/** All 32 NFL team abbreviations as used in nfl_player_stats.team. */
export const NFL_TEAMS = [
  "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE", "DAL", "DEN",
  "DET", "GB", "HOU", "IND", "JAX", "KC", "LAC", "LAR", "LV", "MIA",
  "MIN", "NE", "NO", "NYG", "NYJ", "PHI", "PIT", "SEA", "SF", "TB",
  "TEN", "WSH",
]

// ─── Raw aggregation ──────────────────────────────────────────────────────────

interface RawRow {
  opponent: string   // the defense that faced this player
  team: string       // the offense
  position: string
  game_id: string
  home_away: "home" | "away" | null
  vals: Record<string, number>
}

/**
 * Pulls every player-game row for a season (or all-time) with the columns we
 * aggregate, so we can compute allowances for all teams in one pass.
 */
async function fetchDefenseRows(season: number | "all"): Promise<RawRow[]> {
  const supabase = createAdminClient()
  const cols =
    "game_id, team, opponent, position, game_date, " +
    "rush_att, rush_yds, rush_td, rush_long, " +
    "targets, rec, rec_yds, rec_td, rec_long, " +
    "pass_yds, pass_td, pass_int, pass_c, pass_att"

  // Resolve the season's date range from nfl_games (season spans two calendar years).
  let startDate: string | null = null
  let endDate: string | null = null
  if (season !== "all") {
    const { data: g } = await supabase
      .from("nfl_games")
      .select("game_date")
      .eq("season", season)
      .order("game_date", { ascending: true })
      .limit(1)
    const { data: g2 } = await supabase
      .from("nfl_games")
      .select("game_date")
      .eq("season", season)
      .order("game_date", { ascending: false })
      .limit(1)
    startDate = g?.[0]?.game_date ?? null
    endDate = g2?.[0]?.game_date ?? null
  }

  // Home/away lookup for the offense team in each game.
  const homeByGame = new Map<string, string>()
  {
    let gq = supabase.from("nfl_games").select("id, home_abbr")
    if (season !== "all") gq = gq.eq("season", season)
    const { data: games } = await gq.limit(2000)
    for (const gm of (games ?? []) as any[]) {
      if (gm.id && gm.home_abbr) homeByGame.set(gm.id, gm.home_abbr)
    }
  }

  // This scan is the cold-start cost of the whole NFL props page. Paged
  // serially it was up to 40 sequential round trips before any aggregation
  // began; fetchPagedParallel turns that into a count query plus a handful of
  // concurrent waves. The `id` tiebreaker is required for correctness once the
  // pages are independent queries — ordering by game_date alone is not a total
  // order, so equal-dated rows could land in two pages or neither.
  const raw = await fetchPagedParallel<any>(
    async () => {
      let cq = supabase
        .from("nfl_player_stats")
        .select("id", { count: "exact", head: true })
      if (startDate) cq = cq.gte("game_date", startDate)
      if (endDate) cq = cq.lte("game_date", endDate)
      const { count } = await cq
      return count ?? null
    },
    async (from, to) => {
      let q = supabase
        .from("nfl_player_stats")
        .select(cols)
        .order("game_date", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to)
      if (startDate) q = q.gte("game_date", startDate)
      if (endDate) q = q.lte("game_date", endDate)

      const { data, error } = await q
      if (error) {
        console.error("[nfl-defense] player stats page failed:", error.message)
        return []
      }
      return (data ?? []) as any[]
    },
    { maxRows: 40_000 }
  )

  const rows: RawRow[] = []
  for (const r of raw) {
    if (!r.opponent || !r.position) continue
    const homeAbbr = homeByGame.get(r.game_id)
    const home_away: "home" | "away" | null = homeAbbr
      ? homeAbbr === r.team ? "home" : "away"
      : null
    rows.push({
      opponent: r.opponent,
      team: r.team,
      position: (r.position || "").toUpperCase(),
      game_id: r.game_id,
      home_away,
      vals: {
        rush_att: Number(r.rush_att) || 0,
        rush_yds: Number(r.rush_yds) || 0,
        rush_td: Number(r.rush_td) || 0,
        rush_long: Number(r.rush_long) || 0,
        targets: Number(r.targets) || 0,
        rec: Number(r.rec) || 0,
        rec_yds: Number(r.rec_yds) || 0,
        rec_td: Number(r.rec_td) || 0,
        rec_long: Number(r.rec_long) || 0,
        pass_yds: Number(r.pass_yds) || 0,
        pass_td: Number(r.pass_td) || 0,
        pass_int: Number(r.pass_int) || 0,
        pass_c: Number(r.pass_c) || 0,
        pass_att: Number(r.pass_att) || 0,
      },
    })
  }
  return rows
}

// ─── League-wide computation (all teams, all positions) ─────────────────────────

/**
 * The computed league table, in a JSON-safe shape.
 *
 * These are plain nested records rather than Maps on purpose: this value is
 * stored in Redis, and `JSON.stringify(new Map())` is `"{}"`. When this used
 * Maps, the first request computed the table correctly and every subsequent
 * request read back an empty object whose `.get()` threw — which the props
 * engine swallowed in a `catch`, so matchup grades silently disappeared and the
 * /api/props/nfl-defense panels returned empty groups until the TTL lapsed.
 */
export interface LeagueTable {
  /** team → position → statKey → per-game value allowed. */
  perGame: Record<string, Record<string, Record<string, number>>>
  /** team → distinct games its defense faced. */
  gamesFaced: Record<string, number>
}

function computeLeagueTable(rows: RawRow[], split: DefenseSplit): LeagueTable {
  // For each (defense team, game, position, statKey), accumulate per game.
  // gameAgg: team -> pos -> statKey -> gameId -> aggregated value
  const gameAgg = new Map<string, Map<string, Map<string, Map<string, number>>>>()
  const gamesByTeam = new Map<string, Set<string>>()

  for (const row of rows) {
    // Split filter is on the OFFENSE's home/away; for a defense, "home" means
    // the defense was at home → the offense was away. We filter by the defense's
    // venue: defense home == offense away.
    if (split !== "all") {
      const defenseHome = row.home_away === "away" // offense away → defense home
      if (split === "home" && !defenseHome) continue
      if (split === "away" && defenseHome) continue
    }

    const def = row.opponent
    if (!gamesByTeam.has(def)) gamesByTeam.set(def, new Set())
    gamesByTeam.get(def)!.add(row.game_id)

    for (const sd of STAT_DEFS) {
      if (!sd.positions.includes(row.position as NFLDefensePosition)) continue
      const v = row.vals[sd.sourceCol] ?? 0

      if (!gameAgg.has(def)) gameAgg.set(def, new Map())
      const posMap = gameAgg.get(def)!
      if (!posMap.has(row.position)) posMap.set(row.position, new Map())
      const statMap = posMap.get(row.position)!
      if (!statMap.has(sd.key)) statMap.set(sd.key, new Map())
      const byGame = statMap.get(sd.key)!

      const prev = byGame.get(row.game_id) ?? (sd.agg === "max" ? 0 : 0)
      byGame.set(row.game_id, sd.agg === "max" ? Math.max(prev, v) : prev + v)
    }
  }

  // Reduce per-game maps to a per-game AVERAGE across games faced.
  const perGame: LeagueTable["perGame"] = {}
  for (const [team, posMap] of gameAgg) {
    const games = gamesByTeam.get(team)?.size ?? 0
    const outPos: Record<string, Record<string, number>> = {}
    for (const [pos, statMap] of posMap) {
      const outStat: Record<string, number> = {}
      for (const [statKey, byGame] of statMap) {
        const total = [...byGame.values()].reduce((s, v) => s + v, 0)
        // For "max" stats, average the per-game maxima; for "sum", average totals.
        const val = games > 0 ? total / games : 0
        outStat[statKey] = Math.round(val * 10) / 10
      }
      outPos[pos] = outStat
    }
    perGame[team] = outPos
  }

  const gamesFaced: LeagueTable["gamesFaced"] = {}
  for (const [team, set] of gamesByTeam) gamesFaced[team] = set.size

  return { perGame, gamesFaced }
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the full "Defense Allowed" payload for a single team + position,
 * including league averages and ranks computed across all 32 teams.
 */
/**
 * The cached league-wide allowance table for a (season, split).
 *
 * Exported separately from `getNFLDefenseAllowed` because the props engine needs
 * the grade for dozens of (opponent, position) pairs per request. When the only
 * entry point was `getNFLDefenseAllowed`, each of those pairs went through
 * `cached()` independently — the table is the *same* for all of them, so a
 * single NFL props request fetched this 13.7KB blob ~160 times over Redis. Fetch
 * the table once with this, then call `rankDefenseTable` per pair in memory.
 */
export async function getNFLDefenseLeagueTable(
  season: number | "all" = "all",
  split: DefenseSplit = "all"
): Promise<LeagueTable> {
  // v2 in the key retires entries written in the old Map-based shape, which
  // deserialize from Redis as `{}` and would otherwise read as a valid-but-empty
  // table for the life of the TTL.
  const key = `nfl-def:v2:${season}:${split}`

  // 1 hour: this is a full-table aggregate over every player-game of the season,
  // and NFL box scores only change once a week. A 10-minute TTL meant a browsing
  // session kept paying for the cold recompute.
  return cached(
    key,
    async () => {
      const rows = await fetchDefenseRows(season)
      return computeLeagueTable(rows, split)
    },
    60 * 60_000
  )
}

/**
 * Rank one team + position against an already-fetched league table. Pure and
 * synchronous — no I/O — so callers can grade a whole slate in one pass.
 */
export function rankDefenseTable(
  league: LeagueTable,
  team: string,
  position: NFLDefensePosition,
  season: number | "all" = "all",
  split: DefenseSplit = "all"
): DefenseAllowedResult {
  const teamU = team.toUpperCase()
  const posU = position.toUpperCase() as NFLDefensePosition

  // For each applicable stat, gather every team's value to compute rank + avg.
  const groups: Record<string, DefenseStatCell[]> = {}
  const byStat: Record<string, DefenseStatCell> = {}

  const applicable = STAT_DEFS.filter((d) => d.positions.includes(posU))

  for (const sd of applicable) {
    const values: { team: string; v: number }[] = []
    for (const t of NFL_TEAMS) {
      const v = league.perGame?.[t]?.[posU]?.[sd.key]
      if (v != null) values.push({ team: t, v })
    }
    if (values.length === 0) continue

    const leagueAvg =
      Math.round((values.reduce((s, x) => s + x.v, 0) / values.length) * 10) / 10

    // Rank: 1 = allows the MOST (softest) when offenseFriendly, else 1 = allows
    // the fewest INTs is tough... For INT (defense-friendly), softest for offense
    // = fewest INTs forced, so sort ascending for offenseFriendly=false.
    const sorted = [...values].sort((a, b) =>
      sd.offenseFriendly ? b.v - a.v : a.v - b.v
    )
    const rankOf = sorted.length
    const idx = sorted.findIndex((x) => x.team === teamU)
    const teamVal = league.perGame?.[teamU]?.[posU]?.[sd.key] ?? 0
    const rank = idx >= 0 ? idx + 1 : rankOf
    // percentile: 1 = softest (rank 1), 0 = toughest (rank N)
    const percentile = rankOf > 1 ? 1 - (rank - 1) / (rankOf - 1) : 0.5

    const cell: DefenseStatCell = {
      key: sd.key,
      label: sd.label,
      perGame: teamVal,
      leagueAvg,
      rank,
      rankOf,
      percentile,
      offenseFriendly: sd.offenseFriendly,
    }
    if (!groups[sd.group]) groups[sd.group] = []
    groups[sd.group].push(cell)
    byStat[sd.key] = cell
  }

  return {
    team: teamU,
    position: posU,
    split,
    season,
    gamesFaced: league.gamesFaced?.[teamU] ?? 0,
    groups,
    byStat,
  }
}

/**
 * Returns the full "Defense Allowed" payload for a single team + position,
 * including league averages and ranks computed across all 32 teams.
 *
 * Convenience wrapper over `getNFLDefenseLeagueTable` + `rankDefenseTable` for
 * single-pair callers (the /api/props/nfl-defense panel). Callers grading many
 * pairs should fetch the table once and rank in memory instead.
 */
export async function getNFLDefenseAllowed(
  team: string,
  position: NFLDefensePosition,
  opts?: { season?: number | "all"; split?: DefenseSplit }
): Promise<DefenseAllowedResult> {
  const season = opts?.season ?? "all"
  const split = opts?.split ?? "all"
  const league = await getNFLDefenseLeagueTable(season, split)
  return rankDefenseTable(league, team, position, season, split)
}

/**
 * Lightweight helper for the props engine: given a team, position, and a
 * defense stat key, return { allowed, leagueAvg, rank, rankOf } — enough to
 * grade the matchup. Reuses the same cached league table.
 */
export async function getNFLDefenseCell(
  team: string,
  position: NFLDefensePosition,
  statKey: NFLDefenseStatKey,
  opts?: { season?: number | "all" }
): Promise<DefenseStatCell | null> {
  const result = await getNFLDefenseAllowed(team, position, { season: opts?.season })
  return result.byStat[statKey] ?? null
}
