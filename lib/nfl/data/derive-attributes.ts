/**
 * Stat → attribute derivation for the NFL Auction ("Drive to Win").
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS
 * ─────────────────────────────────────────────────────────────────────────────
 * The NFL sim reads 27 per-player attributes on a 0-99 scale, but only the ones
 * relevant to a player's ROLE (a QB's passing attrs, a CB's coverage, etc. —
 * see lib/nfl/teamRating.ts + value.ts). Rather than hand-tuning every player,
 * this module DERIVES those attributes from real aggregated NFL box-score stats
 * (nfl_player_stats), so the full league can be generated from data instead of
 * curated by hand — mirroring the NBA arena deriver.
 *
 * We branch entirely by position: each position sets only the attributes the sim
 * actually consumes for that role; everything else keeps its BASE default. Some
 * attributes map cleanly from stats (a QB's accuracy ← completion %); others are
 * DESIGNER-ESTIMATE proxies grounded in production (arm strength ← yards/attempt).
 *
 * Pure + deterministic: same stats in → same attributes out. No DB/network here.
 */

import type { PlayerAttributes, Position, PlayerTier } from "../types"

// ─── Input shape (aggregated season totals from nfl_player_stats) ────────────

export interface NflStatTotals {
  games: number
  // Passing
  passYds: number
  passTd: number
  passInt: number
  passC: number
  passAtt: number
  // Rushing
  rushAtt: number
  rushYds: number
  rushTd: number
  // Receiving
  rec: number
  recYds: number
  recTd: number
  targets: number
  // Defense
  tacklesTotal: number
  sacks: number
  tacklesTfl: number
  passesDef: number
  defInt: number
  defTd: number
  fumblesLost: number
}

export interface DerivationInput {
  totals: NflStatTotals
  /** Raw DB position token (QB, RB, WR, TE, LB, CB, S, DE, DT, DL, FB, ...). */
  rawPosition?: string | null
}

export interface DerivedPlayer {
  position: Position
  overall: number
  tier: PlayerTier
  startingBid: number
  /** Only the position-relevant attributes; caller merges over BASE. */
  attr: Partial<PlayerAttributes>
  strengths: string[]
  weaknesses: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const num = (v: number | null | undefined, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback

const clampAttr = (v: number, lo = 30, hi = 99): number =>
  Math.max(lo, Math.min(hi, Math.round(v)))

/** Map a raw value from [lo,hi] onto [outLo,outHi], clamped. The workhorse. */
function scale(v: number, lo: number, hi: number, outLo = 35, outHi = 95): number {
  if (hi === lo) return outLo
  const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)))
  return outLo + t * (outHi - outLo)
}

/** Confidence dampener: pull rate stats toward a baseline for low-game samples. */
function sampleConf(games: number): number {
  return Math.max(0, Math.min(1, games / 12)) // full confidence at ~12 games
}

// ─── Position mapping ─────────────────────────────────────────────────────

const ARENA_POSITIONS = new Set<Position>(["QB", "RB", "WR", "TE", "EDGE", "LB", "CB", "S"])

/**
 * Map a raw DB position token to an arena position, or null if the player isn't
 * draftable in this game (offensive line, kickers, punters, long snappers).
 */
export function mapPosition(raw: string | null | undefined, totals: NflStatTotals): Position | null {
  const p = (raw ?? "").toUpperCase().trim()
  if (ARENA_POSITIONS.has(p as Position)) return p as Position
  switch (p) {
    case "DE":
    case "DT":
    case "DL":
    case "NT":
      return "EDGE"
    case "FB":
      return "RB"
    case "OLB":
    case "MLB":
    case "ILB":
      return "LB"
    case "DB":
      return "CB"
    case "FS":
    case "SS":
      return "S"
    case "OT":
    case "OG":
    case "G":
    case "C":
    case "PK":
    case "K":
    case "P":
    case "LS":
      return null // not a draftable skill/defense slot
    default:
      return inferPosition(totals)
  }
}

/** Infer a position from stat shape when the DB token is missing/unknown. */
function inferPosition(t: NflStatTotals): Position | null {
  const g = Math.max(1, t.games)
  if (t.passAtt / g >= 8) return "QB"
  if (t.rec / g >= 1.5 || t.recYds / g >= 20) {
    // Receiver: TE if lower volume + some blocking role is unknowable → default WR.
    return t.rushAtt / g >= 3 ? "RB" : "WR"
  }
  if (t.rushAtt / g >= 4) return "RB"
  if (t.sacks / g >= 0.25) return "EDGE"
  if (t.passesDef / g >= 0.6 || t.defInt > 0) return "CB"
  if (t.tacklesTotal / g >= 4) return "LB"
  if (t.tacklesTotal > 0) return "S"
  return null // no meaningful offensive/defensive production → skip
}

