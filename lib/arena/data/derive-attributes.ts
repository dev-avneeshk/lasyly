/**
 * Stat → attribute derivation for the Auction Arena.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS
 * ─────────────────────────────────────────────────────────────────────────────
 * The Arena simulation reads 24 per-player attributes on a 0-99 scale. Rather
 * than hand-tuning every player, this module DERIVES those attributes from a
 * player's real 2025-26 season stats (per_game + advanced), so the full ~500+
 * player pool can be generated from data instead of curated by hand.
 *
 * Stats measure production, not raw skill, so some attributes map cleanly
 * (freeThrow ← ft_pct) while others are proxies grounded in role and box-score
 * output (athleticism, clutch, basketballIQ). These proxies are DESIGNER
 * ESTIMATES in the same spirit as the original curated file — reasonable, not
 * official.
 *
 * The mapping is deterministic and pure: same stats in → same attributes out.
 * This module has NO database or network dependency; the generator script feeds
 * it plain stat objects, which keeps it unit-testable.
 */

import type { PlayerAttributes, Position, PlayerTier } from "../types"

// ─── Input shapes (subset of nba_player_season_stats JSON we actually use) ───

export interface PerGameStats {
  pts_per_g?: number | null
  trb_per_g?: number | null
  orb_per_g?: number | null
  drb_per_g?: number | null
  ast_per_g?: number | null
  stl_per_g?: number | null
  blk_per_g?: number | null
  tov_per_g?: number | null
  fg_pct?: number | null
  fg2_pct?: number | null
  fg3_pct?: number | null
  fg3_per_g?: number | null
  fg3a_per_g?: number | null
  fga_per_g?: number | null
  ft_pct?: number | null
  ft_per_g?: number | null
  fta_per_g?: number | null
  mp_per_g?: number | null
  efg_pct?: number | null
  pf_per_g?: number | null
}

export interface AdvancedStats {
  per?: number | null
  ts_pct?: number | null
  usg_pct?: number | null
  obpm?: number | null
  dbpm?: number | null
  bpm?: number | null
  ast_pct?: number | null
  stl_pct?: number | null
  blk_pct?: number | null
  drb_pct?: number | null
  orb_pct?: number | null
  trb_pct?: number | null
  tov_pct?: number | null
  ws?: number | null
  mp?: number | null // total minutes (season)
}

export interface DerivationInput {
  perGame: PerGameStats | null
  advanced: AdvancedStats | null
  /** Raw DB position string, may be compound e.g. "PG-SG" or null. */
  position?: string | null
  /** Games played (used to gauge sample confidence / role). */
  games?: number | null
}

export interface DerivedPlayer {
  primaryPosition: Position
  secondaryPositions: Position[]
  overall: number
  tier: PlayerTier
  startingBid: number
  attributes: PlayerAttributes
  strengths: string[]
  weaknesses: string[]
}

// ─── Small numeric helpers ────────────────────────────────────────────────

const num = (v: number | null | undefined, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback

const clamp = (v: number, lo = 0, hi = 99): number =>
  Math.max(lo, Math.min(hi, Math.round(v)))

/**
 * Map a raw value from [lo, hi] onto an attribute range [outLo, outHi].
 * Values outside [lo,hi] are clamped. This is the workhorse of the mapping:
 * it converts a real statistic (e.g. 3P% of .30..-.45) into a 0-99 rating.
 */
function scale(
  v: number,
  lo: number,
  hi: number,
  outLo = 30,
  outHi = 95
): number {
  if (hi === lo) return outLo
  const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)))
  return outLo + t * (outHi - outLo)
}

// ─── Position parsing ─────────────────────────────────────────────────────

const VALID_POS: Position[] = ["PG", "SG", "SF", "PF", "C"]

/** Adjacent positions a player can plausibly slide into, for secondary slots. */
const POS_NEIGHBORS: Record<Position, Position[]> = {
  PG: ["SG"],
  SG: ["PG", "SF"],
  SF: ["SG", "PF"],
  PF: ["SF", "C"],
  C: ["PF"],
}

