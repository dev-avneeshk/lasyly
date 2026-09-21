/**
 * NFL Advanced Analytics — pure derived-metrics engine.
 *
 * Every function here is pure and deterministic (no I/O). They consume the RAW
 * seed shapes from ./types and produce DERIVED / AGGREGATED / RANKED values,
 * each carrying a MetricLabel so the caller/UI can badge provenance honestly.
 *
 * Hard rules (from the master build spec):
 *   - Never return NaN or Infinity to a caller. A ratio with a zero denominator
 *     is `null` (rendered as "—"), never a fabricated number.
 *   - Never invent a value the source does not support; missing RAW inputs
 *     propagate to a null DERIVED output.
 *   - Ranks/percentiles always carry the size of their comparison population.
 */

import type {
  Labeled,
  MetricLabel,
  NflAdvReceiving,
  NflPlayerGameStat,
  NflSnapCount,
  NflTeamGameStat,
  NflTeamSeasonUnit,
} from "./types"

// ─── Safe arithmetic ────────────────────────────────────────────────────────

/**
 * Divide safely. Returns null when the denominator is 0 / non-finite, or when
 * either operand is null/undefined — never NaN or Infinity.
 */
export function safeDiv(
  numerator: number | null | undefined,
  denominator: number | null | undefined
): number | null {
  if (numerator == null || denominator == null) return null
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null
  if (denominator === 0) return null
  const out = numerator / denominator
  return Number.isFinite(out) ? out : null
}

/** Safe rate as a percentage (0-100), or null. */
export function safePct(
  numerator: number | null | undefined,
  denominator: number | null | undefined
): number | null {
  const r = safeDiv(numerator, denominator)
  return r == null ? null : r * 100
}

/** Round to `dp` decimals; passes null through unchanged. */
export function round(value: number | null, dp = 1): number | null {
  if (value == null || !Number.isFinite(value)) return null
  const f = 10 ** dp
  return Math.round(value * f) / f
}

/** How a null DERIVED value should render. */
export const EM_DASH = "\u2014" // —

/** Present a possibly-null number for display, using "—" for null. */
export function display(value: number | null, dp = 1): string {
  const r = round(value, dp)
  return r == null ? EM_DASH : String(r)
}

function labeled<T>(value: T, label: MetricLabel): Labeled<T> {
  return { value, label }
}

// ─── Receiving efficiency (DERIVED) ─────────────────────────────────────────

export interface ReceivingEfficiency {
  catch_rate: Labeled<number | null>
  yards_per_target: Labeled<number | null>
  yards_per_reception: Labeled<number | null>
  td_per_target: Labeled<number | null>
  first_down_per_target: Labeled<number | null>
  yac_per_reception: Labeled<number | null>
  ybc_per_reception: Labeled<number | null>
  drop_rate: Labeled<number | null>
}

/**
 * Receiving efficiency ratios for one player-game. Uses advanced-receiving
 * inputs (which carry ybc/yac/first_downs); falls back to standard for the
 * yardage ratios. All divide-by-zeros → null.
 */
export function receivingEfficiency(rec: NflAdvReceiving): ReceivingEfficiency {
  return {
    catch_rate: labeled(round(safePct(rec.rec, rec.targets)), "DERIVED"),
    yards_per_target: labeled(round(safeDiv(rec.yds, rec.targets)), "DERIVED"),
    yards_per_reception: labeled(round(safeDiv(rec.yds, rec.rec)), "DERIVED"),
    td_per_target: labeled(round(safePct(rec.td, rec.targets)), "DERIVED"),
    first_down_per_target: labeled(round(safePct(rec.first_downs, rec.targets)), "DERIVED"),
    yac_per_reception: labeled(round(safeDiv(rec.yac, rec.rec)), "DERIVED"),
    ybc_per_reception: labeled(round(safeDiv(rec.ybc, rec.rec)), "DERIVED"),
    drop_rate: labeled(round(safePct(rec.drops, rec.targets)), "DERIVED"),
  }
}