// ─── Per-position attribute derivation ──────────────────────────────────────

function deriveQB(t: NflStatTotals): Partial<PlayerAttributes> {
  const g = Math.max(1, t.games)
  const conf = sampleConf(g)
  const compPct = t.passAtt > 0 ? t.passC / t.passAtt : 0.6
  const ypa = t.passAtt > 0 ? t.passYds / t.passAtt : 6.5
  const tdRate = t.passAtt > 0 ? t.passTd / t.passAtt : 0.04
  const intRate = t.passAtt > 0 ? t.passInt / t.passAtt : 0.025
  const rushYpg = t.rushYds / g
  const attPerGame = t.passAtt / g

  // Volume gate: a backup with a handful of clean attempts posts gaudy rate stats
  // but is NOT a better QB than a full-time starter. `vol` (0..1) scales the
  // profile up only when the player actually carries a starter's passing load
  // (~30 attempts/game = full). Combined with the small-sample games dampener.
  const vol = Math.max(0, Math.min(1, (attPerGame - 12) / 18))
  const strength = Math.min(conf, 0.35 + 0.65 * vol)
  const b = (v: number) => 55 + (v - 55) * (0.4 + 0.6 * strength)

  return {
    shortAccuracy: clampAttr(b(scale(compPct, 0.58, 0.72, 45, 96))),
    deepAccuracy: clampAttr(b(scale(ypa, 6.0, 8.6, 42, 95))),
    armStrength: clampAttr(b(scale(ypa, 6.2, 8.4, 50, 92))),
    pocketAwareness: clampAttr(b(scale(0.05 - intRate, -0.01, 0.04, 45, 92))),
    decisionMaking: clampAttr(b(scale(tdRate - intRate, -0.01, 0.05, 45, 95))),
    mobility: clampAttr(b(scale(rushYpg, 3, 45, 45, 95))),
    clutch: clampAttr(b(scale(tdRate, 0.02, 0.06, 50, 88))),
    consistency: clampAttr(b(scale(compPct, 0.58, 0.7, 50, 88))),
  }
}

function deriveRB(t: NflStatTotals): Partial<PlayerAttributes> {
  const g = Math.max(1, t.games)
  const conf = sampleConf(g)
  const ypc = t.rushAtt > 0 ? t.rushYds / t.rushAtt : 3.8
  const rushYpg = t.rushYds / g
  const recYpg = t.recYds / g
  const totalTd = t.rushTd + t.recTd
  const b = (v: number) => 55 + (v - 55) * (0.5 + 0.5 * conf)

  return {
    speed: clampAttr(b(scale(ypc, 3.6, 5.2, 55, 95))),
    vision: clampAttr(b(scale(ypc, 3.6, 5.0, 52, 93))),
    power: clampAttr(b(scale(rushYpg, 25, 95, 55, 92))),
    agility: clampAttr(b(scale(ypc, 3.8, 5.2, 55, 92))),
    catching: clampAttr(b(scale(recYpg, 5, 40, 45, 90))),
    yac: clampAttr(b(scale(ypc, 3.8, 5.4, 50, 92))),
    clutch: clampAttr(b(scale(totalTd / g, 0.2, 1.0, 50, 88))),
  }
}

function deriveReceiver(t: NflStatTotals, pos: "WR" | "TE"): Partial<PlayerAttributes> {
  const g = Math.max(1, t.games)
  const conf = sampleConf(g)
  const recYpg = t.recYds / g
  const catchRate = t.targets > 0 ? t.rec / t.targets : 0.62
  const ypr = t.rec > 0 ? t.recYds / t.rec : 10
  const tdRate = t.recTd / g
  const b = (v: number) => 55 + (v - 55) * (0.5 + 0.5 * conf)

  const base: Partial<PlayerAttributes> = {
    catching: clampAttr(b(scale(catchRate, 0.55, 0.75, 50, 95))),
    routeRunning: clampAttr(b(scale(recYpg, 25, 90, 48, 94))),
    separation: clampAttr(b(scale(recYpg, 25, 95, 48, 95))),
    speed: clampAttr(b(scale(ypr, 9, 15, 55, 95))),
    yac: clampAttr(b(scale(ypr, 9, 14, 50, 92))),
    contestedCatch: clampAttr(b(scale(catchRate, 0.55, 0.72, 48, 88))),
    clutch: clampAttr(b(scale(tdRate, 0.2, 0.7, 50, 88))),
  }
  if (pos === "TE") {
    // TEs also block; approximate from being a TE (no OL stat available).
    base.runBlock = clampAttr(62)
    base.passBlock = clampAttr(60)
  }
  return base
}

