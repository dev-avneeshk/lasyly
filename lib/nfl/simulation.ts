/**
 * DriveSimulationEngine — a possession-based NFL simulator.
 *
 * NOT "power A vs power B + random()". The game is a sequence of DRIVES; each
 * drive is a loop of DOWNS; each down runs `resolvePlay`, which matches an
 * offensive tendency against a defensive posture using the on-field players'
 * attributes with bounded, seeded randomness.
 *
 * `resolvePlay` is the deliberate SEAM for v2 interactive play-calling: today
 * both calls are chosen by a weighted model from team profile + game state; in
 * v2 the human supplies the offensive call and the same resolver runs.
 *
 * Everything is seeded (mulberry32), so the same rosters + seed reproduce the
 * same game — important for the server-authoritative model and for tests.
 */

import type {
  NflGameResult,
  OwnedPlayer,
  PlayerStatLine,
  QuarterScore,
  RosterState,
  ScoringPlay,
  ScoringKind,
  Season,
  TeamBox,
  TeamId,
} from "./types"
import { orderedRoster, playerInSlot } from "./roster"
import { buildTeamProfile, type NflTeamProfile } from "./teamRating"
import { mulberry32, type RNG } from "./rng"

const QUARTERS = 4
const QUARTER_SECONDS = 15 * 60

// Offensive tendencies and defensive postures. Public so v2 can reuse them.
export type OffCall = "RUN" | "SHORT_PASS" | "DEEP_PASS" | "PLAY_ACTION"
export type DefCall = "RUN_STOP" | "COVERAGE" | "BLITZ" | "PASS_RUSH"

export const OFF_CALLS: OffCall[] = ["RUN", "SHORT_PASS", "DEEP_PASS", "PLAY_ACTION"]
export const DEF_CALLS: DefCall[] = ["RUN_STOP", "COVERAGE", "BLITZ", "PASS_RUSH"]

const A = (o: OwnedPlayer) => o.player.attributes

interface SimTeam {
  team: TeamId
  profile: NflTeamProfile
  roster: RosterState
  box: TeamBox
  lines: Map<string, PlayerStatLine>
  score: number
  /** Difficulty edge: small additive success nudge (+ helps, − hurts). */
  edge: number
}

function newStatLine(o: OwnedPlayer, team: TeamId): PlayerStatLine {
  return {
    playerId: o.player.id,
    name: o.player.name,
    team,
    slot: o.slot,
    passYds: 0, passTd: 0, int: 0, completions: 0, attempts: 0,
    rushYds: 0, rushTd: 0, carries: 0,
    recYds: 0, recTd: 0, receptions: 0, targets: 0,
    tackles: 0, sacks: 0, interceptions: 0, forcedIncompletions: 0,
  }
}

function newTeamBox(team: TeamId): TeamBox {
  return {
    team, points: 0, totalYards: 0, passYards: 0, rushYards: 0,
    firstDowns: 0, thirdDownAtt: 0, thirdDownConv: 0,
    turnovers: 0, sacks: 0, timeOfPossession: 0, drives: 0,
  }
}

function buildSimTeam(team: TeamId, roster: RosterState, edge: number): SimTeam {
  const lines = new Map<string, PlayerStatLine>()
  for (const o of orderedRoster(roster)) lines.set(o.player.id, newStatLine(o, team))
  return {
    team,
    profile: buildTeamProfile(team, roster),
    roster,
    box: newTeamBox(team),
    lines,
    score: 0,
    edge,
  }
}

function line(t: SimTeam, playerId: string | null): PlayerStatLine | null {
  return playerId ? t.lines.get(playerId) ?? null : null
}

function clamp01(v: number): number {
  return Math.max(0.02, Math.min(0.98, v))
}

// ─── Offensive & defensive play selection (v1 auto; v2 = human off call) ─────