// ─── Usage / opportunity shares (DERIVED) ───────────────────────────────────

export interface UsageShares {
  target_share: Labeled<number | null>
  reception_share: Labeled<number | null>
  receiving_yard_share: Labeled<number | null>
  air_yard_share: Labeled<number | null>
}

/**
 * A receiver's share of his team's passing opportunity for a game.
 *
 * Denominators are taken from the *team* totals so the share is honest:
 *   - target_share      = player targets / team pass attempts
 *   - reception_share   = player rec     / team completions
 *   - receiving_yd_share= player rec yds / team pass yds
 *   - air_yard_share    = player YBC     / team YBC (sum of receiver YBC)
 *
 * The air-yard denominator must be supplied by the caller (sum of all the
 * team's receivers' YBC for the game) because team pass yards are net of YAC;
 * pass null when unavailable → air_yard_share is null, never fabricated.
 */
export function usageShares(params: {
  playerTargets: number
  playerReceptions: number
  playerRecYds: number
  playerYbc: number | null
  teamPassAtt: number
  teamCompletions: number
  teamPassYds: number
  teamReceiverYbc: number | null
}): UsageShares {
  return {
    target_share: labeled(
      round(safePct(params.playerTargets, params.teamPassAtt)),
      "DERIVED"
    ),
    reception_share: labeled(
      round(safePct(params.playerReceptions, params.teamCompletions)),
      "DERIVED"
    ),
    receiving_yard_share: labeled(
      round(safePct(params.playerRecYds, params.teamPassYds)),
      "DERIVED"
    ),
    air_yard_share: labeled(
      round(safePct(params.playerYbc, params.teamReceiverYbc)),
      "DERIVED"
    ),
  }
}

/** Sum a team's receiver YBC for a game — the air-yard-share denominator. */
export function teamReceiverYbc(recs: NflAdvReceiving[], team: string): number {
  return recs.filter((r) => r.team === team).reduce((s, r) => s + (r.ybc || 0), 0)
}

// ─── Snap-based usage (DERIVED) ─────────────────────────────────────────────

export interface SnapUsage {
  offensive_snap_share: Labeled<number | null>
  targets_per_snap: Labeled<number | null>
  receptions_per_snap: Labeled<number | null>
  yards_per_snap: Labeled<number | null>
  touches_per_snap: Labeled<number | null>
}

/** Per-offensive-snap usage rates for a player-game. */
export function snapUsage(snap: NflSnapCount, stat: NflPlayerGameStat): SnapUsage {
  const touches = (stat.rush_att || 0) + (stat.rec || 0)
  return {
    // off_pct is RAW from the source; expose it labeled for parity.
    offensive_snap_share: labeled(round(snap.off_pct, 0), "RAW"),
    targets_per_snap: labeled(round(safeDiv(stat.targets, snap.off_snaps), 3), "DERIVED"),
    receptions_per_snap: labeled(round(safeDiv(stat.rec, snap.off_snaps), 3), "DERIVED"),
    yards_per_snap: labeled(round(safeDiv(stat.rec_yds, snap.off_snaps), 2), "DERIVED"),
    touches_per_snap: labeled(round(safeDiv(touches, snap.off_snaps), 3), "DERIVED"),
  }
}

// ─── YAC / air-yard style profile (DERIVED) ─────────────────────────────────

export interface YacProfile {
  ybc_per_reception: Labeled<number | null>
  yac_per_reception: Labeled<number | null>
  /** Share of receiving yards earned before the catch (0-100). */
  air_yard_pct: Labeled<number | null>
  /** Share of receiving yards earned after the catch (0-100). */
  yac_pct: Labeled<number | null>
}

export function yacProfile(rec: NflAdvReceiving): YacProfile {
  const totalYds = rec.yds
  return {
    ybc_per_reception: labeled(round(safeDiv(rec.ybc, rec.rec)), "DERIVED"),
    yac_per_reception: labeled(round(safeDiv(rec.yac, rec.rec)), "DERIVED"),
    air_yard_pct: labeled(round(safePct(rec.ybc, totalYds)), "DERIVED"),
    yac_pct: labeled(round(safePct(rec.yac, totalYds)), "DERIVED"),
  }
}

