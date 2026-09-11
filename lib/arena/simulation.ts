/**
 * SimulationEngine — a possession-based basketball simulator.
 *
 * NOT "power A vs power B + random()". Each possession:
 *   1. Picks an offensive action (iso / P&R / post / spot-up / transition /
 *      drive / pull-up) weighted by the ball-handler's skills.
 *   2. Resolves it against the matched defender + team help (rim protection,
 *      perimeter D) with fatigue, clutch, and bounded randomness.
 *   3. Produces a concrete outcome (made 3 / made 2 / miss + reb / foul+FTs /
 *      turnover / assist / block / steal) and updates box-score lines.
 *
 * A better team wins more often, but variance is real: underdogs win a healthy
 * share. The whole run is seeded, so it's reproducible & testable.
 */

import type {
  GameMoment,
  GameResult,
  OwnedPlayer,
  PlayerBoxLine,
  QuarterScore,
  RosterSlot,
  RosterState,
  SeasonPlayer,
  TeamBox,
  TeamId,
} from "./types"
import { starters, bench } from "./roster"
import { buildTeamProfile, usageShares, type TeamProfile } from "./teamRating"
import { assignMatchups, matchupEdge, type MatchupSet } from "./matchup"
import { mulberry32, type RNG } from "./rng"

const A = (p: SeasonPlayer) => p.attributes

const QUARTERS = 4
/**
 * Loop iterations per team per quarter. Note an offensive rebound CONSUMES an
 * iteration rather than adding a bonus shot, so this figure has to sit above the
 * real ~25 possessions/quarter to land on a realistic ~88 FGA per team.
 */
const POSSESSIONS_PER_QUARTER = 27
const CLUTCH_CLOCK = 5 * 60 // final 5 minutes (seconds)
const QUARTER_SECONDS = 12 * 60

interface SimPlayer {
  owned: OwnedPlayer
  team: TeamId
  usage: number // effective share among on-court players
  stamina: number // current, decays with minutes, recovers on bench
  onCourt: boolean
  box: PlayerBoxLine
}

interface SimTeam {
  team: TeamId
  profile: TeamProfile
  players: SimPlayer[]
  starters: SimPlayer[]
  bench: SimPlayer | null
  matchups: MatchupSet
  box: TeamBox
  score: number
  /** Difficulty edge: small additive shot-probability nudge (+ helps, − hurts). */
  edge: number
}

function newBoxLine(o: OwnedPlayer, team: TeamId): PlayerBoxLine {
  return {
    playerId: o.player.id,
    name: o.player.name,
    team,
    slot: o.slot,
    min: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0,
    fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0,
  }
}

function newTeamBox(team: TeamId): TeamBox {
  return {
    team, points: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0,
    reb: 0, ast: 0, tov: 0, stl: 0, blk: 0,
    paintPoints: 0, fastBreakPoints: 0, secondChancePoints: 0,
  }
}

function buildSimTeam(team: TeamId, roster: RosterState, oppRoster: RosterState, edge = 0): SimTeam {
  const profile = buildTeamProfile(team, roster)
  const shares = usageShares(roster)
  const start = starters(roster)
  const benchOwned = bench(roster)

  const players: SimPlayer[] = []
  const simStarters: SimPlayer[] = start.map((o) => {
    const sp: SimPlayer = {
      owned: o,
      team,
      usage: shares[o.player.id] ?? 0.2,
      stamina: A(o.player).stamina,
      onCourt: true,
      box: newBoxLine(o, team),
    }
    players.push(sp)
    return sp
  })
  let benchSim: SimPlayer | null = null
  if (benchOwned) {
    benchSim = {
      owned: benchOwned,
      team,
      usage: 0.16,
      stamina: A(benchOwned.player).stamina,
      onCourt: false,
      box: newBoxLine(benchOwned, team),
    }
    players.push(benchSim)
  }

  return {
    team,
    profile,
    players,
    starters: simStarters,
    bench: benchSim,
    matchups: assignMatchups(roster, oppRoster),
    box: newTeamBox(team),
    score: 0,
    edge,
  }
}

// ─── Rotation: bench the most-tired starter periodically ────────────────────