function pickOffCall(off: SimTeam, down: number, toGo: number, rng: RNG): OffCall {
  const p = off.profile
  // Weights bias toward the team's strengths and the situation.
  let wRun = 1 + (p.rushingOffense - 60) / 40
  let wShort = 1 + (p.passingOffense - 60) / 40
  let wDeep = 0.5 + (p.explosiveness - 60) / 45
  let wPA = 0.4 + (p.rushingOffense + p.explosiveness - 120) / 90

  if (down >= 3 && toGo >= 7) { wRun *= 0.4; wDeep *= 1.3; wShort *= 1.2 } // obvious passing
  if (down >= 3 && toGo <= 2) { wRun *= 1.8; wPA *= 1.2 } // short yardage
  if (toGo <= 4) wPA *= 1.3

  return weightedCall<OffCall>(rng, [
    ["RUN", wRun], ["SHORT_PASS", wShort], ["DEEP_PASS", wDeep], ["PLAY_ACTION", wPA],
  ])
}

function pickDefCall(def: SimTeam, down: number, toGo: number, rng: RNG): DefCall {
  const p = def.profile
  let wRunStop = 1 + (p.runDefense - 60) / 40
  let wCoverage = 1 + (p.coverage - 60) / 40
  let wBlitz = 0.6 + (p.passRush - 60) / 45
  const wRush = 0.8 + (p.passRush - 60) / 50

  if (down >= 3 && toGo >= 7) { wRunStop *= 0.5; wCoverage *= 1.2; wBlitz *= 1.2 }
  if (down >= 3 && toGo <= 2) { wRunStop *= 1.7 }

  return weightedCall<DefCall>(rng, [
    ["RUN_STOP", wRunStop], ["COVERAGE", wCoverage], ["BLITZ", wBlitz], ["PASS_RUSH", wRush],
  ])
}

function weightedCall<T extends string>(rng: RNG, pairs: [T, number][]): T {
  const total = pairs.reduce((s, [, w]) => s + Math.max(0.01, w), 0)
  let r = rng() * total
  for (const [call, w] of pairs) {
    r -= Math.max(0.01, w)
    if (r <= 0) return call
  }
  return pairs[pairs.length - 1][0]
}

// ─── Play resolution (the v2 seam) ──────────────────────────────────────────

export interface PlayResult {
  yards: number
  clockUsed: number
  event: "run" | "complete" | "incomplete" | "sack" | "interception" | "fumble" | "scramble"
  scored: boolean
}

/**
 * Resolve ONE play. Pure given (calls, teams, state, rng). This is the seam v2
 * hooks into: pass a human-chosen `off` call and the rest is unchanged.
 */
export function resolvePlay(
  off: SimTeam,
  def: SimTeam,
  offCall: OffCall,
  defCall: DefCall,
  rng: RNG
): PlayResult {
  const isRunPlay = offCall === "RUN"
  const isDeep = offCall === "DEEP_PASS"
  const isPA = offCall === "PLAY_ACTION"

  // Matchup multipliers: how the defensive posture counters the offensive call.
  const matchup = matchupMultiplier(offCall, defCall)

  if (isRunPlay || (isPA && rng() < 0.28)) {
    return resolveRun(off, def, defCall, matchup, rng)
  }
  return resolvePass(off, def, offCall, defCall, matchup, isDeep, isPA, rng)
}

/** Multiplier on offensive success for each (off, def) pairing. >1 favors O. */
function matchupMultiplier(off: OffCall, def: DefCall): number {
  const M: Record<OffCall, Record<DefCall, number>> = {
    RUN:         { RUN_STOP: 0.7, COVERAGE: 1.25, BLITZ: 0.85, PASS_RUSH: 1.1 },
    SHORT_PASS:  { RUN_STOP: 1.2, COVERAGE: 0.82, BLITZ: 1.05, PASS_RUSH: 0.95 },
    DEEP_PASS:   { RUN_STOP: 1.3, COVERAGE: 0.7, BLITZ: 1.35, PASS_RUSH: 0.8 },
    PLAY_ACTION: { RUN_STOP: 1.25, COVERAGE: 0.95, BLITZ: 1.2, PASS_RUSH: 0.9 },
  }
  return M[off][def]
}