/**
 * Parse the DB position string into primary + secondary positions.
 * Handles compound strings ("PG-SG", "SF/PF"). Falls back to a stat-inferred
 * position when the string is missing/invalid.
 */
export function parsePositions(
  raw: string | null | undefined,
  input: DerivationInput
): { primary: Position; secondary: Position[] } {
  const parts = (raw ?? "")
    .toUpperCase()
    .split(/[-/,\s]+/)
    .map((p) => p.trim())
    .filter((p): p is Position => (VALID_POS as string[]).includes(p))

  let primary: Position
  let secondary: Position[]

  if (parts.length > 0) {
    primary = parts[0]
    secondary = [...new Set(parts.slice(1))]
  } else {
    primary = inferPosition(input)
    secondary = []
  }

  // Guarantee at least one adjacent secondary so every player is rosterable in
  // more than a single slot (mirrors the curated data, which almost always
  // lists a secondary position). Skip if an explicit secondary already exists.
  if (secondary.length === 0) {
    const neighbor = POS_NEIGHBORS[primary][0]
    if (neighbor) secondary = [neighbor]
  }

  secondary = secondary.filter((p) => p !== primary)
  return { primary, secondary }
}

/** Infer a position from stat shape when the DB has none. */
function inferPosition(input: DerivationInput): Position {
  const pg = input.perGame ?? {}
  const adv = input.advanced ?? {}
  const ast = num(pg.ast_per_g)
  const trb = num(pg.trb_per_g)
  const blk = num(pg.blk_per_g)
  const threeRate = num(pg.fg3a_per_g) / Math.max(1, num(pg.fga_per_g))

  // Big: high rebounds/blocks, low three rate.
  if (blk >= 1.2 || (trb >= 8 && threeRate < 0.35)) return "C"
  if (trb >= 6 && ast < 4) return "PF"
  // Lead guard: high assists.
  if (ast >= 5) return "PG"
  if (num(adv.ast_pct) >= 22) return "PG"
  // Default wing.
  return trb >= 4.5 ? "SF" : "SG"
}

// ─── Attribute derivation ─────────────────────────────────────────────────

/**
 * Derive the 24 attributes. Every attribute is grounded in one or more stats;
 * comments note the source. Volume matters: a 40% shooter on 6 threes a game is
 * a better shooter-attribute than a 40% shooter on 0.5 attempts, so rates are
 * blended with volume where it's meaningful.
 */
