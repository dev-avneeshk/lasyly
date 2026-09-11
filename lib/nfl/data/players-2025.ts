/**
 * 2025 NFL player pool for the Auction "Drive to Win" mode.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DATA PROVENANCE / DISCLAIMER
 * ─────────────────────────────────────────────────────────────────────────────
 * These ratings are DESIGNER ESTIMATES intended to represent each player's
 * approximate ability for a game-balance model — NOT official statistics. No
 * number here should be presented as a real, verified NFL stat.
 *
 * To update for a new season, copy this file to `players-<season>.ts`, adjust
 * `SEASON` and the ratings, and register it in `./index.ts`. The engine reads
 * only the typed shape, so the data layer is fully replaceable.
 *
 * Ratings scale: 0-99. `overall` is a designer-weighted summary; the simulation
 * reads the individual attributes, so two equal-OVR players behave differently.
 */

import type { NflPlayer, PlayerAttributes, Position, PlayerTier } from "../types"

const SEASON = "2025"

/** Attribute defaults keep the data terse: we only specify what's notable. */
const BASE: PlayerAttributes = {
  armStrength: 40,
  shortAccuracy: 40,
  deepAccuracy: 40,
  pocketAwareness: 40,
  decisionMaking: 45,
  speed: 55,
  agility: 55,
  power: 50,
  vision: 45,
  catching: 45,
  routeRunning: 40,
  separation: 45,
  contestedCatch: 45,
  yac: 45,
  runBlock: 40,
  passBlock: 40,
  passRush: 35,
  runStop: 40,
  tackling: 45,
  strength: 55,
  coverage: 40,
  ballHawk: 40,
  awareness: 60,
  stamina: 80,
  consistency: 65,
  clutch: 60,
  mobility: 45,
}

interface RawPlayer {
  id: string
  name: string
  team: string
  position: Position
  overall: number
  tier: PlayerTier
  startingBid: number
  espnId?: number
  attr: Partial<PlayerAttributes>
  strengths: string[]
  weaknesses: string[]
}