function resolveRun(off: SimTeam, def: SimTeam, defCall: DefCall, matchup: number, rng: RNG): PlayResult {
  const rb = playerInSlot(off.roster, "RB")
  const rushO = off.profile.rushingOffense
  const runD = def.profile.runDefense
  const blitzExposure = defCall === "BLITZ" ? 1.12 : 1 // blitz can open big runs

  const base = 0.5 + (rushO - runD) / 200
  const success = clamp01(base * matchup * blitzExposure + off.edge - def.edge)
  const boom = rng() < 0.08 * (rb ? off.profile.rushingOffense / 80 : 1) * (defCall === "BLITZ" ? 1.4 : 1)

  let yards: number
  if (rng() < success) {
    yards = boom ? 12 + Math.floor(rng() * 40) : 3 + Math.floor(rng() * 7)
  } else {
    yards = Math.floor(rng() * 3) - 1 // -1..1
  }

  const rbLine = line(off, rb?.id ?? null)
  if (rbLine) { rbLine.carries += 1; rbLine.rushYds += yards }
  creditTackle(def, rng)

  // Fumble risk on runs, higher when stuffed.
  if (rng() < 0.012 + (yards <= 0 ? 0.01 : 0)) {
    return { yards, clockUsed: 6 + Math.floor(rng() * 4), event: "fumble", scored: false }
  }
  return { yards, clockUsed: 25 + Math.floor(rng() * 12), event: "run", scored: false }
}

function resolvePass(
  off: SimTeam,
  def: SimTeam,
  offCall: OffCall,
  defCall: DefCall,
  matchup: number,
  isDeep: boolean,
  isPA: boolean,
  rng: RNG
): PlayResult {
  const qb = playerInSlot(off.roster, "QB")
  const qbLine = line(off, qb?.id ?? null)

  // Sack risk: pass rush vs protection, amplified by blitz.
  const rushPressure = def.profile.passRush * (defCall === "BLITZ" ? 1.25 : defCall === "PASS_RUSH" ? 1.1 : 0.85)
  const protection = off.profile.passProtection * (isPA ? 1.05 : 1) + (qb ? qb.attributes.mobility * 0.15 : 0)
  const sackProb = clamp01(0.06 + (rushPressure - protection) / 320)
  if (rng() < sackProb) {
    creditSack(def, rng)
    if (qbLine) qbLine.attempts += 0
    return { yards: -(5 + Math.floor(rng() * 5)), clockUsed: 6 + Math.floor(rng() * 4), event: "sack", scored: false }
  }

  // Choose a target among eligible pass-catchers, weighted by separation.
  const target = pickTarget(off, isDeep, rng)
  const targetLine = line(off, target?.player.id ?? null)
  if (qbLine) qbLine.attempts += 1
  if (targetLine) targetLine.targets += 1

  const passO = isDeep ? off.profile.explosiveness : off.profile.passingOffense
  const passD = def.profile.coverage
  const base = (isDeep ? 0.4 : 0.6) + (passO - passD) / 220
  const completion = clamp01(base * matchup + off.edge - def.edge)

  // Interception chance rises on deep/contested throws vs good ball-hawks.
  const intProb = clamp01((isDeep ? 0.045 : 0.02) + (passD - passO) / 900 + (defCall === "COVERAGE" ? 0.01 : 0))
  if (rng() < intProb) {
    if (qbLine) qbLine.int += 1
    creditInterception(def, rng)
    return { yards: 0, clockUsed: 6 + Math.floor(rng() * 4), event: "interception", scored: false }
  }

  if (rng() < completion) {
    const yacBoost = target ? A(target).yac / 120 : 0.4
    const yards = isDeep
      ? 16 + Math.floor(rng() * 34) + Math.floor(yacBoost * 12)
      : 5 + Math.floor(rng() * 9) + Math.floor(yacBoost * 8)
    if (qbLine) { qbLine.completions += 1; qbLine.passYds += yards }
    if (targetLine) { targetLine.receptions += 1; targetLine.recYds += yards }
    return { yards, clockUsed: 20 + Math.floor(rng() * 12), event: "complete", scored: false }
  }

  // Incompletion — forced by coverage.
  creditForcedIncompletion(def, rng)
  return { yards: 0, clockUsed: 6 + Math.floor(rng() * 5), event: "incomplete", scored: false }
}