export function deriveAttributes(input: DerivationInput): PlayerAttributes {
  const pg = input.perGame ?? {}
  const adv = input.advanced ?? {}

  const pts = num(pg.pts_per_g)
  const ast = num(pg.ast_per_g)
  const trb = num(pg.trb_per_g)
  const orb = num(pg.orb_per_g)
  const drb = num(pg.drb_per_g, trb - orb)
  const stl = num(pg.stl_per_g)
  const blk = num(pg.blk_per_g)
  const tov = num(pg.tov_per_g)
  const fga = num(pg.fga_per_g)
  const fg3a = num(pg.fg3a_per_g)
  const fg3pct = num(pg.fg3_pct)
  const fg2pct = num(pg.fg2_pct, num(pg.fg_pct))
  const ftpct = num(pg.ft_pct)
  const fta = num(pg.fta_per_g)
  const mpg = num(pg.mp_per_g)

  const ts = num(adv.ts_pct, 0.55)
  const usg = num(adv.usg_pct, 18)
  const astPct = num(adv.ast_pct)
  const stlPct = num(adv.stl_pct)
  const blkPct = num(adv.blk_pct)
  const trbPct = num(adv.trb_pct)
  const tovPct = num(adv.tov_pct, 12)
  const dbpm = num(adv.dbpm)
  const obpm = num(adv.obpm)

  const threeRate = fg3a / Math.max(1, fga) // 0..1, how perimeter-oriented

  // Scoring: volume (pts) + efficiency (TS) + usage weight.
  // Floors are set so a league-average scorer lands ~60 (the sim centers its
  // shot-make math on attribute value 60), keeping simulated FG%/PPG in the
  // NBA band rather than dragging the whole pool below baseline.
  const scoring = clamp(
    scale(pts, 4, 30, 58, 96) * 0.6 +
      scale(ts, 0.5, 0.65, 56, 90) * 0.25 +
      scale(usg, 12, 32, 54, 92) * 0.15
  )

  // Three-point shooting: rate blended with volume (attempts). Non-shooters
  // still floor around 50 so the sim's spot-up threes don't tank league 3P%.
  const threeVolumeBoost = Math.min(1, fg3a / 6) // full weight at ~6 3PA
  const threePointShooting = clamp(
    scale(fg3pct, 0.3, 0.42, 56, 93) * (0.75 + 0.25 * threeVolumeBoost)
  )

  // Midrange: 2P% for non-rim scorers (guards/wings), lightly boosted by scoring.
  const midrange = clamp(
    scale(fg2pct, 0.42, 0.58, 54, 85) * 0.7 + scale(pts, 6, 26, 50, 80) * 0.3
  )

  // Finishing: 2P% for interior/athletic finishers, boosted by rim volume proxy
  // (low three-rate + points).
  const rimTilt = 1 - Math.min(1, threeRate) // more inside = higher
  const finishing = clamp(
    scale(fg2pct, 0.45, 0.66, 62, 93) * (0.75 + 0.25 * rimTilt)
  )

  const freeThrow = clamp(scale(ftpct, 0.6, 0.9, 45, 95))

  // Playmaking / passing: assists + assist% ; passing leans a touch more on rate.
  const playmaking = clamp(
    scale(ast, 1, 9, 46, 92) * 0.6 + scale(astPct, 8, 35, 46, 92) * 0.4
  )
  const passing = clamp(
    scale(ast, 1, 9, 48, 90) * 0.5 + scale(astPct, 8, 35, 48, 92) * 0.5
  )

  // Ball handling: usage + assist rate, penalized by turnover rate.
  const ballHandling = clamp(
    scale(usg, 12, 30, 45, 88) * 0.4 +
      scale(astPct, 8, 32, 45, 88) * 0.4 +
      scale(20 - tovPct, 6, 18, 40, 85) * 0.2
  )

  // Rebounding: total rebounds + rebound%. The floor is lifted a little so the
  // gap between an elite rebounder and the rest of a (possibly weak) roster
  // isn't extreme — that gap is what lets one player vacuum up 40+ boards in the
  // sim's weighted model.
  const rebounding = clamp(
    scale(trb, 2, 13, 48, 88) * 0.6 + scale(trbPct, 5, 24, 48, 88) * 0.4
  )

  // Defense split:
  //  - interior defense & rim protection ← blocks / blk% (bigs)
  //  - perimeter defense & steals ← steals / stl% + DBPM
  const interiorDefense = clamp(
    scale(blk, 0.2, 2.2, 42, 90) * 0.4 +
      scale(blkPct, 0.5, 4.5, 42, 90) * 0.3 +
      scale(dbpm, -3, 3, 40, 85) * 0.3
  )
  const rimProtection = clamp(
    scale(blk, 0.2, 2.6, 35, 95) * 0.55 + scale(blkPct, 0.5, 5.5, 35, 95) * 0.45
  )
  const perimeterDefense = clamp(
    scale(stl, 0.4, 2.0, 42, 88) * 0.35 +
      scale(stlPct, 0.8, 2.8, 42, 88) * 0.3 +
      scale(dbpm, -3, 3, 40, 88) * 0.35
  )
  const steal = clamp(
    scale(stl, 0.3, 2.2, 40, 92) * 0.55 + scale(stlPct, 0.8, 3.2, 40, 92) * 0.45
  )
  const block = clamp(
    scale(blk, 0.2, 2.8, 35, 95) * 0.6 + scale(blkPct, 0.5, 6, 35, 95) * 0.4
  )

  // Physical — proxies. Stamina from minutes; athleticism/speed inferred from
  // role: guards with steals & finishing skew fast/athletic, bigs skew strong.
  const stamina = clamp(scale(mpg, 12, 36, 55, 95))
  const strength = clamp(
    scale(trbPct, 5, 22, 50, 92) * 0.5 + scale(blkPct, 0.5, 5, 50, 88) * 0.3 + 50 * 0.2
  )
  const athleticism = clamp(
    scale(stl + blk, 0.6, 3.5, 55, 90) * 0.4 +
      scale(orb, 0.3, 3, 55, 88) * 0.25 +
      scale(fg2pct, 0.45, 0.62, 55, 85) * 0.35
  )
  const speed = clamp(
    scale(stl, 0.4, 2.2, 58, 92) * 0.5 +
      scale(ast, 1, 8, 55, 88) * 0.25 +
      (65 - Math.min(20, trb * 1.2)) * 0.25 // bigs are slower
  )

  // Mental / situational — proxies.
  // basketballIQ ← low turnovers relative to usage + assist rate.
  const basketballIQ = clamp(
    scale(astPct - tovPct, -5, 25, 45, 90) * 0.5 +
      scale(ts, 0.5, 0.64, 45, 88) * 0.3 +
      50 * 0.2
  )
  // decisionMaking ← assist-to-turnover balance.
  const decisionMaking = clamp(
    scale(ast / Math.max(0.6, tov), 0.6, 3, 45, 90) * 0.7 +
      scale(20 - tovPct, 4, 18, 45, 85) * 0.3
  )
  // clutch ← overall scoring efficiency & usage (star scorers get the ball late).
  const clutch = clamp(
    scale(pts, 6, 28, 50, 88) * 0.5 + scale(ts, 0.5, 0.63, 45, 82) * 0.3 + 55 * 0.2
  )

  const usage = clamp(scale(usg, 10, 34, 35, 95))
  const efficiency = clamp(scale(ts, 0.48, 0.66, 35, 95))
  // turnoverRisk: higher tov% = higher risk (NOT inverted).
  const turnoverRisk = clamp(scale(tovPct, 6, 20, 25, 75))

  return {
    scoring,
    threePointShooting,
    midrange,
    finishing,
    freeThrow,
    playmaking,
    ballHandling,
    passing,
    rebounding,
    interiorDefense,
    perimeterDefense,
    rimProtection,
    steal,
    block,
    speed,
    athleticism,
    strength,
    stamina,
    clutch,
    basketballIQ,
    decisionMaking,
    usage,
    efficiency,
    turnoverRisk,
  }
}

