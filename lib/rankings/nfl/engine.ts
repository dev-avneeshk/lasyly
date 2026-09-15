/**
 * NFL Ranking Engine — pure scoring functions.
 *
 * Turns raw nfl_player_stats box scores into per-player normalized scores.
 * Everything here is pure and deterministic (no I/O), so it is unit-testable
 * and produces identical output for identical input.
 *
 * Scoring philosophy
 * ------------------
 * NFL box scores don't carry the advanced metrics NBA rankings lean on, so we
 * build scores from production + efficiency, normalized WITHIN a player's
 * position group (a WR's yards aren't comparable to a QB's). Each player gets:
 *   - scoring_score     : yardage/production volume (position-normalized)
 *   - playmaking_score  : touchdowns + big-play rate
 *   - efficiency_score  : per-attempt/per-target efficiency & ball security
 *   - defense_score     : tackles/sacks/INTs/PDs (defensive contributors)
 *   - offense_score     : blend of the offensive components
 *   - two_way_score     : max(offense, defense) so DEF players surface too
 *   - overall_score     : the headline number used for the "overall" board
 *
 * The overall score is a position-weighted blend, then all overall scores are
 * spread across a 40-100 band so the board reads like a ranking rather than a
 * cluster of similar numbers.
 */

import type { RankingTier } from "@/lib/rankings/types"
import type {
  NflStatRow,
  NflPlayerAggregate,
  NflPlayerScore,
  NflRankPosition,
} from "./types"

export const ALGORITHM_VERSION = "nfl-ranking-v1"

/** Minimum games before a player qualifies (ramps down early season). */
export function resolveMinGames(maxGamesInLeague: number): number {
  if (maxGamesInLeague >= 8) return 4
  if (maxGamesInLeague >= 4) return 2
  return 1
}

// ─── Position resolution ──────────────────────────────────────────────────────

/**
 * Resolve a ranking position from the raw ESPN position + what the player
 * actually accumulates. Defensive players (tackles/sacks with negligible
 * offensive volume) collapse into DEF.
 */
export function resolvePosition(agg: {
  position: string | null
  passYds: number
  rushYds: number
  recYds: number
  tackles: number
  sacks: number
  defInt: number
}): NflRankPosition {
  const p = (agg.position ?? "").toUpperCase()
  const offenseVolume = agg.passYds + agg.rushYds + agg.recYds
  const defenseVolume = agg.tackles + agg.sacks * 5 + agg.defInt * 5

  // Explicit offensive skill positions.
  if (p === "QB") return "QB"
  if (p === "RB" || p === "FB" || p === "HB") return "RB"
  if (p === "WR") return "WR"
  if (p === "TE") return "TE"

  // Defensive / special positions, or unknown position with defensive volume.
  const DEF_POS = new Set([
    "DE", "DT", "NT", "LB", "ILB", "OLB", "MLB", "CB", "DB", "S", "SS", "FS", "EDGE",
  ])
  if (DEF_POS.has(p)) return "DEF"

  // Fall back on production when the position label is missing/ambiguous.
  if (offenseVolume < 50 && defenseVolume > 10) return "DEF"
  if (agg.passYds > agg.rushYds && agg.passYds > agg.recYds && agg.passYds > 100) return "QB"
  if (agg.rushYds >= agg.recYds && agg.rushYds > 0) return "RB"
  if (agg.recYds > 0) return "WR"
  return "FLEX"
}

// ─── Aggregation ────────────────────────────────────────────────────────────