function pickTarget(off: SimTeam, isDeep: boolean, rng: RNG): OwnedPlayer | null {
  const candidates = (["WR1", "WR2", "TE", "RB"] as const)
    .map((slot) => off.roster.slots[slot])
    .filter((o): o is OwnedPlayer => o !== null)
  if (candidates.length === 0) return null
  const weights = candidates.map((o) => {
    const a = A(o)
    const base = a.separation * 0.5 + a.catching * 0.3 + a.routeRunning * 0.2
    // Deep shots favor speed; RBs rarely get deep targets.
    const deepAdj = isDeep ? a.speed / 90 : 1
    const rbAdj = o.slot === "RB" ? (isDeep ? 0.2 : 0.7) : 1
    return Math.pow(base / 100, 2) * deepAdj * rbAdj
  })
  const total = weights.reduce((s, w) => s + w, 0) || 1
  let r = rng() * total
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i]
    if (r <= 0) return candidates[i]
  }
  return candidates[0]
}

// ── Defensive stat crediting (weighted by the relevant defender) ────────────

function creditTackle(def: SimTeam, rng: RNG): void {
  const d = pickDefender(def, (a) => a.tackling + a.runStop, rng)
  if (d) d.tackles += 1
}
function creditSack(def: SimTeam, rng: RNG): void {
  const d = pickDefender(def, (a) => a.passRush, rng)
  if (d) { d.sacks += 1; d.tackles += 1 }
  def.box.sacks += 1
}
function creditInterception(def: SimTeam, rng: RNG): void {
  const d = pickDefender(def, (a) => a.ballHawk + a.coverage, rng)
  if (d) d.interceptions += 1
}
function creditForcedIncompletion(def: SimTeam, rng: RNG): void {
  const d = pickDefender(def, (a) => a.coverage, rng)
  if (d) d.forcedIncompletions += 1
}

function pickDefender(
  def: SimTeam,
  weight: (a: OwnedPlayer["player"]["attributes"]) => number,
  rng: RNG
): PlayerStatLine | null {
  const defenders = (["EDGE", "LB", "CB", "S"] as const)
    .map((slot) => def.roster.slots[slot])
    .filter((o): o is OwnedPlayer => o !== null)
  if (defenders.length === 0) return null
  const weights = defenders.map((o) => Math.max(1, weight(o.player.attributes)))
  const total = weights.reduce((s, w) => s + w, 0)
  let r = rng() * total
  for (let i = 0; i < defenders.length; i++) {
    r -= weights[i]
    if (r <= 0) return def.lines.get(defenders[i].player.id) ?? null
  }
  return def.lines.get(defenders[0].player.id) ?? null
}

// ─── Drive loop ──────────────────────────────────────────────────────────

interface DriveOutcome {
  points: number
  kind: ScoringKind | null
  yards: number
  clockUsed: number
  turnover: boolean
  scorer?: PlayerStatLine | null
}

function runDrive(off: SimTeam, def: SimTeam, rng: RNG, maxClock: number): DriveOutcome {
  let yardLine = 25 // own 25 (yards from own goal)
  let down = 1
  let toGo = 10
  let clockUsed = 0
  let totalYards = 0

  while (clockUsed < maxClock) {
    const offCall = pickOffCall(off, down, toGo, rng)
    const defCall = pickDefCall(def, down, toGo, rng)
    const play = resolvePlay(off, def, offCall, defCall, rng)
    clockUsed += play.clockUsed

    if (down === 3) off.box.thirdDownAtt += 1

    if (play.event === "interception" || play.event === "fumble") {
      off.box.turnovers += 1
      return { points: 0, kind: null, yards: totalYards, clockUsed, turnover: true }
    }

    yardLine += play.yards
    totalYards += Math.max(0, play.yards)
    off.box.totalYards += Math.max(0, play.yards)
    if (offCall === "RUN" || play.event === "run") off.box.rushYards += Math.max(0, play.yards)
    else if (play.event === "complete") off.box.passYards += Math.max(0, play.yards)

    // Touchdown.
    if (yardLine >= 100) {
      const isPass = play.event === "complete"
      const scorer = creditTouchdown(off, isPass, rng)
      return {
        points: 7,
        kind: isPass ? "TD_PASS" : "TD_RUN",
        yards: totalYards,
        clockUsed,
        turnover: false,
        scorer,
      }
    }

    // First down?
    if (play.yards >= toGo) {
      off.box.firstDowns += 1
      if (down === 3) off.box.thirdDownConv += 1
      down = 1
      toGo = 10
    } else {
      down += 1
      toGo -= play.yards
      if (down > 4) {
        // 4th down decision: FG if in range (opp ~38+), else turnover on downs.
        if (yardLine >= 62) {
          const fgProb = clamp01(0.92 - (100 - yardLine) / 120)
          if (rng() < fgProb) {
            return { points: 3, kind: "FG", yards: totalYards, clockUsed, turnover: false }
          }
        }
        return { points: 0, kind: null, yards: totalYards, clockUsed, turnover: true }
      }
    }
  }
  return { points: 0, kind: null, yards: totalYards, clockUsed, turnover: false }
}