// ─── Overall / tier / bid ───────────────────────────────────────────────────

/**
 * Overall rating (0-99). Anchored to real impact metrics (BPM / PER / WS) plus a
 * light attribute floor so a role player with a good box profile isn't dragged
 * to the floor by a weak advanced season. BPM is the primary driver because it's
 * the best single-number impact estimate available in the data.
 */
export function deriveOverall(input: DerivationInput, attributes: PlayerAttributes): number {
  const adv = input.advanced ?? {}
  const pg = input.perGame ?? {}
  const bpm = num(adv.bpm, -2)
  const per = num(adv.per, 12)
  const ws = num(adv.ws, 0)
  const mpg = num(pg.mp_per_g)
  const games = num(input.games)

  const impact =
    scale(bpm, -4, 9, 64, 99) * 0.55 +
    scale(per, 9, 29, 64, 98) * 0.3 +
    scale(ws, -1, 11, 66, 96) * 0.15

  // Attribute floor: best two-way traits keep bench specialists respectable.
  const attrFloor =
    (attributes.scoring +
      attributes.rebounding +
      attributes.perimeterDefense +
      attributes.rimProtection +
      attributes.playmaking) /
    5

  let overall = impact * 0.75 + attrFloor * 0.25

  // ── Small-sample dampener ────────────────────────────────────────────────
  // Advanced rates (BPM/PER/WS) are volatile for players with few minutes or
  // games — a 5-minute-a-night player can post a gaudy per-minute BPM. We pull
  // such players toward a role-player baseline (~68) proportional to how little
  // they actually played, so the elite tiers reflect real starters, not noise.
  const minuteConf = Math.max(0, Math.min(1, (mpg - 8) / 20)) // full at ~28 mpg
  const gameConf = Math.max(0, Math.min(1, games / 40)) // full at ~40 games
  const confidence = Math.min(minuteConf, gameConf)
  const BASELINE = 66
  overall = BASELINE + (overall - BASELINE) * (0.4 + 0.6 * confidence)

  // Keep the pool in a believable band. The sim & pricing expect ~60..99.
  return clamp(overall, 60, 99)
}