/** Sum a player's per-game rows into a single season aggregate. */
export function aggregatePlayer(rows: NflStatRow[]): NflPlayerAggregate {
  const first = rows[0]
  const sum = (get: (r: NflStatRow) => number) => rows.reduce((s, r) => s + (get(r) || 0), 0)

  const passYds = sum((r) => r.pass_yds)
  const rushYds = sum((r) => r.rush_yds)
  const recYds = sum((r) => r.rec_yds)
  const tackles = sum((r) => r.tackles_total)
  const sacks = sum((r) => r.sacks)
  const defInt = sum((r) => r.def_int)

  // Passer rating: average across games that actually recorded one.
  const ratedGames = rows.filter((r) => (r.pass_att || 0) > 0 && Number.isFinite(r.pass_rtg))
  const passerRating =
    ratedGames.length > 0
      ? ratedGames.reduce((s, r) => s + (r.pass_rtg || 0), 0) / ratedGames.length
      : 0

  const position = resolvePosition({
    position: first?.position ?? null,
    passYds,
    rushYds,
    recYds,
    tackles,
    sacks,
    defInt,
  })

  // Prefer the most common team (players can be traded).
  const teamCounts = new Map<string, number>()
  for (const r of rows) {
    if (r.team) teamCounts.set(r.team, (teamCounts.get(r.team) ?? 0) + 1)
  }
  const team = [...teamCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? first?.team ?? null

  return {
    player_name: first?.player_name ?? "",
    athlete_id: first?.athlete_id ?? null,
    team,
    position,
    games: rows.length,
    passYds,
    passTd: sum((r) => r.pass_td),
    passInt: sum((r) => r.pass_int),
    passAtt: sum((r) => r.pass_att),
    passComp: sum((r) => r.pass_c),
    rushYds,
    rushTd: sum((r) => r.rush_td),
    rushAtt: sum((r) => r.rush_att),
    recYds,
    recTd: sum((r) => r.rec_td),
    rec: sum((r) => r.rec),
    targets: sum((r) => r.targets),
    fumblesLost: sum((r) => r.fumbles_lost),
    tackles,
    sacks,
    defInt,
    defTd: sum((r) => r.def_td),
    passesDef: sum((r) => r.passes_def),
    passerRating,
  }
}

// ─── Normalization helpers ────────────────────────────────────────────────────

/** Percentile rank of `value` within `population` (0-100). Ties share rank. */
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

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v))
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

export interface PositionContext {
  scoringVolume: number[] // production per position group
  playVolume: number[] // TD-ish per position group
}

/** Build per-position normalization populations from all aggregates. */
export function buildPositionContexts(
  aggs: NflPlayerAggregate[]
): Map<NflRankPosition, PositionContext> {
  const byPos = new Map<NflRankPosition, NflPlayerAggregate[]>()
  for (const a of aggs) {
    if (!byPos.has(a.position)) byPos.set(a.position, [])
    byPos.get(a.position)!.push(a)
  }
  const ctx = new Map<NflRankPosition, PositionContext>()
  for (const [pos, group] of byPos) {
    ctx.set(pos, {
      scoringVolume: group.map((g) => productionVolume(g)),
      playVolume: group.map((g) => bigPlayVolume(g)),
    })
  }
  return ctx
}

/** Position-appropriate "production" figure used for scoring_score. */
export function productionVolume(a: NflPlayerAggregate): number {
  switch (a.position) {
    case "QB":
      return a.passYds + a.rushYds * 1.1
    case "RB":
      return a.rushYds + a.recYds * 0.9
    case "WR":
    case "TE":
    case "FLEX":
      return a.recYds + a.rushYds * 0.5
    case "DEF":
      return a.tackles * 6 + a.sacks * 35 + a.defInt * 45 + a.passesDef * 12
  }
}

/** Position-appropriate "big play / scoring" figure used for playmaking_score. */
export function bigPlayVolume(a: NflPlayerAggregate): number {
  switch (a.position) {
    case "QB":
      return a.passTd + a.rushTd
    case "RB":
      return a.rushTd + a.recTd
    case "WR":
    case "TE":
    case "FLEX":
      return a.recTd + a.rushTd
    case "DEF":
      return a.sacks + a.defInt * 1.5 + a.defTd * 3
  }
}