function creditTouchdown(off: SimTeam, isPass: boolean, rng: RNG): PlayerStatLine | null {
  if (isPass) {
    const qb = playerInSlot(off.roster, "QB")
    const qbLine = line(off, qb?.id ?? null)
    if (qbLine) qbLine.passTd += 1
    const target = pickTarget(off, rng() < 0.35, rng)
    const tLine = line(off, target?.player.id ?? null)
    if (tLine) tLine.recTd += 1
    return tLine ?? qbLine
  }
  const rb = playerInSlot(off.roster, "RB")
  const rbLine = line(off, rb?.id ?? null)
  if (rbLine) rbLine.rushTd += 1
  return rbLine
}

// ─── Full game ─────────────────────────────────────────────────────────

export function simulateGame(
  rosterP1: RosterState,
  rosterP2: RosterState,
  season: Season,
  seed: number,
  edges: Record<TeamId, number> = { P1: 0, P2: 0 }
): NflGameResult {
  const rng = mulberry32(seed >>> 0)
  const p1 = buildSimTeam("P1", rosterP1, edges.P1)
  const p2 = buildSimTeam("P2", rosterP2, edges.P2)

  const quarters: QuarterScore[] = []
  const scoringPlays: ScoringPlay[] = []

  let possession: SimTeam = rng() < 0.5 ? p1 : p2

  for (let q = 1; q <= QUARTERS; q++) {
    const startP1 = p1.score
    const startP2 = p2.score
    let clock = QUARTER_SECONDS

    while (clock > 0) {
      const off = possession
      const def = off === p1 ? p2 : p1
      const outcome = runDrive(off, def, rng, Math.min(clock, 210))
      clock -= outcome.clockUsed
      off.box.timeOfPossession += outcome.clockUsed
      off.box.drives += 1

      if (outcome.points > 0 && outcome.kind) {
        off.score += outcome.points
        off.box.points += outcome.points
        scoringPlays.push({
          quarter: q,
          clock: Math.max(0, Math.round(clock)),
          team: off.team,
          kind: outcome.kind,
          yards: outcome.yards,
          p1Score: p1.score,
          p2Score: p2.score,
          text: scoringText(off, outcome),
          big: outcome.kind === "TD_PASS" && outcome.yards >= 40,
        })
      }

      // Possession flips after every drive (score, punt, or turnover).
      possession = def
      if (clock <= 0) break
    }

    quarters.push({ quarter: q, p1: p1.score - startP1, p2: p2.score - startP2 })
  }

  // Overtime: sudden-ish resolution — one drive each until a leader emerges.
  let otGuard = 0
  while (p1.score === p2.score && otGuard++ < 6) {
    for (const off of [p1, p2]) {
      const def = off === p1 ? p2 : p1
      const outcome = runDrive(off, def, rng, 200)
      if (outcome.points > 0 && outcome.kind) {
        off.score += outcome.points
        off.box.points += outcome.points
        scoringPlays.push({
          quarter: 5,
          clock: 0,
          team: off.team,
          kind: outcome.kind,
          yards: outcome.yards,
          p1Score: p1.score,
          p2Score: p2.score,
          text: `OT: ${scoringText(off, outcome)}`,
          big: true,
        })
      }
    }
  }
  if (p1.score === p2.score) {
    // Final tie-break by team overall (deterministic).
    if (p1.profile.overall >= p2.profile.overall) p1.score += 3
    else p2.score += 3
  }

  const winner: TeamId = p1.score >= p2.score ? "P1" : "P2"
  const box = [...p1.lines.values(), ...p2.lines.values()]

  return {
    season,
    winner,
    finalScore: { p1: p1.score, p2: p2.score },
    quarters,
    scoringPlays,
    box,
    teamBox: { P1: p1.box, P2: p2.box },
    mvp: pickMvp(box, winner),
    topPerformers: pickTopPerformers(box),
    matchupNotes: [], // filled by analysis.ts
    analysis: { P1: [], P2: [] },
    scoutReports: {
      P1: emptyScout("P1"),
      P2: emptyScout("P2"),
    },
    teamComparison: comparison(p1.profile, p2.profile),
    gameChangingPlay: pickGameChangingPlay(scoringPlays),
  }
}