function deriveEDGE(t: NflStatTotals): Partial<PlayerAttributes> {
  const g = Math.max(1, t.games)
  const conf = sampleConf(g)
  const sackRate = t.sacks / g
  const tflRate = t.tacklesTfl / g
  const tklRate = t.tacklesTotal / g
  const b = (v: number) => 55 + (v - 55) * (0.5 + 0.5 * conf)

  return {
    passRush: clampAttr(b(scale(sackRate, 0.2, 1.0, 55, 97))),
    runStop: clampAttr(b(scale(tflRate, 0.3, 1.4, 50, 92))),
    power: clampAttr(b(scale(sackRate + tflRate, 0.5, 2.2, 55, 92))),
    speed: clampAttr(b(scale(sackRate, 0.2, 1.0, 55, 90))),
    tackling: clampAttr(b(scale(tklRate, 2, 5.5, 50, 88))),
    strength: clampAttr(b(scale(tflRate, 0.3, 1.3, 55, 90))),
  }
}

function deriveLB(t: NflStatTotals): Partial<PlayerAttributes> {
  const g = Math.max(1, t.games)
  const conf = sampleConf(g)
  const tklRate = t.tacklesTotal / g
  const sackRate = t.sacks / g
  const pdRate = t.passesDef / g
  const b = (v: number) => 55 + (v - 55) * (0.5 + 0.5 * conf)

  return {
    tackling: clampAttr(b(scale(tklRate, 4, 9, 55, 96))),
    runStop: clampAttr(b(scale(tklRate + t.tacklesTfl / g, 4, 10, 55, 94))),
    coverage: clampAttr(b(scale(pdRate, 0.2, 1.0, 45, 88))),
    awareness: clampAttr(b(scale(tklRate, 4, 8.5, 55, 90))),
    speed: clampAttr(b(scale(tklRate, 4, 9, 50, 85))),
    passRush: clampAttr(b(scale(sackRate, 0.1, 0.6, 45, 85))),
    ballHawk: clampAttr(b(scale(t.defInt / g + pdRate * 0.5, 0.1, 0.8, 45, 85))),
  }
}

function deriveCB(t: NflStatTotals): Partial<PlayerAttributes> {
  const g = Math.max(1, t.games)
  const conf = sampleConf(g)
  const pdRate = t.passesDef / g
  const intRate = t.defInt / g
  const b = (v: number) => 55 + (v - 55) * (0.5 + 0.5 * conf)

  return {
    coverage: clampAttr(b(scale(pdRate, 0.3, 1.3, 52, 96))),
    ballHawk: clampAttr(b(scale(intRate + pdRate * 0.4, 0.15, 1.0, 50, 95))),
    speed: clampAttr(b(scale(pdRate, 0.3, 1.2, 58, 92))),
    agility: clampAttr(b(scale(pdRate, 0.3, 1.1, 55, 90))),
    tackling: clampAttr(b(scale(t.tacklesTotal / g, 2, 5.5, 45, 82))),
  }
}

function deriveS(t: NflStatTotals): Partial<PlayerAttributes> {
  const g = Math.max(1, t.games)
  const conf = sampleConf(g)
  const tklRate = t.tacklesTotal / g
  const pdRate = t.passesDef / g
  const intRate = t.defInt / g
  const b = (v: number) => 55 + (v - 55) * (0.5 + 0.5 * conf)

  return {
    coverage: clampAttr(b(scale(pdRate, 0.25, 1.1, 50, 92))),
    ballHawk: clampAttr(b(scale(intRate + pdRate * 0.4, 0.15, 0.9, 48, 92))),
    tackling: clampAttr(b(scale(tklRate, 3, 7, 52, 92))),
    runStop: clampAttr(b(scale(tklRate, 3, 7.5, 50, 90))),
    speed: clampAttr(b(scale(pdRate, 0.25, 1.0, 55, 88))),
    passRush: clampAttr(b(scale(t.sacks / g, 0.05, 0.4, 40, 78))),
  }
}

// ─── Overall / tier / bid ───────────────────────────────────────────────────

/**
 * Overall (0-99) from the position-relevant attributes — the same dimensions
 * the sim/value model weighs. Anchored so real starters land ~72-90 and the
 * league's best reach the low-90s, matching the curated file's bands.
 */