// ─── League baselines / ranks / percentiles (AGGREGATED + RANKED) ───────────

export interface Baseline {
  value: Labeled<number>
  league_average: Labeled<number>
  difference_from_average: Labeled<number>
  percentage_vs_average: Labeled<number | null>
  rank: Labeled<number>
  percentile: Labeled<number>
  /** Size of the comparison population — every rank/percentile must carry it. */
  sample_size: number
}

/** Mean of a numeric population; 0 for an empty population. */
export function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

/** Median of a numeric population; 0 for empty. */
export function median(values: number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const n = s.length
  return n % 2 === 0 ? (s[n / 2 - 1] + s[n / 2]) / 2 : s[Math.floor(n / 2)]
}

/**
 * Percentile rank of `value` within `population` (0-100). Ties share weight.
 * Empty population → 50 (neutral), matching the existing rankings engine.
 */
export function percentile(value: number, population: number[]): number {
  if (population.length === 0) return 50
  let below = 0
  let equal = 0
  for (const v of population) {
    if (v < value) below++
    else if (v === value) equal++
  }
  return ((below + equal / 2) / population.length) * 100
}

/**
 * 1-based rank of `value` within `population`. `direction` decides whether
 * higher or lower is rank #1 (e.g. points scored = "desc"; points allowed =
 * "asc"). Ties get the same (competition) rank.
 */
export function rankOf(
  value: number,
  population: number[],
  direction: "asc" | "desc"
): number {
  let better = 0
  for (const v of population) {
    if (direction === "desc" ? v > value : v < value) better++
  }
  return better + 1
}

/**
 * Full baseline bundle for a team metric against the league population.
 * `higherIsBetter` orients the rank (offense yards → true; points allowed →
 * false). The metric value itself is never inverted — only the rank is.
 */
export function baseline(
  value: number,
  population: number[],
  higherIsBetter: boolean
): Baseline {
  const avg = mean(population)
  const diff = value - avg
  const pctVs = safePct(diff, avg) // relative to average; null if avg === 0
  return {
    value: labeled(round(value, 2) ?? value, "RAW"),
    league_average: labeled(round(avg, 2) ?? avg, "AGGREGATED"),
    difference_from_average: labeled(round(diff, 2) ?? diff, "DERIVED"),
    percentage_vs_average: labeled(round(pctVs, 1), "DERIVED"),
    rank: labeled(rankOf(value, population, higherIsBetter ? "desc" : "asc"), "RANKED"),
    percentile: labeled(
      round(higherIsBetter ? percentile(value, population) : 100 - percentile(value, population), 1) ??
        50,
      "RANKED"
    ),
    sample_size: population.length,
  }
}

// ─── Opponent / matchup context (AGGREGATED + RANKED) ───────────────────────

export interface MatchupStrength {
  pass_defense: Baseline // opponent pass yards allowed (lower = tougher)
  rush_defense: Baseline // opponent rush yards allowed
  scoring_defense: Baseline // opponent points allowed
  explosiveness_allowed: Baseline // opponent yards/play allowed
  turnover_defense: Baseline // opponent turnover % forced (higher = tougher)
}

/**
 * Build a matchup-strength context for a given opponent's DEFENSE, normalized
 * against the league defensive population. Every component is a Baseline so the
 * caller keeps ranks + percentiles + sample size.
 *
 * Orientation note: for a defense, allowing FEWER yards/points is better, so
 * `higherIsBetter=false`; forcing MORE turnovers is better, so `true`.
 */