function scoringText(off: SimTeam, o: DriveOutcome): string {
  const name = o.scorer?.name ?? off.team
  if (o.kind === "TD_PASS") return `${name} — ${o.yards}-yard TD drive (pass)`
  if (o.kind === "TD_RUN") return `${name} — ${o.yards}-yard TD drive (run)`
  if (o.kind === "FG") return `Field goal — ${o.yards}-yard drive`
  return "Score"
}

function emptyScout(team: TeamId) {
  return { team, strongestArea: "", weakestArea: "", likelyStrategy: "", biggestThreat: "" }
}

function comparison(a: NflTeamProfile, b: NflTeamProfile): NflGameResult["teamComparison"] {
  return {
    passingOffense: { p1: a.passingOffense, p2: b.passingOffense },
    rushingOffense: { p1: a.rushingOffense, p2: b.rushingOffense },
    passProtection: { p1: a.passProtection, p2: b.passProtection },
    explosiveness: { p1: a.explosiveness, p2: b.explosiveness },
    passRush: { p1: a.passRush, p2: b.passRush },
    coverage: { p1: a.coverage, p2: b.coverage },
    runDefense: { p1: a.runDefense, p2: b.runDefense },
    balance: { p1: a.balance, p2: b.balance },
  }
}

function statLineText(l: PlayerStatLine): string {
  const parts: string[] = []
  if (l.attempts > 0) parts.push(`${l.passYds} yds, ${l.passTd} TD${l.int ? `, ${l.int} INT` : ""}`)
  if (l.carries > 0) parts.push(`${l.rushYds} rush yds${l.rushTd ? `, ${l.rushTd} TD` : ""}`)
  if (l.receptions > 0) parts.push(`${l.receptions} rec, ${l.recYds} yds${l.recTd ? `, ${l.recTd} TD` : ""}`)
  if (l.sacks > 0) parts.push(`${l.sacks} sack${l.sacks > 1 ? "s" : ""}`)
  if (l.interceptions > 0) parts.push(`${l.interceptions} INT`)
  if (l.tackles > 0 && parts.length === 0) parts.push(`${l.tackles} tackles`)
  return parts.join(", ") || "—"
}

function playerScore(l: PlayerStatLine): number {
  return (
    l.passYds * 0.04 + l.passTd * 4 - l.int * 3 +
    l.rushYds * 0.1 + l.rushTd * 6 +
    l.recYds * 0.1 + l.recTd * 6 +
    l.sacks * 4 + l.interceptions * 6 + l.tackles * 0.4 + l.forcedIncompletions * 1
  )
}

function pickMvp(box: PlayerStatLine[], winner: TeamId): NflGameResult["mvp"] {
  const winners = box.filter((l) => l.team === winner)
  const pool = winners.length > 0 ? winners : box
  let best = pool[0]
  let bestScore = -Infinity
  for (const l of pool) {
    const s = playerScore(l)
    if (s > bestScore) { bestScore = s; best = l }
  }
  return { playerId: best.playerId, name: best.name, team: best.team, line: statLineText(best) }
}

function pickTopPerformers(box: PlayerStatLine[]): NflGameResult["topPerformers"] {
  return [...box]
    .sort((a, b) => playerScore(b) - playerScore(a))
    .slice(0, 4)
    .map((l) => ({ playerId: l.playerId, name: l.name, team: l.team, line: statLineText(l) }))
}

function pickGameChangingPlay(plays: ScoringPlay[]): ScoringPlay | null {
  if (plays.length === 0) return null
  // Prefer a big, late scoring play; else the biggest.
  const late = plays.filter((p) => p.quarter >= 4).sort((a, b) => b.yards - a.yards)
  return (late[0] ?? [...plays].sort((a, b) => b.yards - a.yards)[0]) ?? null
}