const RAW: RawPlayer[] = [
  // ─── QB ─────────────────────────────────────────────────────────────────
  {
    id: "patrick-mahomes", name: "Patrick Mahomes", team: "Kansas City Chiefs",
    position: "QB", overall: 97, tier: 1, startingBid: 7, espnId: 3139477,
    attr: {
      armStrength: 97, shortAccuracy: 96, deepAccuracy: 94, pocketAwareness: 99,
      decisionMaking: 98, mobility: 90, clutch: 99, awareness: 98, consistency: 92,
    },
    strengths: ["elite under pressure", "improvisation", "deep throws", "late-game execution"],
    weaknesses: ["less designed-run value than elite dual-threats"],
  },
  {
    id: "josh-allen", name: "Josh Allen", team: "Buffalo Bills",
    position: "QB", overall: 95, tier: 1, startingBid: 7, espnId: 3918298,
    attr: {
      armStrength: 99, shortAccuracy: 88, deepAccuracy: 92, pocketAwareness: 86,
      decisionMaking: 86, mobility: 92, power: 88, clutch: 92, awareness: 88,
    },
    strengths: ["cannon arm", "goal-line rushing", "big-play upside"],
    weaknesses: ["turnover-prone when forcing throws"],
  },
  {
    id: "lamar-jackson", name: "Lamar Jackson", team: "Baltimore Ravens",
    position: "QB", overall: 95, tier: 1, startingBid: 7, espnId: 3916387,
    attr: {
      armStrength: 90, shortAccuracy: 90, deepAccuracy: 88, pocketAwareness: 84,
      decisionMaking: 90, mobility: 99, speed: 92, agility: 95, clutch: 88, awareness: 90,
    },
    strengths: ["elite dual-threat", "designed-run gravity", "explosive scrambles"],
    weaknesses: ["deep-ball touch varies", "durability risk as a runner"],
  },
  {
    id: "joe-burrow", name: "Joe Burrow", team: "Cincinnati Bengals",
    position: "QB", overall: 92, tier: 2, startingBid: 6, espnId: 3915511,
    attr: {
      armStrength: 88, shortAccuracy: 95, deepAccuracy: 90, pocketAwareness: 92,
      decisionMaking: 95, mobility: 62, clutch: 92, awareness: 94, consistency: 90,
    },
    strengths: ["surgical accuracy", "processing speed", "clutch"],
    weaknesses: ["limited mobility", "injury history behind poor protection"],
  },
  {
    id: "jalen-hurts", name: "Jalen Hurts", team: "Philadelphia Eagles",
    position: "QB", overall: 90, tier: 2, startingBid: 5, espnId: 4040715,
    attr: {
      armStrength: 84, shortAccuracy: 84, deepAccuracy: 84, pocketAwareness: 82,
      decisionMaking: 84, mobility: 90, power: 90, clutch: 88, awareness: 84,
    },
    strengths: ["short-yardage rushing", "balanced dual-threat", "poise"],
    weaknesses: ["can hold the ball too long"],
  },
  {
    id: "brock-purdy", name: "Brock Purdy", team: "San Francisco 49ers",
    position: "QB", overall: 86, tier: 3, startingBid: 3, espnId: 4361741,
    attr: {
      armStrength: 80, shortAccuracy: 90, deepAccuracy: 84, pocketAwareness: 84,
      decisionMaking: 88, mobility: 66, clutch: 82, awareness: 86,
    },
    strengths: ["quick game", "accuracy", "efficient decisions"],
    weaknesses: ["average arm", "leans on scheme + weapons"],
  },
  {
    id: "caleb-williams", name: "Caleb Williams", team: "Chicago Bears",
    position: "QB", overall: 83, tier: 3, startingBid: 3, espnId: 4431611,
    attr: {
      armStrength: 88, shortAccuracy: 80, deepAccuracy: 84, pocketAwareness: 76,
      decisionMaking: 76, mobility: 84, agility: 84, clutch: 78, consistency: 70,
    },
    strengths: ["arm talent", "off-platform creativity", "upside"],
    weaknesses: ["inconsistent processing", "takes sacks"],
  },

  // ─── RB ─────────────────────────────────────────────────────────────────
  {
    id: "christian-mccaffrey", name: "Christian McCaffrey", team: "San Francisco 49ers",
    position: "RB", overall: 94, tier: 1, startingBid: 6, espnId: 3117251,
    attr: {
      speed: 90, agility: 93, power: 80, vision: 95, catching: 92, routeRunning: 88,
      yac: 90, separation: 82, awareness: 92, stamina: 88, clutch: 88,
    },
    strengths: ["dual-threat back", "elite receiving", "vision"],
    weaknesses: ["heavy workload injury risk"],
  },
  {
    id: "saquon-barkley", name: "Saquon Barkley", team: "Philadelphia Eagles",
    position: "RB", overall: 93, tier: 1, startingBid: 6, espnId: 3929630,
    attr: {
      speed: 93, agility: 90, power: 88, vision: 88, catching: 82, yac: 92,
      contestedCatch: 70, awareness: 84, stamina: 88,
    },
    strengths: ["home-run speed", "explosive cuts", "goal-line power"],
    weaknesses: ["boom-or-bust runs behind weak lines"],
  },
  {
    id: "derrick-henry", name: "Derrick Henry", team: "Baltimore Ravens",
    position: "RB", overall: 91, tier: 2, startingBid: 5, espnId: 3043078,
    attr: {
      speed: 88, agility: 74, power: 99, vision: 84, catching: 55, yac: 90,
      strength: 95, awareness: 82, stamina: 90,
    },
    strengths: ["elite power", "breakaway speed for size", "closes games"],
    weaknesses: ["limited receiving", "less shifty in space"],
  },
  {
    id: "bijan-robinson", name: "Bijan Robinson", team: "Atlanta Falcons",
    position: "RB", overall: 89, tier: 2, startingBid: 4, espnId: 4430807,
    attr: {
      speed: 88, agility: 90, power: 82, vision: 86, catching: 84, routeRunning: 78,
      yac: 88, awareness: 82,
    },
    strengths: ["three-down skillset", "balance", "receiving upside"],
    weaknesses: ["still maximizing usage"],
  },
  {
    id: "jahmyr-gibbs", name: "Jahmyr Gibbs", team: "Detroit Lions",
    position: "RB", overall: 87, tier: 3, startingBid: 3, espnId: 4429795,
    attr: {
      speed: 95, agility: 92, power: 68, vision: 80, catching: 86, yac: 90, awareness: 78,
    },
    strengths: ["explosive speed", "receiving", "space back"],
    weaknesses: ["between-the-tackles power"],
  },
  {
    id: "kyren-williams", name: "Kyren Williams", team: "Los Angeles Rams",
    position: "RB", overall: 82, tier: 3, startingBid: 2, espnId: 4430737,
    attr: {
      speed: 82, agility: 82, power: 74, vision: 84, catching: 74, yac: 78, awareness: 80,
    },
    strengths: ["reliable volume back", "vision", "ball security"],
    weaknesses: ["not a true home-run threat"],
  },

  // ─── WR ─────────────────────────────────────────────────────────────────
  {
    id: "justin-jefferson", name: "Justin Jefferson", team: "Minnesota Vikings",
    position: "WR", overall: 96, tier: 1, startingBid: 6, espnId: 4262921,
    attr: {
      catching: 96, routeRunning: 97, separation: 95, contestedCatch: 92, speed: 90,
      yac: 88, awareness: 92, clutch: 92, consistency: 92,
    },
    strengths: ["elite separation", "contested catches", "route mastery"],
    weaknesses: ["can be bracketed if no #2 threat"],
  },
  {
    id: "ja-marr-chase", name: "Ja'Marr Chase", team: "Cincinnati Bengals",
    position: "WR", overall: 95, tier: 1, startingBid: 6, espnId: 4362628,
    attr: {
      catching: 92, routeRunning: 92, separation: 92, contestedCatch: 94, speed: 94,
      yac: 95, clutch: 90, awareness: 88,
    },
    strengths: ["YAC monster", "deep speed", "contested wins"],
    weaknesses: ["occasional concentration drops"],
  },
  {
    id: "ceedee-lamb", name: "CeeDee Lamb", team: "Dallas Cowboys",
    position: "WR", overall: 93, tier: 1, startingBid: 5, espnId: 4241389,
    attr: {
      catching: 92, routeRunning: 92, separation: 90, contestedCatch: 86, speed: 89,
      yac: 90, awareness: 88,
    },
    strengths: ["route nuance", "YAC", "volume target"],
    weaknesses: ["timing-dependent with QB play"],
  },
  {
    id: "amon-ra-st-brown", name: "Amon-Ra St. Brown", team: "Detroit Lions",
    position: "WR", overall: 90, tier: 2, startingBid: 4, espnId: 4374302,
    attr: {
      catching: 94, routeRunning: 93, separation: 90, contestedCatch: 80, speed: 84,
      yac: 84, awareness: 90, consistency: 92,
    },
    strengths: ["reliable hands", "underneath separation", "toughness"],
    weaknesses: ["not a pure deep burner"],
  },
  {
    id: "aj-brown", name: "A.J. Brown", team: "Philadelphia Eagles",
    position: "WR", overall: 91, tier: 2, startingBid: 4, espnId: 4047646,
    attr: {
      catching: 88, routeRunning: 86, separation: 82, contestedCatch: 95, speed: 88,
      yac: 90, power: 88, strength: 88,
    },
    strengths: ["physical dominance", "contested catches", "YAC power"],
    weaknesses: ["needs targets to stay engaged"],
  },
  {
    id: "tyreek-hill", name: "Tyreek Hill", team: "Miami Dolphins",
    position: "WR", overall: 91, tier: 2, startingBid: 5, espnId: 3116406,
    attr: {
      catching: 84, routeRunning: 86, separation: 94, contestedCatch: 72, speed: 99,
      yac: 96, clutch: 84,
    },
    strengths: ["field-tilting speed", "separation", "explosive YAC"],
    weaknesses: ["contested catching", "aging speed profile"],
  },
  {
    id: "puka-nacua", name: "Puka Nacua", team: "Los Angeles Rams",
    position: "WR", overall: 87, tier: 3, startingBid: 3, espnId: 4426875,
    attr: {
      catching: 88, routeRunning: 84, separation: 82, contestedCatch: 86, speed: 84, yac: 88,
    },
    strengths: ["physical route runner", "YAC", "reliable"],
    weaknesses: ["not elite deep speed"],
  },
  {
    id: "nico-collins", name: "Nico Collins", team: "Houston Texans",
    position: "WR", overall: 86, tier: 3, startingBid: 3, espnId: 4258173,
    attr: {
      catching: 86, routeRunning: 82, separation: 80, contestedCatch: 90, speed: 86, yac: 82,
    },
    strengths: ["size", "contested wins", "deep threat"],
    weaknesses: ["route tree still expanding"],
  },
  {
    id: "jaylen-waddle", name: "Jaylen Waddle", team: "Miami Dolphins",
    position: "WR", overall: 84, tier: 3, startingBid: 2, espnId: 4372016,
    attr: {
      catching: 82, routeRunning: 84, separation: 88, contestedCatch: 68, speed: 96, yac: 88,
    },
    strengths: ["speed", "separation", "YAC"],
    weaknesses: ["contested catching", "size"],
  },

  // ─── TE ─────────────────────────────────────────────────────────────────
  {
    id: "travis-kelce", name: "Travis Kelce", team: "Kansas City Chiefs",
    position: "TE", overall: 90, tier: 2, startingBid: 4, espnId: 15847,
    attr: {
      catching: 92, routeRunning: 94, separation: 84, contestedCatch: 82, speed: 76,
      yac: 82, runBlock: 62, passBlock: 66, awareness: 94, clutch: 92,
    },
    strengths: ["mismatch weapon", "route savvy", "clutch chains-mover"],
    weaknesses: ["blocking", "declining speed"],
  },
  {
    id: "george-kittle", name: "George Kittle", team: "San Francisco 49ers",
    position: "TE", overall: 90, tier: 2, startingBid: 4, espnId: 3040151,
    attr: {
      catching: 88, routeRunning: 84, separation: 80, contestedCatch: 84, speed: 82,
      yac: 94, runBlock: 88, passBlock: 82, power: 84, strength: 86,
    },
    strengths: ["elite YAC", "top blocking TE", "complete"],
    weaknesses: ["target share varies"],
  },
  {
    id: "sam-laporta", name: "Sam LaPorta", team: "Detroit Lions",
    position: "TE", overall: 85, tier: 3, startingBid: 3, espnId: 4430027,
    attr: {
      catching: 86, routeRunning: 84, separation: 82, contestedCatch: 78, speed: 80,
      yac: 82, runBlock: 66, passBlock: 66,
    },
    strengths: ["seam threat", "reliable hands", "athletic"],
    weaknesses: ["still developing as a blocker"],
  },
  {
    id: "trey-mcbride", name: "Trey McBride", team: "Arizona Cardinals",
    position: "TE", overall: 84, tier: 3, startingBid: 2, espnId: 4361307,
    attr: {
      catching: 88, routeRunning: 80, separation: 78, contestedCatch: 82, speed: 78,
      yac: 84, runBlock: 70, passBlock: 68,
    },
    strengths: ["volume receiver", "YAC", "toughness"],
    weaknesses: ["limited deep threat"],
  },
  {
    id: "dallas-goedert", name: "Dallas Goedert", team: "Philadelphia Eagles",
    position: "TE", overall: 82, tier: 4, startingBid: 2, espnId: 3121023,
    attr: {
      catching: 84, routeRunning: 78, separation: 74, contestedCatch: 80, speed: 76,
      yac: 84, runBlock: 78, passBlock: 76,
    },
    strengths: ["complete two-way TE", "YAC", "blocking"],
    weaknesses: ["injury history", "target competition"],
  },

  // ─── EDGE ─────────────────────────────────────────────────────────────────
  {
    id: "myles-garrett", name: "Myles Garrett", team: "Cleveland Browns",
    position: "EDGE", overall: 97, tier: 1, startingBid: 6, espnId: 3915511,
    attr: {
      passRush: 99, runStop: 88, tackling: 88, strength: 92, speed: 90, power: 92,
      awareness: 90, consistency: 92,
    },
    strengths: ["elite pass rush", "bend + power", "game-wrecker"],
    weaknesses: ["can be schemed away with quick game"],
  },
  {
    id: "micah-parsons", name: "Micah Parsons", team: "Dallas Cowboys",
    position: "EDGE", overall: 95, tier: 1, startingBid: 6, espnId: 4361423,
    attr: {
      passRush: 96, runStop: 82, tackling: 84, strength: 82, speed: 95, power: 84,
      coverage: 66, awareness: 86,
    },
    strengths: ["explosive first step", "versatility", "speed rush"],
    weaknesses: ["can be run at in the box"],
  },
  {
    id: "maxx-crosby", name: "Maxx Crosby", team: "Las Vegas Raiders",
    position: "EDGE", overall: 92, tier: 2, startingBid: 5, espnId: 4046668,
    attr: {
      passRush: 92, runStop: 90, tackling: 88, strength: 88, speed: 86, power: 88,
      awareness: 86, stamina: 90,
    },
    strengths: ["relentless motor", "run + pass", "high floor"],
    weaknesses: ["fewer elite bursts than pure speed rushers"],
  },
  {
    id: "nick-bosa", name: "Nick Bosa", team: "San Francisco 49ers",
    position: "EDGE", overall: 92, tier: 2, startingBid: 5, espnId: 3928380,
    attr: {
      passRush: 93, runStop: 86, tackling: 84, strength: 86, speed: 87, power: 88, awareness: 88,
    },
    strengths: ["hand technique", "consistent pressure", "run defense"],
    weaknesses: ["injury history"],
  },
  {
    id: "will-anderson", name: "Will Anderson Jr.", team: "Houston Texans",
    position: "EDGE", overall: 87, tier: 3, startingBid: 3, espnId: 4429084,
    attr: {
      passRush: 86, runStop: 84, tackling: 82, strength: 82, speed: 86, power: 82, awareness: 82,
    },
    strengths: ["polished rusher", "run + pass", "rising"],
    weaknesses: ["not yet elite production"],
  },

  // ─── LB ─────────────────────────────────────────────────────────────────
  {
    id: "fred-warner", name: "Fred Warner", team: "San Francisco 49ers",
    position: "LB", overall: 94, tier: 1, startingBid: 5, espnId: 3919596,
    attr: {
      runStop: 92, tackling: 94, coverage: 90, ballHawk: 82, speed: 84, awareness: 96,
      passRush: 62, consistency: 94,
    },
    strengths: ["elite coverage LB", "range", "diagnosis"],
    weaknesses: ["not a designed pass rusher"],
  },
  {
    id: "roquan-smith", name: "Roquan Smith", team: "Baltimore Ravens",
    position: "LB", overall: 90, tier: 2, startingBid: 4, espnId: 3915306,
    attr: {
      runStop: 90, tackling: 92, coverage: 84, ballHawk: 78, speed: 84, awareness: 90, passRush: 60,
    },
    strengths: ["sideline-to-sideline range", "tackling", "leadership"],
    weaknesses: ["can be exploited by elite TEs deep"],
  },
  {
    id: "patrick-queen", name: "Patrick Queen", team: "Pittsburgh Steelers",
    position: "LB", overall: 84, tier: 3, startingBid: 2, espnId: 4241463,
    attr: {
      runStop: 82, tackling: 84, coverage: 80, ballHawk: 72, speed: 84, awareness: 82, passRush: 58,
    },
    strengths: ["speed", "coverage range", "improving IQ"],
    weaknesses: ["can overrun plays"],
  },
  {
    id: "zaire-franklin", name: "Zaire Franklin", team: "Indianapolis Colts",
    position: "LB", overall: 82, tier: 4, startingBid: 2, espnId: 3915285,
    attr: {
      runStop: 84, tackling: 86, coverage: 74, ballHawk: 68, speed: 80, awareness: 82, passRush: 56,
    },
    strengths: ["tackling volume", "run defense", "durable"],
    weaknesses: ["coverage limitations"],
  },

  // ─── CB ─────────────────────────────────────────────────────────────────
  {
    id: "patrick-surtain", name: "Patrick Surtain II", team: "Denver Broncos",
    position: "CB", overall: 95, tier: 1, startingBid: 5, espnId: 4361050,
    attr: {
      coverage: 96, ballHawk: 86, speed: 90, agility: 90, tackling: 82, awareness: 92, consistency: 94,
    },
    strengths: ["shutdown man coverage", "size + speed", "locks a side"],
    weaknesses: ["few splash INTs by design"],
  },
  {
    id: "sauce-gardner", name: "Sauce Gardner", team: "New York Jets",
    position: "CB", overall: 92, tier: 2, startingBid: 4, espnId: 4426502,
    attr: {
      coverage: 94, ballHawk: 80, speed: 90, agility: 88, tackling: 78, awareness: 88,
    },
    strengths: ["length", "press coverage", "erases WR1s"],
    weaknesses: ["gambles occasionally"],
  },
  {
    id: "derek-stingley", name: "Derek Stingley Jr.", team: "Houston Texans",
    position: "CB", overall: 88, tier: 3, startingBid: 3, espnId: 4429971,
    attr: {
      coverage: 88, ballHawk: 88, speed: 92, agility: 88, tackling: 74, awareness: 82,
    },
    strengths: ["ballhawk", "recovery speed", "playmaking"],
    weaknesses: ["run support", "durability"],
  },
  {
    id: "devon-witherspoon", name: "Devon Witherspoon", team: "Seattle Seahawks",
    position: "CB", overall: 86, tier: 3, startingBid: 3, espnId: 4567048,
    attr: {
      coverage: 84, ballHawk: 78, speed: 88, agility: 86, tackling: 86, awareness: 84, passRush: 70,
    },
    strengths: ["versatility", "blitzing", "physical"],
    weaknesses: ["can be grabby"],
  },

  // ─── S ──────────────────────────────────────────────────────────────────
  {
    id: "minkah-fitzpatrick", name: "Minkah Fitzpatrick", team: "Pittsburgh Steelers",
    position: "S", overall: 91, tier: 2, startingBid: 4, espnId: 3126486,
    attr: {
      coverage: 90, ballHawk: 92, speed: 88, tackling: 82, runStop: 78, awareness: 92,
    },
    strengths: ["range", "ballhawk", "single-high coverage"],
    weaknesses: ["run fits in the box"],
  },
  {
    id: "antoine-winfield", name: "Antoine Winfield Jr.", team: "Tampa Bay Buccaneers",
    position: "S", overall: 90, tier: 2, startingBid: 4, espnId: 4240069,
    attr: {
      coverage: 86, ballHawk: 84, speed: 86, tackling: 90, runStop: 86, awareness: 90, passRush: 74,
    },
    strengths: ["do-it-all safety", "blitz", "run + pass"],
    weaknesses: ["deep-half range vs burners"],
  },
  {
    id: "budda-baker", name: "Budda Baker", team: "Arizona Cardinals",
    position: "S", overall: 87, tier: 3, startingBid: 3, espnId: 3116365,
    attr: {
      coverage: 82, ballHawk: 78, speed: 88, tackling: 90, runStop: 86, awareness: 88,
    },
    strengths: ["tackling machine", "range", "run support"],
    weaknesses: ["size in the box"],
  },
  {
    id: "kyle-hamilton", name: "Kyle Hamilton", team: "Baltimore Ravens",
    position: "S", overall: 89, tier: 3, startingBid: 3, espnId: 4430197,
    attr: {
      coverage: 86, ballHawk: 84, speed: 84, tackling: 88, runStop: 88, awareness: 90, passRush: 76,
    },
    strengths: ["versatile chess piece", "size", "blitz + coverage"],
    weaknesses: ["pure deep speed vs elite WRs"],
  },
]

function toPlayer(r: RawPlayer): NflPlayer {
  return {
    id: r.id,
    name: r.name,
    team: r.team,
    season: SEASON,
    position: r.position,
    overall: r.overall,
    tier: r.tier,
    startingBid: r.startingBid,
    espnId: r.espnId,
    attributes: { ...BASE, ...r.attr },
    strengths: r.strengths,
    weaknesses: r.weaknesses,
  }
}

export const PLAYERS_2025: NflPlayer[] = RAW.map(toPlayer)