export function deriveOverall(pos: Position, a: Partial<PlayerAttributes>): number {
  const g = (k: keyof PlayerAttributes) => num(a[k], 55)
  let raw: number
  switch (pos) {
    case "QB":
      raw = g("shortAccuracy") * 0.24 + g("deepAccuracy") * 0.18 + g("decisionMaking") * 0.22 + g("pocketAwareness") * 0.16 + g("armStrength") * 0.1 + g("mobility") * 0.1
      break
    case "RB":
      raw = g("speed") * 0.22 + g("vision") * 0.22 + g("power") * 0.18 + g("agility") * 0.16 + g("catching") * 0.12 + g("yac") * 0.1
      break
    case "WR":
      raw = g("separation") * 0.26 + g("catching") * 0.24 + g("routeRunning") * 0.2 + g("speed") * 0.16 + g("yac") * 0.14
      break
    case "TE":
      raw = g("catching") * 0.3 + g("routeRunning") * 0.22 + g("separation") * 0.16 + g("yac") * 0.14 + g("runBlock") * 0.1 + g("passBlock") * 0.08
      break
    case "EDGE":
      raw = g("passRush") * 0.5 + g("runStop") * 0.22 + g("power") * 0.16 + g("speed") * 0.12
      break
    case "LB":
      raw = g("tackling") * 0.26 + g("runStop") * 0.24 + g("coverage") * 0.24 + g("awareness") * 0.14 + g("speed") * 0.12
      break
    case "CB":
      raw = g("coverage") * 0.5 + g("ballHawk") * 0.2 + g("speed") * 0.18 + g("agility") * 0.12
      break
    case "S":
      raw = g("coverage") * 0.3 + g("ballHawk") * 0.22 + g("tackling") * 0.2 + g("runStop") * 0.16 + g("speed") * 0.12
      break
    default:
      raw = 60
  }
  return Math.max(58, Math.min(99, Math.round(raw)))
}

export function deriveTier(overall: number): PlayerTier {
  if (overall >= 88) return 1
  if (overall >= 81) return 2
  if (overall >= 73) return 3
  return 4
}

export function deriveStartingBid(tier: PlayerTier): number {
  switch (tier) {
    case 1: return 7
    case 2: return 5
    case 3: return 3
    case 4:
    default: return 2
  }
}

// ─── Strengths / weaknesses ─────────────────────────────────────────────────

const ATTR_LABELS: Partial<Record<keyof PlayerAttributes, string>> = {
  armStrength: "arm strength", shortAccuracy: "short accuracy", deepAccuracy: "deep ball",
  pocketAwareness: "pocket presence", decisionMaking: "decision-making", mobility: "mobility",
  speed: "speed", agility: "agility", power: "power", vision: "vision",
  catching: "hands", routeRunning: "route running", separation: "separation",
  contestedCatch: "contested catch", yac: "yards after catch",
  passRush: "pass rush", runStop: "run defense", tackling: "tackling", strength: "strength",
  coverage: "coverage", ballHawk: "ball skills", clutch: "clutch",
}

export function deriveStrengthsWeaknesses(a: Partial<PlayerAttributes>): { strengths: string[]; weaknesses: string[] } {
  const entries = (Object.keys(a) as (keyof PlayerAttributes)[])
    .filter((k) => ATTR_LABELS[k])
    .map((k) => ({ label: ATTR_LABELS[k]!, val: num(a[k], 55) }))
  const strengths = [...entries].sort((x, y) => y.val - x.val).filter((e) => e.val >= 82).slice(0, 3).map((e) => e.label)
  const weaknesses = [...entries].sort((x, y) => x.val - y.val).filter((e) => e.val <= 55).slice(0, 2).map((e) => e.label)
  return { strengths, weaknesses }
}

// ─── Top-level derive ─────────────────────────────────────────────────────

/** Derive a full player profile, or null if the player isn't draftable. */
export function derivePlayer(input: DerivationInput): DerivedPlayer | null {
  const pos = mapPosition(input.rawPosition, input.totals)
  if (!pos) return null

  let attr: Partial<PlayerAttributes>
  switch (pos) {
    case "QB": attr = deriveQB(input.totals); break
    case "RB": attr = deriveRB(input.totals); break
    case "WR": attr = deriveReceiver(input.totals, "WR"); break
    case "TE": attr = deriveReceiver(input.totals, "TE"); break
    case "EDGE": attr = deriveEDGE(input.totals); break
    case "LB": attr = deriveLB(input.totals); break
    case "CB": attr = deriveCB(input.totals); break
    case "S": attr = deriveS(input.totals); break
    default: return null
  }

  const overall = deriveOverall(pos, attr)
  const tier = deriveTier(overall)
  const startingBid = deriveStartingBid(tier)
  const { strengths, weaknesses } = deriveStrengthsWeaknesses(attr)

  return { position: pos, overall, tier, startingBid, attr, strengths, weaknesses }
}