function manageRotation(t: SimTeam, rng: RNG, clutch: boolean): void {
  if (!t.bench) return
  const onCourt = t.starters.filter((p) => p.onCourt)
  const benched = t.starters.find((p) => !p.onCourt)

  if (t.bench.onCourt) {
    // Consider subbing the bench back out for the rested starter — in crunch
    // time, favor the better starter unless the bench is a defensive stopper.
    const rested = benched
    if (rested) {
      const benchIsStopper = A(t.bench.owned.player).perimeterDefense >= 82
      const keepBench = clutch ? benchIsStopper && rng() < 0.5 : rng() < 0.35
      if (!keepBench) {
        t.bench.onCourt = false
        rested.onCourt = true
      }
    }
    return
  }

  // Bench is out. Sub in for the most-fatigued starter (skip in deep clutch
  // unless someone is gassed).
  const tired = onCourt.slice().sort((a, b) => a.stamina - b.stamina)[0]
  if (!tired) return
  const shouldSub = clutch ? tired.stamina < 55 : tired.stamina < 68 || rng() < 0.25
  if (shouldSub) {
    tired.onCourt = false
    t.bench.onCourt = true
  }
}

function onCourtPlayers(t: SimTeam): SimPlayer[] {
  return t.players.filter((p) => p.onCourt)
}

// ─── Possession resolution ────────────────────────────────────────────────

type ActionKind = "iso" | "pnr" | "post" | "spotup" | "transition" | "drive" | "pullup"

function chooseBallHandler(t: SimTeam, rng: RNG): SimPlayer {
  const court = onCourtPlayers(t)
  // Weight by effective usage × fatigue factor.
  const weights = court.map((p) => p.usage * (0.6 + (p.stamina / 100) * 0.4))
  const total = weights.reduce((s, w) => s + w, 0) || 1
  let r = rng() * total
  for (let i = 0; i < court.length; i++) {
    r -= weights[i]
    if (r <= 0) return court[i]
  }
  return court[court.length - 1]
}

/**
 * Shot-diet multipliers. The raw attribute weights are all in the same 40-90
 * band, which made every action equally likely and left the sim taking ~16 threes
 * a game (a 1990s shot profile). These scalars push the mix toward a modern one:
 * roughly 40% threes, 35% rim attacks, 25% middies.
 */
const ACTION_FREQ: Record<Exclude<ActionKind, "transition">, number> = {
  spotup: 2.05,
  drive: 1.15,
  pnr: 1.0,
  pullup: 0.9,
  iso: 0.7,
  post: 0.5,
}

function chooseAction(p: SeasonPlayer, transition: boolean, rng: RNG): ActionKind {
  if (transition) return "transition"
  const a = A(p)
  const opts: { k: ActionKind; w: number }[] = [
    { k: "iso", w: (a.scoring * 0.5 + a.ballHandling * 0.5) * ACTION_FREQ.iso },
    { k: "pnr", w: (a.playmaking * 0.6 + a.ballHandling * 0.4) * ACTION_FREQ.pnr },
    { k: "post", w: (a.strength * 0.5 + a.finishing * 0.5) * ACTION_FREQ.post },
    { k: "spotup", w: a.threePointShooting * ACTION_FREQ.spotup },
    { k: "drive", w: (a.speed * 0.5 + a.finishing * 0.5) * ACTION_FREQ.drive },
    { k: "pullup", w: (a.midrange * 0.6 + a.threePointShooting * 0.4) * ACTION_FREQ.pullup },
  ]
  const total = opts.reduce((s, o) => s + Math.max(1, o.w), 0)
  let r = rng() * total
  for (const o of opts) {
    r -= Math.max(1, o.w)
    if (r <= 0) return o.k
  }
  return "iso"
}

/** Find the defender matched to this offensive player (by drafted slot). */
function defenderFor(offense: SimPlayer, def: SimTeam): SimPlayer {
  const slot = offense.owned.slot
  const onCourt = onCourtPlayers(def)
  const matched = onCourt.find((d) => d.owned.slot === slot)
  return matched ?? onCourt[Math.floor(onCourt.length / 2)] ?? def.players[0]
}

interface PossessionResult {
  points: number
  scorer?: SimPlayer
  assister?: SimPlayer
  kind: "made3" | "made2" | "miss" | "ftonly" | "turnover"
  paint: boolean
  fastBreak: boolean
  secondChance: boolean
  blockedBy?: SimPlayer
  stolenBy?: SimPlayer
  big?: boolean
}

function fatigueFactor(sp: SimPlayer): number {
  // 1.0 fresh → ~0.86 gassed. Never crushes performance.
  return 0.86 + (sp.stamina / 100) * 0.14
}