/** Per-attempt efficiency & ball security (0-100). */
function efficiencyScore(a: NflPlayerAggregate): number {
  switch (a.position) {
    case "QB": {
      // Passer rating maps ~0..158.3. Penalize turnovers.
      const rating = clamp((a.passerRating / 120) * 100, 0, 100)
      const intRate = a.passAtt > 0 ? a.passInt / a.passAtt : 0
      const penalty = clamp(intRate * 400, 0, 30)
      return clamp(rating - penalty)
    }
    case "RB": {
      const ypc = a.rushAtt > 0 ? a.rushYds / a.rushAtt : 0
      // 3.5 ypc ≈ 45, 5.0 ypc ≈ 80.
      const base = clamp(((ypc - 2.5) / 3) * 100, 0, 100)
      const fumblePenalty = clamp(a.fumblesLost * 6, 0, 25)
      return clamp(base - fumblePenalty)
    }
    case "WR":
    case "TE":
    case "FLEX": {
      const catchRate = a.targets > 0 ? a.rec / a.targets : 0
      const ypr = a.rec > 0 ? a.recYds / a.rec : 0
      const catchScore = clamp(catchRate * 100, 0, 100)
      const yprScore = clamp((ypr / 16) * 100, 0, 100)
      return clamp(catchScore * 0.5 + yprScore * 0.5)
    }
    case "DEF": {
      // Splash-play rate per game.
      const splashPerGame = a.games > 0 ? (a.sacks + a.defInt + a.passesDef) / a.games : 0
      return clamp((splashPerGame / 4) * 100, 0, 100)
    }
  }
}

/** Descriptor for the player's profile. */
function signatureFor(a: NflPlayerAggregate): string {
  switch (a.position) {
    case "QB":
      return a.rushYds > 400 ? "DUAL-THREAT QB" : "POCKET PASSER"
    case "RB":
      return a.rec > 40 ? "RECEIVING BACK" : "WORKHORSE BACK"
    case "WR":
      return a.recYds > 900 ? "WR1 TARGET" : "ROTATION RECEIVER"
    case "TE":
      return "SEAM TIGHT END"
    case "DEF":
      return a.sacks >= 6 ? "PASS RUSHER" : a.defInt >= 3 ? "BALL HAWK" : "DEFENSIVE ANCHOR"
    case "FLEX":
      return "UTILITY PLAYER"
  }
}

/**
 * Compute all component scores + the overall score for one player, using
 * position-group normalization contexts.
 */
export function scorePlayer(
  a: NflPlayerAggregate,
  ctx: Map<NflRankPosition, PositionContext>,
  maxGamesInLeague: number
): NflPlayerScore {
  const posCtx = ctx.get(a.position) ?? { scoringVolume: [], playVolume: [] }

  const scoring = round2(percentile(productionVolume(a), posCtx.scoringVolume))
  const playmaking = round2(percentile(bigPlayVolume(a), posCtx.playVolume))
  const efficiency = round2(efficiencyScore(a))

  // Offense blend (skill positions). For DEF this stays low by construction
  // because production/bigplay populations are defensive.
  const isDefense = a.position === "DEF"
  const offense = isDefense
    ? round2(clamp(scoring * 0.4 + playmaking * 0.3 + efficiency * 0.3) * 0.5)
    : round2(clamp(scoring * 0.45 + playmaking * 0.3 + efficiency * 0.25))

  const defense = isDefense
    ? round2(clamp(scoring * 0.55 + playmaking * 0.3 + efficiency * 0.15))
    : round2(clamp(a.tackles * 1.5 + a.sacks * 6 + a.defInt * 8, 0, 40))

  const twoWay = round2(Math.max(offense, defense))

  // Availability: games played vs the league leader's game count.
  const availability = round2(clamp((a.games / Math.max(1, maxGamesInLeague)) * 100))

  // Overall: production-led, with efficiency and availability modifiers.
  const core = isDefense
    ? defense * 0.75 + efficiency * 0.15 + playmaking * 0.1
    : scoring * 0.5 + playmaking * 0.28 + efficiency * 0.22
  const overall = round2(clamp(core * 0.9 + availability * 0.1))

  // Confidence from sample size.
  const confidence = round2(clamp((a.games / Math.max(4, maxGamesInLeague)) * 100, 20, 100))
  const lowConfidence = a.games < 3

  const { strengths, weaknesses } = describeProfile(a, { scoring, playmaking, efficiency, defense })

  return {
    player_name: a.player_name,
    athlete_id: a.athlete_id,
    team: a.team,
    position: a.position,
    games: a.games,
    offense_score: offense,
    defense_score: defense,
    scoring_score: scoring,
    playmaking_score: playmaking,
    efficiency_score: efficiency,
    two_way_score: twoWay,
    availability_score: availability,
    overall_score: overall,
    confidence,
    low_confidence: lowConfidence,
    strengths,
    weaknesses,
    signature: signatureFor(a),
    explanation: buildExplanation(a),
  }
}