/** Tier from overall, matching the curated file's rough bands. */
export function deriveTier(overall: number): PlayerTier {
  if (overall >= 88) return 1 // superstars
  if (overall >= 82) return 2 // all-stars / high starters
  if (overall >= 76) return 3 // solid starters / high-value role players
  return 4 // role players / specialists
}

/** Suggested opening bid, matching the curated file's tier→bid scale. */
export function deriveStartingBid(tier: PlayerTier): number {
  switch (tier) {
    case 1:
      return 7
    case 2:
      return 5
    case 3:
      return 3
    case 4:
    default:
      return 2
  }
}

// ─── Strengths / weaknesses (auto-labeled from top/bottom attributes) ────────

const ATTR_LABELS: Partial<Record<keyof PlayerAttributes, string>> = {
  scoring: "scoring",
  threePointShooting: "three-point shooting",
  midrange: "midrange",
  finishing: "finishing",
  freeThrow: "free-throw shooting",
  playmaking: "playmaking",
  ballHandling: "ball handling",
  passing: "passing",
  rebounding: "rebounding",
  interiorDefense: "interior defense",
  perimeterDefense: "perimeter defense",
  rimProtection: "rim protection",
  steal: "steals",
  block: "shot blocking",
  athleticism: "athleticism",
  speed: "speed",
  clutch: "clutch scoring",
  efficiency: "efficiency",
}

/** Pick the top-3 strengths and (real) bottom-2 weaknesses by attribute value. */
export function deriveStrengthsWeaknesses(attributes: PlayerAttributes): {
  strengths: string[]
  weaknesses: string[]
} {
  const entries = (Object.keys(ATTR_LABELS) as (keyof PlayerAttributes)[]).map(
    (k) => ({ key: k, label: ATTR_LABELS[k]!, val: attributes[k] })
  )
  const byVal = [...entries].sort((a, b) => b.val - a.val)
  const strengths = byVal
    .filter((e) => e.val >= 78)
    .slice(0, 3)
    .map((e) => e.label)
  const weaknesses = [...entries]
    .sort((a, b) => a.val - b.val)
    .filter((e) => e.val <= 50)
    .slice(0, 2)
    .map((e) => e.label)
  return { strengths, weaknesses }
}

// ─── Top-level derive ─────────────────────────────────────────────────────

/** Derive a complete player profile (everything except id/name/team/nbaId). */
export function derivePlayer(input: DerivationInput): DerivedPlayer {
  const attributes = deriveAttributes(input)
  const overall = deriveOverall(input, attributes)
  const tier = deriveTier(overall)
  const startingBid = deriveStartingBid(tier)
  const { primary, secondary } = parsePositions(input.position, input)
  const { strengths, weaknesses } = deriveStrengthsWeaknesses(attributes)

  return {
    primaryPosition: primary,
    secondaryPositions: secondary,
    overall,
    tier,
    startingBid,
    attributes,
    strengths,
    weaknesses,
  }
}