function simulatePossession(
  off: SimTeam,
  def: SimTeam,
  rng: RNG,
  clutch: boolean,
  transition: boolean
): PossessionResult {
  const handler = chooseBallHandler(off, rng)
  const hp = handler.owned.player
  const action = chooseAction(hp, transition, rng)
  const defender = defenderFor(handler, def)
  const dp = defender.owned.player

  const fat = fatigueFactor(handler)
  const defFat = fatigueFactor(defender)

  // Base matchup edge (offense positive).
  const { edge } = matchupEdge(hp, dp)

  // Team help context.
  const helpRim = def.profile.rimProtection
  const helpPerim = def.profile.perimeterDefense
  const teamOff = off.profile.offense
  const teamDef = def.profile.defense
  const clutchBoost = clutch ? (A(hp).clutch - 60) * 0.15 : 0

  // Turnover chance (usage overlap + turnoverRisk + steal pressure).
  const stealPressure = A(dp).steal + def.profile.perimeterDefense * 0.2
  let toChance =
    0.072 +
    (A(hp).turnoverRisk / 100) * 0.10 +
    (off.profile.usageOverlap / 100) * 0.05 +
    (stealPressure / 100) * 0.05 -
    (A(hp).basketballIQ / 100) * 0.04
  toChance = clamp01(toChance)
  if (rng() < toChance) {
    handler.box.tov += 1
    off.box.tov += 1
    // Roughly two thirds of live-ball turnovers are credited as steals.
    const stolen = rng() < 0.32 + (A(dp).steal / 100) * 0.3
    let stealer: SimPlayer | undefined
    if (stolen) {
      // The matched defender is most likely, but any teammate can jump the pass.
      stealer = weightedPick(
        onCourtPlayers(def),
        (p) => {
          const a = A(p.owned.player)
          const w = Math.pow(Math.max(1, a.steal) / 100, 1.6) * (0.7 + (a.perimeterDefense / 100) * 0.5)
          return (p === defender ? w * 2.2 : w) + 0.04
        },
        rng
      )
      if (stealer) { stealer.box.stl += 1; def.box.stl += 1 }
    }
    return {
      points: 0, kind: "turnover", paint: false, fastBreak: false, secondChance: false,
      stolenBy: stealer,
    }
  }

  // Decide shot type from action.
  const wantsThree =
    action === "spotup" ||
    (action === "pullup" && A(hp).threePointShooting >= A(hp).midrange - 6) ||
    (action === "pnr" && rng() < 0.42 && A(hp).threePointShooting > 68) ||
    (action === "iso" && rng() < 0.22 && A(hp).threePointShooting > 74)
  const atRim = action === "drive" || action === "transition" || action === "post"

  // Assist chance. Around 60% of made NBA field goals are assisted, and it
  // depends heavily on the action: spot-ups and pick-and-rolls are created for
  // you, isos and pull-ups are self-generated.
  const creator = pickCreator(off, handler, rng)
  const ASSIST_BY_ACTION: Record<ActionKind, number> = {
    spotup: 1.45,
    pnr: 1.2,
    transition: 1.15,
    post: 0.85,
    drive: 0.8,
    pullup: 0.5,
    iso: 0.35,
  }
  const assistBase = 0.305 + (creator ? A(creator.owned.player).playmaking / 100 : 0) * 0.4
  const assisted =
    !!creator && rng() < clamp01(assistBase * ASSIST_BY_ACTION[action])

  // Block chance at the rim.
  if (atRim) {
    // Shot-blocking PRESSURE comes from the best rim protector in help...
    const rimDef = maxBy(onCourtPlayers(def), (p) => A(p.owned.player).rimProtection)!
    const blockChance = clamp01(
      ((A(rimDef.owned.player).rimProtection + A(rimDef.owned.player).block) / 2 - A(hp).finishing) / 170 + 0.105
    )
    if (rng() < blockChance) {
      // ...but the block is CREDITED probabilistically. Always handing it to the
      // same rim protector left every other defender with 0 blocks all season.
      const blocker =
        weightedPick(
          onCourtPlayers(def),
          (p) => {
            const a = A(p.owned.player)
            const w = Math.pow(Math.max(1, (a.block + a.rimProtection) / 2) / 100, 2.0)
            return (p === rimDef ? w * 2.5 : w) + 0.03
          },
          rng
        ) ?? rimDef
      handler.box.fga += 1
      off.box.fga += 1
      blocker.box.blk += 1
      def.box.blk += 1
      const reb = grabRebound(off, def, rng)
      return {
        points: 0, kind: "miss", paint: true, fastBreak: false,
        secondChance: reb === "off",
        blockedBy: blocker,
        big: A(blocker.owned.player).rimProtection > 85,
      }
    }
  }

  // Shot quality: offense skill + edge + team offense − defense + fatigue + clutch.
  // (The handler takes the shot; any assist is credited to `creator` below.)
  let makeProb: number
  if (wantsThree) {
    makeProb =
      0.248 +
      (A(hp).threePointShooting - 60) / 260 +
      edge / 500 +
      (teamOff - teamDef) / 900 +
      (assisted ? 0.05 : -0.01) -
      (helpPerim - 60) / 700
    makeProb += clutchBoost / 100
  } else if (atRim) {
    makeProb =
      0.522 +
      (A(hp).finishing - 60) / 240 +
      edge / 380 -
      (helpRim - 55) / 420 +
      (transition ? 0.08 : 0)
    makeProb += clutchBoost / 120
  } else {
    // midrange / pullup
    makeProb =
      0.388 +
      (A(hp).midrange - 60) / 260 +
      edge / 420 +
      (teamOff - teamDef) / 1000
    makeProb += clutchBoost / 110
  }
  makeProb *= fat
  makeProb /= (0.97 + (1 - defFat) * 0.06) // tired defense concedes a bit
  // Difficulty edge: the offense's execution edge helps, the defense's hurts.
  makeProb += off.edge - def.edge * 0.5
  makeProb = clamp(makeProb, 0.05, 0.92)

  handler.box.fga += 1
  off.box.fga += 1
  if (wantsThree) { handler.box.tpa += 1; off.box.tpa += 1 }

  if (rng() < makeProb) {
    // Made shot.
    const pts = wantsThree ? 3 : 2
    handler.box.fgm += 1
    off.box.fgm += 1
    handler.box.pts += pts
    off.score += pts
    off.box.points += pts
    if (wantsThree) { handler.box.tpm += 1; off.box.tpm += 1 }
    if (atRim && !wantsThree) off.box.paintPoints += pts
    if (transition) off.box.fastBreakPoints += pts
    if (assisted && creator) {
      creator.box.ast += 1
      off.box.ast += 1
    }
    // And-one: contact finishes at the rim draw a bonus free throw. Without this
    // the sim only ever generated FTs on misses, roughly halving the FT rate.
    if (atRim && !wantsThree) {
      const andOneProb = clamp01(0.085 + (A(hp).strength / 100) * 0.05 + (A(hp).athleticism / 100) * 0.04)
      if (rng() < andOneProb) {
        handler.box.fta += 1
        off.box.fta += 1
        if (rng() < A(hp).freeThrow / 100) {
          handler.box.ftm += 1
          off.box.ftm += 1
          handler.box.pts += 1
          off.score += 1
          off.box.points += 1
        }
      }
    }
    return {
      points: pts,
      scorer: handler,
      assister: assisted ? creator ?? undefined : undefined,
      kind: wantsThree ? "made3" : "made2",
      paint: atRim && !wantsThree,
      fastBreak: transition,
      secondChance: false,
      big: pts === 3 && clutch,
    }
  }

  // Missed — maybe fouled (free throws). Rim attacks and strong, athletic
  // finishers draw contact far more often than jump shooters.
  const foulProb = clamp01(
    0.095 +
      (A(hp).athleticism / 100) * 0.055 +
      (A(hp).strength / 100) * 0.035 +
      (atRim ? 0.12 : 0) -
      (wantsThree ? 0.05 : 0)
  )
  if (rng() < foulProb) {
    const shots = wantsThree ? 3 : 2
    let made = 0
    for (let i = 0; i < shots; i++) {
      handler.box.fta += 1
      off.box.fta += 1
      if (rng() < A(hp).freeThrow / 100) {
        made++
        handler.box.ftm += 1
        off.box.ftm += 1
      }
    }
    handler.box.fga -= 1 // shooting foul: not counted as FGA
    off.box.fga -= 1
    if (wantsThree) { handler.box.tpa -= 1; off.box.tpa -= 1 }
    handler.box.pts += made
    off.score += made
    off.box.points += made
    // A missed LAST free throw is a live rebound — previously these vanished,
    // costing the game several rebounds a night.
    if (made < shots) {
      const reb = grabRebound(off, def, rng)
      return {
        points: made, scorer: handler, kind: "ftonly", paint: atRim, fastBreak: false,
        secondChance: reb === "off",
      }
    }
    return {
      points: made, scorer: handler, kind: "ftonly", paint: atRim, fastBreak: false,
      secondChance: false,
    }
  }

  // Plain miss → rebound battle.
  const reb = grabRebound(off, def, rng)
  return {
    points: 0, kind: "miss", paint: atRim, fastBreak: false,
    secondChance: reb === "off",
  }
}