function describeProfile(
  a: NflPlayerAggregate,
  s: { scoring: number; playmaking: number; efficiency: number; defense: number }
): { strengths: string[]; weaknesses: string[] } {
  const strengths: string[] = []
  const weaknesses: string[] = []

  if (s.scoring >= 80) strengths.push("Elite Volume")
  if (s.playmaking >= 80) strengths.push("Big-Play Threat")
  if (s.efficiency >= 75) strengths.push("Highly Efficient")
  if (a.position === "DEF" && s.defense >= 75) strengths.push("Defensive Difference-Maker")

  if (s.efficiency <= 40) weaknesses.push("Inefficient")
  if (a.fumblesLost >= 3 || a.passInt >= 10) weaknesses.push("Turnover-Prone")
  if (a.games < 4) weaknesses.push("Small Sample")

  if (strengths.length === 0) strengths.push("Rotation Contributor")
  return { strengths, weaknesses }
}

function buildExplanation(a: NflPlayerAggregate): string {
  const g = a.games
  switch (a.position) {
    case "QB":
      return `${a.passYds.toLocaleString()} pass yds, ${a.passTd} TD / ${a.passInt} INT over ${g} games (rating ${Math.round(a.passerRating)}).`
    case "RB": {
      const ypc = a.rushAtt > 0 ? (a.rushYds / a.rushAtt).toFixed(1) : "0.0"
      return `${a.rushYds.toLocaleString()} rush yds (${ypc} YPC), ${a.rushTd + a.recTd} total TD over ${g} games.`
    }
    case "WR":
    case "TE":
    case "FLEX":
      return `${a.rec} rec for ${a.recYds.toLocaleString()} yds, ${a.recTd} TD over ${g} games.`
    case "DEF":
      return `${a.tackles} tackles, ${a.sacks} sacks, ${a.defInt} INT over ${g} games.`
  }
}

// ─── Tiers ──────────────────────────────────────────────────────────────────

/** Map a 0-100 overall score to the shared NBA-style tier label. */
export function tierForScore(score: number): RankingTier {
  if (score >= 92) return "Ω — Apex"
  if (score >= 85) return "X — Mythic"
  if (score >= 76) return "S — Elite"
  if (score >= 66) return "A — Dominant"
  if (score >= 55) return "B — Impact"
  if (score >= 44) return "C — Rotation"
  if (score >= 33) return "D — Limited"
  return "E — Fringe"
}

/**
 * Spread a set of raw overall scores across a readable band (min..max) while
 * preserving order, so the board doesn't cluster. Rank-based, stable.
 */
export function spreadScores(scores: number[], min = 42, max = 99): number[] {
  const n = scores.length
  if (n === 0) return []
  if (n === 1) return [round2((min + max) / 2)]
  // Rank descending; highest raw score → max.
  const order = scores
    .map((v, i) => ({ v, i }))
    .sort((a, b) => b.v - a.v)
  const out = new Array<number>(n)
  order.forEach((entry, rankIndex) => {
    const t = rankIndex / (n - 1) // 0 for best, 1 for worst
    out[entry.i] = round2(max - t * (max - min))
  })
  return out
}