export function matchupStrength(
  opponent: string,
  leagueDefense: NflTeamSeasonUnit[]
): MatchupStrength | null {
  const opp = leagueDefense.find((u) => u.team === opponent)
  if (!opp) return null

  const passYds = leagueDefense.map((u) => u.pass_yds)
  const rushYds = leagueDefense.map((u) => u.rush_yds)
  const points = leagueDefense.map((u) => u.points)
  const ypp = leagueDefense.map((u) => u.yds_per_play)
  const toPct = leagueDefense.map((u) => u.turnover_pct)

  return {
    pass_defense: baseline(opp.pass_yds, passYds, false),
    rush_defense: baseline(opp.rush_yds, rushYds, false),
    scoring_defense: baseline(opp.points, points, false),
    explosiveness_allowed: baseline(opp.yds_per_play, ypp, false),
    turnover_defense: baseline(opp.turnover_pct, toPct, true),
  }
}

// ─── Drive efficiency (AGGREGATED) ──────────────────────────────────────────

export interface DriveEfficiency {
  drives: number
  yards_per_drive: Labeled<number | null>
  plays_per_drive: Labeled<number | null>
  points_per_drive: Labeled<number | null>
  scoring_drive_rate: Labeled<number | null>
  turnover_drive_rate: Labeled<number | null>
}

const SCORING_RESULTS = new Set(["Touchdown", "Field Goal"])
const TURNOVER_RESULTS = new Set(["Interception", "Fumble", "Downs"])

/**
 * Aggregate a team's drives for a game into efficiency rates. `points` is the
 * team's total points that game (RAW), used for points-per-drive.
 */
export function driveEfficiency(
  drives: { plays: number; net_yds: number; result: string }[],
  points: number
): DriveEfficiency {
  const n = drives.length
  const totalPlays = drives.reduce((s, d) => s + (d.plays || 0), 0)
  const totalYds = drives.reduce((s, d) => s + (d.net_yds || 0), 0)
  const scoring = drives.filter((d) => SCORING_RESULTS.has(d.result)).length
  const turnovers = drives.filter((d) => TURNOVER_RESULTS.has(d.result)).length
  return {
    drives: n,
    yards_per_drive: labeled(round(safeDiv(totalYds, n), 1), "AGGREGATED"),
    plays_per_drive: labeled(round(safeDiv(totalPlays, n), 1), "AGGREGATED"),
    points_per_drive: labeled(round(safeDiv(points, n), 2), "AGGREGATED"),
    scoring_drive_rate: labeled(round(safePct(scoring, n), 1), "DERIVED"),
    turnover_drive_rate: labeled(round(safePct(turnovers, n), 1), "DERIVED"),
  }
}

// ─── Team-stat reconciliation helpers (used by tests + ingestion QA) ─────────

/**
 * Reconcile per-player receiving against a team line: the sum of a team's
 * player receptions/targets/rec-yards must match the team totals derived from
 * the passing line. Returns the discrepancies (empty array = clean).
 */
export function reconcileTeamPassing(
  team: NflTeamGameStat,
  playerStats: NflPlayerGameStat[]
): string[] {
  const issues: string[] = []
  const teamPlayers = playerStats.filter((p) => p.team === team.team)

  const recSum = teamPlayers.reduce((s, p) => s + (p.rec || 0), 0)
  const recYdsSum = teamPlayers.reduce((s, p) => s + (p.rec_yds || 0), 0)
  const passCmpSum = teamPlayers.reduce((s, p) => s + (p.pass_cmp || 0), 0)
  const passYdsSum = teamPlayers.reduce((s, p) => s + (p.pass_yds || 0), 0)

  // Team completions should equal both total receptions and total pass cmp.
  if (recSum !== team.pass_cmp) {
    issues.push(`${team.team}: receptions ${recSum} != team completions ${team.pass_cmp}`)
  }
  if (passCmpSum !== team.pass_cmp) {
    issues.push(`${team.team}: QB completions ${passCmpSum} != team completions ${team.pass_cmp}`)
  }
  if (recYdsSum !== team.pass_yds) {
    issues.push(`${team.team}: receiving yds ${recYdsSum} != team pass yds ${team.pass_yds}`)
  }
  if (passYdsSum !== team.pass_yds) {
    issues.push(`${team.team}: passing yds ${passYdsSum} != team pass yds ${team.pass_yds}`)
  }
  return issues
}