function pickCreator(off: SimTeam, handler: SimPlayer, rng: RNG): SimPlayer | null {
  const others = onCourtPlayers(off).filter((p) => p !== handler)
  if (others.length === 0) return null
  const weights = others.map((p) => Math.pow(A(p.owned.player).playmaking / 100, 2))
  const total = weights.reduce((s, w) => s + w, 0) || 1
  let r = rng() * total
  for (let i = 0; i < others.length; i++) {
    r -= weights[i]
    if (r <= 0) return others[i]
  }
  return others[0]
}

/**
 * Share of missed shots that never become an individual rebound — the ball goes
 * out of bounds or is scored as a team rebound. Without this every single miss
 * produced a credited board, pushing team rebounds well past NBA levels.
 */
const TEAM_REBOUND_RATE = 0.085

/** Award a rebound to a weighted-random contester; returns which side got it. */
function grabRebound(off: SimTeam, def: SimTeam, rng: RNG): "off" | "def" {
  const offReb = off.profile.rebounding * 0.36 // offensive rebounding is harder
  const defReb = def.profile.rebounding
  const offP = offReb / (offReb + defReb + 1)
  const offensive = rng() < offP
  const team = offensive ? off : def
  // Possession still changes hands, but nobody gets the box-score credit.
  if (rng() < TEAM_REBOUND_RATE) return offensive ? "off" : "def"
  const r = weightedPick(onCourtPlayers(team), (p) => reboundWeight(p, offensive), rng)
  if (r) { r.box.reb += 1; team.box.reb += 1 }
  return offensive ? "off" : "def"
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/** Single-pass max — cheaper than sort()[0] in the per-possession hot path. */
function maxBy<T>(arr: T[], score: (t: T) => number): T | undefined {
  let best: T | undefined
  let bestScore = -Infinity
  for (const item of arr) {
    const s = score(item)
    if (s > bestScore) { bestScore = s; best = item }
  }
  return best
}

/**
 * Weighted random pick. Credit for rebounds/steals/blocks MUST be probabilistic:
 * awarding them with maxBy() gave the single best rebounder on the floor every
 * board (one player finishing with 40+ boards while every guard finished with 0).
 */
function weightedPick<T>(arr: T[], weight: (t: T) => number, rng: RNG): T | undefined {
  if (arr.length === 0) return undefined
  let total = 0
  for (const item of arr) total += Math.max(0, weight(item))
  if (total <= 0) return arr[Math.floor(rng() * arr.length)]
  let r = rng() * total
  for (const item of arr) {
    r -= Math.max(0, weight(item))
    if (r <= 0) return item
  }
  return arr[arr.length - 1]
}

/**
 * How much a slot competes for rebounds. Bigs dominate the glass but guards are
 * never shut out — real NBA guards average 3-5 boards a game.
 */
const REB_SLOT_BIAS: Record<RosterSlot, number> = {
  PG: 0.6,
  SG: 0.7,
  SF: 0.95,
  PF: 1.2,
  C: 1.32,
  BENCH: 1.0,
}

/** Rebounding pull for one player: ability, shaped by position, with a floor. */
function reboundWeight(sp: SimPlayer, offensive: boolean): number {
  const a = A(sp.owned.player)
  // Exponent concentrates boards on real rebounders without monopolizing them.
  const ability = Math.pow(Math.max(1, a.rebounding) / 100, 1.55)
  const bias = REB_SLOT_BIAS[sp.owned.slot] ?? 1
  // Offensive boards skew harder to bigs crashing the glass.
  const orebTilt = offensive ? Math.pow(bias, 1.5) : bias
  const height = 0.75 + (a.strength / 100) * 0.25
  return ability * orebTilt * height * (0.55 + (sp.stamina / 100) * 0.45) + 0.05
}

// ─── Full game ─────────────────────────────────────────────────────────────

export function simulateGame(
  rosterP1: RosterState,
  rosterP2: RosterState,
  season: string,
  seed: number,
  edges: Record<TeamId, number> = { P1: 0, P2: 0 }
): GameResult {
  const rng = mulberry32(seed >>> 0)
  const p1 = buildSimTeam("P1", rosterP1, rosterP2, edges.P1)
  const p2 = buildSimTeam("P2", rosterP2, rosterP1, edges.P2)

  const quarters: QuarterScore[] = []
  const moments: GameMoment[] = []

  // Tip-off decides first possession.
  let offense: SimTeam = rng() < 0.5 ? p1 : p2

  for (let q = 1; q <= QUARTERS; q++) {
    const startP1 = p1.score
    const startP2 = p2.score
    let clockSeconds = QUARTER_SECONDS
    const perPoss = QUARTER_SECONDS / (POSSESSIONS_PER_QUARTER * 2)
    // True when the possession about to be played follows an offensive rebound,
    // so anything scored on it counts as second-chance points.
    let afterOffRebound = false

    for (let poss = 0; poss < POSSESSIONS_PER_QUARTER * 2; poss++) {
      const defense = offense === p1 ? p2 : p1
      const clutch = q === 4 && clockSeconds <= CLUTCH_CLOCK
      const transition = rng() < 0.14 + (offense.profile.transitionOffense - defense.profile.transitionDefense) / 900

      // Rotation & fatigue update roughly every few possessions.
      if (poss % 4 === 0) {
        manageRotation(offense, rng, clutch)
        manageRotation(defense, rng, clutch)
      }
      decayStamina(offense)
      decayStamina(defense)

      const res = simulatePossession(offense, defense, rng, clutch, transition)

      // Book team-level context stats. Points scored on a possession that BEGAN
      // with an offensive rebound are the second-chance points.
      if (afterOffRebound && res.points > 0) offense.box.secondChancePoints += res.points

      // Scoreboard ticks: record scoring plays so the live scoreboard climbs
      // smoothly. No play-by-play narration — just score/quarter progression.
      if (res.points > 0) {
        moments.push({
          quarter: q,
          clock: Math.max(0, Math.round(clockSeconds)),
          team: offense.team,
          p1Score: p1.score,
          p2Score: p2.score,
          big: !!(res.big || clutch),
        })
      }

      // Possession clock + minutes.
      clockSeconds -= perPoss * (transition ? 0.6 : 1)
      creditMinutes(offense, perPoss)
      creditMinutes(defense, perPoss)

      // Possession changes hands unless an offensive rebound kept it alive. This
      // covers missed FGs, blocked shots AND missed final free throws — anything
      // that produced an offensive board.
      const keptPossession = res.secondChance
      afterOffRebound = keptPossession
      if (!keptPossession) {
        offense = defense
      }
      if (clockSeconds <= 0) break
    }

    quarters.push({ quarter: q, p1: p1.score, p2: p2.score })
    // recovery between quarters
    for (const t of [p1, p2]) for (const pl of t.players) if (!pl.onCourt) pl.stamina = Math.min(A(pl.owned.player).stamina, pl.stamina + 12)
    void startP1; void startP2
  }

  // Overtime if tied. Basketball has no ties, so keep playing extra periods; the
  // cap only exists so a pathological seed can't loop forever.
  let otCount = 0
  while (p1.score === p2.score && otCount < 8) {
    otCount++
    const q = 4 + otCount
    let clockSeconds = 5 * 60
    const perPoss = (5 * 60) / (12 * 2)
    let afterOffRebound = false
    for (let poss = 0; poss < 24; poss++) {
      const defense = offense === p1 ? p2 : p1
      // Rotations still run in OT — previously whoever was on the floor at the
      // final buzzer of Q4 was locked in for every extra period.
      if (poss % 4 === 0) {
        manageRotation(offense, rng, true)
        manageRotation(defense, rng, true)
      }
      decayStamina(offense); decayStamina(defense)
      const res = simulatePossession(offense, defense, rng, true, rng() < 0.12)
      if (afterOffRebound && res.points > 0) offense.box.secondChancePoints += res.points
      if (res.points > 0) {
        moments.push({ quarter: q, clock: Math.max(0, Math.round(clockSeconds)), team: offense.team, p1Score: p1.score, p2Score: p2.score, big: true })
      }
      clockSeconds -= perPoss
      creditMinutes(offense, perPoss); creditMinutes(defense, perPoss)
      const keptPossession = res.secondChance
      afterOffRebound = keptPossession
      if (!keptPossession) offense = defense
      if (clockSeconds <= 0) break
    }
    quarters.push({ quarter: q, p1: p1.score, p2: p2.score })
  }
  // Guarantee a winner. Awarded as a real made free throw by the better team's
  // most clutch player so the headline score, the team box and the player lines
  // all still reconcile — bumping `score` alone left the box score one point off.
  if (p1.score === p2.score) {
    const winnerTeam = p1.profile.overall >= p2.profile.overall ? p1 : p2
    const hero =
      maxBy(onCourtPlayers(winnerTeam), (p) => A(p.owned.player).clutch) ??
      winnerTeam.players[0]
    winnerTeam.score += 1
    winnerTeam.box.points += 1
    winnerTeam.box.ftm += 1
    winnerTeam.box.fta += 1
    hero.box.pts += 1
    hero.box.ftm += 1
    hero.box.fta += 1
  }

  const winner: TeamId = p1.score > p2.score ? "P1" : "P2"

  const boxScore = [...p1.players, ...p2.players].map((p) => finalizeLine(p))
  const teamBox: Record<TeamId, TeamBox> = { P1: p1.box, P2: p2.box }

  const mvp = pickMVP([...p1.players, ...p2.players], winner)
  const topPerformers = pickTopPerformers([...p1.players, ...p2.players])

  return {
    season,
    winner,
    finalScore: { p1: p1.score, p2: p2.score },
    quarters,
    moments,
    boxScore,
    teamBox,
    mvp,
    topPerformers,
    matchupNotes: [], // filled by analyzer
    analysis: { P1: [], P2: [] }, // filled by analyzer
    teamComparison: {
      offense: { p1: Math.round(p1.profile.offense), p2: Math.round(p2.profile.offense) },
      defense: { p1: Math.round(p1.profile.defense), p2: Math.round(p2.profile.defense) },
      shooting: { p1: Math.round(p1.profile.spacing), p2: Math.round(p2.profile.spacing) },
      rebounding: { p1: Math.round(p1.profile.rebounding), p2: Math.round(p2.profile.rebounding) },
      playmaking: { p1: Math.round(p1.profile.playmaking), p2: Math.round(p2.profile.playmaking) },
      athleticism: { p1: Math.round(p1.profile.athleticism), p2: Math.round(p2.profile.athleticism) },
      bench: { p1: Math.round(p1.profile.benchStrength), p2: Math.round(p2.profile.benchStrength) },
      chemistry: { p1: Math.round(p1.profile.chemistry), p2: Math.round(p2.profile.chemistry) },
    },
  }
}

function decayStamina(t: SimTeam): void {
  for (const p of t.players) {
    if (p.onCourt) p.stamina = Math.max(35, p.stamina - 0.6)
    else p.stamina = Math.min(A(p.owned.player).stamina, p.stamina + 1.4)
  }
}

function creditMinutes(t: SimTeam, seconds: number): void {
  for (const p of onCourtPlayers(t)) p.box.min += seconds / 60
}

function finalizeLine(p: SimPlayer): PlayerBoxLine {
  return { ...p.box, min: Math.round(p.box.min) }
}

function scoreImpact(p: SimPlayer): number {
  const b = p.box
  return b.pts + b.reb * 1.2 + b.ast * 1.5 + b.stl * 2 + b.blk * 2 - b.tov * 1
}

function pickMVP(all: SimPlayer[], winner: TeamId): GameResult["mvp"] {
  // MVP heavily favors the winning team's best impact player.
  const ranked = all
    .map((p) => ({ p, s: scoreImpact(p) + (p.team === winner ? 8 : 0) }))
    .sort((a, b) => b.s - a.s)
  const top = ranked[0].p
  return { playerId: top.owned.player.id, name: top.owned.player.name, team: top.team }
}

function pickTopPerformers(all: SimPlayer[]): GameResult["topPerformers"] {
  return all
    .map((p) => ({ p, s: scoreImpact(p) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 4)
    .map(({ p }) => ({
      playerId: p.owned.player.id,
      name: p.owned.player.name,
      team: p.team,
      line: `${p.box.pts} PTS · ${p.box.reb} REB · ${p.box.ast} AST`,
    }))
}
