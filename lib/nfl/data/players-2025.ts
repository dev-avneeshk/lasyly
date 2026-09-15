/**
 * 2025 NFL player pool for the Auction "Drive to Win" mode — FULL POOL (generated).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * GENERATED FILE — DO NOT HAND-EDIT.
 * ─────────────────────────────────────────────────────────────────────────────
 * Produced by scripts/generate-nfl-players.ts from real NFL box-score stats
 * (nfl_player_stats) run through the attribute deriver in ./derive-attributes.ts,
 * with hand-reviewed corrections from ./overrides.ts applied on top. To change a
 * rating permanently, edit ./overrides.ts (NOT this file) and regenerate:
 *
 *     npx tsx scripts/generate-nfl-players.ts
 *
 * Ratings are DESIGNER ESTIMATES derived from production stats — a game-balance
 * model, not official statistics. Attributes are on a 0-99 scale.
 */

import type { NflPlayer, PlayerAttributes, Position, PlayerTier } from "../types"

const SEASON = "2025"

const BASE: PlayerAttributes = {
  armStrength: 40, shortAccuracy: 40, deepAccuracy: 40, pocketAwareness: 40, decisionMaking: 45,
  speed: 55, agility: 55, power: 50, vision: 45,
  catching: 45, routeRunning: 40, separation: 45, contestedCatch: 45, yac: 45,
  runBlock: 40, passBlock: 40, passRush: 35, runStop: 40, tackling: 45, strength: 55,
  coverage: 40, ballHawk: 40, awareness: 60, stamina: 80, consistency: 65, clutch: 60, mobility: 45,
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
  {
    id: "myles-garrett", name: "Myles Garrett", team: "CLE",
    position: "EDGE", overall: 94, tier: 1, startingBid: 7, espnId: 3122132,
    attr: {
      speed: 90, power: 92, passRush: 97, runStop: 92, tackling: 65, strength: 90,
    },
    strengths: ["pass rush","run defense","power"],
    weaknesses: [],
  },
  {
    id: "aidan-hutchinson", name: "Aidan Hutchinson", team: "DET",
    position: "EDGE", overall: 90, tier: 1, startingBid: 7, espnId: 4372099,
    attr: {
      speed: 90, power: 89, passRush: 97, runStop: 77, tackling: 65, strength: 80,
    },
    strengths: ["pass rush","speed","power"],
    weaknesses: [],
  },
  {
    id: "jahmyr-gibbs", name: "Jahmyr Gibbs", team: "DET",
    position: "RB", overall: 90, tier: 1, startingBid: 7, espnId: 4429795,
    attr: {
      speed: 95, agility: 92, power: 84, vision: 93, catching: 83, yac: 92, clutch: 88,
    },
    strengths: ["speed","vision","agility"],
    weaknesses: [],
  },
  {
    id: "puka-nacua", name: "Puka Nacua", team: "LAR",
    position: "WR", overall: 90, tier: 1, startingBid: 7, espnId: 4426515,
    attr: {
      speed: 82, catching: 88, routeRunning: 94, separation: 95, contestedCatch: 87, yac: 85, clutch: 69,
    },
    strengths: ["separation","route running","hands"],
    weaknesses: [],
  },
  {
    id: "derrick-henry", name: "Derrick Henry", team: "BAL",
    position: "RB", overall: 88, tier: 1, startingBid: 7, espnId: 3043078,
    attr: {
      speed: 95, agility: 92, power: 92, vision: 93, catching: 51, yac: 92, clutch: 88,
    },
    strengths: ["speed","vision","power"],
    weaknesses: ["hands"],
  },
  {
    id: "jaxon-smith-njigba", name: "Jaxon Smith-Njigba", team: "SEA",
    position: "WR", overall: 88, tier: 1, startingBid: 7, espnId: 4430878,
    attr: {
      speed: 84, catching: 89, routeRunning: 91, separation: 89, contestedCatch: 88, yac: 86, clutch: 73,
    },
    strengths: ["route running","hands","separation"],
    weaknesses: [],
  },
  {
    id: "will-anderson-jr", name: "Will Anderson Jr.", team: "HOU",
    position: "EDGE", overall: 88, tier: 1, startingBid: 7, espnId: 4685724,
    attr: {
      speed: 84, power: 89, passRush: 90, runStop: 84, tackling: 61, strength: 87,
    },
    strengths: ["pass rush","power","strength"],
    weaknesses: [],
  },
  {
    id: "bijan-robinson", name: "Bijan Robinson", team: "ATL",
    position: "RB", overall: 87, tier: 2, startingBid: 5, espnId: 4430807,
    attr: {
      speed: 88, agility: 85, power: 87, vision: 91, catching: 88, yac: 80, clutch: 77,
    },
    strengths: ["vision","speed","hands"],
    weaknesses: [],
  },
  {
    id: "devon-achane", name: "De'Von Achane", team: "MIA",
    position: "RB", overall: 87, tier: 2, startingBid: 5, espnId: 4429160,
    attr: {
      speed: 92, agility: 89, power: 77, vision: 93, catching: 81, yac: 83, clutch: 74,
    },
    strengths: ["vision","speed","agility"],
    weaknesses: [],
  },
  {
    id: "saquon-barkley", name: "Saquon Barkley", team: "PHI",
    position: "RB", overall: 87, tier: 2, startingBid: 5, espnId: 3929630,
    attr: {
      speed: 92, agility: 88, power: 92, vision: 93, catching: 60, yac: 83, clutch: 77,
    },
    strengths: ["vision","speed","power"],
    weaknesses: [],
  },
  {
    id: "jamarr-chase", name: "Ja'Marr Chase", team: "CIN",
    position: "WR", overall: 86, tier: 2, startingBid: 5, espnId: 4362628,
    attr: {
      speed: 77, catching: 83, routeRunning: 94, separation: 93, contestedCatch: 83, yac: 78, clutch: 88,
    },
    strengths: ["route running","separation","clutch"],
    weaknesses: [],
  },
  {
    id: "mike-jackson", name: "Mike Jackson", team: "CAR",
    position: "CB", overall: 86, tier: 2, startingBid: 5, espnId: 3917853,
    attr: {
      speed: 89, agility: 90, tackling: 68, coverage: 88, ballHawk: 76,
    },
    strengths: ["agility","speed","coverage"],
    weaknesses: [],
  },
  {
    id: "derek-stingley-jr", name: "Derek Stingley Jr.", team: "HOU",
    position: "CB", overall: 85, tier: 2, startingBid: 5, espnId: 4426434,
    attr: {
      speed: 87, agility: 88, tackling: 54, coverage: 85, ballHawk: 81,
    },
    strengths: ["agility","speed","coverage"],
    weaknesses: ["tackling"],
  },
  {
    id: "james-cook-iii", name: "James Cook III", team: "BUF",
    position: "RB", overall: 85, tier: 2, startingBid: 5, espnId: 4379399,
    attr: {
      speed: 91, agility: 87, power: 84, vision: 93, catching: 60, yac: 82, clutch: 83,
    },
    strengths: ["vision","speed","agility"],
    weaknesses: [],
  },
  {
    id: "lamar-jackson", name: "Lamar Jackson", team: "BAL",
    position: "QB", overall: 85, tier: 2, startingBid: 5, espnId: 3916387,
    attr: {
      armStrength: 89, shortAccuracy: 72, deepAccuracy: 91, pocketAwareness: 85, decisionMaking: 91, consistency: 73, clutch: 85, mobility: 89,
    },
    strengths: ["deep ball","decision-making","arm strength"],
    weaknesses: [],
  },
  {
    id: "micah-parsons", name: "Micah Parsons", team: "GB",
    position: "EDGE", overall: 85, tier: 2, startingBid: 5, espnId: 4361423,
    attr: {
      speed: 86, power: 83, passRush: 92, runStop: 72, tackling: 62, strength: 76,
    },
    strengths: ["pass rush","speed","power"],
    weaknesses: [],
  },
  {
    id: "maxx-crosby", name: "Maxx Crosby", team: "LV",
    position: "EDGE", overall: 84, tier: 2, startingBid: 5, espnId: 3916655,
    attr: {
      speed: 76, power: 92, passRush: 80, runStop: 92, tackling: 75, strength: 90,
    },
    strengths: ["run defense","power","strength"],
    weaknesses: [],
  },
  {
    id: "nico-collins", name: "Nico Collins", team: "HOU",
    position: "WR", overall: 84, tier: 2, startingBid: 5, espnId: 4258173,
    attr: {
      speed: 95, catching: 70, routeRunning: 86, separation: 84, contestedCatch: 69, yac: 92, clutch: 72,
    },
    strengths: ["speed","yards after catch","route running"],
    weaknesses: [],
  },
  {
    id: "amon-ra-st-brown", name: "Amon-Ra St. Brown", team: "DET",
    position: "WR", overall: 83, tier: 2, startingBid: 5, espnId: 4374302,
    attr: {
      speed: 71, catching: 93, routeRunning: 87, separation: 85, contestedCatch: 88, yac: 71, clutch: 88,
    },
    strengths: ["hands","contested catch","clutch"],
    weaknesses: [],
  },
  {
    id: "blake-cashman", name: "Blake Cashman", team: "MIN",
    position: "LB", overall: 83, tier: 2, startingBid: 5, espnId: 3728281,
    attr: {
      speed: 85, passRush: 59, runStop: 94, tackling: 96, coverage: 53, ballHawk: 49, awareness: 90,
    },
    strengths: ["tackling","run defense","speed"],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "danielle-hunter", name: "Danielle Hunter", team: "HOU",
    position: "EDGE", overall: 83, tier: 2, startingBid: 5, espnId: 2976560,
    attr: {
      speed: 82, power: 82, passRush: 87, runStop: 74, tackling: 61, strength: 77,
    },
    strengths: ["pass rush","power","speed"],
    weaknesses: [],
  },
  {
    id: "george-pickens", name: "George Pickens", team: "DAL",
    position: "WR", overall: 83, tier: 2, startingBid: 5, espnId: 4426354,
    attr: {
      speed: 95, catching: 70, routeRunning: 83, separation: 81, contestedCatch: 69, yac: 92, clutch: 65,
    },
    strengths: ["speed","yards after catch","route running"],
    weaknesses: [],
  },
  {
    id: "jonathan-taylor", name: "Jonathan Taylor", team: "IND",
    position: "RB", overall: 83, tier: 2, startingBid: 5, espnId: 4242335,
    attr: {
      speed: 86, agility: 82, power: 92, vision: 88, catching: 60, yac: 77, clutch: 88,
    },
    strengths: ["power","vision","clutch"],
    weaknesses: [],
  },
  {
    id: "zay-flowers", name: "Zay Flowers", team: "BAL",
    position: "WR", overall: 83, tier: 2, startingBid: 5, espnId: 4429615,
    attr: {
      speed: 93, catching: 81, routeRunning: 79, separation: 78, contestedCatch: 80, yac: 92, clutch: 57,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: [],
  },
  {
    id: "jamien-sherwood", name: "Jamien Sherwood", team: "NYJ",
    position: "LB", overall: 82, tier: 2, startingBid: 5, espnId: 4361331,
    attr: {
      speed: 85, passRush: 46, runStop: 91, tackling: 96, coverage: 51, ballHawk: 48, awareness: 90,
    },
    strengths: ["tackling","run defense","speed"],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "jared-goff", name: "Jared Goff", team: "DET",
    position: "QB", overall: 82, tier: 2, startingBid: 5, espnId: 3046779,
    attr: {
      armStrength: 87, shortAccuracy: 87, deepAccuracy: 85, pocketAwareness: 83, decisionMaking: 89, consistency: 87, clutch: 88, mobility: 45,
    },
    strengths: ["decision-making","clutch","short accuracy"],
    weaknesses: ["mobility"],
  },
  {
    id: "jordyn-brooks", name: "Jordyn Brooks", team: "MIA",
    position: "LB", overall: 82, tier: 2, startingBid: 5, espnId: 4043130,
    attr: {
      speed: 85, passRush: 52, runStop: 94, tackling: 96, coverage: 48, ballHawk: 47, awareness: 90,
    },
    strengths: ["tackling","run defense","speed"],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "josh-allen", name: "Josh Allen", team: "BUF",
    position: "QB", overall: 82, tier: 2, startingBid: 5, espnId: 3918298,
    attr: {
      armStrength: 82, shortAccuracy: 78, deepAccuracy: 81, pocketAwareness: 86, decisionMaking: 86, consistency: 79, clutch: 84, mobility: 83,
    },
    strengths: ["pocket presence","decision-making","clutch"],
    weaknesses: [],
  },
  {
    id: "alex-singleton", name: "Alex Singleton", team: "DEN",
    position: "LB", overall: 81, tier: 2, startingBid: 5, espnId: 2612151,
    attr: {
      speed: 85, passRush: 45, runStop: 91, tackling: 96, coverage: 46, ballHawk: 48, awareness: 90,
    },
    strengths: ["tackling","run defense","speed"],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "carson-schwesinger", name: "Carson Schwesinger", team: "CLE",
    position: "LB", overall: 81, tier: 2, startingBid: 5, espnId: 4876017,
    attr: {
      speed: 85, passRush: 49, runStop: 94, tackling: 96, coverage: 45, ballHawk: 51, awareness: 90,
    },
    strengths: ["tackling","run defense","speed"],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "ceedee-lamb", name: "CeeDee Lamb", team: "DAL",
    position: "WR", overall: 81, tier: 2, startingBid: 5, espnId: 4241389,
    attr: {
      speed: 80, catching: 73, routeRunning: 87, separation: 85, contestedCatch: 72, yac: 82, clutch: 61,
    },
    strengths: ["route running","separation","yards after catch"],
    weaknesses: [],
  },
  {
    id: "dameon-pierce", name: "Dameon Pierce", team: "KC",
    position: "RB", overall: 81, tier: 2, startingBid: 5, espnId: 4360238,
    attr: {
      speed: 95, agility: 92, power: 55, vision: 93, catching: 45, yac: 92, clutch: 50,
    },
    strengths: ["speed","vision","agility"],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "deejay-dallas", name: "DeeJay Dallas", team: "MIN",
    position: "RB", overall: 81, tier: 2, startingBid: 5, espnId: 4240631,
    attr: {
      speed: 95, agility: 92, power: 55, vision: 93, catching: 45, yac: 92, clutch: 50,
    },
    strengths: ["speed","vision","agility"],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "emari-demercado", name: "Emari Demercado", team: "DAL",
    position: "RB", overall: 81, tier: 2, startingBid: 5, espnId: 4362478,
    attr: {
      speed: 95, agility: 92, power: 55, vision: 93, catching: 49, yac: 92, clutch: 50,
    },
    strengths: ["speed","vision","agility"],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "foyesade-oluokun", name: "Foyesade Oluokun", team: "JAX",
    position: "LB", overall: 81, tier: 2, startingBid: 5, espnId: 3050073,
    attr: {
      speed: 79, passRush: 45, runStop: 84, tackling: 89, coverage: 66, ballHawk: 62, awareness: 87,
    },
    strengths: ["tackling","run defense"],
    weaknesses: ["pass rush"],
  },
  {
    id: "isaiah-davis", name: "Isaiah Davis", team: "NYJ",
    position: "RB", overall: 81, tier: 2, startingBid: 5, espnId: 4695404,
    attr: {
      speed: 95, agility: 92, power: 55, vision: 93, catching: 50, yac: 92, clutch: 50,
    },
    strengths: ["speed","vision","agility"],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "jack-campbell", name: "Jack Campbell", team: "DET",
    position: "LB", overall: 81, tier: 2, startingBid: 5, espnId: 4569465,
    attr: {
      speed: 85, passRush: 51, runStop: 91, tackling: 96, coverage: 48, ballHawk: 46, awareness: 90,
    },
    strengths: ["tackling","run defense","speed"],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "jacob-saylors", name: "Jacob Saylors", team: "DET",
    position: "RB", overall: 81, tier: 2, startingBid: 5, espnId: 4383429,
    attr: {
      speed: 95, agility: 92, power: 55, vision: 93, catching: 45, yac: 92, clutch: 50,
    },
    strengths: ["speed","vision","agility"],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "joe-burrow", name: "Joe Burrow", team: "CIN",
    position: "QB", overall: 81, tier: 2, startingBid: 5, espnId: 3915511,
    attr: {
      armStrength: 73, shortAccuracy: 87, deepAccuracy: 70, pocketAwareness: 86, decisionMaking: 94, consistency: 87, clutch: 88, mobility: 53,
    },
    strengths: ["decision-making","clutch","short accuracy"],
    weaknesses: ["mobility"],
  },
  {
    id: "justin-jefferson", name: "Justin Jefferson", team: "MIN",
    position: "WR", overall: 81, tier: 2, startingBid: 5, espnId: 4262921,
    attr: {
      speed: 86, catching: 70, routeRunning: 84, separation: 82, contestedCatch: 69, yac: 89, clutch: 64,
    },
    strengths: ["yards after catch","speed","route running"],
    weaknesses: [],
  },
  {
    id: "kamari-lassiter", name: "Kamari Lassiter", team: "HOU",
    position: "CB", overall: 81, tier: 2, startingBid: 5, espnId: 4602699,
    attr: {
      speed: 83, agility: 84, tackling: 75, coverage: 82, ballHawk: 75,
    },
    strengths: ["agility","speed","coverage"],
    weaknesses: [],
  },
  {
    id: "nick-bosa", name: "Nick Bosa", team: "SF",
    position: "EDGE", overall: 81, tier: 2, startingBid: 5, espnId: 4040605,
    attr: {
      speed: 75, power: 85, passRush: 78, runStop: 86, tackling: 75, strength: 88,
    },
    strengths: ["strength","run defense","power"],
    weaknesses: [],
  },
  {
    id: "roquan-smith", name: "Roquan Smith", team: "BAL",
    position: "LB", overall: 81, tier: 2, startingBid: 5, espnId: 3915189,
    attr: {
      speed: 85, passRush: 45, runStop: 90, tackling: 96, coverage: 47, ballHawk: 49, awareness: 90,
    },
    strengths: ["tackling","run defense","speed"],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "tyler-badie", name: "Tyler Badie", team: "DEN",
    position: "RB", overall: 81, tier: 2, startingBid: 5, espnId: 4362748,
    attr: {
      speed: 95, agility: 92, power: 55, vision: 93, catching: 47, yac: 92, clutch: 50,
    },
    strengths: ["speed","vision","agility"],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "zack-baun", name: "Zack Baun", team: "PHI",
    position: "LB", overall: 81, tier: 2, startingBid: 5, espnId: 3917657,
    attr: {
      speed: 82, passRush: 52, runStop: 88, tackling: 92, coverage: 57, ballHawk: 59, awareness: 90,
    },
    strengths: ["tackling","run defense","speed"],
    weaknesses: ["pass rush"],
  },
  {
    id: "aj-brown", name: "A.J. Brown", team: "NE",
    position: "WR", overall: 80, tier: 3, startingBid: 3, espnId: 4047646,
    attr: {
      speed: 89, catching: 72, routeRunning: 78, separation: 77, contestedCatch: 71, yac: 92, clutch: 71,
    },
    strengths: ["yards after catch","speed"],
    weaknesses: [],
  },
  {
    id: "brian-branch", name: "Brian Branch", team: "DET",
    position: "S", overall: 80, tier: 3, startingBid: 3, espnId: 4692025,
    attr: {
      speed: 82, passRush: 48, runStop: 83, tackling: 89, coverage: 80, ballHawk: 68,
    },
    strengths: ["tackling","run defense","speed"],
    weaknesses: ["pass rush"],
  },
  {
    id: "cedric-gray", name: "Cedric Gray", team: "TEN",
    position: "LB", overall: 80, tier: 3, startingBid: 3, espnId: 4429834,
    attr: {
      speed: 84, passRush: 45, runStop: 89, tackling: 95, coverage: 45, ballHawk: 45, awareness: 90,
    },
    strengths: ["tackling","run defense","speed"],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "ernest-jones-iv", name: "Ernest Jones IV", team: "SEA",
    position: "LB", overall: 80, tier: 3, startingBid: 3, espnId: 4362851,
    attr: {
      speed: 82, passRush: 45, runStop: 87, tackling: 93, coverage: 53, ballHawk: 61, awareness: 90,
    },
    strengths: ["tackling","run defense","speed"],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "ladd-mcconkey", name: "Ladd McConkey", team: "LAC",
    position: "WR", overall: 80, tier: 3, startingBid: 3, espnId: 4612826,
    attr: {
      speed: 86, catching: 79, routeRunning: 76, separation: 74, contestedCatch: 78, yac: 89, clutch: 67,
    },
    strengths: ["yards after catch","speed"],
    weaknesses: [],
  },
  {
    id: "zaire-franklin", name: "Zaire Franklin", team: "GB",
    position: "LB", overall: 80, tier: 3, startingBid: 3, espnId: 3124005,
    attr: {
      speed: 82, passRush: 50, runStop: 88, tackling: 93, coverage: 51, ballHawk: 52, awareness: 90,
    },
    strengths: ["tackling","run defense","speed"],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "demario-davis", name: "Demario Davis", team: "NYJ",
    position: "LB", overall: 79, tier: 3, startingBid: 3, espnId: 14958,
    attr: {
      speed: 81, passRush: 45, runStop: 86, tackling: 91, coverage: 52, ballHawk: 50, awareness: 90,
    },
    strengths: ["tackling","run defense"],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "dj-turner-ii", name: "DJ Turner II", team: "CIN",
    position: "CB", overall: 79, tier: 3, startingBid: 3, espnId: 4572036,
    attr: {
      speed: 83, agility: 84, tackling: 52, coverage: 81, ballHawk: 66,
    },
    strengths: ["agility","speed"],
    weaknesses: ["tackling"],
  },
  {
    id: "drake-maye", name: "Drake Maye", team: "NE",
    position: "QB", overall: 79, tier: 3, startingBid: 3, espnId: 4431452,
    attr: {
      armStrength: 80, shortAccuracy: 82, deepAccuracy: 78, pocketAwareness: 77, decisionMaking: 76, consistency: 82, clutch: 81, mobility: 78,
    },
    strengths: ["short accuracy"],
    weaknesses: [],
  },
  {
    id: "george-kittle", name: "George Kittle", team: "SF",
    position: "TE", overall: 79, tier: 3, startingBid: 3, espnId: 3040151,
    attr: {
      speed: 80, catching: 95, routeRunning: 75, separation: 73, contestedCatch: 88, yac: 81, runBlock: 62, passBlock: 60, clutch: 76,
    },
    strengths: ["hands","contested catch"],
    weaknesses: [],
  },
  {
    id: "jalen-coker", name: "Jalen Coker", team: "CAR",
    position: "WR", overall: 79, tier: 3, startingBid: 3, espnId: 4695883,
    attr: {
      speed: 88, catching: 94, routeRunning: 64, separation: 63, contestedCatch: 88, yac: 92, clutch: 60,
    },
    strengths: ["hands","yards after catch","speed"],
    weaknesses: [],
  },
  {
    id: "jalen-hurts", name: "Jalen Hurts", team: "PHI",
    position: "QB", overall: 79, tier: 3, startingBid: 3, espnId: 4040715,
    attr: {
      armStrength: 73, shortAccuracy: 74, deepAccuracy: 71, pocketAwareness: 87, decisionMaking: 85, consistency: 75, clutch: 80, mobility: 81,
    },
    strengths: ["pocket presence","decision-making"],
    weaknesses: [],
  },
  {
    id: "jerome-ford", name: "Jerome Ford", team: "CLE",
    position: "RB", overall: 79, tier: 3, startingBid: 3, espnId: 4372019,
    attr: {
      speed: 90, agility: 86, power: 55, vision: 93, catching: 54, yac: 81, clutch: 50,
    },
    strengths: ["vision","speed","agility"],
    weaknesses: ["clutch","hands"],
  },
  {
    id: "jordan-mason", name: "Jordan Mason", team: "MIN",
    position: "RB", overall: 79, tier: 3, startingBid: 3, espnId: 4360569,
    attr: {
      speed: 88, agility: 84, power: 71, vision: 90, catching: 45, yac: 79, clutch: 57,
    },
    strengths: ["vision","speed","agility"],
    weaknesses: ["hands"],
  },
  {
    id: "quay-walker", name: "Quay Walker", team: "LV",
    position: "LB", overall: 79, tier: 3, startingBid: 3, espnId: 4379416,
    attr: {
      speed: 80, passRush: 50, runStop: 87, tackling: 91, coverage: 50, ballHawk: 48, awareness: 89,
    },
    strengths: ["tackling","run defense"],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "terry-mclaurin", name: "Terry McLaurin", team: "WSH",
    position: "WR", overall: 79, tier: 3, startingBid: 3, espnId: 3121422,
    attr: {
      speed: 89, catching: 76, routeRunning: 74, separation: 73, contestedCatch: 75, yac: 92, clutch: 81,
    },
    strengths: ["yards after catch","speed"],
    weaknesses: [],
  },
  {
    id: "andrew-beck", name: "Andrew Beck", team: "NYJ",
    position: "RB", overall: 78, tier: 3, startingBid: 3, espnId: 3125107,
    attr: {
      speed: 90, agility: 87, power: 55, vision: 93, catching: 45, yac: 82, clutch: 50,
    },
    strengths: ["vision","speed","agility"],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "baker-mayfield", name: "Baker Mayfield", team: "TB",
    position: "QB", overall: 78, tier: 3, startingBid: 3, espnId: 3052587,
    attr: {
      armStrength: 73, shortAccuracy: 81, deepAccuracy: 71, pocketAwareness: 80, decisionMaking: 84, consistency: 82, clutch: 88, mobility: 68,
    },
    strengths: ["clutch","decision-making"],
    weaknesses: [],
  },
  {
    id: "chris-olave", name: "Chris Olave", team: "NO",
    position: "WR", overall: 78, tier: 3, startingBid: 3, espnId: 4361370,
    attr: {
      speed: 77, catching: 76, routeRunning: 80, separation: 78, contestedCatch: 75, yac: 78, clutch: 65,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "daiyan-henley", name: "Daiyan Henley", team: "LAC",
    position: "LB", overall: 78, tier: 3, startingBid: 3, espnId: 4241597,
    attr: {
      speed: 78, passRush: 48, runStop: 83, tackling: 88, coverage: 56, ballHawk: 57, awareness: 86,
    },
    strengths: ["tackling","run defense"],
    weaknesses: ["pass rush"],
  },
  {
    id: "devonta-smith", name: "DeVonta Smith", team: "PHI",
    position: "WR", overall: 78, tier: 3, startingBid: 3, espnId: 4241478,
    attr: {
      speed: 78, catching: 90, routeRunning: 73, separation: 71, contestedCatch: 88, yac: 80, clutch: 62,
    },
    strengths: ["hands","contested catch"],
    weaknesses: [],
  },
  {
    id: "drake-london", name: "Drake London", team: "ATL",
    position: "WR", overall: 78, tier: 3, startingBid: 3, espnId: 4426502,
    attr: {
      speed: 82, catching: 66, routeRunning: 83, separation: 81, contestedCatch: 65, yac: 84, clutch: 75,
    },
    strengths: ["yards after catch","route running","speed"],
    weaknesses: [],
  },
  {
    id: "fred-warner", name: "Fred Warner", team: "SF",
    position: "LB", overall: 78, tier: 3, startingBid: 3, espnId: 3138826,
    attr: {
      speed: 78, passRush: 45, runStop: 83, tackling: 88, coverage: 59, ballHawk: 57, awareness: 86,
    },
    strengths: ["tackling","run defense"],
    weaknesses: ["pass rush"],
  },
  {
    id: "isaac-guerendo", name: "Isaac Guerendo", team: "SF",
    position: "RB", overall: 78, tier: 3, startingBid: 3, espnId: 4372561,
    attr: {
      speed: 90, agility: 87, power: 55, vision: 93, catching: 47, yac: 82, clutch: 50,
    },
    strengths: ["vision","speed","agility"],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "jk-dobbins", name: "J.K. Dobbins", team: "DEN",
    position: "RB", overall: 78, tier: 3, startingBid: 3, espnId: 4241985,
    attr: {
      speed: 84, agility: 80, power: 79, vision: 86, catching: 48, yac: 75, clutch: 65,
    },
    strengths: ["vision","speed"],
    weaknesses: ["hands"],
  },
  {
    id: "jameson-williams", name: "Jameson Williams", team: "DET",
    position: "WR", overall: 78, tier: 3, startingBid: 3, espnId: 4426388,
    attr: {
      speed: 95, catching: 66, routeRunning: 76, separation: 74, contestedCatch: 65, yac: 92, clutch: 66,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: [],
  },
  {
    id: "jayden-reed", name: "Jayden Reed", team: "GB",
    position: "WR", overall: 78, tier: 3, startingBid: 3, espnId: 4362249,
    attr: {
      speed: 87, catching: 93, routeRunning: 64, separation: 63, contestedCatch: 88, yac: 90, clutch: 59,
    },
    strengths: ["hands","yards after catch","contested catch"],
    weaknesses: [],
  },
  {
    id: "paulson-adebo", name: "Paulson Adebo", team: "NYG",
    position: "CB", overall: 78, tier: 3, startingBid: 3, espnId: 4242547,
    attr: {
      speed: 81, agility: 81, tackling: 82, coverage: 78, ballHawk: 72,
    },
    strengths: ["tackling"],
    weaknesses: [],
  },
  {
    id: "quinyon-mitchell", name: "Quinyon Mitchell", team: "PHI",
    position: "CB", overall: 78, tier: 3, startingBid: 3, espnId: 4686273,
    attr: {
      speed: 82, agility: 83, tackling: 54, coverage: 80, ballHawk: 68,
    },
    strengths: ["agility","speed"],
    weaknesses: ["tackling"],
  },
  {
    id: "rashee-rice", name: "Rashee Rice", team: "KC",
    position: "WR", overall: 78, tier: 3, startingBid: 3, espnId: 4428331,
    attr: {
      speed: 69, catching: 89, routeRunning: 78, separation: 77, contestedCatch: 88, yac: 68, clutch: 82,
    },
    strengths: ["hands","contested catch","clutch"],
    weaknesses: [],
  },
  {
    id: "robert-spillane", name: "Robert Spillane", team: "NE",
    position: "LB", overall: 78, tier: 3, startingBid: 3, espnId: 3129446,
    attr: {
      speed: 78, passRush: 45, runStop: 84, tackling: 88, coverage: 56, ballHawk: 57, awareness: 86,
    },
    strengths: ["tackling","run defense"],
    weaknesses: ["pass rush"],
  },
  {
    id: "trey-mcbride", name: "Trey McBride", team: "ARI",
    position: "TE", overall: 78, tier: 3, startingBid: 3, espnId: 4361307,
    attr: {
      speed: 62, catching: 94, routeRunning: 82, separation: 80, contestedCatch: 88, yac: 59, runBlock: 62, passBlock: 60, clutch: 66,
    },
    strengths: ["hands","contested catch","route running"],
    weaknesses: [],
  },
  {
    id: "brian-thomas-jr", name: "Brian Thomas Jr.", team: "JAX",
    position: "WR", overall: 77, tier: 3, startingBid: 3, espnId: 4432773,
    attr: {
      speed: 93, catching: 64, routeRunning: 74, separation: 73, contestedCatch: 62, yac: 92, clutch: 65,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: [],
  },
  {
    id: "christian-rozeboom", name: "Christian Rozeboom", team: "LAR",
    position: "LB", overall: 77, tier: 3, startingBid: 3, espnId: 3909013,
    attr: {
      speed: 80, passRush: 45, runStop: 85, tackling: 90, coverage: 47, ballHawk: 49, awareness: 88,
    },
    strengths: ["tackling","run defense"],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "denzel-ward", name: "Denzel Ward", team: "CLE",
    position: "CB", overall: 77, tier: 3, startingBid: 3, espnId: 3915535,
    attr: {
      speed: 81, agility: 81, tackling: 56, coverage: 79, ballHawk: 66,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "jayden-daniels", name: "Jayden Daniels", team: "WSH",
    position: "QB", overall: 77, tier: 3, startingBid: 3, espnId: 4426348,
    attr: {
      armStrength: 67, shortAccuracy: 74, deepAccuracy: 65, pocketAwareness: 86, decisionMaking: 80, consistency: 75, clutch: 77, mobility: 94,
    },
    strengths: ["mobility","pocket presence"],
    weaknesses: [],
  },
  {
    id: "justice-hill", name: "Justice Hill", team: "BAL",
    position: "RB", overall: 77, tier: 3, startingBid: 3, espnId: 4038441,
    attr: {
      speed: 86, agility: 82, power: 55, vision: 88, catching: 65, yac: 77, clutch: 54,
    },
    strengths: ["vision","speed","agility"],
    weaknesses: ["clutch","power"],
  },
  {
    id: "malik-willis", name: "Malik Willis", team: "MIA",
    position: "QB", overall: 77, tier: 3, startingBid: 3, espnId: 4242512,
    attr: {
      armStrength: 78, shortAccuracy: 80, deepAccuracy: 79, pocketAwareness: 78, decisionMaking: 76, consistency: 75, clutch: 70, mobility: 67,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "marlon-humphrey", name: "Marlon Humphrey", team: "BAL",
    position: "CB", overall: 77, tier: 3, startingBid: 3, espnId: 3126356,
    attr: {
      speed: 79, agility: 79, tackling: 70, coverage: 76, ballHawk: 76,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "sam-darnold", name: "Sam Darnold", team: "SEA",
    position: "QB", overall: 77, tier: 3, startingBid: 3, espnId: 3912547,
    attr: {
      armStrength: 85, shortAccuracy: 75, deepAccuracy: 84, pocketAwareness: 79, decisionMaking: 81, consistency: 76, clutch: 85, mobility: 52,
    },
    strengths: ["arm strength","clutch","deep ball"],
    weaknesses: ["mobility"],
  },
  {
    id: "tee-higgins", name: "Tee Higgins", team: "CIN",
    position: "WR", overall: 77, tier: 3, startingBid: 3, espnId: 4239993,
    attr: {
      speed: 85, catching: 69, routeRunning: 76, separation: 75, contestedCatch: 68, yac: 87, clutch: 88,
    },
    strengths: ["clutch","yards after catch","speed"],
    weaknesses: [],
  },
  {
    id: "trey-benson", name: "Trey Benson", team: "ARI",
    position: "RB", overall: 77, tier: 3, startingBid: 3, espnId: 4429275,
    attr: {
      speed: 88, agility: 84, power: 57, vision: 90, catching: 48, yac: 79, clutch: 50,
    },
    strengths: ["vision","speed","agility"],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "bobby-okereke", name: "Bobby Okereke", team: "CAR",
    position: "LB", overall: 76, tier: 3, startingBid: 3, espnId: 3117253,
    attr: {
      speed: 78, passRush: 45, runStop: 83, tackling: 88, coverage: 50, ballHawk: 52, awareness: 87,
    },
    strengths: ["tackling","run defense"],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "brock-bowers", name: "Brock Bowers", team: "LV",
    position: "TE", overall: 76, tier: 3, startingBid: 3, espnId: 4432665,
    attr: {
      speed: 66, catching: 92, routeRunning: 76, separation: 75, contestedCatch: 88, yac: 64, runBlock: 62, passBlock: 60, clutch: 66,
    },
    strengths: ["hands","contested catch"],
    weaknesses: [],
  },
  {
    id: "brock-purdy", name: "Brock Purdy", team: "SF",
    position: "QB", overall: 76, tier: 3, startingBid: 3, espnId: 4361741,
    attr: {
      armStrength: 84, shortAccuracy: 77, deepAccuracy: 83, pocketAwareness: 72, decisionMaking: 72, consistency: 78, clutch: 82, mobility: 66,
    },
    strengths: ["arm strength","deep ball","clutch"],
    weaknesses: [],
  },
  {
    id: "chris-godwin-jr", name: "Chris Godwin Jr.", team: "TB",
    position: "WR", overall: 76, tier: 3, startingBid: 3, espnId: 3116165,
    attr: {
      speed: 70, catching: 94, routeRunning: 71, separation: 70, contestedCatch: 88, yac: 69, clutch: 66,
    },
    strengths: ["hands","contested catch"],
    weaknesses: [],
  },
  {
    id: "devin-white", name: "Devin White", team: "DET",
    position: "LB", overall: 76, tier: 3, startingBid: 3, espnId: 4035434,
    attr: {
      speed: 79, passRush: 45, runStop: 85, tackling: 89, coverage: 45, ballHawk: 45, awareness: 87,
    },
    strengths: ["tackling","run defense"],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "kyle-monangai", name: "Kyle Monangai", team: "CHI",
    position: "RB", overall: 76, tier: 3, startingBid: 3, espnId: 4608686,
    attr: {
      speed: 83, agility: 80, power: 67, vision: 85, catching: 54, yac: 74, clutch: 55,
    },
    strengths: ["vision","speed"],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "luther-burden-iii", name: "Luther Burden III", team: "CHI",
    position: "WR", overall: 76, tier: 3, startingBid: 3, espnId: 4685278,
    attr: {
      speed: 85, catching: 91, routeRunning: 61, separation: 60, contestedCatch: 88, yac: 88, clutch: 50,
    },
    strengths: ["hands","yards after catch","contested catch"],
    weaknesses: ["clutch"],
  },
  {
    id: "malik-nabers", name: "Malik Nabers", team: "NYG",
    position: "WR", overall: 76, tier: 3, startingBid: 3, espnId: 4595348,
    attr: {
      speed: 72, catching: 66, routeRunning: 85, separation: 83, contestedCatch: 65, yac: 72, clutch: 69,
    },
    strengths: ["route running","separation"],
    weaknesses: [],
  },
  {
    id: "matthew-stafford", name: "Matthew Stafford", team: "LAR",
    position: "QB", overall: 76, tier: 3, startingBid: 3, espnId: 12483,
    attr: {
      armStrength: 77, shortAccuracy: 68, deepAccuracy: 75, pocketAwareness: 89, decisionMaking: 90, consistency: 70, clutch: 85, mobility: 45,
    },
    strengths: ["decision-making","pocket presence","clutch"],
    weaknesses: ["mobility"],
  },
  {
    id: "nick-bolton", name: "Nick Bolton", team: "KC",
    position: "LB", overall: 76, tier: 3, startingBid: 3, espnId: 4362759,
    attr: {
      speed: 76, passRush: 46, runStop: 83, tackling: 85, coverage: 55, ballHawk: 53, awareness: 84,
    },
    strengths: ["tackling","run defense"],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "riq-woolen", name: "Riq Woolen", team: "PHI",
    position: "CB", overall: 76, tier: 3, startingBid: 3, espnId: 4245185,
    attr: {
      speed: 80, agility: 80, tackling: 54, coverage: 78, ballHawk: 67,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "tank-bigsby", name: "Tank Bigsby", team: "PHI",
    position: "RB", overall: 76, tier: 3, startingBid: 3, espnId: 4429013,
    attr: {
      speed: 86, agility: 83, power: 61, vision: 89, catching: 45, yac: 77, clutch: 54,
    },
    strengths: ["vision","speed","agility"],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "tremaine-edmunds", name: "Tremaine Edmunds", team: "NYG",
    position: "LB", overall: 76, tier: 3, startingBid: 3, espnId: 3929950,
    attr: {
      speed: 74, passRush: 45, runStop: 78, tackling: 83, coverage: 64, ballHawk: 64, awareness: 81,
    },
    strengths: ["tackling"],
    weaknesses: ["pass rush"],
  },
  {
    id: "tyrel-dodson", name: "Tyrel Dodson", team: "MIA",
    position: "LB", overall: 76, tier: 3, startingBid: 3, espnId: 4035232,
    attr: {
      speed: 77, passRush: 56, runStop: 83, tackling: 87, coverage: 50, ballHawk: 55, awareness: 85,
    },
    strengths: ["tackling","run defense"],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "will-mcdonald-iv", name: "Will McDonald IV", team: "NYJ",
    position: "EDGE", overall: 76, tier: 3, startingBid: 3, espnId: 4361767,
    attr: {
      speed: 76, power: 75, passRush: 80, runStop: 68, tackling: 50, strength: 71,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "ameer-abdullah", name: "Ameer Abdullah", team: "JAX",
    position: "RB", overall: 75, tier: 3, startingBid: 3, espnId: 2576336,
    attr: {
      speed: 85, agility: 81, power: 55, vision: 87, catching: 55, yac: 76, clutch: 50,
    },
    strengths: ["vision","speed"],
    weaknesses: ["clutch","power"],
  },
  {
    id: "bucky-irving", name: "Bucky Irving", team: "TB",
    position: "RB", overall: 75, tier: 3, startingBid: 3, espnId: 4596448,
    attr: {
      speed: 78, agility: 74, power: 75, vision: 79, catching: 71, yac: 69, clutch: 63,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "cam-taylor-britt", name: "Cam Taylor-Britt", team: "CIN",
    position: "CB", overall: 75, tier: 3, startingBid: 3, espnId: 4361196,
    attr: {
      speed: 78, agility: 79, tackling: 65, coverage: 76, ballHawk: 66,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "christian-gonzalez", name: "Christian Gonzalez", team: "NE",
    position: "CB", overall: 75, tier: 3, startingBid: 3, espnId: 4686772,
    attr: {
      speed: 79, agility: 79, tackling: 69, coverage: 77, ballHawk: 65,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "derek-carr", name: "Derek Carr", team: "NO",
    position: "QB", overall: 75, tier: 3, startingBid: 3, espnId: 16757,
    attr: {
      armStrength: 76, shortAccuracy: 78, deepAccuracy: 74, pocketAwareness: 82, decisionMaking: 80, consistency: 78, clutch: 79, mobility: 50,
    },
    strengths: ["pocket presence"],
    weaknesses: ["mobility"],
  },
  {
    id: "dk-metcalf", name: "DK Metcalf", team: "PIT",
    position: "WR", overall: 75, tier: 3, startingBid: 3, espnId: 4047650,
    attr: {
      speed: 93, catching: 59, routeRunning: 73, separation: 72, contestedCatch: 57, yac: 92, clutch: 61,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: [],
  },
  {
    id: "emmanuel-forbes-jr", name: "Emmanuel Forbes Jr.", team: "LAR",
    position: "CB", overall: 75, tier: 3, startingBid: 3, espnId: 4429767,
    attr: {
      speed: 78, agility: 78, tackling: 52, coverage: 75, ballHawk: 69,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "justin-herbert", name: "Justin Herbert", team: "LAC",
    position: "QB", overall: 75, tier: 3, startingBid: 3, espnId: 4038941,
    attr: {
      armStrength: 73, shortAccuracy: 72, deepAccuracy: 71, pocketAwareness: 84, decisionMaking: 76, consistency: 73, clutch: 75, mobility: 71,
    },
    strengths: ["pocket presence"],
    weaknesses: [],
  },
  {
    id: "keaton-mitchell", name: "Keaton Mitchell", team: "LAC",
    position: "RB", overall: 75, tier: 3, startingBid: 3, espnId: 4596334,
    attr: {
      speed: 87, agility: 83, power: 55, vision: 89, catching: 45, yac: 78, clutch: 50,
    },
    strengths: ["vision","speed","agility"],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "kenneth-walker-iii", name: "Kenneth Walker III", team: "KC",
    position: "RB", overall: 75, tier: 3, startingBid: 3, espnId: 4567048,
    attr: {
      speed: 78, agility: 74, power: 76, vision: 79, catching: 67, yac: 69, clutch: 69,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "mike-evans", name: "Mike Evans", team: "SF",
    position: "WR", overall: 75, tier: 3, startingBid: 3, espnId: 16737,
    attr: {
      speed: 81, catching: 69, routeRunning: 75, separation: 74, contestedCatch: 67, yac: 83, clutch: 85,
    },
    strengths: ["clutch","yards after catch"],
    weaknesses: [],
  },
  {
    id: "mitchell-trubisky", name: "Mitchell Trubisky", team: "BUF",
    position: "QB", overall: 75, tier: 3, startingBid: 3, espnId: 3039707,
    attr: {
      armStrength: 74, shortAccuracy: 80, deepAccuracy: 73, pocketAwareness: 78, decisionMaking: 79, consistency: 75, clutch: 75, mobility: 49,
    },
    strengths: [],
    weaknesses: ["mobility"],
  },
  {
    id: "nick-emmanwori", name: "Nick Emmanwori", team: "SEA",
    position: "S", overall: 75, tier: 3, startingBid: 3, espnId: 4869523,
    attr: {
      speed: 83, passRush: 51, runStop: 72, tackling: 77, coverage: 81, ballHawk: 63,
    },
    strengths: ["speed"],
    weaknesses: ["pass rush"],
  },
  {
    id: "quentin-lake", name: "Quentin Lake", team: "LAR",
    position: "S", overall: 75, tier: 3, startingBid: 3, espnId: 4249128,
    attr: {
      speed: 74, passRush: 45, runStop: 83, tackling: 90, coverage: 72, ballHawk: 59,
    },
    strengths: ["tackling","run defense"],
    weaknesses: ["pass rush"],
  },
  {
    id: "stefon-diggs", name: "Stefon Diggs", team: "WSH",
    position: "WR", overall: 75, tier: 3, startingBid: 3, espnId: 2976212,
    attr: {
      speed: 69, catching: 95, routeRunning: 70, separation: 69, contestedCatch: 88, yac: 68, clutch: 58,
    },
    strengths: ["hands","contested catch"],
    weaknesses: [],
  },
  {
    id: "tetairoa-mcmillan", name: "Tetairoa McMillan", team: "CAR",
    position: "WR", overall: 75, tier: 3, startingBid: 3, espnId: 4685472,
    attr: {
      speed: 93, catching: 58, routeRunning: 74, separation: 73, contestedCatch: 56, yac: 92, clutch: 63,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: [],
  },
  {
    id: "treveyon-henderson", name: "TreVeyon Henderson", team: "NE",
    position: "RB", overall: 75, tier: 3, startingBid: 3, espnId: 4432710,
    attr: {
      speed: 83, agility: 79, power: 67, vision: 84, catching: 54, yac: 74, clutch: 63,
    },
    strengths: ["vision","speed"],
    weaknesses: ["hands"],
  },
  {
    id: "zyon-mccollum", name: "Zyon McCollum", team: "TB",
    position: "CB", overall: 75, tier: 3, startingBid: 3, espnId: 4250392,
    attr: {
      speed: 78, agility: 79, tackling: 78, coverage: 76, ballHawk: 65,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "christian-watson", name: "Christian Watson", team: "GB",
    position: "WR", overall: 74, tier: 3, startingBid: 3, espnId: 4248528,
    attr: {
      speed: 95, catching: 60, routeRunning: 69, separation: 68, contestedCatch: 58, yac: 92, clutch: 67,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: [],
  },
  {
    id: "jadeveon-clowney", name: "Jadeveon Clowney", team: "HOU",
    position: "EDGE", overall: 74, tier: 3, startingBid: 3, espnId: 16734,
    attr: {
      speed: 71, power: 75, passRush: 75, runStop: 71, tackling: 65, strength: 74,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "jaire-alexander", name: "Jaire Alexander", team: "BAL",
    position: "CB", overall: 74, tier: 3, startingBid: 3, espnId: 3895429,
    attr: {
      speed: 76, agility: 76, tackling: 52, coverage: 74, ballHawk: 71,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "jaylen-waddle", name: "Jaylen Waddle", team: "DEN",
    position: "WR", overall: 74, tier: 3, startingBid: 3, espnId: 4372016,
    attr: {
      speed: 85, catching: 75, routeRunning: 67, separation: 66, contestedCatch: 74, yac: 87, clutch: 54,
    },
    strengths: ["yards after catch","speed"],
    weaknesses: ["clutch"],
  },
  {
    id: "jordan-love", name: "Jordan Love", team: "GB",
    position: "QB", overall: 74, tier: 3, startingBid: 3, espnId: 4036378,
    attr: {
      armStrength: 81, shortAccuracy: 64, deepAccuracy: 79, pocketAwareness: 81, decisionMaking: 81, consistency: 67, clutch: 83, mobility: 52,
    },
    strengths: ["clutch"],
    weaknesses: ["mobility"],
  },
  {
    id: "kaden-elliss", name: "Kaden Elliss", team: "NO",
    position: "LB", overall: 74, tier: 3, startingBid: 3, espnId: 3124890,
    attr: {
      speed: 75, passRush: 56, runStop: 82, tackling: 85, coverage: 50, ballHawk: 51, awareness: 83,
    },
    strengths: ["tackling","run defense"],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "mike-sainristil", name: "Mike Sainristil", team: "WSH",
    position: "CB", overall: 74, tier: 3, startingBid: 3, espnId: 4428414,
    attr: {
      speed: 76, agility: 76, tackling: 78, coverage: 74, ballHawk: 70,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "rico-dowdle", name: "Rico Dowdle", team: "PIT",
    position: "RB", overall: 74, tier: 3, startingBid: 3, espnId: 4038815,
    attr: {
      speed: 78, agility: 74, power: 75, vision: 78, catching: 59, yac: 68, clutch: 57,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "riley-moss", name: "Riley Moss", team: "DEN",
    position: "CB", overall: 74, tier: 3, startingBid: 3, espnId: 4382401,
    attr: {
      speed: 78, agility: 78, tackling: 80, coverage: 75, ballHawk: 63,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "sam-laporta", name: "Sam LaPorta", team: "DET",
    position: "TE", overall: 74, tier: 3, startingBid: 3, espnId: 4430027,
    attr: {
      speed: 74, catching: 95, routeRunning: 65, separation: 64, contestedCatch: 88, yac: 74, runBlock: 62, passBlock: 60, clutch: 66,
    },
    strengths: ["hands","contested catch"],
    weaknesses: [],
  },
  {
    id: "tucker-kraft", name: "Tucker Kraft", team: "GB",
    position: "TE", overall: 74, tier: 3, startingBid: 3, espnId: 4572680,
    attr: {
      speed: 90, catching: 88, routeRunning: 64, separation: 63, contestedCatch: 88, yac: 92, runBlock: 62, passBlock: 60, clutch: 71,
    },
    strengths: ["yards after catch","speed","hands"],
    weaknesses: [],
  },
  {
    id: "tyreek-hill", name: "Tyreek Hill", team: "MIA",
    position: "WR", overall: 74, tier: 3, startingBid: 3, espnId: 3116406,
    attr: {
      speed: 75, catching: 77, routeRunning: 72, separation: 70, contestedCatch: 76, yac: 75, clutch: 60,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "alec-pierce", name: "Alec Pierce", team: "IND",
    position: "WR", overall: 73, tier: 3, startingBid: 3, espnId: 4360078,
    attr: {
      speed: 95, catching: 51, routeRunning: 72, separation: 71, contestedCatch: 49, yac: 92, clutch: 66,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["contested catch","hands"],
  },
  {
    id: "ben-skowronek", name: "Ben Skowronek", team: "PIT",
    position: "WR", overall: 73, tier: 3, startingBid: 3, espnId: 4035656,
    attr: {
      speed: 95, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 92, clutch: 50,
    },
    strengths: ["hands","speed","yards after catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "blake-corum", name: "Blake Corum", team: "LAR",
    position: "RB", overall: 73, tier: 3, startingBid: 3, espnId: 4429096,
    attr: {
      speed: 83, agility: 79, power: 58, vision: 85, catching: 45, yac: 74, clutch: 50,
    },
    strengths: ["vision","speed"],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "courtland-sutton", name: "Courtland Sutton", team: "DEN",
    position: "WR", overall: 73, tier: 3, startingBid: 3, espnId: 3128429,
    attr: {
      speed: 84, catching: 59, routeRunning: 73, separation: 72, contestedCatch: 57, yac: 86, clutch: 68,
    },
    strengths: ["yards after catch","speed"],
    weaknesses: [],
  },
  {
    id: "dallas-goedert", name: "Dallas Goedert", team: "PHI",
    position: "TE", overall: 73, tier: 3, startingBid: 3, espnId: 3121023,
    attr: {
      speed: 69, catching: 95, routeRunning: 63, separation: 62, contestedCatch: 88, yac: 68, runBlock: 62, passBlock: 60, clutch: 76,
    },
    strengths: ["hands","contested catch"],
    weaknesses: [],
  },
  {
    id: "jakobi-meyers", name: "Jakobi Meyers", team: "JAX",
    position: "WR", overall: 73, tier: 3, startingBid: 3, espnId: 3916433,
    attr: {
      speed: 72, catching: 78, routeRunning: 71, separation: 70, contestedCatch: 77, yac: 72, clutch: 53,
    },
    strengths: [],
    weaknesses: ["clutch"],
  },
  {
    id: "james-conner", name: "James Conner", team: "ARI",
    position: "RB", overall: 73, tier: 3, startingBid: 3, espnId: 3045147,
    attr: {
      speed: 76, agility: 72, power: 75, vision: 76, catching: 69, yac: 67, clutch: 68,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "jeremiah-owusu-koramoah", name: "Jeremiah Owusu-Koramoah", team: "CLE",
    position: "LB", overall: 73, tier: 3, startingBid: 3, espnId: 4258599,
    attr: {
      speed: 72, passRush: 65, runStop: 81, tackling: 80, coverage: 55, ballHawk: 57, awareness: 78,
    },
    strengths: [],
    weaknesses: ["coverage"],
  },
  {
    id: "jeremy-mcnichols", name: "Jeremy McNichols", team: "WSH",
    position: "RB", overall: 73, tier: 3, startingBid: 3, espnId: 3127586,
    attr: {
      speed: 83, agility: 79, power: 55, vision: 85, catching: 47, yac: 74, clutch: 50,
    },
    strengths: ["vision","speed"],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "julian-love", name: "Julian Love", team: "SEA",
    position: "S", overall: 73, tier: 3, startingBid: 3, espnId: 4046675,
    attr: {
      speed: 75, passRush: 40, runStop: 73, tackling: 78, coverage: 73, ballHawk: 69,
    },
    strengths: [],
    weaknesses: ["pass rush"],
  },
  {
    id: "kool-aid-mckinstry", name: "Kool-Aid McKinstry", team: "NO",
    position: "CB", overall: 73, tier: 3, startingBid: 3, espnId: 4433975,
    attr: {
      speed: 77, agility: 77, tackling: 68, coverage: 74, ballHawk: 64,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "kyler-murray", name: "Kyler Murray", team: "MIN",
    position: "QB", overall: 73, tier: 3, startingBid: 3, espnId: 3917315,
    attr: {
      armStrength: 62, shortAccuracy: 84, deepAccuracy: 59, pocketAwareness: 81, decisionMaking: 67, consistency: 84, clutch: 67, mobility: 80,
    },
    strengths: ["short accuracy"],
    weaknesses: [],
  },
  {
    id: "kyren-williams", name: "Kyren Williams", team: "LAR",
    position: "RB", overall: 73, tier: 3, startingBid: 3, espnId: 4430737,
    attr: {
      speed: 76, agility: 72, power: 82, vision: 77, catching: 57, yac: 67, clutch: 83,
    },
    strengths: ["clutch","power"],
    weaknesses: [],
  },
  {
    id: "leonard-williams", name: "Leonard Williams", team: "SEA",
    position: "EDGE", overall: 73, tier: 3, startingBid: 3, espnId: 2971622,
    attr: {
      speed: 71, power: 73, passRush: 75, runStop: 68, tackling: 70, strength: 72,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "malik-davis", name: "Malik Davis", team: "DAL",
    position: "RB", overall: 73, tier: 3, startingBid: 3, espnId: 4240603,
    attr: {
      speed: 83, agility: 79, power: 55, vision: 85, catching: 46, yac: 75, clutch: 50,
    },
    strengths: ["vision","speed"],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "nate-wiggins", name: "Nate Wiggins", team: "BAL",
    position: "CB", overall: 73, tier: 3, startingBid: 3, espnId: 4601278,
    attr: {
      speed: 77, agility: 77, tackling: 60, coverage: 74, ballHawk: 65,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "oronde-gadsden", name: "Oronde Gadsden", team: "LAC",
    position: "TE", overall: 73, tier: 3, startingBid: 3, espnId: 4595342,
    attr: {
      speed: 85, catching: 90, routeRunning: 61, separation: 60, contestedCatch: 88, yac: 87, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch","yards after catch"],
    weaknesses: ["clutch"],
  },
  {
    id: "patrick-queen", name: "Patrick Queen", team: "PIT",
    position: "LB", overall: 73, tier: 3, startingBid: 3, espnId: 4242207,
    attr: {
      speed: 74, passRush: 45, runStop: 80, tackling: 83, coverage: 50, ballHawk: 48, awareness: 82,
    },
    strengths: ["tackling"],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "ricky-pearsall", name: "Ricky Pearsall", team: "SF",
    position: "WR", overall: 73, tier: 3, startingBid: 3, espnId: 4428209,
    attr: {
      speed: 87, catching: 76, routeRunning: 62, separation: 61, contestedCatch: 75, yac: 91, clutch: 50,
    },
    strengths: ["yards after catch","speed"],
    weaknesses: ["clutch"],
  },
  {
    id: "tyrique-stevenson", name: "Tyrique Stevenson", team: "CHI",
    position: "CB", overall: 73, tier: 3, startingBid: 3, espnId: 4426374,
    attr: {
      speed: 77, agility: 77, tackling: 70, coverage: 74, ballHawk: 64,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "will-johnson", name: "Will Johnson", team: "ARI",
    position: "CB", overall: 73, tier: 3, startingBid: 3, espnId: 4685408,
    attr: {
      speed: 78, agility: 78, tackling: 60, coverage: 75, ballHawk: 60,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "xavier-mckinney", name: "Xavier McKinney", team: "GB",
    position: "S", overall: 73, tier: 3, startingBid: 3, espnId: 4241470,
    attr: {
      speed: 72, passRush: 41, runStop: 75, tackling: 80, coverage: 69, ballHawk: 70,
    },
    strengths: [],
    weaknesses: ["pass rush"],
  },
  {
    id: "xavier-smith", name: "Xavier Smith", team: "LAR",
    position: "WR", overall: 73, tier: 3, startingBid: 3, espnId: 4386544,
    attr: {
      speed: 95, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 92, clutch: 50,
    },
    strengths: ["hands","speed","yards after catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "alontae-taylor", name: "Alontae Taylor", team: "TEN",
    position: "CB", overall: 72, tier: 4, startingBid: 2, espnId: 4369835,
    attr: {
      speed: 76, agility: 76, tackling: 78, coverage: 73, ballHawk: 61,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "calvin-ridley", name: "Calvin Ridley", team: "TEN",
    position: "WR", overall: 72, tier: 4, startingBid: 2, espnId: 3925357,
    attr: {
      speed: 95, catching: 50, routeRunning: 69, separation: 68, contestedCatch: 48, yac: 92, clutch: 50,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["contested catch","hands"],
  },
  {
    id: "chris-brooks", name: "Chris Brooks", team: "GB",
    position: "RB", overall: 72, tier: 4, startingBid: 2, espnId: 3149687,
    attr: {
      speed: 83, agility: 79, power: 55, vision: 84, catching: 46, yac: 74, clutch: 50,
    },
    strengths: ["vision","speed"],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "cooper-dejean", name: "Cooper DeJean", team: "PHI",
    position: "CB", overall: 72, tier: 4, startingBid: 2, espnId: 4682618,
    attr: {
      speed: 76, agility: 76, tackling: 74, coverage: 73, ballHawk: 63,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "dandre-swift", name: "D'Andre Swift", team: "CHI",
    position: "RB", overall: 72, tier: 4, startingBid: 2, espnId: 4259545,
    attr: {
      speed: 74, agility: 70, power: 76, vision: 75, catching: 65, yac: 65, clutch: 67,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "dak-prescott", name: "Dak Prescott", team: "DAL",
    position: "QB", overall: 72, tier: 4, startingBid: 2, espnId: 2577417,
    attr: {
      armStrength: 71, shortAccuracy: 76, deepAccuracy: 68, pocketAwareness: 82, decisionMaking: 75, consistency: 77, clutch: 75, mobility: 53,
    },
    strengths: ["pocket presence"],
    weaknesses: ["mobility"],
  },
  {
    id: "davante-adams", name: "Davante Adams", team: "LAR",
    position: "WR", overall: 72, tier: 4, startingBid: 2, espnId: 16800,
    attr: {
      speed: 81, catching: 51, routeRunning: 76, separation: 75, contestedCatch: 49, yac: 83, clutch: 88,
    },
    strengths: ["clutch","yards after catch"],
    weaknesses: ["contested catch","hands"],
  },
  {
    id: "dorance-armstrong", name: "Dorance Armstrong", team: "WSH",
    position: "EDGE", overall: 72, tier: 4, startingBid: 2, espnId: 3928979,
    attr: {
      speed: 72, power: 72, passRush: 75, runStop: 66, tackling: 61, strength: 69,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "efton-chism-iii", name: "Efton Chism III", team: "NE",
    position: "WR", overall: 72, tier: 4, startingBid: 2, espnId: 4695193,
    attr: {
      speed: 92, catching: 92, routeRunning: 49, separation: 49, contestedCatch: 85, yac: 89, clutch: 50,
    },
    strengths: ["hands","speed","yards after catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "emeka-egbuka", name: "Emeka Egbuka", team: "TB",
    position: "WR", overall: 72, tier: 4, startingBid: 2, espnId: 4567750,
    attr: {
      speed: 93, catching: 50, routeRunning: 70, separation: 69, contestedCatch: 48, yac: 92, clutch: 60,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["contested catch","hands"],
  },
  {
    id: "garrett-wilson", name: "Garrett Wilson", team: "NYJ",
    position: "WR", overall: 72, tier: 4, startingBid: 2, espnId: 4569618,
    attr: {
      speed: 69, catching: 73, routeRunning: 75, separation: 74, contestedCatch: 72, yac: 67, clutch: 68,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "gunner-olszewski", name: "Gunner Olszewski", team: "NYG",
    position: "WR", overall: 72, tier: 4, startingBid: 2, espnId: 4424106,
    attr: {
      speed: 92, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 92, clutch: 50,
    },
    strengths: ["hands","speed","yards after catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "jalen-pitre", name: "Jalen Pitre", team: "HOU",
    position: "S", overall: 72, tier: 4, startingBid: 2, espnId: 4241223,
    attr: {
      speed: 76, passRush: 40, runStop: 71, tackling: 76, coverage: 73, ballHawk: 66,
    },
    strengths: [],
    weaknesses: ["pass rush"],
  },
  {
    id: "james-pierre", name: "James Pierre", team: "MIN",
    position: "CB", overall: 72, tier: 4, startingBid: 2, espnId: 4259252,
    attr: {
      speed: 75, agility: 75, tackling: 55, coverage: 72, ballHawk: 66,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "jaxson-dart", name: "Jaxson Dart", team: "NYG",
    position: "QB", overall: 72, tier: 4, startingBid: 2, espnId: 4689114,
    attr: {
      armStrength: 61, shortAccuracy: 68, deepAccuracy: 58, pocketAwareness: 85, decisionMaking: 79, consistency: 70, clutch: 75, mobility: 81,
    },
    strengths: ["pocket presence"],
    weaknesses: [],
  },
  {
    id: "juwan-johnson", name: "Juwan Johnson", team: "NO",
    position: "TE", overall: 72, tier: 4, startingBid: 2, espnId: 3929645,
    attr: {
      speed: 71, catching: 93, routeRunning: 62, separation: 62, contestedCatch: 88, yac: 71, runBlock: 62, passBlock: 60, clutch: 51,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["clutch"],
  },
  {
    id: "kerby-joseph", name: "Kerby Joseph", team: "DET",
    position: "S", overall: 72, tier: 4, startingBid: 2, espnId: 4360383,
    attr: {
      speed: 73, passRush: 40, runStop: 63, tackling: 67, coverage: 71, ballHawk: 84,
    },
    strengths: ["ball skills"],
    weaknesses: ["pass rush"],
  },
  {
    id: "khalil-shakir", name: "Khalil Shakir", team: "BUF",
    position: "WR", overall: 72, tier: 4, startingBid: 2, espnId: 4373678,
    attr: {
      speed: 63, catching: 95, routeRunning: 67, separation: 66, contestedCatch: 88, yac: 60, clutch: 51,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["clutch"],
  },
  {
    id: "nakobe-dean", name: "Nakobe Dean", team: "LV",
    position: "LB", overall: 72, tier: 4, startingBid: 2, espnId: 4426340,
    attr: {
      speed: 74, passRush: 61, runStop: 82, tackling: 83, coverage: 45, ballHawk: 47, awareness: 82,
    },
    strengths: ["tackling","run defense"],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "nate-landman", name: "Nate Landman", team: "LAR",
    position: "LB", overall: 72, tier: 4, startingBid: 2, espnId: 4243181,
    attr: {
      speed: 73, passRush: 45, runStop: 78, tackling: 82, coverage: 50, ballHawk: 49, awareness: 80,
    },
    strengths: ["tackling"],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "tua-tagovailoa", name: "Tua Tagovailoa", team: "MIA",
    position: "QB", overall: 72, tier: 4, startingBid: 2, espnId: 4241479,
    attr: {
      armStrength: 66, shortAccuracy: 90, deepAccuracy: 64, pocketAwareness: 75, decisionMaking: 71, consistency: 88, clutch: 78, mobility: 46,
    },
    strengths: ["short accuracy"],
    weaknesses: ["mobility"],
  },
  {
    id: "tylan-wallace", name: "Tylan Wallace", team: "BAL",
    position: "WR", overall: 72, tier: 4, startingBid: 2, espnId: 4241424,
    attr: {
      speed: 95, catching: 93, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 92, clutch: 50,
    },
    strengths: ["speed","hands","yards after catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "tyson-campbell", name: "Tyson Campbell", team: "CLE",
    position: "CB", overall: 72, tier: 4, startingBid: 2, espnId: 4379397,
    attr: {
      speed: 77, agility: 77, tackling: 78, coverage: 74, ballHawk: 61,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "xavier-watts", name: "Xavier Watts", team: "ATL",
    position: "S", overall: 72, tier: 4, startingBid: 2, espnId: 4431005,
    attr: {
      speed: 71, passRush: 40, runStop: 73, tackling: 78, coverage: 68, ballHawk: 70,
    },
    strengths: [],
    weaknesses: ["pass rush"],
  },
  {
    id: "brandon-jones", name: "Brandon Jones", team: "DEN",
    position: "S", overall: 71, tier: 4, startingBid: 2, espnId: 4039059,
    attr: {
      speed: 69, passRush: 40, runStop: 80, tackling: 86, coverage: 65, ballHawk: 62,
    },
    strengths: ["tackling"],
    weaknesses: ["pass rush"],
  },
  {
    id: "breece-hall", name: "Breece Hall", team: "NYJ",
    position: "RB", overall: 71, tier: 4, startingBid: 2, espnId: 4427366,
    attr: {
      speed: 73, agility: 68, power: 75, vision: 73, catching: 72, yac: 63, clutch: 61,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "carlton-davis-iii", name: "Carlton Davis III", team: "NE",
    position: "CB", overall: 71, tier: 4, startingBid: 2, espnId: 3916923,
    attr: {
      speed: 74, agility: 74, tackling: 70, coverage: 71, ballHawk: 64,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "chase-brown", name: "Chase Brown", team: "CIN",
    position: "RB", overall: 71, tier: 4, startingBid: 2, espnId: 4362238,
    attr: {
      speed: 73, agility: 69, power: 74, vision: 73, catching: 70, yac: 64, clutch: 73,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "chase-young", name: "Chase Young", team: "NO",
    position: "EDGE", overall: 71, tier: 4, startingBid: 2, espnId: 4241986,
    attr: {
      speed: 70, power: 71, passRush: 74, runStop: 64, tackling: 55, strength: 68,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "chuba-hubbard", name: "Chuba Hubbard", team: "CAR",
    position: "RB", overall: 71, tier: 4, startingBid: 2, espnId: 4241416,
    attr: {
      speed: 76, agility: 72, power: 72, vision: 76, catching: 56, yac: 66, clutch: 69,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "darius-slay", name: "Darius Slay", team: "PIT",
    position: "CB", overall: 71, tier: 4, startingBid: 2, espnId: 15863,
    attr: {
      speed: 76, agility: 76, tackling: 63, coverage: 73, ballHawk: 60,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "dee-alford", name: "Dee Alford", team: "BUF",
    position: "CB", overall: 71, tier: 4, startingBid: 2, espnId: 4401823,
    attr: {
      speed: 75, agility: 75, tackling: 74, coverage: 72, ballHawk: 63,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "denzel-burke", name: "Denzel Burke", team: "ARI",
    position: "CB", overall: 71, tier: 4, startingBid: 2, espnId: 4432668,
    attr: {
      speed: 74, agility: 74, tackling: 61, coverage: 71, ballHawk: 68,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "jacory-croskey-merritt", name: "Jacory Croskey-Merritt", team: "WSH",
    position: "RB", overall: 71, tier: 4, startingBid: 2, espnId: 4575131,
    attr: {
      speed: 79, agility: 75, power: 67, vision: 80, catching: 45, yac: 70, clutch: 64,
    },
    strengths: [],
    weaknesses: ["hands"],
  },
  {
    id: "jauan-jennings", name: "Jauan Jennings", team: "MIN",
    position: "WR", overall: 71, tier: 4, startingBid: 2, espnId: 3886598,
    attr: {
      speed: 78, catching: 70, routeRunning: 66, separation: 66, contestedCatch: 68, yac: 79, clutch: 69,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "jaylen-warren", name: "Jaylen Warren", team: "PIT",
    position: "RB", overall: 71, tier: 4, startingBid: 2, espnId: 4569987,
    attr: {
      speed: 75, agility: 71, power: 66, vision: 76, catching: 65, yac: 66, clutch: 53,
    },
    strengths: [],
    weaknesses: ["clutch"],
  },
  {
    id: "jeffery-simmons", name: "Jeffery Simmons", team: "TEN",
    position: "EDGE", overall: 71, tier: 4, startingBid: 2, espnId: 4035369,
    attr: {
      speed: 68, power: 74, passRush: 71, runStop: 72, tackling: 78, strength: 75,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "joey-porter-jr", name: "Joey Porter Jr.", team: "PIT",
    position: "CB", overall: 71, tier: 4, startingBid: 2, espnId: 4426506,
    attr: {
      speed: 75, agility: 75, tackling: 67, coverage: 72, ballHawk: 61,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "kayshon-boutte", name: "Kayshon Boutte", team: "HOU",
    position: "WR", overall: 71, tier: 4, startingBid: 2, espnId: 4429022,
    attr: {
      speed: 95, catching: 69, routeRunning: 58, separation: 57, contestedCatch: 67, yac: 92, clutch: 57,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: [],
  },
  {
    id: "micah-mcfadden", name: "Micah McFadden", team: "NYG",
    position: "LB", overall: 71, tier: 4, startingBid: 2, espnId: 4371961,
    attr: {
      speed: 73, passRush: 53, runStop: 80, tackling: 82, coverage: 45, ballHawk: 45, awareness: 81,
    },
    strengths: ["tackling"],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "parker-washington", name: "Parker Washington", team: "JAX",
    position: "WR", overall: 71, tier: 4, startingBid: 2, espnId: 4432620,
    attr: {
      speed: 88, catching: 66, routeRunning: 62, separation: 61, contestedCatch: 65, yac: 92, clutch: 59,
    },
    strengths: ["yards after catch","speed"],
    weaknesses: [],
  },
  {
    id: "patrick-mahomes", name: "Patrick Mahomes", team: "KC",
    position: "QB", overall: 71, tier: 4, startingBid: 2, espnId: 3139477,
    attr: {
      armStrength: 66, shortAccuracy: 71, deepAccuracy: 63, pocketAwareness: 82, decisionMaking: 74, consistency: 73, clutch: 75, mobility: 71,
    },
    strengths: ["pocket presence"],
    weaknesses: [],
  },
  {
    id: "renardo-green", name: "Renardo Green", team: "SF",
    position: "CB", overall: 71, tier: 4, startingBid: 2, espnId: 4427325,
    attr: {
      speed: 75, agility: 75, tackling: 67, coverage: 72, ballHawk: 61,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "romeo-doubs", name: "Romeo Doubs", team: "NE",
    position: "WR", overall: 71, tier: 4, startingBid: 2, espnId: 4361432,
    attr: {
      speed: 83, catching: 71, routeRunning: 63, separation: 62, contestedCatch: 70, yac: 85, clutch: 61,
    },
    strengths: ["yards after catch","speed"],
    weaknesses: [],
  },
  {
    id: "tj-edwards", name: "T.J. Edwards", team: "CHI",
    position: "LB", overall: 71, tier: 4, startingBid: 2, espnId: 3121544,
    attr: {
      speed: 71, passRush: 50, runStop: 78, tackling: 80, coverage: 50, ballHawk: 52, awareness: 79,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "travis-kelce", name: "Travis Kelce", team: "KC",
    position: "TE", overall: 71, tier: 4, startingBid: 2, espnId: 15847,
    attr: {
      speed: 63, catching: 87, routeRunning: 67, separation: 66, contestedCatch: 87, yac: 60, runBlock: 62, passBlock: 60, clutch: 53,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["clutch"],
  },
  {
    id: "trent-mcduffie", name: "Trent McDuffie", team: "LAR",
    position: "CB", overall: 71, tier: 4, startingBid: 2, espnId: 4426405,
    attr: {
      speed: 75, agility: 75, tackling: 68, coverage: 72, ballHawk: 63,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "trevor-etienne", name: "Trevor Etienne", team: "CAR",
    position: "RB", overall: 71, tier: 4, startingBid: 2, espnId: 4685350,
    attr: {
      speed: 82, agility: 78, power: 55, vision: 83, catching: 45, yac: 73, clutch: 50,
    },
    strengths: ["vision","speed"],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "ty-johnson", name: "Ty Johnson", team: "BUF",
    position: "RB", overall: 71, tier: 4, startingBid: 2, espnId: 3915411,
    attr: {
      speed: 79, agility: 75, power: 55, vision: 80, catching: 59, yac: 70, clutch: 53,
    },
    strengths: [],
    weaknesses: ["clutch","power"],
  },
  {
    id: "tykee-smith", name: "Tykee Smith", team: "TB",
    position: "S", overall: 71, tier: 4, startingBid: 2, espnId: 4428522,
    attr: {
      speed: 75, passRush: 42, runStop: 72, tackling: 77, coverage: 72, ballHawk: 61,
    },
    strengths: [],
    weaknesses: ["pass rush"],
  },
  {
    id: "tyler-shough", name: "Tyler Shough", team: "NO",
    position: "QB", overall: 71, tier: 4, startingBid: 2, espnId: 4360689,
    attr: {
      armStrength: 71, shortAccuracy: 77, deepAccuracy: 68, pocketAwareness: 82, decisionMaking: 64, consistency: 78, clutch: 63, mobility: 61,
    },
    strengths: ["pocket presence"],
    weaknesses: [],
  },
  {
    id: "zadarius-smith", name: "Za'Darius Smith", team: "ATL",
    position: "EDGE", overall: 71, tier: 4, startingBid: 2, espnId: 3043168,
    attr: {
      speed: 71, power: 70, passRush: 74, runStop: 63, tackling: 52, strength: 67,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "zach-allen", name: "Zach Allen", team: "DEN",
    position: "EDGE", overall: 71, tier: 4, startingBid: 2, espnId: 3915282,
    attr: {
      speed: 71, power: 70, passRush: 74, runStop: 63, tackling: 64, strength: 67,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "aaron-jones-sr", name: "Aaron Jones Sr.", team: "MIN",
    position: "RB", overall: 70, tier: 4, startingBid: 2, espnId: 3042519,
    attr: {
      speed: 73, agility: 68, power: 72, vision: 73, catching: 64, yac: 63, clutch: 57,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "alex-anzalone", name: "Alex Anzalone", team: "TB",
    position: "LB", overall: 70, tier: 4, startingBid: 2, espnId: 3043107,
    attr: {
      speed: 67, passRush: 47, runStop: 73, tackling: 74, coverage: 61, ballHawk: 56, awareness: 73,
    },
    strengths: [],
    weaknesses: ["pass rush"],
  },
  {
    id: "austin-ekeler", name: "Austin Ekeler", team: "WSH",
    position: "RB", overall: 70, tier: 4, startingBid: 2, espnId: 3068267,
    attr: {
      speed: 75, agility: 71, power: 57, vision: 76, catching: 75, yac: 66, clutch: 52,
    },
    strengths: [],
    weaknesses: ["clutch"],
  },
  {
    id: "chris-rodriguez-jr", name: "Chris Rodriguez Jr.", team: "JAX",
    position: "RB", overall: 70, tier: 4, startingBid: 2, espnId: 4362619,
    attr: {
      speed: 79, agility: 75, power: 60, vision: 80, catching: 45, yac: 70, clutch: 60,
    },
    strengths: [],
    weaknesses: ["hands"],
  },
  {
    id: "cobie-durant", name: "Cobie Durant", team: "DAL",
    position: "CB", overall: 70, tier: 4, startingBid: 2, espnId: 4384549,
    attr: {
      speed: 72, agility: 71, tackling: 50, coverage: 69, ballHawk: 68,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "dj-reed", name: "D.J. Reed", team: "DET",
    position: "CB", overall: 70, tier: 4, startingBid: 2, espnId: 3139387,
    attr: {
      speed: 74, agility: 74, tackling: 73, coverage: 71, ballHawk: 62,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "dalton-kincaid", name: "Dalton Kincaid", team: "BUF",
    position: "TE", overall: 70, tier: 4, startingBid: 2, espnId: 4385690,
    attr: {
      speed: 81, catching: 81, routeRunning: 61, separation: 60, contestedCatch: 80, yac: 83, runBlock: 62, passBlock: 60, clutch: 57,
    },
    strengths: ["yards after catch"],
    weaknesses: [],
  },
  {
    id: "daniel-jones", name: "Daniel Jones", team: "IND",
    position: "QB", overall: 70, tier: 4, startingBid: 2, espnId: 3917792,
    attr: {
      armStrength: 66, shortAccuracy: 73, deepAccuracy: 64, pocketAwareness: 82, decisionMaking: 67, consistency: 74, clutch: 66, mobility: 63,
    },
    strengths: ["pocket presence"],
    weaknesses: [],
  },
  {
    id: "deshon-elliott", name: "DeShon Elliott", team: "PIT",
    position: "S", overall: 70, tier: 4, startingBid: 2, espnId: 3929846,
    attr: {
      speed: 63, passRush: 40, runStop: 87, tackling: 92, coverage: 59, ballHawk: 55,
    },
    strengths: ["tackling","run defense"],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "edgerrin-cooper", name: "Edgerrin Cooper", team: "GB",
    position: "LB", overall: 70, tier: 4, startingBid: 2, espnId: 4430438,
    attr: {
      speed: 70, passRush: 49, runStop: 77, tackling: 79, coverage: 49, ballHawk: 49, awareness: 77,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "geno-smith", name: "Geno Smith", team: "NYJ",
    position: "QB", overall: 70, tier: 4, startingBid: 2, espnId: 15864,
    attr: {
      armStrength: 69, shortAccuracy: 86, deepAccuracy: 66, pocketAwareness: 73, decisionMaking: 60, consistency: 86, clutch: 67, mobility: 55,
    },
    strengths: ["short accuracy"],
    weaknesses: ["mobility"],
  },
  {
    id: "isaiah-likely", name: "Isaiah Likely", team: "NYG",
    position: "TE", overall: 70, tier: 4, startingBid: 2, espnId: 4361050,
    attr: {
      speed: 73, catching: 95, routeRunning: 54, separation: 54, contestedCatch: 88, yac: 73, runBlock: 62, passBlock: 60, clutch: 61,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "jakorian-bennett", name: "Jakorian Bennett", team: "LV",
    position: "CB", overall: 70, tier: 4, startingBid: 2, espnId: 4686911,
    attr: {
      speed: 75, agility: 75, tackling: 53, coverage: 72, ballHawk: 58,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "jalen-mcmillan", name: "Jalen McMillan", team: "TB",
    position: "WR", overall: 70, tier: 4, startingBid: 2, espnId: 4430834,
    attr: {
      speed: 84, catching: 75, routeRunning: 57, separation: 57, contestedCatch: 74, yac: 86, clutch: 69,
    },
    strengths: ["yards after catch","speed"],
    weaknesses: [],
  },
  {
    id: "jaquan-brisker", name: "Jaquan Brisker", team: "PIT",
    position: "S", overall: 70, tier: 4, startingBid: 2, espnId: 4570044,
    attr: {
      speed: 67, passRush: 48, runStop: 81, tackling: 87, coverage: 63, ballHawk: 58,
    },
    strengths: ["tackling"],
    weaknesses: ["pass rush"],
  },
  {
    id: "javonte-williams", name: "Javonte Williams", team: "DAL",
    position: "RB", overall: 70, tier: 4, startingBid: 2, espnId: 4361579,
    attr: {
      speed: 74, agility: 70, power: 69, vision: 74, catching: 58, yac: 64, clutch: 66,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "jaycee-horn", name: "Jaycee Horn", team: "CAR",
    position: "CB", overall: 70, tier: 4, startingBid: 2, espnId: 4362847,
    attr: {
      speed: 73, agility: 73, tackling: 62, coverage: 70, ballHawk: 67,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "joe-mixon", name: "Joe Mixon", team: "HOU",
    position: "RB", overall: 70, tier: 4, startingBid: 2, espnId: 3116385,
    attr: {
      speed: 70, agility: 66, power: 82, vision: 70, catching: 65, yac: 61, clutch: 82,
    },
    strengths: ["power","clutch"],
    weaknesses: [],
  },
  {
    id: "jordan-addison", name: "Jordan Addison", team: "MIN",
    position: "WR", overall: 70, tier: 4, startingBid: 2, espnId: 4429205,
    attr: {
      speed: 88, catching: 56, routeRunning: 65, separation: 64, contestedCatch: 54, yac: 92, clutch: 64,
    },
    strengths: ["yards after catch","speed"],
    weaknesses: ["contested catch"],
  },
  {
    id: "josh-hines-allen", name: "Josh Hines-Allen", team: "JAX",
    position: "EDGE", overall: 70, tier: 4, startingBid: 2, espnId: 3915239,
    attr: {
      speed: 69, power: 71, passRush: 72, runStop: 65, tackling: 60, strength: 69,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "josh-jobe", name: "Josh Jobe", team: "SEA",
    position: "CB", overall: 70, tier: 4, startingBid: 2, espnId: 4372020,
    attr: {
      speed: 74, agility: 74, tackling: 63, coverage: 71, ballHawk: 63,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "kendrick-bourne", name: "Kendrick Bourne", team: "ARI",
    position: "WR", overall: 70, tier: 4, startingBid: 2, espnId: 3045523,
    attr: {
      speed: 80, catching: 89, routeRunning: 54, separation: 54, contestedCatch: 88, yac: 82, clutch: 50,
    },
    strengths: ["hands","contested catch","yards after catch"],
    weaknesses: ["clutch","route running"],
  },
  {
    id: "marvin-harrison-jr", name: "Marvin Harrison Jr.", team: "ARI",
    position: "WR", overall: 70, tier: 4, startingBid: 2, espnId: 4432708,
    attr: {
      speed: 93, catching: 50, routeRunning: 66, separation: 65, contestedCatch: 48, yac: 92, clutch: 65,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["contested catch","hands"],
  },
  {
    id: "nick-mullens", name: "Nick Mullens", team: "JAX",
    position: "QB", overall: 70, tier: 4, startingBid: 2, espnId: 3059989,
    attr: {
      armStrength: 78, shortAccuracy: 80, deepAccuracy: 79, pocketAwareness: 78, decisionMaking: 54, consistency: 75, clutch: 52, mobility: 49,
    },
    strengths: [],
    weaknesses: ["mobility","clutch"],
  },
  {
    id: "nnamdi-madubuike", name: "Nnamdi Madubuike", team: "BAL",
    position: "EDGE", overall: 70, tier: 4, startingBid: 2, espnId: 4035245,
    attr: {
      speed: 69, power: 70, passRush: 72, runStop: 64, tackling: 60, strength: 68,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "pat-surtain-ii", name: "Pat Surtain II", team: "DEN",
    position: "CB", overall: 70, tier: 4, startingBid: 2, espnId: 4372012,
    attr: {
      speed: 73, agility: 73, tackling: 57, coverage: 70, ballHawk: 65,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "ronald-darby", name: "Ronald Darby", team: "JAX",
    position: "CB", overall: 70, tier: 4, startingBid: 2, espnId: 2969920,
    attr: {
      speed: 75, agility: 75, tackling: 64, coverage: 72, ballHawk: 58,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "russell-wilson", name: "Russell Wilson", team: "NYG",
    position: "QB", overall: 70, tier: 4, startingBid: 2, espnId: 14881,
    attr: {
      armStrength: 72, shortAccuracy: 61, deepAccuracy: 70, pocketAwareness: 84, decisionMaking: 74, consistency: 64, clutch: 71, mobility: 59,
    },
    strengths: ["pocket presence"],
    weaknesses: [],
  },
  {
    id: "samaje-perine", name: "Samaje Perine", team: "CIN",
    position: "RB", overall: 70, tier: 4, startingBid: 2, espnId: 3116389,
    attr: {
      speed: 79, agility: 75, power: 55, vision: 80, catching: 55, yac: 70, clutch: 50,
    },
    strengths: [],
    weaknesses: ["clutch","power"],
  },
  {
    id: "sean-tucker", name: "Sean Tucker", team: "TB",
    position: "RB", overall: 70, tier: 4, startingBid: 2, espnId: 4430871,
    attr: {
      speed: 80, agility: 77, power: 55, vision: 82, catching: 45, yac: 71, clutch: 56,
    },
    strengths: ["vision"],
    weaknesses: ["hands","power"],
  },
  {
    id: "tank-dell", name: "Tank Dell", team: "HOU",
    position: "WR", overall: 70, tier: 4, startingBid: 2, espnId: 4366031,
    attr: {
      speed: 82, catching: 68, routeRunning: 64, separation: 63, contestedCatch: 67, yac: 84, clutch: 51,
    },
    strengths: ["yards after catch","speed"],
    weaknesses: ["clutch"],
  },
  {
    id: "tony-pollard", name: "Tony Pollard", team: "TEN",
    position: "RB", overall: 70, tier: 4, startingBid: 2, espnId: 3916148,
    attr: {
      speed: 73, agility: 69, power: 76, vision: 73, catching: 55, yac: 64, clutch: 54,
    },
    strengths: [],
    weaknesses: ["clutch","hands"],
  },
  {
    id: "azareyeh-thomas", name: "Azareye'h Thomas", team: "NYJ",
    position: "CB", overall: 69, tier: 4, startingBid: 2, espnId: 4685596,
    attr: {
      speed: 73, agility: 73, tackling: 56, coverage: 71, ballHawk: 58,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "azeez-al-shaair", name: "Azeez Al-Shaair", team: "HOU",
    position: "LB", overall: 69, tier: 4, startingBid: 2, espnId: 3919117,
    attr: {
      speed: 68, passRush: 45, runStop: 73, tackling: 76, coverage: 56, ballHawk: 54, awareness: 74,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "brandon-dorlus", name: "Brandon Dorlus", team: "ATL",
    position: "EDGE", overall: 69, tier: 4, startingBid: 2, espnId: 4427090,
    attr: {
      speed: 68, power: 69, passRush: 71, runStop: 63, tackling: 50, strength: 67,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "brenton-strange", name: "Brenton Strange", team: "JAX",
    position: "TE", overall: 69, tier: 4, startingBid: 2, espnId: 4430539,
    attr: {
      speed: 68, catching: 94, routeRunning: 55, separation: 55, contestedCatch: 88, yac: 66, runBlock: 62, passBlock: 60, clutch: 51,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["clutch","route running"],
  },
  {
    id: "calijah-kancey", name: "Calijah Kancey", team: "TB",
    position: "EDGE", overall: 69, tier: 4, startingBid: 2, espnId: 4427673,
    attr: {
      speed: 67, power: 72, passRush: 69, runStop: 70, tackling: 50, strength: 73,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "charlie-kolar", name: "Charlie Kolar", team: "BAL",
    position: "TE", overall: 69, tier: 4, startingBid: 2, espnId: 4241263,
    attr: {
      speed: 91, catching: 91, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 92, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["yards after catch","hands","speed"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "cooper-kupp", name: "Cooper Kupp", team: "SEA",
    position: "WR", overall: 69, tier: 4, startingBid: 2, espnId: 2977187,
    attr: {
      speed: 72, catching: 77, routeRunning: 63, separation: 63, contestedCatch: 77, yac: 72, clutch: 55,
    },
    strengths: [],
    weaknesses: ["clutch"],
  },
  {
    id: "daniel-bellinger", name: "Daniel Bellinger", team: "TEN",
    position: "TE", overall: 69, tier: 4, startingBid: 2, espnId: 4361516,
    attr: {
      speed: 77, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 78, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "darnell-mooney", name: "Darnell Mooney", team: "NYG",
    position: "WR", overall: 69, tier: 4, startingBid: 2, espnId: 4040655,
    attr: {
      speed: 94, catching: 50, routeRunning: 63, separation: 62, contestedCatch: 48, yac: 92, clutch: 50,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["contested catch","hands"],
  },
  {
    id: "deebo-samuel-sr", name: "Deebo Samuel Sr.", team: "SF",
    position: "WR", overall: 69, tier: 4, startingBid: 2, espnId: 3126486,
    attr: {
      speed: 70, catching: 81, routeRunning: 62, separation: 62, contestedCatch: 81, yac: 68, clutch: 56,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "deforest-buckner", name: "DeForest Buckner", team: "IND",
    position: "EDGE", overall: 69, tier: 4, startingBid: 2, espnId: 2971282,
    attr: {
      speed: 67, power: 71, passRush: 70, runStop: 67, tackling: 80, strength: 70,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "dj-moore", name: "DJ Moore", team: "BUF",
    position: "WR", overall: 69, tier: 4, startingBid: 2, espnId: 3915416,
    attr: {
      speed: 71, catching: 75, routeRunning: 66, separation: 65, contestedCatch: 74, yac: 70, clutch: 66,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "ej-speed", name: "E.J. Speed", team: "IND",
    position: "LB", overall: 69, tier: 4, startingBid: 2, espnId: 3071353,
    attr: {
      speed: 70, passRush: 45, runStop: 76, tackling: 79, coverage: 45, ballHawk: 47, awareness: 78,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "george-karlaftis", name: "George Karlaftis", team: "KC",
    position: "EDGE", overall: 69, tier: 4, startingBid: 2, espnId: 4426659,
    attr: {
      speed: 68, power: 69, passRush: 71, runStop: 63, tackling: 58, strength: 67,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "harrison-smith", name: "Harrison Smith", team: "MIN",
    position: "S", overall: 69, tier: 4, startingBid: 2, espnId: 14945,
    attr: {
      speed: 74, passRush: 41, runStop: 65, tackling: 69, coverage: 72, ballHawk: 65,
    },
    strengths: [],
    weaknesses: ["pass rush"],
  },
  {
    id: "jack-jones", name: "Jack Jones", team: "SF",
    position: "CB", overall: 69, tier: 4, startingBid: 2, espnId: 4035686,
    attr: {
      speed: 73, agility: 72, tackling: 68, coverage: 69, ballHawk: 63,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "josh-jacobs", name: "Josh Jacobs", team: "GB",
    position: "RB", overall: 69, tier: 4, startingBid: 2, espnId: 4047365,
    attr: {
      speed: 70, agility: 65, power: 79, vision: 69, catching: 64, yac: 60, clutch: 84,
    },
    strengths: ["clutch"],
    weaknesses: [],
  },
  {
    id: "kyle-pitts-sr", name: "Kyle Pitts Sr.", team: "ATL",
    position: "TE", overall: 69, tier: 4, startingBid: 2, espnId: 4360248,
    attr: {
      speed: 71, catching: 84, routeRunning: 61, separation: 61, contestedCatch: 83, yac: 70, runBlock: 62, passBlock: 60, clutch: 54,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["clutch"],
  },
  {
    id: "marcus-jones", name: "Marcus Jones", team: "NE",
    position: "CB", overall: 69, tier: 4, startingBid: 2, espnId: 4241720,
    attr: {
      speed: 73, agility: 72, tackling: 67, coverage: 69, ballHawk: 64,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "marshon-lattimore", name: "Marshon Lattimore", team: "NO",
    position: "CB", overall: 69, tier: 4, startingBid: 2, espnId: 3121421,
    attr: {
      speed: 73, agility: 73, tackling: 64, coverage: 70, ballHawk: 60,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "michael-wilson", name: "Michael Wilson", team: "ARI",
    position: "WR", overall: 69, tier: 4, startingBid: 2, espnId: 4360761,
    attr: {
      speed: 78, catching: 70, routeRunning: 64, separation: 63, contestedCatch: 69, yac: 78, clutch: 59,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "mike-gesicki", name: "Mike Gesicki", team: "CIN",
    position: "TE", overall: 69, tier: 4, startingBid: 2, espnId: 3116164,
    attr: {
      speed: 66, catching: 93, routeRunning: 56, separation: 56, contestedCatch: 88, yac: 64, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["clutch"],
  },
  {
    id: "montez-sweat", name: "Montez Sweat", team: "CHI",
    position: "EDGE", overall: 69, tier: 4, startingBid: 2, espnId: 3134690,
    attr: {
      speed: 68, power: 70, passRush: 71, runStop: 65, tackling: 57, strength: 69,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "pat-freiermuth", name: "Pat Freiermuth", team: "PIT",
    position: "TE", overall: 69, tier: 4, startingBid: 2, espnId: 4361411,
    attr: {
      speed: 66, catching: 95, routeRunning: 55, separation: 55, contestedCatch: 88, yac: 63, runBlock: 62, passBlock: 60, clutch: 61,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "quincy-williams", name: "Quincy Williams", team: "CLE",
    position: "LB", overall: 69, tier: 4, startingBid: 2, espnId: 3110565,
    attr: {
      speed: 68, passRush: 51, runStop: 76, tackling: 76, coverage: 53, ballHawk: 49, awareness: 75,
    },
    strengths: [],
    weaknesses: ["ball skills","pass rush"],
  },
  {
    id: "rome-odunze", name: "Rome Odunze", team: "CHI",
    position: "WR", overall: 69, tier: 4, startingBid: 2, espnId: 4431299,
    attr: {
      speed: 93, catching: 50, routeRunning: 64, separation: 63, contestedCatch: 48, yac: 92, clutch: 56,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["contested catch","hands"],
  },
  {
    id: "terrel-bernard", name: "Terrel Bernard", team: "BUF",
    position: "LB", overall: 69, tier: 4, startingBid: 2, espnId: 4259166,
    attr: {
      speed: 70, passRush: 45, runStop: 76, tackling: 78, coverage: 45, ballHawk: 51, awareness: 77,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "terrion-arnold", name: "Terrion Arnold", team: "DET",
    position: "CB", overall: 69, tier: 4, startingBid: 2, espnId: 4592837,
    attr: {
      speed: 74, agility: 73, tackling: 65, coverage: 70, ballHawk: 59,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "trevor-lawrence", name: "Trevor Lawrence", team: "JAX",
    position: "QB", overall: 69, tier: 4, startingBid: 2, espnId: 4360310,
    attr: {
      armStrength: 70, shortAccuracy: 57, deepAccuracy: 67, pocketAwareness: 79, decisionMaking: 77, consistency: 60, clutch: 81, mobility: 62,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "tutu-atwell", name: "Tutu Atwell", team: "LAR",
    position: "WR", overall: 69, tier: 4, startingBid: 2, espnId: 4360797,
    attr: {
      speed: 95, catching: 68, routeRunning: 53, separation: 53, contestedCatch: 66, yac: 92, clutch: 50,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["clutch","route running"],
  },
  {
    id: "tyrell-shavers", name: "Tyrell Shavers", team: "BUF",
    position: "WR", overall: 69, tier: 4, startingBid: 2, espnId: 4241476,
    attr: {
      speed: 95, catching: 73, routeRunning: 50, separation: 50, contestedCatch: 72, yac: 92, clutch: 50,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "tyrone-tracy-jr", name: "Tyrone Tracy Jr.", team: "NYG",
    position: "RB", overall: 69, tier: 4, startingBid: 2, espnId: 4360516,
    attr: {
      speed: 73, agility: 68, power: 67, vision: 73, catching: 61, yac: 63, clutch: 55,
    },
    strengths: [],
    weaknesses: ["clutch"],
  },
  {
    id: "zach-sieler", name: "Zach Sieler", team: "MIA",
    position: "EDGE", overall: 69, tier: 4, startingBid: 2, espnId: 3057956,
    attr: {
      speed: 67, power: 71, passRush: 69, runStop: 67, tackling: 63, strength: 71,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "antonio-gibson", name: "Antonio Gibson", team: "NE",
    position: "RB", overall: 68, tier: 4, startingBid: 2, espnId: 4360294,
    attr: {
      speed: 76, agility: 72, power: 57, vision: 77, catching: 51, yac: 67, clutch: 50,
    },
    strengths: [],
    weaknesses: ["clutch","hands"],
  },
  {
    id: "barrett-carter", name: "Barrett Carter", team: "CIN",
    position: "LB", overall: 68, tier: 4, startingBid: 2, espnId: 4431519,
    attr: {
      speed: 69, passRush: 45, runStop: 73, tackling: 77, coverage: 47, ballHawk: 49, awareness: 76,
    },
    strengths: [],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "bo-nix", name: "Bo Nix", team: "DEN",
    position: "QB", overall: 68, tier: 4, startingBid: 2, espnId: 4426338,
    attr: {
      armStrength: 55, shortAccuracy: 68, deepAccuracy: 52, pocketAwareness: 83, decisionMaking: 76, consistency: 70, clutch: 75, mobility: 69,
    },
    strengths: ["pocket presence"],
    weaknesses: ["deep ball","arm strength"],
  },
  {
    id: "charvarius-ward", name: "Charvarius Ward", team: "IND",
    position: "CB", overall: 68, tier: 4, startingBid: 2, espnId: 4037361,
    attr: {
      speed: 73, agility: 73, tackling: 67, coverage: 70, ballHawk: 57,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "colston-loveland", name: "Colston Loveland", team: "CHI",
    position: "TE", overall: 68, tier: 4, startingBid: 2, espnId: 4723086,
    attr: {
      speed: 81, catching: 71, routeRunning: 64, separation: 63, contestedCatch: 70, yac: 83, runBlock: 62, passBlock: 60, clutch: 59,
    },
    strengths: ["yards after catch"],
    weaknesses: [],
  },
  {
    id: "david-montgomery", name: "David Montgomery", team: "HOU",
    position: "RB", overall: 68, tier: 4, startingBid: 2, espnId: 4035538,
    attr: {
      speed: 72, agility: 67, power: 67, vision: 72, catching: 60, yac: 62, clutch: 74,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "demetrius-knight-jr", name: "Demetrius Knight Jr.", team: "CIN",
    position: "LB", overall: 68, tier: 4, startingBid: 2, espnId: 4427729,
    attr: {
      speed: 66, passRush: 50, runStop: 71, tackling: 74, coverage: 55, ballHawk: 57, awareness: 73,
    },
    strengths: [],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "derwin-james-jr", name: "Derwin James Jr.", team: "LAC",
    position: "S", overall: 68, tier: 4, startingBid: 2, espnId: 3691739,
    attr: {
      speed: 65, passRush: 59, runStop: 78, tackling: 83, coverage: 61, ballHawk: 57,
    },
    strengths: ["tackling"],
    weaknesses: [],
  },
  {
    id: "devin-lloyd", name: "Devin Lloyd", team: "CAR",
    position: "LB", overall: 68, tier: 4, startingBid: 2, espnId: 4243256,
    attr: {
      speed: 67, passRush: 45, runStop: 74, tackling: 75, coverage: 52, ballHawk: 59, awareness: 74,
    },
    strengths: [],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "donte-jackson", name: "Donte Jackson", team: "LAC",
    position: "CB", overall: 68, tier: 4, startingBid: 2, espnId: 3843769,
    attr: {
      speed: 70, agility: 69, tackling: 46, coverage: 66, ballHawk: 70,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "foster-moreau", name: "Foster Moreau", team: "HOU",
    position: "TE", overall: 68, tier: 4, startingBid: 2, espnId: 3843945,
    attr: {
      speed: 74, catching: 94, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 74, runBlock: 62, passBlock: 60, clutch: 51,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "hunter-henry", name: "Hunter Henry", team: "NE",
    position: "TE", overall: 68, tier: 4, startingBid: 2, espnId: 3046439,
    attr: {
      speed: 71, catching: 80, routeRunning: 60, separation: 59, contestedCatch: 79, yac: 71, runBlock: 62, passBlock: 60, clutch: 55,
    },
    strengths: [],
    weaknesses: ["clutch"],
  },
  {
    id: "jackson-hawes", name: "Jackson Hawes", team: "BUF",
    position: "TE", overall: 68, tier: 4, startingBid: 2, espnId: 4573699,
    attr: {
      speed: 73, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 73, runBlock: 62, passBlock: 60, clutch: 52,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "jacob-cowing", name: "Jacob Cowing", team: "SF",
    position: "WR", overall: 68, tier: 4, startingBid: 2, espnId: 4575665,
    attr: {
      speed: 95, catching: 76, routeRunning: 48, separation: 48, contestedCatch: 75, yac: 92, clutch: 50,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "jerry-jeudy", name: "Jerry Jeudy", team: "CLE",
    position: "WR", overall: 68, tier: 4, startingBid: 2, espnId: 4241463,
    attr: {
      speed: 82, catching: 52, routeRunning: 68, separation: 67, contestedCatch: 50, yac: 84, clutch: 50,
    },
    strengths: ["yards after catch","speed"],
    weaknesses: ["contested catch","clutch"],
  },
  {
    id: "jessie-bates-iii", name: "Jessie Bates III", team: "ATL",
    position: "S", overall: 68, tier: 4, startingBid: 2, espnId: 3919512,
    attr: {
      speed: 64, passRush: 40, runStop: 76, tackling: 81, coverage: 60, ballHawk: 62,
    },
    strengths: [],
    weaknesses: ["pass rush"],
  },
  {
    id: "jordan-hicks", name: "Jordan Hicks", team: "CLE",
    position: "LB", overall: 68, tier: 4, startingBid: 2, espnId: 2514270,
    attr: {
      speed: 68, passRush: 50, runStop: 73, tackling: 76, coverage: 52, ballHawk: 49, awareness: 74,
    },
    strengths: [],
    weaknesses: ["ball skills","pass rush"],
  },
  {
    id: "keisean-nixon", name: "Keisean Nixon", team: "GB",
    position: "CB", overall: 68, tier: 4, startingBid: 2, espnId: 4259493,
    attr: {
      speed: 72, agility: 71, tackling: 73, coverage: 69, ballHawk: 61,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "kevin-byard", name: "Kevin Byard", team: "NE",
    position: "S", overall: 68, tier: 4, startingBid: 2, espnId: 2574056,
    attr: {
      speed: 62, passRush: 40, runStop: 81, tackling: 86, coverage: 58, ballHawk: 61,
    },
    strengths: ["tackling"],
    weaknesses: ["pass rush"],
  },
  {
    id: "kyle-hamilton", name: "Kyle Hamilton", team: "BAL",
    position: "S", overall: 68, tier: 4, startingBid: 2, espnId: 4575517,
    attr: {
      speed: 66, passRush: 44, runStop: 80, tackling: 86, coverage: 62, ballHawk: 53,
    },
    strengths: ["tackling"],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "logan-wilson", name: "Logan Wilson", team: "CIN",
    position: "LB", overall: 68, tier: 4, startingBid: 2, espnId: 3918330,
    attr: {
      speed: 69, passRush: 45, runStop: 73, tackling: 77, coverage: 47, ballHawk: 46, awareness: 76,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "luke-mccaffrey", name: "Luke McCaffrey", team: "WSH",
    position: "WR", overall: 68, tier: 4, startingBid: 2, espnId: 4426948,
    attr: {
      speed: 80, catching: 89, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 82, clutch: 50,
    },
    strengths: ["hands","contested catch","yards after catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "mack-hollins", name: "Mack Hollins", team: "NE",
    position: "WR", overall: 68, tier: 4, startingBid: 2, espnId: 2991662,
    attr: {
      speed: 83, catching: 76, routeRunning: 53, separation: 53, contestedCatch: 75, yac: 85, clutch: 53,
    },
    strengths: ["yards after catch","speed"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "marcus-mariota", name: "Marcus Mariota", team: "WSH",
    position: "QB", overall: 68, tier: 4, startingBid: 2, espnId: 2576980,
    attr: {
      armStrength: 71, shortAccuracy: 63, deepAccuracy: 70, pocketAwareness: 71, decisionMaking: 70, consistency: 65, clutch: 74, mobility: 68,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "mark-andrews", name: "Mark Andrews", team: "BAL",
    position: "TE", overall: 68, tier: 4, startingBid: 2, espnId: 3116365,
    attr: {
      speed: 67, catching: 92, routeRunning: 54, separation: 54, contestedCatch: 88, yac: 65, runBlock: 62, passBlock: 60, clutch: 68,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "matthew-golden", name: "Matthew Golden", team: "GB",
    position: "WR", overall: 68, tier: 4, startingBid: 2, espnId: 4701936,
    attr: {
      speed: 87, catching: 70, routeRunning: 54, separation: 54, contestedCatch: 69, yac: 91, clutch: 50,
    },
    strengths: ["yards after catch","speed"],
    weaknesses: ["clutch","route running"],
  },
  {
    id: "michael-pittman-jr", name: "Michael Pittman Jr.", team: "PIT",
    position: "WR", overall: 68, tier: 4, startingBid: 2, espnId: 4035687,
    attr: {
      speed: 67, catching: 78, routeRunning: 65, separation: 64, contestedCatch: 78, yac: 66, clutch: 57,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "montaric-brown", name: "Montaric Brown", team: "JAX",
    position: "CB", overall: 68, tier: 4, startingBid: 2, espnId: 4242149,
    attr: {
      speed: 72, agility: 71, tackling: 72, coverage: 68, ballHawk: 61,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "omarion-hampton", name: "Omarion Hampton", team: "LAC",
    position: "RB", overall: 68, tier: 4, startingBid: 2, espnId: 4685382,
    attr: {
      speed: 71, agility: 67, power: 69, vision: 71, catching: 61, yac: 62, clutch: 66,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "quentin-johnston", name: "Quentin Johnston", team: "LAC",
    position: "WR", overall: 68, tier: 4, startingBid: 2, espnId: 4429025,
    attr: {
      speed: 84, catching: 56, routeRunning: 64, separation: 63, contestedCatch: 54, yac: 87, clutch: 74,
    },
    strengths: ["yards after catch","speed"],
    weaknesses: ["contested catch"],
  },
  {
    id: "sauce-gardner", name: "Sauce Gardner", team: "IND",
    position: "CB", overall: 68, tier: 4, startingBid: 2, espnId: 4427250,
    attr: {
      speed: 73, agility: 72, tackling: 59, coverage: 69, ballHawk: 59,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "tj-hockenson", name: "T.J. Hockenson", team: "MIN",
    position: "TE", overall: 68, tier: 4, startingBid: 2, espnId: 4036133,
    attr: {
      speed: 61, catching: 91, routeRunning: 56, separation: 56, contestedCatch: 88, yac: 57, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["clutch"],
  },
  {
    id: "teddye-buchanan", name: "Teddye Buchanan", team: "BAL",
    position: "LB", overall: 68, tier: 4, startingBid: 2, espnId: 4698244,
    attr: {
      speed: 69, passRush: 45, runStop: 75, tackling: 77, coverage: 45, ballHawk: 45, awareness: 76,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "travon-walker", name: "Travon Walker", team: "JAX",
    position: "EDGE", overall: 68, tier: 4, startingBid: 2, espnId: 4426349,
    attr: {
      speed: 67, power: 69, passRush: 69, runStop: 64, tackling: 63, strength: 68,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "aaron-rodgers", name: "Aaron Rodgers", team: "PIT",
    position: "QB", overall: 67, tier: 4, startingBid: 2, espnId: 8439,
    attr: {
      armStrength: 57, shortAccuracy: 66, deepAccuracy: 54, pocketAwareness: 86, decisionMaking: 78, consistency: 68, clutch: 75, mobility: 47,
    },
    strengths: ["pocket presence"],
    weaknesses: ["mobility","deep ball"],
  },
  {
    id: "adam-thielen", name: "Adam Thielen", team: "PIT",
    position: "WR", overall: 67, tier: 4, startingBid: 2, espnId: 16460,
    attr: {
      speed: 75, catching: 83, routeRunning: 54, separation: 53, contestedCatch: 83, yac: 75, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["clutch","separation"],
  },
  {
    id: "adoree-jackson", name: "Adoree' Jackson", team: "NYG",
    position: "CB", overall: 67, tier: 4, startingBid: 2, espnId: 3120347,
    attr: {
      speed: 72, agility: 71, tackling: 62, coverage: 68, ballHawk: 58,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "amani-hooker", name: "Amani Hooker", team: "TEN",
    position: "S", overall: 67, tier: 4, startingBid: 2, espnId: 4036134,
    attr: {
      speed: 68, passRush: 40, runStop: 70, tackling: 74, coverage: 65, ballHawk: 62,
    },
    strengths: [],
    weaknesses: ["pass rush"],
  },
  {
    id: "austin-hooper", name: "Austin Hooper", team: "NE",
    position: "TE", overall: 67, tier: 4, startingBid: 2, espnId: 3043275,
    attr: {
      speed: 69, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 67, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "byron-murphy-jr", name: "Byron Murphy Jr.", team: "MIN",
    position: "CB", overall: 67, tier: 4, startingBid: 2, espnId: 4038999,
    attr: {
      speed: 70, agility: 69, tackling: 73, coverage: 66, ballHawk: 67,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "cj-stroud", name: "C.J. Stroud", team: "HOU",
    position: "QB", overall: 67, tier: 4, startingBid: 2, espnId: 4432577,
    attr: {
      armStrength: 67, shortAccuracy: 64, deepAccuracy: 64, pocketAwareness: 80, decisionMaking: 67, consistency: 67, clutch: 68, mobility: 60,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "caleb-williams", name: "Caleb Williams", team: "CHI",
    position: "QB", overall: 67, tier: 4, startingBid: 2, espnId: 4431611,
    attr: {
      armStrength: 60, shortAccuracy: 52, deepAccuracy: 56, pocketAwareness: 88, decisionMaking: 77, consistency: 56, clutch: 71, mobility: 74,
    },
    strengths: ["pocket presence"],
    weaknesses: ["short accuracy"],
  },
  {
    id: "cam-hart", name: "Cam Hart", team: "LAC",
    position: "CB", overall: 67, tier: 4, startingBid: 2, espnId: 4427404,
    attr: {
      speed: 72, agility: 71, tackling: 56, coverage: 68, ballHawk: 58,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "cameron-jordan", name: "Cameron Jordan", team: "NO",
    position: "EDGE", overall: 67, tier: 4, startingBid: 2, espnId: 13971,
    attr: {
      speed: 66, power: 69, passRush: 68, runStop: 65, tackling: 56, strength: 69,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "darius-slayton", name: "Darius Slayton", team: "NYG",
    position: "WR", overall: 67, tier: 4, startingBid: 2, espnId: 3916945,
    attr: {
      speed: 92, catching: 54, routeRunning: 57, separation: 56, contestedCatch: 52, yac: 92, clutch: 50,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["clutch","contested catch"],
  },
  {
    id: "darren-waller", name: "Darren Waller", team: "CAR",
    position: "TE", overall: 67, tier: 4, startingBid: 2, espnId: 2576925,
    attr: {
      speed: 72, catching: 85, routeRunning: 55, separation: 54, contestedCatch: 84, yac: 72, runBlock: 62, passBlock: 60, clutch: 82,
    },
    strengths: ["hands","contested catch","clutch"],
    weaknesses: ["separation","route running"],
  },
  {
    id: "deonte-banks", name: "Deonte Banks", team: "NYG",
    position: "CB", overall: 67, tier: 4, startingBid: 2, espnId: 4428328,
    attr: {
      speed: 71, agility: 71, tackling: 56, coverage: 68, ballHawk: 56,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "devaughn-vele", name: "Devaughn Vele", team: "NO",
    position: "WR", overall: 67, tier: 4, startingBid: 2, espnId: 4569559,
    attr: {
      speed: 71, catching: 83, routeRunning: 55, separation: 55, contestedCatch: 82, yac: 71, clutch: 54,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["clutch","route running"],
  },
  {
    id: "devin-bush", name: "Devin Bush", team: "CHI",
    position: "LB", overall: 67, tier: 4, startingBid: 2, espnId: 4036261,
    attr: {
      speed: 66, passRush: 45, runStop: 73, tackling: 74, coverage: 52, ballHawk: 54, awareness: 73,
    },
    strengths: [],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "grant-calcaterra", name: "Grant Calcaterra", team: "PHI",
    position: "TE", overall: 67, tier: 4, startingBid: 2, espnId: 4241374,
    attr: {
      speed: 69, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 68, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "jacoby-brissett", name: "Jacoby Brissett", team: "ARI",
    position: "QB", overall: 67, tier: 4, startingBid: 2, espnId: 2578570,
    attr: {
      armStrength: 57, shortAccuracy: 67, deepAccuracy: 53, pocketAwareness: 89, decisionMaking: 74, consistency: 69, clutch: 67, mobility: 55,
    },
    strengths: ["pocket presence"],
    weaknesses: ["deep ball","mobility"],
  },
  {
    id: "jake-ferguson", name: "Jake Ferguson", team: "DAL",
    position: "TE", overall: 67, tier: 4, startingBid: 2, espnId: 4242355,
    attr: {
      speed: 55, catching: 95, routeRunning: 55, separation: 54, contestedCatch: 88, yac: 50, runBlock: 62, passBlock: 60, clutch: 54,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["yards after catch","separation"],
  },
  {
    id: "jaleel-mclaughlin", name: "Jaleel McLaughlin", team: "DEN",
    position: "RB", overall: 67, tier: 4, startingBid: 2, espnId: 4722893,
    attr: {
      speed: 76, agility: 72, power: 56, vision: 77, catching: 45, yac: 67, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "jamel-dean", name: "Jamel Dean", team: "PIT",
    position: "CB", overall: 67, tier: 4, startingBid: 2, espnId: 3873935,
    attr: {
      speed: 70, agility: 69, tackling: 68, coverage: 67, ballHawk: 63,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "jonnu-smith", name: "Jonnu Smith", team: "GB",
    position: "TE", overall: 67, tier: 4, startingBid: 2, espnId: 3054212,
    attr: {
      speed: 55, catching: 95, routeRunning: 53, separation: 53, contestedCatch: 88, yac: 50, runBlock: 62, passBlock: 60, clutch: 56,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["yards after catch","route running"],
  },
  {
    id: "jordan-whitehead", name: "Jordan Whitehead", team: "TB",
    position: "LB", overall: 67, tier: 4, startingBid: 2, espnId: 3895798,
    attr: {
      speed: 68, passRush: 45, runStop: 73, tackling: 76, coverage: 48, ballHawk: 46, awareness: 75,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "jordan-whittington", name: "Jordan Whittington", team: "LAR",
    position: "WR", overall: 67, tier: 4, startingBid: 2, espnId: 4569382,
    attr: {
      speed: 74, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 73, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "josh-oliver", name: "Josh Oliver", team: "MIN",
    position: "TE", overall: 67, tier: 4, startingBid: 2, espnId: 3921690,
    attr: {
      speed: 69, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 68, runBlock: 62, passBlock: 60, clutch: 56,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "joshua-palmer", name: "Joshua Palmer", team: "BUF",
    position: "WR", overall: 67, tier: 4, startingBid: 2, espnId: 4242433,
    attr: {
      speed: 94, catching: 60, routeRunning: 54, separation: 53, contestedCatch: 59, yac: 92, clutch: 50,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["clutch","separation"],
  },
  {
    id: "justin-fields", name: "Justin Fields", team: "PIT",
    position: "QB", overall: 67, tier: 4, startingBid: 2, espnId: 4362887,
    attr: {
      armStrength: 55, shortAccuracy: 64, deepAccuracy: 52, pocketAwareness: 83, decisionMaking: 71, consistency: 65, clutch: 60, mobility: 75,
    },
    strengths: ["pocket presence"],
    weaknesses: ["deep ball","arm strength"],
  },
  {
    id: "kalif-raymond", name: "Kalif Raymond", team: "CHI",
    position: "WR", overall: 67, tier: 4, startingBid: 2, espnId: 2973405,
    attr: {
      speed: 75, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 75, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "kavontae-turpin", name: "KaVontae Turpin", team: "DAL",
    position: "WR", overall: 67, tier: 4, startingBid: 2, espnId: 3676833,
    attr: {
      speed: 90, catching: 70, routeRunning: 49, separation: 49, contestedCatch: 69, yac: 92, clutch: 50,
    },
    strengths: ["yards after catch","speed"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "kobie-turner", name: "Kobie Turner", team: "LAR",
    position: "EDGE", overall: 67, tier: 4, startingBid: 2, espnId: 4250621,
    attr: {
      speed: 66, power: 67, passRush: 69, runStop: 61, tackling: 65, strength: 65,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "lacale-london", name: "LaCale London", team: "ATL",
    position: "EDGE", overall: 67, tier: 4, startingBid: 2, espnId: 4376288,
    attr: {
      speed: 66, power: 67, passRush: 68, runStop: 63, tackling: 61, strength: 66,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "mack-wilson-sr", name: "Mack Wilson Sr.", team: "ARI",
    position: "LB", overall: 67, tier: 4, startingBid: 2, espnId: 4040983,
    attr: {
      speed: 63, passRush: 47, runStop: 69, tackling: 70, coverage: 61, ballHawk: 58, awareness: 70,
    },
    strengths: [],
    weaknesses: ["pass rush"],
  },
  {
    id: "nahshon-wright", name: "Nahshon Wright", team: "NYJ",
    position: "CB", overall: 67, tier: 4, startingBid: 2, espnId: 4570470,
    attr: {
      speed: 69, agility: 68, tackling: 70, coverage: 65, ballHawk: 68,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "nick-cross", name: "Nick Cross", team: "WSH",
    position: "S", overall: 67, tier: 4, startingBid: 2, espnId: 4426403,
    attr: {
      speed: 57, passRush: 45, runStop: 90, tackling: 92, coverage: 52, ballHawk: 53,
    },
    strengths: ["tackling","run defense"],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "noah-fant", name: "Noah Fant", team: "NO",
    position: "TE", overall: 67, tier: 4, startingBid: 2, espnId: 4036131,
    attr: {
      speed: 59, catching: 95, routeRunning: 51, separation: 51, contestedCatch: 88, yac: 55, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["clutch","route running"],
  },
  {
    id: "rachaad-white", name: "Rachaad White", team: "WSH",
    position: "RB", overall: 67, tier: 4, startingBid: 2, espnId: 4697815,
    attr: {
      speed: 71, agility: 67, power: 61, vision: 71, catching: 62, yac: 62, clutch: 59,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "rashod-bateman", name: "Rashod Bateman", team: "BAL",
    position: "WR", overall: 67, tier: 4, startingBid: 2, espnId: 4360939,
    attr: {
      speed: 95, catching: 60, routeRunning: 54, separation: 54, contestedCatch: 58, yac: 92, clutch: 66,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "stone-smartt", name: "Stone Smartt", team: "NYJ",
    position: "TE", overall: 67, tier: 4, startingBid: 2, espnId: 4250764,
    attr: {
      speed: 70, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 69, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "tyler-warren", name: "Tyler Warren", team: "IND",
    position: "TE", overall: 67, tier: 4, startingBid: 2, espnId: 4431459,
    attr: {
      speed: 65, catching: 78, routeRunning: 63, separation: 62, contestedCatch: 77, yac: 63, runBlock: 62, passBlock: 60, clutch: 56,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "zay-jones", name: "Zay Jones", team: "ARI",
    position: "WR", overall: 67, tier: 4, startingBid: 2, espnId: 3059722,
    attr: {
      speed: 84, catching: 81, routeRunning: 48, separation: 48, contestedCatch: 81, yac: 87, clutch: 50,
    },
    strengths: ["yards after catch","speed"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "akeem-davis-gaither", name: "Akeem Davis-Gaither", team: "IND",
    position: "LB", overall: 66, tier: 4, startingBid: 2, espnId: 3917142,
    attr: {
      speed: 66, passRush: 45, runStop: 71, tackling: 74, coverage: 49, ballHawk: 51, awareness: 73,
    },
    strengths: [],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "alex-wright", name: "Alex Wright", team: "CLE",
    position: "EDGE", overall: 66, tier: 4, startingBid: 2, espnId: 4570119,
    attr: {
      speed: 63, power: 69, passRush: 65, runStop: 68, tackling: 57, strength: 71,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "andrew-wingard", name: "Andrew Wingard", team: "ARI",
    position: "S", overall: 66, tier: 4, startingBid: 2, espnId: 3918331,
    attr: {
      speed: 70, passRush: 40, runStop: 67, tackling: 71, coverage: 67, ballHawk: 58,
    },
    strengths: [],
    weaknesses: ["pass rush"],
  },
  {
    id: "antoine-winfield-jr", name: "Antoine Winfield Jr.", team: "TB",
    position: "S", overall: 66, tier: 4, startingBid: 2, espnId: 4034790,
    attr: {
      speed: 62, passRush: 47, runStop: 79, tackling: 85, coverage: 58, ballHawk: 53,
    },
    strengths: ["tackling"],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "ben-sinnott", name: "Ben Sinnott", team: "WSH",
    position: "TE", overall: 66, tier: 4, startingBid: 2, espnId: 4690923,
    attr: {
      speed: 60, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 56, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "brandon-graham", name: "Brandon Graham", team: "PHI",
    position: "EDGE", overall: 66, tier: 4, startingBid: 2, espnId: 13239,
    attr: {
      speed: 67, power: 67, passRush: 69, runStop: 60, tackling: 51, strength: 65,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "british-brooks", name: "British Brooks", team: "HOU",
    position: "RB", overall: 66, tier: 4, startingBid: 2, espnId: 4373273,
    attr: {
      speed: 75, agility: 71, power: 55, vision: 76, catching: 45, yac: 66, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "budda-baker", name: "Budda Baker", team: "ARI",
    position: "S", overall: 66, tier: 4, startingBid: 2, espnId: 3127287,
    attr: {
      speed: 57, passRush: 44, runStop: 90, tackling: 92, coverage: 52, ballHawk: 48,
    },
    strengths: ["tackling","run defense"],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "cade-otton", name: "Cade Otton", team: "TB",
    position: "TE", overall: 66, tier: 4, startingBid: 2, espnId: 4243331,
    attr: {
      speed: 62, catching: 84, routeRunning: 58, separation: 58, contestedCatch: 84, yac: 58, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["clutch"],
  },
  {
    id: "cam-akers", name: "Cam Akers", team: "HOU",
    position: "RB", overall: 66, tier: 4, startingBid: 2, espnId: 4240021,
    attr: {
      speed: 75, agility: 71, power: 55, vision: 76, catching: 45, yac: 66, clutch: 52,
    },
    strengths: [],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "cam-bynum", name: "Cam Bynum", team: "IND",
    position: "S", overall: 66, tier: 4, startingBid: 2, espnId: 4035861,
    attr: {
      speed: 66, passRush: 40, runStop: 70, tackling: 74, coverage: 62, ballHawk: 62,
    },
    strengths: [],
    weaknesses: ["pass rush"],
  },
  {
    id: "cam-skattebo", name: "Cam Skattebo", team: "NYG",
    position: "RB", overall: 66, tier: 4, startingBid: 2, espnId: 4696981,
    attr: {
      speed: 67, agility: 63, power: 69, vision: 66, catching: 67, yac: 58, clutch: 79,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "christian-mccaffrey", name: "Christian McCaffrey", team: "SF",
    position: "RB", overall: 66, tier: 4, startingBid: 2, espnId: 3117251,
    attr: {
      speed: 63, agility: 58, power: 76, vision: 61, catching: 90, yac: 53, clutch: 78,
    },
    strengths: ["hands"],
    weaknesses: ["yards after catch"],
  },
  {
    id: "cole-kmet", name: "Cole Kmet", team: "CHI",
    position: "TE", overall: 66, tier: 4, startingBid: 2, espnId: 4258595,
    attr: {
      speed: 67, catching: 92, routeRunning: 49, separation: 49, contestedCatch: 88, yac: 65, runBlock: 62, passBlock: 60, clutch: 53,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "cordale-flott", name: "Cor'Dale Flott", team: "TEN",
    position: "CB", overall: 66, tier: 4, startingBid: 2, espnId: 4429607,
    attr: {
      speed: 70, agility: 69, tackling: 58, coverage: 66, ballHawk: 59,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "dalton-schultz", name: "Dalton Schultz", team: "HOU",
    position: "TE", overall: 66, tier: 4, startingBid: 2, espnId: 3117256,
    attr: {
      speed: 61, catching: 85, routeRunning: 57, separation: 57, contestedCatch: 84, yac: 58, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["clutch"],
  },
  {
    id: "darious-williams", name: "Darious Williams", team: "LAR",
    position: "CB", overall: 66, tier: 4, startingBid: 2, espnId: 4239833,
    attr: {
      speed: 70, agility: 69, tackling: 57, coverage: 67, ballHawk: 59,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "darnell-washington", name: "Darnell Washington", team: "PIT",
    position: "TE", overall: 66, tier: 4, startingBid: 2, espnId: 4430802,
    attr: {
      speed: 69, catching: 90, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 68, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "dawson-knox", name: "Dawson Knox", team: "BUF",
    position: "TE", overall: 66, tier: 4, startingBid: 2, espnId: 3930086,
    attr: {
      speed: 76, catching: 86, routeRunning: 48, separation: 48, contestedCatch: 86, yac: 77, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "devonte-wyatt", name: "Devonte Wyatt", team: "GB",
    position: "EDGE", overall: 66, tier: 4, startingBid: 2, espnId: 4361791,
    attr: {
      speed: 64, power: 68, passRush: 66, runStop: 65, tackling: 54, strength: 68,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "devontez-walker", name: "Devontez Walker", team: "BAL",
    position: "WR", overall: 66, tier: 4, startingBid: 2, espnId: 4696882,
    attr: {
      speed: 92, catching: 68, routeRunning: 49, separation: 49, contestedCatch: 67, yac: 89, clutch: 64,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "greg-dulcich", name: "Greg Dulcich", team: "MIA",
    position: "TE", overall: 66, tier: 4, startingBid: 2, espnId: 4367209,
    attr: {
      speed: 72, catching: 84, routeRunning: 51, separation: 51, contestedCatch: 84, yac: 71, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["clutch","route running"],
  },
  {
    id: "harold-fannin-jr", name: "Harold Fannin Jr.", team: "CLE",
    position: "TE", overall: 66, tier: 4, startingBid: 2, espnId: 5083076,
    attr: {
      speed: 63, catching: 78, routeRunning: 62, separation: 61, contestedCatch: 77, yac: 60, runBlock: 62, passBlock: 60, clutch: 62,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "jaylin-noel", name: "Jaylin Noel", team: "HOU",
    position: "WR", overall: 66, tier: 4, startingBid: 2, espnId: 4586312,
    attr: {
      speed: 77, catching: 88, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 78, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "josh-downs", name: "Josh Downs", team: "IND",
    position: "WR", overall: 66, tier: 4, startingBid: 2, espnId: 4688813,
    attr: {
      speed: 66, catching: 75, routeRunning: 62, separation: 62, contestedCatch: 75, yac: 64, clutch: 57,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "jourdan-lewis", name: "Jourdan Lewis", team: "JAX",
    position: "CB", overall: 66, tier: 4, startingBid: 2, espnId: 3045207,
    attr: {
      speed: 70, agility: 69, tackling: 65, coverage: 66, ballHawk: 61,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "kam-curl", name: "Kam Curl", team: "LAR",
    position: "S", overall: 66, tier: 4, startingBid: 2, espnId: 4242154,
    attr: {
      speed: 62, passRush: 43, runStop: 78, tackling: 83, coverage: 58, ballHawk: 53,
    },
    strengths: ["tackling"],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "kirk-cousins", name: "Kirk Cousins", team: "LV",
    position: "QB", overall: 66, tier: 4, startingBid: 2, espnId: 14880,
    attr: {
      armStrength: 68, shortAccuracy: 71, deepAccuracy: 66, pocketAwareness: 73, decisionMaking: 62, consistency: 73, clutch: 70, mobility: 45,
    },
    strengths: [],
    weaknesses: ["mobility"],
  },
  {
    id: "kristian-fulton", name: "Kristian Fulton", team: "KC",
    position: "CB", overall: 66, tier: 4, startingBid: 2, espnId: 4035433,
    attr: {
      speed: 71, agility: 70, tackling: 61, coverage: 67, ballHawk: 58,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "leonard-floyd", name: "Leonard Floyd", team: "SF",
    position: "EDGE", overall: 66, tier: 4, startingBid: 2, espnId: 3043136,
    attr: {
      speed: 66, power: 65, passRush: 69, runStop: 58, tackling: 54, strength: 62,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "mac-jones", name: "Mac Jones", team: "JAX",
    position: "QB", overall: 66, tier: 4, startingBid: 2, espnId: 4241464,
    attr: {
      armStrength: 62, shortAccuracy: 77, deepAccuracy: 60, pocketAwareness: 75, decisionMaking: 63, consistency: 77, clutch: 66, mobility: 51,
    },
    strengths: [],
    weaknesses: ["mobility"],
  },
  {
    id: "marvin-mims-jr", name: "Marvin Mims Jr.", team: "DEN",
    position: "WR", overall: 66, tier: 4, startingBid: 2, espnId: 4686472,
    attr: {
      speed: 68, catching: 94, routeRunning: 50, separation: 50, contestedCatch: 88, yac: 67, clutch: 52,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "mike-williams", name: "Mike Williams", team: "NYJ",
    position: "WR", overall: 66, tier: 4, startingBid: 2, espnId: 3045138,
    attr: {
      speed: 95, catching: 64, routeRunning: 48, separation: 48, contestedCatch: 62, yac: 92, clutch: 50,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "noah-brown", name: "Noah Brown", team: "WSH",
    position: "WR", overall: 66, tier: 4, startingBid: 2, espnId: 3121409,
    attr: {
      speed: 84, catching: 63, routeRunning: 56, separation: 55, contestedCatch: 61, yac: 87, clutch: 50,
    },
    strengths: ["yards after catch","speed"],
    weaknesses: ["clutch","separation"],
  },
  {
    id: "quincy-riley", name: "Quincy Riley", team: "NO",
    position: "CB", overall: 66, tier: 4, startingBid: 2, espnId: 4428350,
    attr: {
      speed: 71, agility: 70, tackling: 47, coverage: 67, ballHawk: 59,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "rashid-shaheed", name: "Rashid Shaheed", team: "SEA",
    position: "WR", overall: 66, tier: 4, startingBid: 2, espnId: 4032473,
    attr: {
      speed: 85, catching: 54, routeRunning: 59, separation: 58, contestedCatch: 52, yac: 88, clutch: 50,
    },
    strengths: ["yards after catch","speed"],
    weaknesses: ["clutch","contested catch"],
  },
  {
    id: "ronnie-rivers", name: "Ronnie Rivers", team: "LAR",
    position: "RB", overall: 66, tier: 4, startingBid: 2, espnId: 4243003,
    attr: {
      speed: 75, agility: 71, power: 55, vision: 76, catching: 45, yac: 66, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "samuel-womack-iii", name: "Samuel Womack III", team: "IND",
    position: "CB", overall: 66, tier: 4, startingBid: 2, espnId: 4280416,
    attr: {
      speed: 70, agility: 69, tackling: 51, coverage: 66, ballHawk: 61,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "shemar-james", name: "Shemar James", team: "DAL",
    position: "LB", overall: 66, tier: 4, startingBid: 2, espnId: 4685400,
    attr: {
      speed: 68, passRush: 46, runStop: 72, tackling: 76, coverage: 45, ballHawk: 45, awareness: 74,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "sirvocea-dennis", name: "SirVocea Dennis", team: "TB",
    position: "LB", overall: 66, tier: 4, startingBid: 2, espnId: 4429511,
    attr: {
      speed: 65, passRush: 53, runStop: 73, tackling: 73, coverage: 48, ballHawk: 49, awareness: 72,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "stephon-gilmore", name: "Stephon Gilmore", team: "MIN",
    position: "CB", overall: 66, tier: 4, startingBid: 2, espnId: 14942,
    attr: {
      speed: 70, agility: 69, tackling: 62, coverage: 66, ballHawk: 59,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "talanoa-hufanga", name: "Talanoa Hufanga", team: "DEN",
    position: "S", overall: 66, tier: 4, startingBid: 2, espnId: 4360853,
    attr: {
      speed: 65, passRush: 43, runStop: 78, tackling: 84, coverage: 61, ballHawk: 50,
    },
    strengths: ["tackling"],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "tatum-bethune", name: "Tatum Bethune", team: "SF",
    position: "LB", overall: 66, tier: 4, startingBid: 2, espnId: 4426698,
    attr: {
      speed: 66, passRush: 45, runStop: 72, tackling: 74, coverage: 48, ballHawk: 46, awareness: 73,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "taysom-hill", name: "Taysom Hill", team: "NO",
    position: "RB", overall: 66, tier: 4, startingBid: 2, espnId: 2468609,
    attr: {
      speed: 73, agility: 68, power: 55, vision: 73, catching: 56, yac: 63, clutch: 56,
    },
    strengths: [],
    weaknesses: ["power"],
  },
  {
    id: "tonka-hemingway", name: "Tonka Hemingway", team: "LV",
    position: "EDGE", overall: 66, tier: 4, startingBid: 2, espnId: 4429109,
    attr: {
      speed: 66, power: 66, passRush: 68, runStop: 61, tackling: 51, strength: 64,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "travis-etienne-jr", name: "Travis Etienne Jr.", team: "NO",
    position: "RB", overall: 66, tier: 4, startingBid: 2, espnId: 4239996,
    attr: {
      speed: 69, agility: 64, power: 69, vision: 68, catching: 62, yac: 59, clutch: 63,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "tyler-higbee", name: "Tyler Higbee", team: "LAR",
    position: "TE", overall: 66, tier: 4, startingBid: 2, espnId: 2573401,
    attr: {
      speed: 68, catching: 88, routeRunning: 52, separation: 52, contestedCatch: 88, yac: 66, runBlock: 62, passBlock: 60, clutch: 60,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "tyler-huntley", name: "Tyler Huntley", team: "MIA",
    position: "QB", overall: 66, tier: 4, startingBid: 2, espnId: 4035671,
    attr: {
      armStrength: 52, shortAccuracy: 79, deepAccuracy: 49, pocketAwareness: 80, decisionMaking: 60, consistency: 78, clutch: 55, mobility: 71,
    },
    strengths: [],
    weaknesses: ["deep ball","arm strength"],
  },
  {
    id: "xavier-worthy", name: "Xavier Worthy", team: "KC",
    position: "WR", overall: 66, tier: 4, startingBid: 2, espnId: 4683062,
    attr: {
      speed: 75, catching: 66, routeRunning: 61, separation: 60, contestedCatch: 65, yac: 75, clutch: 57,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "aj-terrell-jr", name: "A.J. Terrell Jr.", team: "ATL",
    position: "CB", overall: 65, tier: 4, startingBid: 2, espnId: 4239995,
    attr: {
      speed: 70, agility: 69, tackling: 71, coverage: 66, ballHawk: 58,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "aj-barner", name: "AJ Barner", team: "SEA",
    position: "TE", overall: 65, tier: 4, startingBid: 2, espnId: 4576297,
    attr: {
      speed: 58, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 53, runBlock: 62, passBlock: 60, clutch: 59,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "alvin-kamara", name: "Alvin Kamara", team: "NO",
    position: "RB", overall: 65, tier: 4, startingBid: 2, espnId: 3054850,
    attr: {
      speed: 64, agility: 59, power: 72, vision: 62, catching: 76, yac: 54, clutch: 58,
    },
    strengths: [],
    weaknesses: ["yards after catch"],
  },
  {
    id: "brenton-cox-jr", name: "Brenton Cox Jr.", team: "GB",
    position: "EDGE", overall: 65, tier: 4, startingBid: 2, espnId: 4361776,
    attr: {
      speed: 66, power: 65, passRush: 68, runStop: 59, tackling: 50, strength: 63,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "calen-bullock", name: "Calen Bullock", team: "HOU",
    position: "S", overall: 65, tier: 4, startingBid: 2, espnId: 4431517,
    attr: {
      speed: 71, passRush: 40, runStop: 55, tackling: 58, coverage: 68, ballHawk: 69,
    },
    strengths: [],
    weaknesses: ["pass rush","run defense"],
  },
  {
    id: "carson-wentz", name: "Carson Wentz", team: "MIN",
    position: "QB", overall: 65, tier: 4, startingBid: 2, espnId: 2573079,
    attr: {
      armStrength: 65, shortAccuracy: 67, deepAccuracy: 62, pocketAwareness: 74, decisionMaking: 67, consistency: 68, clutch: 69, mobility: 51,
    },
    strengths: [],
    weaknesses: ["mobility"],
  },
  {
    id: "chig-okonkwo", name: "Chig Okonkwo", team: "WSH",
    position: "TE", overall: 65, tier: 4, startingBid: 2, espnId: 4360635,
    attr: {
      speed: 59, catching: 89, routeRunning: 52, separation: 52, contestedCatch: 88, yac: 55, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["clutch","route running"],
  },
  {
    id: "cody-white", name: "Cody White", team: "LV",
    position: "WR", overall: 65, tier: 4, startingBid: 2, espnId: 4241983,
    attr: {
      speed: 93, catching: 66, routeRunning: 48, separation: 48, contestedCatch: 65, yac: 90, clutch: 50,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "demario-douglas", name: "DeMario Douglas", team: "NE",
    position: "WR", overall: 65, tier: 4, startingBid: 2, espnId: 4427095,
    attr: {
      speed: 66, catching: 89, routeRunning: 53, separation: 52, contestedCatch: 88, yac: 64, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["clutch","separation"],
  },
  {
    id: "demarvion-overshown", name: "DeMarvion Overshown", team: "DAL",
    position: "LB", overall: 65, tier: 4, startingBid: 2, espnId: 4362088,
    attr: {
      speed: 66, passRush: 57, runStop: 73, tackling: 73, coverage: 45, ballHawk: 48, awareness: 73,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "drew-sample", name: "Drew Sample", team: "CIN",
    position: "TE", overall: 65, tier: 4, startingBid: 2, espnId: 3127310,
    attr: {
      speed: 55, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 50, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "drue-tranquill", name: "Drue Tranquill", team: "KC",
    position: "LB", overall: 65, tier: 4, startingBid: 2, espnId: 3129310,
    attr: {
      speed: 65, passRush: 48, runStop: 72, tackling: 73, coverage: 45, ballHawk: 45, awareness: 72,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "elijah-higgins", name: "Elijah Higgins", team: "ARI",
    position: "TE", overall: 65, tier: 4, startingBid: 2, espnId: 4426844,
    attr: {
      speed: 58, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 54, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "emanuel-wilson", name: "Emanuel Wilson", team: "SEA",
    position: "RB", overall: 65, tier: 4, startingBid: 2, espnId: 4887558,
    attr: {
      speed: 73, agility: 69, power: 56, vision: 73, catching: 45, yac: 64, clutch: 51,
    },
    strengths: [],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "eric-murray", name: "Eric Murray", team: "JAX",
    position: "S", overall: 65, tier: 4, startingBid: 2, espnId: 2970716,
    attr: {
      speed: 69, passRush: 41, runStop: 65, tackling: 69, coverage: 65, ballHawk: 58,
    },
    strengths: [],
    weaknesses: ["pass rush"],
  },
  {
    id: "gunnar-helm", name: "Gunnar Helm", team: "TEN",
    position: "TE", overall: 65, tier: 4, startingBid: 2, espnId: 4686728,
    attr: {
      speed: 55, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 50, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "henry-tootoo", name: "Henry To'oTo'o", team: "HOU",
    position: "LB", overall: 65, tier: 4, startingBid: 2, espnId: 4426350,
    attr: {
      speed: 66, passRush: 46, runStop: 72, tackling: 73, coverage: 46, ballHawk: 47, awareness: 72,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "jatavion-sanders", name: "Ja'Tavion Sanders", team: "CAR",
    position: "TE", overall: 65, tier: 4, startingBid: 2, espnId: 4431588,
    attr: {
      speed: 55, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 50, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "jalen-nailor", name: "Jalen Nailor", team: "LV",
    position: "WR", overall: 65, tier: 4, startingBid: 2, espnId: 4382466,
    attr: {
      speed: 92, catching: 61, routeRunning: 49, separation: 49, contestedCatch: 60, yac: 92, clutch: 57,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "jared-verse", name: "Jared Verse", team: "CLE",
    position: "EDGE", overall: 65, tier: 4, startingBid: 2, espnId: 4578085,
    attr: {
      speed: 63, power: 68, passRush: 64, runStop: 66, tackling: 67, strength: 70,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "jeremy-chinn", name: "Jeremy Chinn", team: "LV",
    position: "S", overall: 65, tier: 4, startingBid: 2, espnId: 4043169,
    attr: {
      speed: 55, passRush: 44, runStop: 89, tackling: 92, coverage: 50, ballHawk: 48,
    },
    strengths: ["tackling","run defense"],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "josh-whyle", name: "Josh Whyle", team: "TEN",
    position: "TE", overall: 65, tier: 4, startingBid: 2, espnId: 4360086,
    attr: {
      speed: 55, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 50, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "juju-smith-schuster", name: "JuJu Smith-Schuster", team: "KC",
    position: "WR", overall: 65, tier: 4, startingBid: 2, espnId: 3120348,
    attr: {
      speed: 74, catching: 87, routeRunning: 48, separation: 48, contestedCatch: 87, yac: 74, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "julius-chestnut", name: "Julius Chestnut", team: "TEN",
    position: "RB", overall: 65, tier: 4, startingBid: 2, espnId: 4367567,
    attr: {
      speed: 73, agility: 68, power: 55, vision: 73, catching: 45, yac: 63, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "kendall-fuller", name: "Kendall Fuller", team: "MIA",
    position: "CB", overall: 65, tier: 4, startingBid: 2, espnId: 3045465,
    attr: {
      speed: 70, agility: 69, tackling: 71, coverage: 66, ballHawk: 56,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "kenny-gainwell", name: "Kenny Gainwell", team: "TB",
    position: "RB", overall: 65, tier: 4, startingBid: 2, espnId: 4371733,
    attr: {
      speed: 71, agility: 67, power: 55, vision: 71, catching: 60, yac: 62, clutch: 51,
    },
    strengths: [],
    weaknesses: ["clutch","power"],
  },
  {
    id: "keon-coleman", name: "Keon Coleman", team: "BUF",
    position: "WR", overall: 65, tier: 4, startingBid: 2, espnId: 4635008,
    attr: {
      speed: 89, catching: 54, routeRunning: 54, separation: 54, contestedCatch: 52, yac: 92, clutch: 57,
    },
    strengths: ["yards after catch","speed"],
    weaknesses: ["contested catch","hands"],
  },
  {
    id: "kwity-paye", name: "Kwity Paye", team: "LV",
    position: "EDGE", overall: 65, tier: 4, startingBid: 2, espnId: 4258194,
    attr: {
      speed: 66, power: 66, passRush: 68, runStop: 59, tackling: 58, strength: 64,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "laiatu-latu", name: "Laiatu Latu", team: "IND",
    position: "EDGE", overall: 65, tier: 4, startingBid: 2, espnId: 4426473,
    attr: {
      speed: 65, power: 65, passRush: 67, runStop: 59, tackling: 57, strength: 64,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "lucas-krull", name: "Lucas Krull", team: "DEN",
    position: "TE", overall: 65, tier: 4, startingBid: 2, espnId: 4360231,
    attr: {
      speed: 55, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 50, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "luke-musgrave", name: "Luke Musgrave", team: "GB",
    position: "TE", overall: 65, tier: 4, startingBid: 2, espnId: 4428085,
    attr: {
      speed: 59, catching: 94, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 55, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "miles-sanders", name: "Miles Sanders", team: "CAR",
    position: "RB", overall: 65, tier: 4, startingBid: 2, espnId: 4045163,
    attr: {
      speed: 72, agility: 68, power: 55, vision: 72, catching: 54, yac: 63, clutch: 53,
    },
    strengths: [],
    weaknesses: ["clutch","hands"],
  },
  {
    id: "nate-adkins", name: "Nate Adkins", team: "DEN",
    position: "TE", overall: 65, tier: 4, startingBid: 2, espnId: 4383440,
    attr: {
      speed: 55, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 50, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "nick-vannett", name: "Nick Vannett", team: "TEN",
    position: "TE", overall: 65, tier: 4, startingBid: 2, espnId: 2576399,
    attr: {
      speed: 55, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 50, runBlock: 62, passBlock: 60, clutch: 54,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "payton-wilson", name: "Payton Wilson", team: "PIT",
    position: "LB", overall: 65, tier: 4, startingBid: 2, espnId: 4361652,
    attr: {
      speed: 66, passRush: 45, runStop: 72, tackling: 74, coverage: 45, ballHawk: 46, awareness: 73,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "tanner-hudson", name: "Tanner Hudson", team: "CIN",
    position: "TE", overall: 65, tier: 4, startingBid: 2, espnId: 3050481,
    attr: {
      speed: 55, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 50, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "tim-jones", name: "Tim Jones", team: "JAX",
    position: "WR", overall: 65, tier: 4, startingBid: 2, espnId: 4245131,
    attr: {
      speed: 83, catching: 73, routeRunning: 49, separation: 49, contestedCatch: 72, yac: 86, clutch: 51,
    },
    strengths: ["yards after catch","speed"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "tredavious-white", name: "Tre'Davious White", team: "BUF",
    position: "CB", overall: 65, tier: 4, startingBid: 2, espnId: 3042717,
    attr: {
      speed: 70, agility: 69, tackling: 49, coverage: 66, ballHawk: 57,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "tyler-goodson", name: "Tyler Goodson", team: "IND",
    position: "RB", overall: 65, tier: 4, startingBid: 2, espnId: 4429676,
    attr: {
      speed: 73, agility: 69, power: 55, vision: 73, catching: 45, yac: 64, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "ugo-amadi", name: "Ugo Amadi", team: "NO",
    position: "CB", overall: 65, tier: 4, startingBid: 2, espnId: 3886834,
    attr: {
      speed: 70, agility: 69, tackling: 81, coverage: 66, ballHawk: 56,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "wandale-robinson", name: "Wan'Dale Robinson", team: "TEN",
    position: "WR", overall: 65, tier: 4, startingBid: 2, espnId: 4569587,
    attr: {
      speed: 56, catching: 76, routeRunning: 67, separation: 66, contestedCatch: 75, yac: 52, clutch: 50,
    },
    strengths: [],
    weaknesses: ["clutch","yards after catch"],
  },
  {
    id: "zach-ertz", name: "Zach Ertz", team: "WSH",
    position: "WR", overall: 65, tier: 4, startingBid: 2, espnId: 15835,
    attr: {
      speed: 60, catching: 87, routeRunning: 58, separation: 58, contestedCatch: 86, yac: 57, clutch: 62,
    },
    strengths: ["hands","contested catch"],
    weaknesses: [],
  },
  {
    id: "adam-prentice", name: "Adam Prentice", team: "NO",
    position: "RB", overall: 64, tier: 4, startingBid: 2, espnId: 3929914,
    attr: {
      speed: 72, agility: 67, power: 55, vision: 72, catching: 45, yac: 62, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "adam-trautman", name: "Adam Trautman", team: "DEN",
    position: "TE", overall: 64, tier: 4, startingBid: 2, espnId: 3911853,
    attr: {
      speed: 68, catching: 85, routeRunning: 48, separation: 48, contestedCatch: 85, yac: 67, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "ahkello-witherspoon", name: "Ahkello Witherspoon", team: "LAR",
    position: "CB", overall: 64, tier: 4, startingBid: 2, espnId: 3122630,
    attr: {
      speed: 69, agility: 67, tackling: 49, coverage: 64, ballHawk: 60,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "brycen-tremayne", name: "Brycen Tremayne", team: "CAR",
    position: "WR", overall: 64, tier: 4, startingBid: 2, espnId: 4360763,
    attr: {
      speed: 65, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 63, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "cj-gardner-johnson", name: "C.J. Gardner-Johnson", team: "BUF",
    position: "S", overall: 64, tier: 4, startingBid: 2, espnId: 4034953,
    attr: {
      speed: 66, passRush: 44, runStop: 63, tackling: 66, coverage: 62, ballHawk: 65,
    },
    strengths: [],
    weaknesses: ["pass rush"],
  },
  {
    id: "carl-granderson", name: "Carl Granderson", team: "NO",
    position: "EDGE", overall: 64, tier: 4, startingBid: 2, espnId: 3918310,
    attr: {
      speed: 62, power: 66, passRush: 64, runStop: 62, tackling: 67, strength: 66,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "carl-lawson", name: "Carl Lawson", team: "DAL",
    position: "EDGE", overall: 64, tier: 4, startingBid: 2, espnId: 3051911,
    attr: {
      speed: 66, power: 62, passRush: 68, runStop: 53, tackling: 50, strength: 57,
    },
    strengths: [],
    weaknesses: ["tackling","run defense"],
  },
  {
    id: "christian-elliss", name: "Christian Elliss", team: "NE",
    position: "LB", overall: 64, tier: 4, startingBid: 2, espnId: 4245273,
    attr: {
      speed: 63, passRush: 45, runStop: 67, tackling: 70, coverage: 50, ballHawk: 49, awareness: 69,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "cody-barton", name: "Cody Barton", team: "TEN",
    position: "LB", overall: 64, tier: 4, startingBid: 2, espnId: 3926229,
    attr: {
      speed: 61, passRush: 45, runStop: 66, tackling: 67, coverage: 58, ballHawk: 60, awareness: 67,
    },
    strengths: [],
    weaknesses: ["pass rush"],
  },
  {
    id: "dax-hill", name: "Dax Hill", team: "CIN",
    position: "CB", overall: 64, tier: 4, startingBid: 2, espnId: 4426422,
    attr: {
      speed: 69, agility: 68, tackling: 82, coverage: 65, ballHawk: 57,
    },
    strengths: ["tackling"],
    weaknesses: [],
  },
  {
    id: "devondre-campbell", name: "De'Vondre Campbell", team: "SF",
    position: "LB", overall: 64, tier: 4, startingBid: 2, espnId: 3040180,
    attr: {
      speed: 65, passRush: 45, runStop: 70, tackling: 72, coverage: 45, ballHawk: 45, awareness: 71,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "demarcus-robinson", name: "Demarcus Robinson", team: "SF",
    position: "WR", overall: 64, tier: 4, startingBid: 2, espnId: 3043116,
    attr: {
      speed: 95, catching: 51, routeRunning: 51, separation: 51, contestedCatch: 49, yac: 92, clutch: 56,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["contested catch","hands"],
  },
  {
    id: "devon-witherspoon", name: "Devon Witherspoon", team: "SEA",
    position: "CB", overall: 64, tier: 4, startingBid: 2, espnId: 4575431,
    attr: {
      speed: 70, agility: 68, tackling: 82, coverage: 65, ballHawk: 56,
    },
    strengths: ["tackling"],
    weaknesses: [],
  },
  {
    id: "ed-oliver", name: "Ed Oliver", team: "BUF",
    position: "EDGE", overall: 64, tier: 4, startingBid: 2, espnId: 4039303,
    attr: {
      speed: 61, power: 68, passRush: 62, runStop: 68, tackling: 60, strength: 72,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "ian-thomas", name: "Ian Thomas", team: "LV",
    position: "TE", overall: 64, tier: 4, startingBid: 2, espnId: 4045305,
    attr: {
      speed: 55, catching: 93, routeRunning: 48, separation: 48, contestedCatch: 87, yac: 50, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "jaquan-mcmillian", name: "Ja'Quan McMillian", team: "DEN",
    position: "CB", overall: 64, tier: 4, startingBid: 2, espnId: 4567462,
    attr: {
      speed: 68, agility: 67, tackling: 65, coverage: 64, ballHawk: 61,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "jake-tonges", name: "Jake Tonges", team: "SF",
    position: "TE", overall: 64, tier: 4, startingBid: 2, espnId: 4259147,
    attr: {
      speed: 56, catching: 90, routeRunning: 49, separation: 49, contestedCatch: 88, yac: 51, runBlock: 62, passBlock: 60, clutch: 62,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "jalen-mills", name: "Jalen Mills", team: "DET",
    position: "CB", overall: 64, tier: 4, startingBid: 2, espnId: 2976540,
    attr: {
      speed: 69, agility: 67, tackling: 71, coverage: 64, ballHawk: 59,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "john-franklin-myers", name: "John Franklin-Myers", team: "TEN",
    position: "EDGE", overall: 64, tier: 4, startingBid: 2, espnId: 3120464,
    attr: {
      speed: 65, power: 63, passRush: 68, runStop: 55, tackling: 51, strength: 59,
    },
    strengths: [],
    weaknesses: ["tackling","run defense"],
  },
  {
    id: "jordan-battle", name: "Jordan Battle", team: "CIN",
    position: "S", overall: 64, tier: 4, startingBid: 2, espnId: 4567098,
    attr: {
      speed: 57, passRush: 40, runStop: 78, tackling: 84, coverage: 52, ballHawk: 55,
    },
    strengths: ["tackling"],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "joshua-metellus", name: "Joshua Metellus", team: "MIN",
    position: "S", overall: 64, tier: 4, startingBid: 2, espnId: 4046537,
    attr: {
      speed: 59, passRush: 40, runStop: 76, tackling: 81, coverage: 54, ballHawk: 54,
    },
    strengths: [],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "justin-reid", name: "Justin Reid", team: "NO",
    position: "S", overall: 64, tier: 4, startingBid: 2, espnId: 3931399,
    attr: {
      speed: 64, passRush: 40, runStop: 71, tackling: 75, coverage: 60, ballHawk: 55,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "kindle-vildor", name: "Kindle Vildor", team: "TB",
    position: "CB", overall: 64, tier: 4, startingBid: 2, espnId: 4036651,
    attr: {
      speed: 69, agility: 67, tackling: 53, coverage: 64, ballHawk: 59,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "michael-penix-jr", name: "Michael Penix Jr.", team: "ATL",
    position: "QB", overall: 64, tier: 4, startingBid: 2, espnId: 4360423,
    attr: {
      armStrength: 69, shortAccuracy: 51, deepAccuracy: 66, pocketAwareness: 85, decisionMaking: 66, consistency: 55, clutch: 61, mobility: 49,
    },
    strengths: ["pocket presence"],
    weaknesses: ["mobility","short accuracy"],
  },
  {
    id: "milton-williams", name: "Milton Williams", team: "NE",
    position: "EDGE", overall: 64, tier: 4, startingBid: 2, espnId: 4239699,
    attr: {
      speed: 63, power: 66, passRush: 65, runStop: 61, tackling: 50, strength: 66,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "noah-gray", name: "Noah Gray", team: "KC",
    position: "TE", overall: 64, tier: 4, startingBid: 2, espnId: 4240472,
    attr: {
      speed: 59, catching: 89, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 55, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "pat-bryant", name: "Pat Bryant", team: "DEN",
    position: "WR", overall: 64, tier: 4, startingBid: 2, espnId: 4600981,
    attr: {
      speed: 73, catching: 75, routeRunning: 52, separation: 52, contestedCatch: 74, yac: 72, clutch: 50,
    },
    strengths: [],
    weaknesses: ["clutch","route running"],
  },
  {
    id: "ray-ray-mccloud-iii", name: "Ray-Ray McCloud III", team: "ATL",
    position: "WR", overall: 64, tier: 4, startingBid: 2, espnId: 3728262,
    attr: {
      speed: 68, catching: 78, routeRunning: 55, separation: 54, contestedCatch: 78, yac: 66, clutch: 50,
    },
    strengths: [],
    weaknesses: ["clutch","separation"],
  },
  {
    id: "rhamondre-stevenson", name: "Rhamondre Stevenson", team: "NE",
    position: "RB", overall: 64, tier: 4, startingBid: 2, espnId: 4569173,
    attr: {
      speed: 66, agility: 62, power: 68, vision: 65, catching: 64, yac: 57, clutch: 66,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "ryan-flournoy", name: "Ryan Flournoy", team: "DAL",
    position: "WR", overall: 64, tier: 4, startingBid: 2, espnId: 5083754,
    attr: {
      speed: 72, catching: 84, routeRunning: 48, separation: 48, contestedCatch: 84, yac: 71, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "tim-patrick", name: "Tim Patrick", team: "DET",
    position: "WR", overall: 64, tier: 4, startingBid: 2, espnId: 3134353,
    attr: {
      speed: 77, catching: 77, routeRunning: 48, separation: 48, contestedCatch: 77, yac: 78, clutch: 51,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "tommy-tremble", name: "Tommy Tremble", team: "CAR",
    position: "TE", overall: 64, tier: 4, startingBid: 2, espnId: 4372780,
    attr: {
      speed: 58, catching: 90, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 54, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "trevon-moehrig", name: "Tre'von Moehrig", team: "CAR",
    position: "S", overall: 64, tier: 4, startingBid: 2, espnId: 4362487,
    attr: {
      speed: 59, passRush: 47, runStop: 77, tackling: 83, coverage: 55, ballHawk: 52,
    },
    strengths: ["tackling"],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "tyler-johnson", name: "Tyler Johnson", team: "NYJ",
    position: "WR", overall: 64, tier: 4, startingBid: 2, espnId: 2310331,
    attr: {
      speed: 81, catching: 71, routeRunning: 48, separation: 48, contestedCatch: 70, yac: 82, clutch: 50,
    },
    strengths: ["yards after catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "xavier-woods", name: "Xavier Woods", team: "CAR",
    position: "S", overall: 64, tier: 4, startingBid: 2, espnId: 3040572,
    attr: {
      speed: 59, passRush: 40, runStop: 75, tackling: 81, coverage: 54, ballHawk: 58,
    },
    strengths: [],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "alex-austin", name: "Alex Austin", team: "NE",
    position: "CB", overall: 63, tier: 4, startingBid: 2, espnId: 4426599,
    attr: {
      speed: 68, agility: 67, tackling: 48, coverage: 64, ballHawk: 55,
    },
    strengths: [],
    weaknesses: ["tackling","ball skills"],
  },
  {
    id: "alohi-gilman", name: "Alohi Gilman", team: "KC",
    position: "S", overall: 63, tier: 4, startingBid: 2, espnId: 4039413,
    attr: {
      speed: 65, passRush: 40, runStop: 69, tackling: 73, coverage: 61, ballHawk: 52,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "amik-robertson", name: "Amik Robertson", team: "WSH",
    position: "CB", overall: 63, tier: 4, startingBid: 2, espnId: 4239694,
    attr: {
      speed: 68, agility: 67, tackling: 57, coverage: 64, ballHawk: 56,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "arden-key", name: "Arden Key", team: "IND",
    position: "EDGE", overall: 63, tier: 4, startingBid: 2, espnId: 3843843,
    attr: {
      speed: 63, power: 65, passRush: 64, runStop: 61, tackling: 54, strength: 65,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "audric-estime", name: "Audric Estime", team: "NO",
    position: "RB", overall: 63, tier: 4, startingBid: 2, espnId: 4569682,
    attr: {
      speed: 69, agility: 65, power: 57, vision: 69, catching: 48, yac: 60, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "braden-fiske", name: "Braden Fiske", team: "LAR",
    position: "EDGE", overall: 63, tier: 4, startingBid: 2, espnId: 4362245,
    attr: {
      speed: 64, power: 64, passRush: 66, runStop: 57, tackling: 54, strength: 62,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "brian-robinson-jr", name: "Brian Robinson Jr.", team: "ATL",
    position: "RB", overall: 63, tier: 4, startingBid: 2, espnId: 4241474,
    attr: {
      speed: 69, agility: 65, power: 61, vision: 69, catching: 46, yac: 60, clutch: 56,
    },
    strengths: [],
    weaknesses: ["hands"],
  },
  {
    id: "brock-wright", name: "Brock Wright", team: "DET",
    position: "TE", overall: 63, tier: 4, startingBid: 2, espnId: 4242392,
    attr: {
      speed: 55, catching: 88, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 50, runBlock: 62, passBlock: 60, clutch: 52,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "bryce-young", name: "Bryce Young", team: "CAR",
    position: "QB", overall: 63, tier: 4, startingBid: 2, espnId: 4685720,
    attr: {
      armStrength: 54, shortAccuracy: 59, deepAccuracy: 51, pocketAwareness: 79, decisionMaking: 71, consistency: 62, clutch: 73, mobility: 60,
    },
    strengths: [],
    weaknesses: ["deep ball","arm strength"],
  },
  {
    id: "cade-stover", name: "Cade Stover", team: "HOU",
    position: "TE", overall: 63, tier: 4, startingBid: 2, espnId: 4426496,
    attr: {
      speed: 55, catching: 90, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 50, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "calvin-austin-iii", name: "Calvin Austin III", team: "PIT",
    position: "WR", overall: 63, tier: 4, startingBid: 2, espnId: 4243389,
    attr: {
      speed: 84, catching: 58, routeRunning: 51, separation: 51, contestedCatch: 57, yac: 87, clutch: 51,
    },
    strengths: ["yards after catch","speed"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "chris-jones", name: "Chris Jones", team: "KC",
    position: "EDGE", overall: 63, tier: 4, startingBid: 2, espnId: 3044859,
    attr: {
      speed: 62, power: 65, passRush: 63, runStop: 62, tackling: 50, strength: 66,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "craig-reynolds", name: "Craig Reynolds", team: "DET",
    position: "RB", overall: 63, tier: 4, startingBid: 2, espnId: 4421446,
    attr: {
      speed: 70, agility: 66, power: 55, vision: 70, catching: 45, yac: 61, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "dane-belton", name: "Dane Belton", team: "NYJ",
    position: "S", overall: 63, tier: 4, startingBid: 2, espnId: 4426686,
    attr: {
      speed: 60, passRush: 45, runStop: 74, tackling: 79, coverage: 55, ballHawk: 51,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "daron-bland", name: "DaRon Bland", team: "DAL",
    position: "CB", overall: 63, tier: 4, startingBid: 2, espnId: 4248911,
    attr: {
      speed: 67, agility: 66, tackling: 82, coverage: 63, ballHawk: 56,
    },
    strengths: ["tackling"],
    weaknesses: [],
  },
  {
    id: "david-njoku", name: "David Njoku", team: "LAC",
    position: "TE", overall: 63, tier: 4, startingBid: 2, espnId: 3123076,
    attr: {
      speed: 55, catching: 79, routeRunning: 57, separation: 56, contestedCatch: 79, yac: 50, runBlock: 62, passBlock: 60, clutch: 65,
    },
    strengths: [],
    weaknesses: ["yards after catch","speed"],
  },
  {
    id: "dyami-brown", name: "Dyami Brown", team: "WSH",
    position: "WR", overall: 63, tier: 4, startingBid: 2, espnId: 4361577,
    attr: {
      speed: 75, catching: 75, routeRunning: 48, separation: 48, contestedCatch: 74, yac: 75, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "erick-all-jr", name: "Erick All Jr.", team: "CIN",
    position: "TE", overall: 63, tier: 4, startingBid: 2, espnId: 4427834,
    attr: {
      speed: 55, catching: 88, routeRunning: 49, separation: 49, contestedCatch: 83, yac: 51, runBlock: 62, passBlock: 60, clutch: 51,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "evan-williams", name: "Evan Williams", team: "GB",
    position: "S", overall: 63, tier: 4, startingBid: 2, espnId: 4428863,
    attr: {
      speed: 58, passRush: 40, runStop: 75, tackling: 80, coverage: 53, ballHawk: 55,
    },
    strengths: [],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "frankie-luvu", name: "Frankie Luvu", team: "WSH",
    position: "LB", overall: 63, tier: 4, startingBid: 2, espnId: 3127273,
    attr: {
      speed: 60, passRush: 64, runStop: 68, tackling: 67, coverage: 53, ballHawk: 51, awareness: 66,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "garrett-williams", name: "Garrett Williams", team: "ARI",
    position: "CB", overall: 63, tier: 4, startingBid: 2, espnId: 4568506,
    attr: {
      speed: 67, agility: 65, tackling: 66, coverage: 62, ballHawk: 60,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "geno-stone", name: "Geno Stone", team: "CIN",
    position: "S", overall: 63, tier: 4, startingBid: 2, espnId: 4240575,
    attr: {
      speed: 57, passRush: 41, runStop: 73, tackling: 78, coverage: 53, ballHawk: 57,
    },
    strengths: [],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "isaac-teslaa", name: "Isaac TeSlaa", team: "DET",
    position: "WR", overall: 63, tier: 4, startingBid: 2, espnId: 5123663,
    attr: {
      speed: 95, catching: 55, routeRunning: 48, separation: 48, contestedCatch: 53, yac: 92, clutch: 65,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "isaiah-mcduffie", name: "Isaiah McDuffie", team: "GB",
    position: "LB", overall: 63, tier: 4, startingBid: 2, espnId: 4239947,
    attr: {
      speed: 63, passRush: 45, runStop: 68, tackling: 70, coverage: 45, ballHawk: 45, awareness: 69,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "jalen-ramsey", name: "Jalen Ramsey", team: "PIT",
    position: "CB", overall: 63, tier: 4, startingBid: 2, espnId: 3045373,
    attr: {
      speed: 68, agility: 66, tackling: 70, coverage: 63, ballHawk: 58,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "jalen-thompson", name: "Jalen Thompson", team: "DAL",
    position: "S", overall: 63, tier: 4, startingBid: 2, espnId: 4043089,
    attr: {
      speed: 57, passRush: 40, runStop: 81, tackling: 87, coverage: 52, ballHawk: 48,
    },
    strengths: ["tackling"],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "jarrian-jones", name: "Jarrian Jones", team: "JAX",
    position: "CB", overall: 63, tier: 4, startingBid: 2, espnId: 4426448,
    attr: {
      speed: 66, agility: 64, tackling: 55, coverage: 62, ballHawk: 60,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "jayden-higgins", name: "Jayden Higgins", team: "HOU",
    position: "WR", overall: 63, tier: 4, startingBid: 2, espnId: 4877706,
    attr: {
      speed: 78, catching: 63, routeRunning: 54, separation: 53, contestedCatch: 62, yac: 79, clutch: 59,
    },
    strengths: [],
    weaknesses: ["separation","route running"],
  },
  {
    id: "jeremy-ruckert", name: "Jeremy Ruckert", team: "NYJ",
    position: "TE", overall: 63, tier: 4, startingBid: 2, espnId: 4361372,
    attr: {
      speed: 55, catching: 89, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 50, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "kader-kohou", name: "Kader Kohou", team: "MIA",
    position: "CB", overall: 63, tier: 4, startingBid: 2, espnId: 4291489,
    attr: {
      speed: 67, agility: 65, tackling: 56, coverage: 62, ballHawk: 60,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "kyu-blu-kelly", name: "Kyu Blu Kelly", team: "LV",
    position: "CB", overall: 63, tier: 4, startingBid: 2, espnId: 4427695,
    attr: {
      speed: 66, agility: 64, tackling: 61, coverage: 61, ballHawk: 66,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "luke-farrell", name: "Luke Farrell", team: "SF",
    position: "TE", overall: 63, tier: 4, startingBid: 2, espnId: 4040612,
    attr: {
      speed: 55, catching: 89, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 50, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "maxwell-hairston", name: "Maxwell Hairston", team: "BUF",
    position: "CB", overall: 63, tier: 4, startingBid: 2, espnId: 4688931,
    attr: {
      speed: 66, agility: 65, tackling: 49, coverage: 62, ballHawk: 64,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "mike-hughes", name: "Mike Hughes", team: "ATL",
    position: "CB", overall: 63, tier: 4, startingBid: 2, espnId: 3895841,
    attr: {
      speed: 68, agility: 67, tackling: 73, coverage: 64, ballHawk: 56,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "pete-werner", name: "Pete Werner", team: "NO",
    position: "LB", overall: 63, tier: 4, startingBid: 2, espnId: 4241993,
    attr: {
      speed: 63, passRush: 45, runStop: 68, tackling: 70, coverage: 46, ballHawk: 46, awareness: 69,
    },
    strengths: [],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "rasul-douglas", name: "Rasul Douglas", team: "WSH",
    position: "CB", overall: 63, tier: 4, startingBid: 2, espnId: 3943270,
    attr: {
      speed: 68, agility: 66, tackling: 66, coverage: 63, ballHawk: 57,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "ray-davis", name: "Ray Davis", team: "BUF",
    position: "RB", overall: 63, tier: 4, startingBid: 2, espnId: 4429501,
    attr: {
      speed: 71, agility: 66, power: 55, vision: 70, catching: 48, yac: 61, clutch: 51,
    },
    strengths: [],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "rock-ya-sin", name: "Rock Ya-Sin", team: "DET",
    position: "CB", overall: 63, tier: 4, startingBid: 2, espnId: 3910229,
    attr: {
      speed: 69, agility: 67, tackling: 56, coverage: 64, ballHawk: 54,
    },
    strengths: [],
    weaknesses: ["ball skills"],
  },
  {
    id: "shaq-thompson", name: "Shaq Thompson", team: "BUF",
    position: "LB", overall: 63, tier: 4, startingBid: 2, espnId: 2978313,
    attr: {
      speed: 62, passRush: 45, runStop: 70, tackling: 70, coverage: 45, ballHawk: 47, awareness: 69,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "tarheeb-still", name: "Tarheeb Still", team: "LAC",
    position: "CB", overall: 63, tier: 4, startingBid: 2, espnId: 4432571,
    attr: {
      speed: 67, agility: 65, tackling: 66, coverage: 62, ballHawk: 60,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "tershawn-wharton", name: "Tershawn Wharton", team: "KC",
    position: "EDGE", overall: 63, tier: 4, startingBid: 2, espnId: 4058925,
    attr: {
      speed: 65, power: 63, passRush: 67, runStop: 55, tackling: 61, strength: 60,
    },
    strengths: [],
    weaknesses: ["run defense"],
  },
  {
    id: "tip-reiman", name: "Tip Reiman", team: "ARI",
    position: "TE", overall: 63, tier: 4, startingBid: 2, espnId: 4696700,
    attr: {
      speed: 55, catching: 88, routeRunning: 49, separation: 49, contestedCatch: 83, yac: 51, runBlock: 62, passBlock: 60, clutch: 51,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "tony-adams", name: "Tony Adams", team: "TEN",
    position: "S", overall: 63, tier: 4, startingBid: 2, espnId: 4240532,
    attr: {
      speed: 63, passRush: 43, runStop: 71, tackling: 76, coverage: 59, ballHawk: 52,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "trey-amos", name: "Trey Amos", team: "WSH",
    position: "CB", overall: 63, tier: 4, startingBid: 2, espnId: 4574689,
    attr: {
      speed: 68, agility: 67, tackling: 57, coverage: 64, ballHawk: 55,
    },
    strengths: [],
    weaknesses: ["ball skills"],
  },
  {
    id: "tyler-nubin", name: "Tyler Nubin", team: "NYG",
    position: "S", overall: 63, tier: 4, startingBid: 2, espnId: 4430261,
    attr: {
      speed: 55, passRush: 40, runStop: 82, tackling: 88, coverage: 50, ballHawk: 48,
    },
    strengths: ["tackling","run defense"],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "tyquan-thornton", name: "Tyquan Thornton", team: "KC",
    position: "WR", overall: 63, tier: 4, startingBid: 2, espnId: 4362921,
    attr: {
      speed: 95, catching: 50, routeRunning: 50, separation: 50, contestedCatch: 48, yac: 92, clutch: 50,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["contested catch","hands"],
  },
  {
    id: "vita-vea", name: "Vita Vea", team: "TB",
    position: "EDGE", overall: 63, tier: 4, startingBid: 2, espnId: 3134362,
    attr: {
      speed: 62, power: 64, passRush: 64, runStop: 59, tackling: 55, strength: 64,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "will-shipley", name: "Will Shipley", team: "PHI",
    position: "RB", overall: 63, tier: 4, startingBid: 2, espnId: 4431545,
    attr: {
      speed: 71, agility: 67, power: 55, vision: 71, catching: 45, yac: 62, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "zach-charbonnet", name: "Zach Charbonnet", team: "SEA",
    position: "RB", overall: 63, tier: 4, startingBid: 2, espnId: 4426385,
    attr: {
      speed: 67, agility: 62, power: 62, vision: 66, catching: 57, yac: 57, clutch: 70,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "allen-lazard", name: "Allen Lazard", team: "NYJ",
    position: "WR", overall: 62, tier: 4, startingBid: 2, espnId: 3128390,
    attr: {
      speed: 80, catching: 62, routeRunning: 51, separation: 50, contestedCatch: 60, yac: 82, clutch: 60,
    },
    strengths: ["yards after catch"],
    weaknesses: ["separation","route running"],
  },
  {
    id: "andrei-iosivas", name: "Andrei Iosivas", team: "CIN",
    position: "WR", overall: 62, tier: 4, startingBid: 2, espnId: 4368003,
    attr: {
      speed: 82, catching: 57, routeRunning: 50, separation: 50, contestedCatch: 56, yac: 84, clutch: 53,
    },
    strengths: ["yards after catch","speed"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "anthony-gould", name: "Anthony Gould", team: "IND",
    position: "WR", overall: 62, tier: 4, startingBid: 2, espnId: 4429684,
    attr: {
      speed: 59, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 56, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "ashton-dulin", name: "Ashton Dulin", team: "IND",
    position: "WR", overall: 62, tier: 4, startingBid: 2, espnId: 4061956,
    attr: {
      speed: 95, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 92, clutch: 50,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "avonte-maddox", name: "Avonte Maddox", team: "DET",
    position: "CB", overall: 62, tier: 4, startingBid: 2, espnId: 3123938,
    attr: {
      speed: 66, agility: 65, tackling: 51, coverage: 62, ballHawk: 55,
    },
    strengths: [],
    weaknesses: ["tackling","ball skills"],
  },
  {
    id: "bhayshul-tuten", name: "Bhayshul Tuten", team: "JAX",
    position: "RB", overall: 62, tier: 4, startingBid: 2, espnId: 4882093,
    attr: {
      speed: 69, agility: 64, power: 55, vision: 68, catching: 46, yac: 59, clutch: 60,
    },
    strengths: [],
    weaknesses: ["hands","power"],
  },
  {
    id: "bo-melton", name: "Bo Melton", team: "GB",
    position: "WR", overall: 62, tier: 4, startingBid: 2, espnId: 4259305,
    attr: {
      speed: 95, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 92, clutch: 50,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "brandon-stephens", name: "Brandon Stephens", team: "BAL",
    position: "CB", overall: 62, tier: 4, startingBid: 2, espnId: 4035824,
    attr: {
      speed: 67, agility: 66, tackling: 69, coverage: 63, ballHawk: 54,
    },
    strengths: [],
    weaknesses: ["ball skills"],
  },
  {
    id: "caelen-carson", name: "Caelen Carson", team: "DAL",
    position: "CB", overall: 62, tier: 4, startingBid: 2, espnId: 4431006,
    attr: {
      speed: 67, agility: 65, tackling: 66, coverage: 62, ballHawk: 54,
    },
    strengths: [],
    weaknesses: ["ball skills"],
  },
  {
    id: "calais-campbell", name: "Calais Campbell", team: "BAL",
    position: "EDGE", overall: 62, tier: 4, startingBid: 2, espnId: 11284,
    attr: {
      speed: 61, power: 64, passRush: 62, runStop: 61, tackling: 58, strength: 66,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "cameron-heyward", name: "Cameron Heyward", team: "PIT",
    position: "EDGE", overall: 62, tier: 4, startingBid: 2, espnId: 13977,
    attr: {
      speed: 60, power: 64, passRush: 61, runStop: 62, tackling: 77, strength: 66,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "charlie-woerner", name: "Charlie Woerner", team: "ATL",
    position: "TE", overall: 62, tier: 4, startingBid: 2, espnId: 4035020,
    attr: {
      speed: 55, catching: 87, routeRunning: 48, separation: 48, contestedCatch: 87, yac: 50, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "chris-moore", name: "Chris Moore", team: "BAL",
    position: "WR", overall: 62, tier: 4, startingBid: 2, espnId: 2576581,
    attr: {
      speed: 93, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 90, clutch: 50,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "christian-kirk", name: "Christian Kirk", team: "HOU",
    position: "WR", overall: 62, tier: 4, startingBid: 2, espnId: 3895856,
    attr: {
      speed: 75, catching: 55, routeRunning: 57, separation: 56, contestedCatch: 53, yac: 75, clutch: 50,
    },
    strengths: [],
    weaknesses: ["clutch","contested catch"],
  },
  {
    id: "coby-bryant", name: "Coby Bryant", team: "SEA",
    position: "S", overall: 62, tier: 4, startingBid: 2, espnId: 4239094,
    attr: {
      speed: 63, passRush: 40, runStop: 62, tackling: 66, coverage: 59, ballHawk: 62,
    },
    strengths: [],
    weaknesses: ["pass rush"],
  },
  {
    id: "colby-parkinson", name: "Colby Parkinson", team: "LAR",
    position: "TE", overall: 62, tier: 4, startingBid: 2, espnId: 4242557,
    attr: {
      speed: 63, catching: 81, routeRunning: 48, separation: 48, contestedCatch: 80, yac: 61, runBlock: 62, passBlock: 60, clutch: 59,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "craig-woodson", name: "Craig Woodson", team: "NE",
    position: "S", overall: 62, tier: 4, startingBid: 2, espnId: 4428930,
    attr: {
      speed: 62, passRush: 40, runStop: 69, tackling: 74, coverage: 58, ballHawk: 51,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "dadrion-taylor-demerson", name: "Dadrion Taylor-Demerson", team: "ARI",
    position: "S", overall: 62, tier: 4, startingBid: 2, espnId: 4428633,
    attr: {
      speed: 66, passRush: 40, runStop: 62, tackling: 66, coverage: 62, ballHawk: 56,
    },
    strengths: [],
    weaknesses: ["pass rush"],
  },
  {
    id: "dareke-young", name: "Dareke Young", team: "SEA",
    position: "WR", overall: 62, tier: 4, startingBid: 2, espnId: 4401805,
    attr: {
      speed: 95, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 92, clutch: 50,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "deandre-hopkins", name: "DeAndre Hopkins", team: "TEN",
    position: "WR", overall: 62, tier: 4, startingBid: 2, espnId: 15795,
    attr: {
      speed: 75, catching: 70, routeRunning: 49, separation: 49, contestedCatch: 69, yac: 75, clutch: 52,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "denico-autry", name: "Denico Autry", team: "HOU",
    position: "EDGE", overall: 62, tier: 4, startingBid: 2, espnId: 17447,
    attr: {
      speed: 64, power: 60, passRush: 66, runStop: 52, tackling: 50, strength: 57,
    },
    strengths: [],
    weaknesses: ["tackling","run defense"],
  },
  {
    id: "divine-deablo", name: "Divine Deablo", team: "ATL",
    position: "LB", overall: 62, tier: 4, startingBid: 2, espnId: 4037626,
    attr: {
      speed: 59, passRush: 45, runStop: 66, tackling: 66, coverage: 52, ballHawk: 49, awareness: 65,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "dremont-jones", name: "Dre'Mont Jones", team: "NE",
    position: "EDGE", overall: 62, tier: 4, startingBid: 2, espnId: 3915525,
    attr: {
      speed: 62, power: 62, passRush: 64, runStop: 56, tackling: 52, strength: 60,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "eric-saubert", name: "Eric Saubert", team: "SEA",
    position: "TE", overall: 62, tier: 4, startingBid: 2, espnId: 2975863,
    attr: {
      speed: 55, catching: 87, routeRunning: 48, separation: 48, contestedCatch: 87, yac: 50, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "evan-engram", name: "Evan Engram", team: "DEN",
    position: "TE", overall: 62, tier: 4, startingBid: 2, espnId: 3051876,
    attr: {
      speed: 55, catching: 81, routeRunning: 53, separation: 53, contestedCatch: 81, yac: 50, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: [],
    weaknesses: ["yards after catch","clutch"],
  },
  {
    id: "hollywood-brown", name: "Hollywood Brown", team: "KC",
    position: "WR", overall: 62, tier: 4, startingBid: 2, espnId: 4241372,
    attr: {
      speed: 72, catching: 65, routeRunning: 55, separation: 54, contestedCatch: 64, yac: 71, clutch: 53,
    },
    strengths: [],
    weaknesses: ["clutch","separation"],
  },
  {
    id: "hunter-long", name: "Hunter Long", team: "LAR",
    position: "TE", overall: 62, tier: 4, startingBid: 2, espnId: 4239944,
    attr: {
      speed: 55, catching: 87, routeRunning: 48, separation: 48, contestedCatch: 87, yac: 50, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "isaiah-bond", name: "Isaiah Bond", team: "CLE",
    position: "WR", overall: 62, tier: 4, startingBid: 2, espnId: 4808839,
    attr: {
      speed: 95, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 92, clutch: 50,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "jack-bech", name: "Jack Bech", team: "LV",
    position: "WR", overall: 62, tier: 4, startingBid: 2, espnId: 4603186,
    attr: {
      speed: 67, catching: 83, routeRunning: 48, separation: 48, contestedCatch: 83, yac: 65, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "jake-bobo", name: "Jake Bobo", team: "SEA",
    position: "WR", overall: 62, tier: 4, startingBid: 2, espnId: 4360405,
    attr: {
      speed: 58, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 53, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "jalen-brooks", name: "Jalen Brooks", team: "DAL",
    position: "WR", overall: 62, tier: 4, startingBid: 2, espnId: 4692835,
    attr: {
      speed: 95, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 92, clutch: 50,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "jalen-carter", name: "Jalen Carter", team: "PHI",
    position: "EDGE", overall: 62, tier: 4, startingBid: 2, espnId: 4685759,
    attr: {
      speed: 60, power: 64, passRush: 61, runStop: 62, tackling: 58, strength: 66,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "jaylen-watson", name: "Jaylen Watson", team: "LAR",
    position: "CB", overall: 62, tier: 4, startingBid: 2, espnId: 4697639,
    attr: {
      speed: 66, agility: 65, tackling: 68, coverage: 62, ballHawk: 57,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "joey-bosa", name: "Joey Bosa", team: "BUF",
    position: "EDGE", overall: 62, tier: 4, startingBid: 2, espnId: 3051389,
    attr: {
      speed: 62, power: 63, passRush: 64, runStop: 58, tackling: 50, strength: 62,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "jonas-sanker", name: "Jonas Sanker", team: "NO",
    position: "S", overall: 62, tier: 4, startingBid: 2, espnId: 4683813,
    attr: {
      speed: 60, passRush: 40, runStop: 70, tackling: 75, coverage: 55, ballHawk: 54,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "kameron-johnson", name: "Kameron Johnson", team: "TB",
    position: "WR", overall: 62, tier: 4, startingBid: 2, espnId: 5097554,
    attr: {
      speed: 95, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 92, clutch: 50,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "keenan-allen", name: "Keenan Allen", team: "IND",
    position: "WR", overall: 62, tier: 4, startingBid: 2, espnId: 15818,
    attr: {
      speed: 61, catching: 66, routeRunning: 63, separation: 62, contestedCatch: 65, yac: 57, clutch: 59,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "khadarel-hodge", name: "KhaDarel Hodge", team: "SF",
    position: "WR", overall: 62, tier: 4, startingBid: 2, espnId: 3047876,
    attr: {
      speed: 95, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 92, clutch: 50,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "kyle-williams", name: "Kyle Williams", team: "NE",
    position: "WR", overall: 62, tier: 4, startingBid: 2, espnId: 4613202,
    attr: {
      speed: 95, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 92, clutch: 50,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "luke-schoonmaker", name: "Luke Schoonmaker", team: "DAL",
    position: "TE", overall: 62, tier: 4, startingBid: 2, espnId: 4372096,
    attr: {
      speed: 56, catching: 84, routeRunning: 48, separation: 48, contestedCatch: 83, yac: 51, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "maliek-collins", name: "Maliek Collins", team: "CLE",
    position: "EDGE", overall: 62, tier: 4, startingBid: 2, espnId: 3040471,
    attr: {
      speed: 64, power: 62, passRush: 65, runStop: 54, tackling: 50, strength: 59,
    },
    strengths: [],
    weaknesses: ["tackling","run defense"],
  },
  {
    id: "marquez-valdes-scantling", name: "Marquez Valdes-Scantling", team: "BUF",
    position: "WR", overall: 62, tier: 4, startingBid: 2, espnId: 3051738,
    attr: {
      speed: 95, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 92, clutch: 51,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "minkah-fitzpatrick", name: "Minkah Fitzpatrick", team: "PIT",
    position: "S", overall: 62, tier: 4, startingBid: 2, espnId: 3925345,
    attr: {
      speed: 58, passRush: 40, runStop: 75, tackling: 80, coverage: 53, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "mitchell-evans", name: "Mitchell Evans", team: "CAR",
    position: "TE", overall: 62, tier: 4, startingBid: 2, espnId: 4683243,
    attr: {
      speed: 55, catching: 87, routeRunning: 48, separation: 48, contestedCatch: 87, yac: 50, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "najee-harris", name: "Najee Harris", team: "PIT",
    position: "RB", overall: 62, tier: 4, startingBid: 2, espnId: 4241457,
    attr: {
      speed: 64, agility: 59, power: 70, vision: 62, catching: 60, yac: 54, clutch: 54,
    },
    strengths: [],
    weaknesses: ["yards after catch","clutch"],
  },
  {
    id: "nikko-remigio", name: "Nikko Remigio", team: "KC",
    position: "WR", overall: 62, tier: 4, startingBid: 2, espnId: 4372716,
    attr: {
      speed: 95, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 92, clutch: 50,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "pharaoh-brown", name: "Pharaoh Brown", team: "SEA",
    position: "TE", overall: 62, tier: 4, startingBid: 2, espnId: 2971281,
    attr: {
      speed: 55, catching: 87, routeRunning: 48, separation: 48, contestedCatch: 87, yac: 50, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "pierre-strong-jr", name: "Pierre Strong Jr.", team: "CLE",
    position: "RB", overall: 62, tier: 4, startingBid: 2, espnId: 4249836,
    attr: {
      speed: 69, agility: 64, power: 55, vision: 68, catching: 50, yac: 59, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "simi-fehoko", name: "Simi Fehoko", team: "ARI",
    position: "WR", overall: 62, tier: 4, startingBid: 2, espnId: 4360739,
    attr: {
      speed: 95, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 92, clutch: 50,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "skyy-moore", name: "Skyy Moore", team: "GB",
    position: "WR", overall: 62, tier: 4, startingBid: 2, espnId: 4430191,
    attr: {
      speed: 95, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 92, clutch: 50,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "theo-johnson", name: "Theo Johnson", team: "NYG",
    position: "TE", overall: 62, tier: 4, startingBid: 2, espnId: 4429148,
    attr: {
      speed: 72, catching: 69, routeRunning: 54, separation: 54, contestedCatch: 68, yac: 72, runBlock: 62, passBlock: 60, clutch: 52,
    },
    strengths: [],
    weaknesses: ["clutch","route running"],
  },
  {
    id: "tony-jefferson", name: "Tony Jefferson", team: "LAC",
    position: "S", overall: 62, tier: 4, startingBid: 2, espnId: 16195,
    attr: {
      speed: 62, passRush: 40, runStop: 65, tackling: 69, coverage: 57, ballHawk: 60,
    },
    strengths: [],
    weaknesses: ["pass rush"],
  },
  {
    id: "tre-tucker", name: "Tre Tucker", team: "LV",
    position: "WR", overall: 62, tier: 4, startingBid: 2, espnId: 4428718,
    attr: {
      speed: 74, catching: 61, routeRunning: 56, separation: 55, contestedCatch: 59, yac: 74, clutch: 52,
    },
    strengths: [],
    weaknesses: ["clutch","separation"],
  },
  {
    id: "trevon-diggs", name: "Trevon Diggs", team: "DAL",
    position: "CB", overall: 62, tier: 4, startingBid: 2, espnId: 4040966,
    attr: {
      speed: 66, agility: 65, tackling: 59, coverage: 62, ballHawk: 58,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "trey-palmer", name: "Trey Palmer", team: "TB",
    position: "WR", overall: 62, tier: 4, startingBid: 2, espnId: 4426407,
    attr: {
      speed: 91, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 92, clutch: 50,
    },
    strengths: ["yards after catch","speed"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "tyler-allgeier", name: "Tyler Allgeier", team: "ARI",
    position: "RB", overall: 62, tier: 4, startingBid: 2, espnId: 4373626,
    attr: {
      speed: 68, agility: 63, power: 60, vision: 67, catching: 46, yac: 58, clutch: 55,
    },
    strengths: [],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "tyler-conklin", name: "Tyler Conklin", team: "NYJ",
    position: "TE", overall: 62, tier: 4, startingBid: 2, espnId: 3915486,
    attr: {
      speed: 58, catching: 85, routeRunning: 48, separation: 48, contestedCatch: 85, yac: 54, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "adonai-mitchell", name: "Adonai Mitchell", team: "NYJ",
    position: "WR", overall: 61, tier: 4, startingBid: 2, espnId: 4597500,
    attr: {
      speed: 88, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 92, clutch: 50,
    },
    strengths: ["yards after catch","speed"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "aidan-oconnell", name: "Aidan O'Connell", team: "LV",
    position: "QB", overall: 61, tier: 4, startingBid: 2, espnId: 4260394,
    attr: {
      armStrength: 55, shortAccuracy: 59, deepAccuracy: 52, pocketAwareness: 84, decisionMaking: 65, consistency: 62, clutch: 59, mobility: 47,
    },
    strengths: ["pocket presence"],
    weaknesses: ["mobility","deep ball"],
  },
  {
    id: "alex-bachman", name: "Alex Bachman", team: "LV",
    position: "WR", overall: 61, tier: 4, startingBid: 2, espnId: 3919510,
    attr: {
      speed: 55, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 50, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "beanie-bishop-jr", name: "Beanie Bishop Jr.", team: "PIT",
    position: "CB", overall: 61, tier: 4, startingBid: 2, espnId: 4363052,
    attr: {
      speed: 63, agility: 61, tackling: 54, coverage: 58, ballHawk: 65,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "benjamin-morrison", name: "Benjamin Morrison", team: "TB",
    position: "CB", overall: 61, tier: 4, startingBid: 2, espnId: 4816107,
    attr: {
      speed: 66, agility: 65, tackling: 59, coverage: 62, ballHawk: 54,
    },
    strengths: [],
    weaknesses: ["ball skills"],
  },
  {
    id: "brevyn-spann-ford", name: "Brevyn Spann-Ford", team: "DAL",
    position: "TE", overall: 61, tier: 4, startingBid: 2, espnId: 4360967,
    attr: {
      speed: 59, catching: 81, routeRunning: 48, separation: 48, contestedCatch: 81, yac: 55, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "britain-covey", name: "Britain Covey", team: "PHI",
    position: "WR", overall: 61, tier: 4, startingBid: 2, espnId: 3926231,
    attr: {
      speed: 55, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 50, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "chamarri-conner", name: "Chamarri Conner", team: "KC",
    position: "S", overall: 61, tier: 4, startingBid: 2, espnId: 4361964,
    attr: {
      speed: 55, passRush: 47, runStop: 78, tackling: 83, coverage: 50, ballHawk: 48,
    },
    strengths: ["tackling"],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "charles-harris", name: "Charles Harris", team: "CAR",
    position: "EDGE", overall: 61, tier: 4, startingBid: 2, espnId: 3051852,
    attr: {
      speed: 61, power: 62, passRush: 63, runStop: 57, tackling: 60, strength: 61,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "chidobe-awuzie", name: "Chidobe Awuzie", team: "BAL",
    position: "CB", overall: 61, tier: 4, startingBid: 2, espnId: 3052101,
    attr: {
      speed: 66, agility: 64, tackling: 57, coverage: 61, ballHawk: 55,
    },
    strengths: [],
    weaknesses: ["ball skills"],
  },
  {
    id: "christian-benford", name: "Christian Benford", team: "BUF",
    position: "CB", overall: 61, tier: 4, startingBid: 2, espnId: 4379778,
    attr: {
      speed: 65, agility: 63, tackling: 63, coverage: 60, ballHawk: 58,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "damar-hamlin", name: "Damar Hamlin", team: "BUF",
    position: "S", overall: 61, tier: 4, startingBid: 2, espnId: 4036060,
    attr: {
      speed: 56, passRush: 40, runStop: 73, tackling: 78, coverage: 51, ballHawk: 52,
    },
    strengths: [],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "deshaun-watson", name: "Deshaun Watson", team: "CLE",
    position: "QB", overall: 61, tier: 4, startingBid: 2, espnId: 3122840,
    attr: {
      armStrength: 51, shortAccuracy: 65, deepAccuracy: 45, pocketAwareness: 79, decisionMaking: 59, consistency: 67, clutch: 55, mobility: 66,
    },
    strengths: [],
    weaknesses: ["deep ball","arm strength"],
  },
  {
    id: "deven-thompkins", name: "Deven Thompkins", team: "ATL",
    position: "WR", overall: 61, tier: 4, startingBid: 2, espnId: 4374187,
    attr: {
      speed: 55, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 50, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "germaine-pratt", name: "Germaine Pratt", team: "CIN",
    position: "CB", overall: 61, tier: 4, startingBid: 2, espnId: 3116724,
    attr: {
      speed: 65, agility: 63, tackling: 82, coverage: 60, ballHawk: 57,
    },
    strengths: ["tackling"],
    weaknesses: [],
  },
  {
    id: "grant-delpit", name: "Grant Delpit", team: "CLE",
    position: "S", overall: 61, tier: 4, startingBid: 2, espnId: 4242208,
    attr: {
      speed: 55, passRush: 47, runStop: 76, tackling: 82, coverage: 50, ballHawk: 48,
    },
    strengths: ["tackling"],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "greg-dortch", name: "Greg Dortch", team: "BUF",
    position: "WR", overall: 61, tier: 4, startingBid: 2, espnId: 4037235,
    attr: {
      speed: 55, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 50, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "ivan-pace-jr", name: "Ivan Pace Jr.", team: "MIN",
    position: "LB", overall: 61, tier: 4, startingBid: 2, espnId: 4430280,
    attr: {
      speed: 60, passRush: 49, runStop: 67, tackling: 67, coverage: 45, ballHawk: 45, awareness: 66,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "jacob-parrish", name: "Jacob Parrish", team: "TB",
    position: "CB", overall: 61, tier: 4, startingBid: 2, espnId: 4912847,
    attr: {
      speed: 64, agility: 62, tackling: 72, coverage: 60, ballHawk: 58,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "jalen-tolbert", name: "Jalen Tolbert", team: "DAL",
    position: "WR", overall: 61, tier: 4, startingBid: 2, espnId: 4249417,
    attr: {
      speed: 76, catching: 60, routeRunning: 51, separation: 51, contestedCatch: 58, yac: 76, clutch: 57,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "jalon-walker", name: "Jalon Walker", team: "ATL",
    position: "EDGE", overall: 61, tier: 4, startingBid: 2, espnId: 4685597,
    attr: {
      speed: 63, power: 60, passRush: 65, runStop: 52, tackling: 56, strength: 57,
    },
    strengths: [],
    weaknesses: ["run defense"],
  },
  {
    id: "josey-jewell", name: "Josey Jewell", team: "CAR",
    position: "EDGE", overall: 61, tier: 4, startingBid: 2, espnId: 3040150,
    attr: {
      speed: 59, power: 63, passRush: 60, runStop: 61, tackling: 88, strength: 65,
    },
    strengths: ["tackling"],
    weaknesses: [],
  },
  {
    id: "julian-blackmon", name: "Julian Blackmon", team: "NO",
    position: "S", overall: 61, tier: 4, startingBid: 2, espnId: 4035661,
    attr: {
      speed: 56, passRush: 40, runStop: 72, tackling: 77, coverage: 51, ballHawk: 55,
    },
    strengths: [],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "julian-hill", name: "Julian Hill", team: "MIA",
    position: "TE", overall: 61, tier: 4, startingBid: 2, espnId: 4365395,
    attr: {
      speed: 55, catching: 82, routeRunning: 48, separation: 48, contestedCatch: 81, yac: 50, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "lajohntay-wester", name: "LaJohntay Wester", team: "BAL",
    position: "WR", overall: 61, tier: 4, startingBid: 2, espnId: 4690143,
    attr: {
      speed: 55, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 50, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "michael-mayer", name: "Michael Mayer", team: "LV",
    position: "TE", overall: 61, tier: 4, startingBid: 2, espnId: 4429086,
    attr: {
      speed: 55, catching: 83, routeRunning: 48, separation: 48, contestedCatch: 83, yac: 50, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "mitchell-tinsley", name: "Mitchell Tinsley", team: "CIN",
    position: "WR", overall: 61, tier: 4, startingBid: 2, espnId: 4690070,
    attr: {
      speed: 86, catching: 51, routeRunning: 49, separation: 49, contestedCatch: 49, yac: 86, clutch: 54,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "nick-scott", name: "Nick Scott", team: "CAR",
    position: "S", overall: 61, tier: 4, startingBid: 2, espnId: 3116179,
    attr: {
      speed: 55, passRush: 40, runStop: 77, tackling: 82, coverage: 50, ballHawk: 48,
    },
    strengths: ["tackling"],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "payne-durham", name: "Payne Durham", team: "TB",
    position: "TE", overall: 61, tier: 4, startingBid: 2, espnId: 4372505,
    attr: {
      speed: 65, catching: 76, routeRunning: 48, separation: 48, contestedCatch: 75, yac: 63, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "savion-williams", name: "Savion Williams", team: "GB",
    position: "WR", overall: 61, tier: 4, startingBid: 2, espnId: 4431487,
    attr: {
      speed: 55, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 50, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "travis-hunter", name: "Travis Hunter", team: "JAX",
    position: "WR", overall: 61, tier: 4, startingBid: 2, espnId: 4685415,
    attr: {
      speed: 64, catching: 66, routeRunning: 57, separation: 57, contestedCatch: 65, yac: 62, clutch: 51,
    },
    strengths: [],
    weaknesses: ["clutch"],
  },
  {
    id: "trent-sherfield", name: "Trent Sherfield", team: "MIN",
    position: "WR", overall: 61, tier: 4, startingBid: 2, espnId: 3122168,
    attr: {
      speed: 55, catching: 95, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 50, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "trevin-wallace", name: "Trevin Wallace", team: "CAR",
    position: "LB", overall: 61, tier: 4, startingBid: 2, espnId: 4683815,
    attr: {
      speed: 60, passRush: 47, runStop: 66, tackling: 67, coverage: 45, ballHawk: 45, awareness: 66,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "will-dissly", name: "Will Dissly", team: "LAC",
    position: "WR", overall: 61, tier: 4, startingBid: 2, espnId: 3127292,
    attr: {
      speed: 58, catching: 93, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 54, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "will-levis", name: "Will Levis", team: "TEN",
    position: "QB", overall: 61, tier: 4, startingBid: 2, espnId: 4361418,
    attr: {
      armStrength: 63, shortAccuracy: 63, deepAccuracy: 61, pocketAwareness: 63, decisionMaking: 56, consistency: 65, clutch: 70, mobility: 59,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "amari-cooper", name: "Amari Cooper", team: "CLE",
    position: "WR", overall: 60, tier: 4, startingBid: 2, espnId: 2976499,
    attr: {
      speed: 73, catching: 50, routeRunning: 56, separation: 56, contestedCatch: 48, yac: 73, clutch: 54,
    },
    strengths: [],
    weaknesses: ["contested catch","hands"],
  },
  {
    id: "andrew-van-ginkel", name: "Andrew Van Ginkel", team: "MIN",
    position: "LB", overall: 60, tier: 4, startingBid: 2, espnId: 3133487,
    attr: {
      speed: 53, passRush: 85, runStop: 65, tackling: 59, coverage: 62, ballHawk: 60, awareness: 59,
    },
    strengths: ["pass rush"],
    weaknesses: ["speed"],
  },
  {
    id: "andy-dalton", name: "Andy Dalton", team: "CAR",
    position: "QB", overall: 60, tier: 4, startingBid: 2, espnId: 14012,
    attr: {
      armStrength: 56, shortAccuracy: 71, deepAccuracy: 53, pocketAwareness: 65, decisionMaking: 57, consistency: 72, clutch: 66, mobility: 47,
    },
    strengths: [],
    weaknesses: ["mobility","deep ball"],
  },
  {
    id: "ashton-jeanty", name: "Ashton Jeanty", team: "LV",
    position: "RB", overall: 60, tier: 4, startingBid: 2, espnId: 4890973,
    attr: {
      speed: 58, agility: 55, power: 73, vision: 56, catching: 67, yac: 50, clutch: 72,
    },
    strengths: [],
    weaknesses: ["yards after catch","agility"],
  },
  {
    id: "bryan-bresee", name: "Bryan Bresee", team: "NO",
    position: "EDGE", overall: 60, tier: 4, startingBid: 2, espnId: 4428988,
    attr: {
      speed: 61, power: 60, passRush: 62, runStop: 54, tackling: 51, strength: 59,
    },
    strengths: [],
    weaknesses: ["tackling","run defense"],
  },
  {
    id: "bryan-cook", name: "Bryan Cook", team: "CIN",
    position: "S", overall: 60, tier: 4, startingBid: 2, espnId: 4247726,
    attr: {
      speed: 58, passRush: 40, runStop: 67, tackling: 71, coverage: 54, ballHawk: 52,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "cody-simon", name: "Cody Simon", team: "ARI",
    position: "LB", overall: 60, tier: 4, startingBid: 2, espnId: 4429071,
    attr: {
      speed: 60, passRush: 45, runStop: 65, tackling: 67, coverage: 45, ballHawk: 45, awareness: 66,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "deatrich-wise-jr", name: "Deatrich Wise Jr.", team: "NE",
    position: "EDGE", overall: 60, tier: 4, startingBid: 2, espnId: 2980080,
    attr: {
      speed: 61, power: 60, passRush: 62, runStop: 54, tackling: 52, strength: 59,
    },
    strengths: [],
    weaknesses: ["tackling","run defense"],
  },
  {
    id: "dexter-lawrence-ii", name: "Dexter Lawrence II", team: "CIN",
    position: "EDGE", overall: 60, tier: 4, startingBid: 2, espnId: 4035483,
    attr: {
      speed: 61, power: 60, passRush: 62, runStop: 54, tackling: 56, strength: 59,
    },
    strengths: [],
    weaknesses: ["run defense"],
  },
  {
    id: "donte-thornton-jr", name: "Dont'e Thornton Jr.", team: "LV",
    position: "WR", overall: 60, tier: 4, startingBid: 2, espnId: 4432775,
    attr: {
      speed: 84, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 86, clutch: 50,
    },
    strengths: ["yards after catch","speed"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "elic-ayomanor", name: "Elic Ayomanor", team: "TEN",
    position: "WR", overall: 60, tier: 4, startingBid: 2, espnId: 4883647,
    attr: {
      speed: 78, catching: 50, routeRunning: 52, separation: 52, contestedCatch: 48, yac: 80, clutch: 57,
    },
    strengths: [],
    weaknesses: ["contested catch","hands"],
  },
  {
    id: "eric-wilson", name: "Eric Wilson", team: "MIN",
    position: "LB", overall: 60, tier: 4, startingBid: 2, espnId: 3056916,
    attr: {
      speed: 59, passRush: 56, runStop: 68, tackling: 66, coverage: 45, ballHawk: 45, awareness: 65,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "greg-newsome-ii", name: "Greg Newsome II", team: "NYG",
    position: "CB", overall: 60, tier: 4, startingBid: 2, espnId: 4361266,
    attr: {
      speed: 65, agility: 63, tackling: 55, coverage: 60, ballHawk: 56,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "jahan-dotson", name: "Jahan Dotson", team: "ATL",
    position: "WR", overall: 60, tier: 4, startingBid: 2, espnId: 4361409,
    attr: {
      speed: 84, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 87, clutch: 50,
    },
    strengths: ["yards after catch","speed"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "jameis-winston", name: "Jameis Winston", team: "CLE",
    position: "QB", overall: 60, tier: 4, startingBid: 2, espnId: 2969939,
    attr: {
      armStrength: 72, shortAccuracy: 53, deepAccuracy: 70, pocketAwareness: 64, decisionMaking: 56, consistency: 57, clutch: 69, mobility: 51,
    },
    strengths: [],
    weaknesses: ["mobility","short accuracy"],
  },
  {
    id: "jaylin-lane", name: "Jaylin Lane", team: "WSH",
    position: "WR", overall: 60, tier: 4, startingBid: 2, espnId: 4602667,
    attr: {
      speed: 85, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 88, clutch: 50,
    },
    strengths: ["yards after catch","speed"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "jaylon-johnson", name: "Jaylon Johnson", team: "CHI",
    position: "CB", overall: 60, tier: 4, startingBid: 2, espnId: 4243253,
    attr: {
      speed: 64, agility: 62, tackling: 56, coverage: 59, ballHawk: 58,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "jiayir-brown", name: "Ji'Ayir Brown", team: "SF",
    position: "S", overall: 60, tier: 4, startingBid: 2, espnId: 4693644,
    attr: {
      speed: 60, passRush: 40, runStop: 65, tackling: 69, coverage: 55, ballHawk: 53,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "joe-flacco", name: "Joe Flacco", team: "IND",
    position: "QB", overall: 60, tier: 4, startingBid: 2, espnId: 11252,
    attr: {
      armStrength: 54, shortAccuracy: 60, deepAccuracy: 50, pocketAwareness: 77, decisionMaking: 66, consistency: 63, clutch: 70, mobility: 45,
    },
    strengths: [],
    weaknesses: ["mobility","deep ball"],
  },
  {
    id: "justin-eboigbe", name: "Justin Eboigbe", team: "LAC",
    position: "EDGE", overall: 60, tier: 4, startingBid: 2, espnId: 4567138,
    attr: {
      speed: 61, power: 60, passRush: 62, runStop: 53, tackling: 55, strength: 58,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "kamren-kinchens", name: "Kamren Kinchens", team: "LAR",
    position: "S", overall: 60, tier: 4, startingBid: 2, espnId: 4596363,
    attr: {
      speed: 59, passRush: 40, runStop: 64, tackling: 68, coverage: 55, ballHawk: 56,
    },
    strengths: [],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "keshawn-williams", name: "Ke'Shawn Williams", team: "CIN",
    position: "WR", overall: 60, tier: 4, startingBid: 2, espnId: 4570738,
    attr: {
      speed: 55, catching: 93, routeRunning: 48, separation: 48, contestedCatch: 87, yac: 50, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "kenny-moore-ii", name: "Kenny Moore II", team: "IND",
    position: "CB", overall: 60, tier: 4, startingBid: 2, espnId: 4218312,
    attr: {
      speed: 64, agility: 61, tackling: 72, coverage: 59, ballHawk: 59,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "kevin-givens", name: "Kevin Givens", team: "SF",
    position: "EDGE", overall: 60, tier: 4, startingBid: 2, espnId: 3929641,
    attr: {
      speed: 62, power: 57, passRush: 64, runStop: 51, tackling: 51, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "kimani-vidal", name: "Kimani Vidal", team: "LAC",
    position: "RB", overall: 60, tier: 4, startingBid: 2, espnId: 4430968,
    attr: {
      speed: 64, agility: 59, power: 61, vision: 63, catching: 51, yac: 54, clutch: 51,
    },
    strengths: [],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "malachi-moore", name: "Malachi Moore", team: "NYJ",
    position: "S", overall: 60, tier: 4, startingBid: 2, espnId: 4692024,
    attr: {
      speed: 55, passRush: 40, runStop: 74, tackling: 79, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "mason-taylor", name: "Mason Taylor", team: "NYJ",
    position: "TE", overall: 60, tier: 4, startingBid: 2, espnId: 4808766,
    attr: {
      speed: 55, catching: 78, routeRunning: 49, separation: 49, contestedCatch: 78, yac: 50, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "nick-westbrook-ikhine", name: "Nick Westbrook-Ikhine", team: "MIA",
    position: "WR", overall: 60, tier: 4, startingBid: 2, espnId: 3929785,
    attr: {
      speed: 86, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 89, clutch: 61,
    },
    strengths: ["yards after catch","speed"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "omar-speights", name: "Omar Speights", team: "LAR",
    position: "LB", overall: 60, tier: 4, startingBid: 2, espnId: 4428550,
    attr: {
      speed: 60, passRush: 45, runStop: 65, tackling: 67, coverage: 45, ballHawk: 45, awareness: 66,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "reed-blankenship", name: "Reed Blankenship", team: "HOU",
    position: "S", overall: 60, tier: 4, startingBid: 2, espnId: 4243956,
    attr: {
      speed: 56, passRush: 40, runStop: 72, tackling: 76, coverage: 51, ballHawk: 53,
    },
    strengths: [],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "roman-wilson", name: "Roman Wilson", team: "PIT",
    position: "WR", overall: 60, tier: 4, startingBid: 2, espnId: 4431492,
    attr: {
      speed: 78, catching: 56, routeRunning: 49, separation: 49, contestedCatch: 54, yac: 80, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "spencer-rattler", name: "Spencer Rattler", team: "NO",
    position: "QB", overall: 60, tier: 4, startingBid: 2, espnId: 4426339,
    attr: {
      armStrength: 50, shortAccuracy: 62, deepAccuracy: 42, pocketAwareness: 82, decisionMaking: 57, consistency: 65, clutch: 55, mobility: 65,
    },
    strengths: ["pocket presence"],
    weaknesses: ["deep ball","arm strength"],
  },
  {
    id: "sterling-shepard", name: "Sterling Shepard", team: "TB",
    position: "WR", overall: 60, tier: 4, startingBid: 2, espnId: 2976592,
    attr: {
      speed: 61, catching: 80, routeRunning: 49, separation: 49, contestedCatch: 79, yac: 58, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "tai-felton", name: "Tai Felton", team: "MIN",
    position: "WR", overall: 60, tier: 4, startingBid: 2, espnId: 4565185,
    attr: {
      speed: 55, catching: 92, routeRunning: 49, separation: 49, contestedCatch: 85, yac: 50, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "taylor-rapp", name: "Taylor Rapp", team: "BUF",
    position: "S", overall: 60, tier: 4, startingBid: 2, espnId: 4039007,
    attr: {
      speed: 58, passRush: 40, runStop: 68, tackling: 72, coverage: 53, ballHawk: 55,
    },
    strengths: [],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "tom-kennedy", name: "Tom Kennedy", team: "DET",
    position: "WR", overall: 60, tier: 4, startingBid: 2, espnId: 3126997,
    attr: {
      speed: 55, catching: 92, routeRunning: 49, separation: 49, contestedCatch: 85, yac: 50, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "tre-harris", name: "Tre' Harris", team: "LAC",
    position: "WR", overall: 60, tier: 4, startingBid: 2, espnId: 4686612,
    attr: {
      speed: 64, catching: 78, routeRunning: 48, separation: 48, contestedCatch: 77, yac: 62, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "tyler-boyd", name: "Tyler Boyd", team: "TEN",
    position: "WR", overall: 60, tier: 4, startingBid: 2, espnId: 3045144,
    attr: {
      speed: 62, catching: 80, routeRunning: 49, separation: 49, contestedCatch: 80, yac: 58, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "tyrice-knight", name: "Tyrice Knight", team: "SEA",
    position: "LB", overall: 60, tier: 4, startingBid: 2, espnId: 4686540,
    attr: {
      speed: 59, passRush: 47, runStop: 66, tackling: 66, coverage: 45, ballHawk: 45, awareness: 65,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "velus-jones-jr", name: "Velus Jones Jr.", team: "SEA",
    position: "WR", overall: 60, tier: 4, startingBid: 2, espnId: 4035693,
    attr: {
      speed: 55, catching: 88, routeRunning: 49, separation: 49, contestedCatch: 83, yac: 51, clutch: 51,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "bryce-huff", name: "Bryce Huff", team: "SF",
    position: "EDGE", overall: 59, tier: 4, startingBid: 2, espnId: 4039375,
    attr: {
      speed: 59, power: 61, passRush: 59, runStop: 57, tackling: 50, strength: 61,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "byron-murphy-ii", name: "Byron Murphy II", team: "SEA",
    position: "EDGE", overall: 59, tier: 4, startingBid: 2, espnId: 4570040,
    attr: {
      speed: 60, power: 59, passRush: 61, runStop: 53, tackling: 66, strength: 58,
    },
    strengths: [],
    weaknesses: ["run defense"],
  },
  {
    id: "cam-ward", name: "Cam Ward", team: "TEN",
    position: "QB", overall: 59, tier: 4, startingBid: 2, espnId: 4688380,
    attr: {
      armStrength: 50, shortAccuracy: 52, deepAccuracy: 42, pocketAwareness: 90, decisionMaking: 66, consistency: 56, clutch: 58, mobility: 53,
    },
    strengths: ["pocket presence"],
    weaknesses: ["deep ball","arm strength"],
  },
  {
    id: "cedric-tillman", name: "Cedric Tillman", team: "CLE",
    position: "WR", overall: 59, tier: 4, startingBid: 2, espnId: 4369863,
    attr: {
      speed: 76, catching: 54, routeRunning: 51, separation: 51, contestedCatch: 52, yac: 77, clutch: 53,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "chris-manhertz", name: "Chris Manhertz", team: "NYG",
    position: "TE", overall: 59, tier: 4, startingBid: 2, espnId: 2531358,
    attr: {
      speed: 56, catching: 74, routeRunning: 49, separation: 49, contestedCatch: 73, yac: 52, runBlock: 62, passBlock: 60, clutch: 51,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "colson-yankoff", name: "Colson Yankoff", team: "WSH",
    position: "TE", overall: 59, tier: 4, startingBid: 2, espnId: 4361088,
    attr: {
      speed: 55, catching: 76, routeRunning: 48, separation: 48, contestedCatch: 75, yac: 50, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "darius-alexander", name: "Darius Alexander", team: "NYG",
    position: "EDGE", overall: 59, tier: 4, startingBid: 2, espnId: 4426542,
    attr: {
      speed: 60, power: 59, passRush: 61, runStop: 53, tackling: 50, strength: 57,
    },
    strengths: [],
    weaknesses: ["tackling","run defense"],
  },
  {
    id: "dee-winters", name: "Dee Winters", team: "DAL",
    position: "LB", overall: 59, tier: 4, startingBid: 2, espnId: 4428914,
    attr: {
      speed: 57, passRush: 45, runStop: 64, tackling: 63, coverage: 49, ballHawk: 49, awareness: 62,
    },
    strengths: [],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "derek-barnett", name: "Derek Barnett", team: "HOU",
    position: "EDGE", overall: 59, tier: 4, startingBid: 2, espnId: 3115336,
    attr: {
      speed: 61, power: 59, passRush: 62, runStop: 53, tackling: 50, strength: 58,
    },
    strengths: [],
    weaknesses: ["tackling","run defense"],
  },
  {
    id: "derius-davis", name: "Derius Davis", team: "LAC",
    position: "WR", overall: 59, tier: 4, startingBid: 2, espnId: 4362477,
    attr: {
      speed: 55, catching: 90, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 50, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "dillon-gabriel", name: "Dillon Gabriel", team: "CLE",
    position: "QB", overall: 59, tier: 4, startingBid: 2, espnId: 4427238,
    attr: {
      armStrength: 51, shortAccuracy: 51, deepAccuracy: 45, pocketAwareness: 82, decisionMaking: 71, consistency: 55, clutch: 64, mobility: 52,
    },
    strengths: ["pocket presence"],
    weaknesses: ["deep ball","short accuracy"],
  },
  {
    id: "dorian-williams", name: "Dorian Williams", team: "BUF",
    position: "LB", overall: 59, tier: 4, startingBid: 2, espnId: 4568624,
    attr: {
      speed: 59, passRush: 45, runStop: 64, tackling: 65, coverage: 45, ballHawk: 45, awareness: 65,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "dre-greenlaw", name: "Dre Greenlaw", team: "SF",
    position: "LB", overall: 59, tier: 4, startingBid: 2, espnId: 3916903,
    attr: {
      speed: 59, passRush: 45, runStop: 64, tackling: 65, coverage: 45, ballHawk: 48, awareness: 65,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "felix-anudike-uzomah", name: "Felix Anudike-Uzomah", team: "KC",
    position: "EDGE", overall: 59, tier: 4, startingBid: 2, espnId: 4612387,
    attr: {
      speed: 58, power: 63, passRush: 58, runStop: 61, tackling: 50, strength: 65,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "hunter-luepke", name: "Hunter Luepke", team: "DAL",
    position: "RB", overall: 59, tier: 4, startingBid: 2, espnId: 4383396,
    attr: {
      speed: 65, agility: 60, power: 55, vision: 64, catching: 48, yac: 55, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "isaiah-pola-mao", name: "Isaiah Pola-Mao", team: "LV",
    position: "S", overall: 59, tier: 4, startingBid: 2, espnId: 4259632,
    attr: {
      speed: 56, passRush: 40, runStop: 71, tackling: 76, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "isaiah-williams", name: "Isaiah Williams", team: "NYJ",
    position: "WR", overall: 59, tier: 4, startingBid: 2, espnId: 4569371,
    attr: {
      speed: 55, catching: 89, routeRunning: 48, separation: 48, contestedCatch: 88, yac: 50, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "jack-gibbens", name: "Jack Gibbens", team: "ARI",
    position: "LB", overall: 59, tier: 4, startingBid: 2, espnId: 4249739,
    attr: {
      speed: 58, passRush: 45, runStop: 65, tackling: 65, coverage: 45, ballHawk: 45, awareness: 64,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "jalen-redmond", name: "Jalen Redmond", team: "MIN",
    position: "EDGE", overall: 59, tier: 4, startingBid: 2, espnId: 4360277,
    attr: {
      speed: 57, power: 63, passRush: 57, runStop: 62, tackling: 60, strength: 66,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "jarvis-brownlee-jr", name: "Jarvis Brownlee Jr.", team: "NYJ",
    position: "CB", overall: 59, tier: 4, startingBid: 2, espnId: 4426817,
    attr: {
      speed: 64, agility: 62, tackling: 78, coverage: 59, ballHawk: 54,
    },
    strengths: [],
    weaknesses: ["ball skills"],
  },
  {
    id: "jason-marshall-jr", name: "Jason Marshall Jr.", team: "MIA",
    position: "CB", overall: 59, tier: 4, startingBid: 2, espnId: 4432730,
    attr: {
      speed: 62, agility: 61, tackling: 56, coverage: 58, ballHawk: 57,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "jihaad-campbell", name: "Jihaad Campbell", team: "PHI",
    position: "LB", overall: 59, tier: 4, startingBid: 2, espnId: 4685287,
    attr: {
      speed: 59, passRush: 45, runStop: 64, tackling: 65, coverage: 45, ballHawk: 48, awareness: 65,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "john-bates", name: "John Bates", team: "WSH",
    position: "TE", overall: 59, tier: 4, startingBid: 2, espnId: 4048228,
    attr: {
      speed: 59, catching: 72, routeRunning: 48, separation: 48, contestedCatch: 71, yac: 55, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "jordan-akins", name: "Jordan Akins", team: "CLE",
    position: "WR", overall: 59, tier: 4, startingBid: 2, espnId: 3128452,
    attr: {
      speed: 60, catching: 81, routeRunning: 48, separation: 48, contestedCatch: 81, yac: 56, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "joseph-ossai", name: "Joseph Ossai", team: "CIN",
    position: "EDGE", overall: 59, tier: 4, startingBid: 2, espnId: 4362094,
    attr: {
      speed: 60, power: 60, passRush: 61, runStop: 55, tackling: 59, strength: 59,
    },
    strengths: [],
    weaknesses: ["run defense"],
  },
  {
    id: "josh-newton", name: "Josh Newton", team: "CIN",
    position: "CB", overall: 59, tier: 4, startingBid: 2, espnId: 4365319,
    attr: {
      speed: 64, agility: 62, tackling: 46, coverage: 59, ballHawk: 54,
    },
    strengths: [],
    weaknesses: ["tackling","ball skills"],
  },
  {
    id: "justin-simmons", name: "Justin Simmons", team: "ATL",
    position: "CB", overall: 59, tier: 4, startingBid: 2, espnId: 2969860,
    attr: {
      speed: 63, agility: 61, tackling: 65, coverage: 58, ballHawk: 58,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "lavonte-david", name: "Lavonte David", team: "TB",
    position: "EDGE", overall: 59, tier: 4, startingBid: 2, espnId: 14985,
    attr: {
      speed: 59, power: 61, passRush: 60, runStop: 57, tackling: 88, strength: 62,
    },
    strengths: ["tackling"],
    weaknesses: [],
  },
  {
    id: "lequint-allen-jr", name: "LeQuint Allen Jr.", team: "JAX",
    position: "RB", overall: 59, tier: 4, startingBid: 2, espnId: 4911851,
    attr: {
      speed: 66, agility: 61, power: 55, vision: 65, catching: 45, yac: 56, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "malik-mustapha", name: "Malik Mustapha", team: "SF",
    position: "S", overall: 59, tier: 4, startingBid: 2, espnId: 4696211,
    attr: {
      speed: 56, passRush: 40, runStop: 71, tackling: 76, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "mason-rudolph", name: "Mason Rudolph", team: "TEN",
    position: "QB", overall: 59, tier: 4, startingBid: 2, espnId: 3116407,
    attr: {
      armStrength: 56, shortAccuracy: 70, deepAccuracy: 54, pocketAwareness: 63, decisionMaking: 54, consistency: 71, clutch: 65, mobility: 52,
    },
    strengths: [],
    weaknesses: ["mobility","deep ball"],
  },
  {
    id: "nohl-williams", name: "Nohl Williams", team: "KC",
    position: "CB", overall: 59, tier: 4, startingBid: 2, espnId: 4610705,
    attr: {
      speed: 64, agility: 62, tackling: 56, coverage: 60, ballHawk: 52,
    },
    strengths: [],
    weaknesses: ["ball skills"],
  },
  {
    id: "quan-martin", name: "Quan Martin", team: "WSH",
    position: "S", overall: 59, tier: 4, startingBid: 2, espnId: 4360378,
    attr: {
      speed: 55, passRush: 40, runStop: 72, tackling: 76, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "quinnen-williams", name: "Quinnen Williams", team: "DAL",
    position: "EDGE", overall: 59, tier: 4, startingBid: 2, espnId: 4040982,
    attr: {
      speed: 58, power: 62, passRush: 58, runStop: 60, tackling: 60, strength: 64,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "ronnie-hickman", name: "Ronnie Hickman", team: "CLE",
    position: "S", overall: 59, tier: 4, startingBid: 2, espnId: 4569620,
    attr: {
      speed: 56, passRush: 40, runStop: 70, tackling: 74, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "storm-duck", name: "Storm Duck", team: "MIA",
    position: "CB", overall: 59, tier: 4, startingBid: 2, espnId: 4427103,
    attr: {
      speed: 63, agility: 61, tackling: 59, coverage: 59, ballHawk: 52,
    },
    strengths: [],
    weaknesses: ["ball skills"],
  },
  {
    id: "terell-smith", name: "Terell Smith", team: "CHI",
    position: "CB", overall: 59, tier: 4, startingBid: 2, espnId: 4360935,
    attr: {
      speed: 62, agility: 61, tackling: 47, coverage: 58, ballHawk: 57,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "tez-johnson", name: "Tez Johnson", team: "TB",
    position: "WR", overall: 59, tier: 4, startingBid: 2, espnId: 4608810,
    attr: {
      speed: 72, catching: 66, routeRunning: 48, separation: 48, contestedCatch: 65, yac: 71, clutch: 59,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "tory-horton", name: "Tory Horton", team: "SEA",
    position: "WR", overall: 59, tier: 4, startingBid: 2, espnId: 4597703,
    attr: {
      speed: 74, catching: 59, routeRunning: 49, separation: 49, contestedCatch: 57, yac: 75, clutch: 78,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "tyler-lockett", name: "Tyler Lockett", team: "SEA",
    position: "WR", overall: 59, tier: 4, startingBid: 2, espnId: 2577327,
    attr: {
      speed: 68, catching: 68, routeRunning: 49, separation: 49, contestedCatch: 66, yac: 67, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "tyrann-mathieu", name: "Tyrann Mathieu", team: "NO",
    position: "CB", overall: 59, tier: 4, startingBid: 2, espnId: 15851,
    attr: {
      speed: 62, agility: 60, tackling: 62, coverage: 57, ballHawk: 60,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "tyree-wilson", name: "Tyree Wilson", team: "NO",
    position: "EDGE", overall: 59, tier: 4, startingBid: 2, espnId: 4372533,
    attr: {
      speed: 59, power: 61, passRush: 60, runStop: 57, tackling: 52, strength: 61,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "tyrod-taylor", name: "Tyrod Taylor", team: "NYJ",
    position: "QB", overall: 59, tier: 4, startingBid: 2, espnId: 14163,
    attr: {
      armStrength: 51, shortAccuracy: 59, deepAccuracy: 45, pocketAwareness: 68, decisionMaking: 66, consistency: 61, clutch: 74, mobility: 62,
    },
    strengths: [],
    weaknesses: ["deep ball","arm strength"],
  },
  {
    id: "van-jefferson", name: "Van Jefferson", team: "PIT",
    position: "WR", overall: 59, tier: 4, startingBid: 2, espnId: 3930066,
    attr: {
      speed: 75, catching: 58, routeRunning: 48, separation: 48, contestedCatch: 56, yac: 76, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "zach-harrison", name: "Zach Harrison", team: "ATL",
    position: "EDGE", overall: 59, tier: 4, startingBid: 2, espnId: 4426412,
    attr: {
      speed: 59, power: 60, passRush: 60, runStop: 55, tackling: 56, strength: 59,
    },
    strengths: [],
    weaknesses: ["run defense"],
  },
  {
    id: "ashawn-robinson", name: "A'Shawn Robinson", team: "TB",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3054857,
    attr: {
      speed: 56, power: 56, passRush: 57, runStop: 51, tackling: 76, strength: 56,
    },
    strengths: [],
    weaknesses: ["run defense"],
  },
  {
    id: "abdul-carter", name: "Abdul Carter", team: "NYG",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4725996,
    attr: {
      speed: 50, passRush: 57, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "adam-butler", name: "Adam Butler", team: "LV",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 2972342,
    attr: {
      speed: 55, power: 56, passRush: 55, runStop: 52, tackling: 68, strength: 57,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "adetomiwa-adebawore", name: "Adetomiwa Adebawore", team: "IND",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4427635,
    attr: {
      speed: 57, power: 58, passRush: 57, runStop: 53, tackling: 53, strength: 58,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "adin-huntington", name: "Adin Huntington", team: "CLE",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4605792,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "aj-epenesa", name: "AJ Epenesa", team: "PHI",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4240585,
    attr: {
      speed: 56, power: 56, passRush: 57, runStop: 51, tackling: 53, strength: 56,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "akayleb-evans", name: "Akayleb Evans", team: "CAR",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4244607,
    attr: {
      speed: 58, agility: 55, tackling: 45, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["tackling","ball skills"],
  },
  {
    id: "al-quadin-muhammad", name: "Al-Quadin Muhammad", team: "TB",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 3051942,
    attr: {
      speed: 50, passRush: 85, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: ["pass rush"],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "alec-ingold", name: "Alec Ingold", team: "MIA",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 3917668,
    attr: {
      speed: 55, agility: 55, power: 55, vision: 52, catching: 49, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "alex-highsmith", name: "Alex Highsmith", team: "PIT",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4037333,
    attr: {
      speed: 50, passRush: 85, runStop: 60, tackling: 55, coverage: 46, ballHawk: 46, awareness: 55,
    },
    strengths: ["pass rush"],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "alexander-mattison", name: "Alexander Mattison", team: "LV",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4048244,
    attr: {
      speed: 55, agility: 55, power: 58, vision: 52, catching: 66, yac: 50, clutch: 57,
    },
    strengths: [],
    weaknesses: ["yards after catch","vision"],
  },
  {
    id: "alfred-collins", name: "Alfred Collins", team: "SF",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4430835,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "ali-gaye", name: "Ali Gaye", team: "TEN",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4243321,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 53, tackling: 51, strength: 57,
    },
    strengths: [],
    weaknesses: ["tackling","run defense"],
  },
  {
    id: "alijah-clark", name: "Alijah Clark", team: "DAL",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4595352,
    attr: {
      speed: 55, passRush: 41, runStop: 50, tackling: 52, coverage: 50, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "alim-mcneill", name: "Alim McNeill", team: "DET",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4361662,
    attr: {
      speed: 58, power: 60, passRush: 58, runStop: 57, tackling: 50, strength: 61,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "amani-oruwariye", name: "Amani Oruwariye", team: "DAL",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 3116175,
    attr: {
      speed: 60, agility: 58, tackling: 62, coverage: 55, ballHawk: 56,
    },
    strengths: [],
    weaknesses: ["coverage"],
  },
  {
    id: "amari-burney", name: "Amari Burney", team: "LV",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4360239,
    attr: {
      speed: 55, passRush: 48, runStop: 51, tackling: 52, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "amen-ogbongbemiga", name: "Amen Ogbongbemiga", team: "CHI",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4038432,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "andre-cisco", name: "Andre Cisco", team: "NYJ",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4361939,
    attr: {
      speed: 58, passRush: 40, runStop: 64, tackling: 68, coverage: 53, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "andrew-billings", name: "Andrew Billings", team: "CHI",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3051775,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 52, tackling: 50, strength: 57,
    },
    strengths: [],
    weaknesses: ["tackling","run defense"],
  },
  {
    id: "andrew-mukuba", name: "Andrew Mukuba", team: "PHI",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4602197,
    attr: {
      speed: 55, passRush: 40, runStop: 58, tackling: 61, coverage: 50, ballHawk: 55,
    },
    strengths: [],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "anfernee-jennings", name: "Anfernee Jennings", team: "NO",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 3925350,
    attr: {
      speed: 50, passRush: 52, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "anfernee-orji", name: "Anfernee Orji", team: "NO",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4567535,
    attr: {
      speed: 55, passRush: 41, runStop: 50, tackling: 52, coverage: 50, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "anthony-nelson", name: "Anthony Nelson", team: "TB",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 3894856,
    attr: {
      speed: 50, passRush: 55, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "anthony-richardson-sr", name: "Anthony Richardson Sr.", team: "IND",
    position: "QB", overall: 58, tier: 4, startingBid: 2, espnId: 4429084,
    attr: {
      armStrength: 61, shortAccuracy: 47, deepAccuracy: 58, pocketAwareness: 58, decisionMaking: 47, consistency: 51, clutch: 59, mobility: 80,
    },
    strengths: [],
    weaknesses: ["short accuracy","decision-making"],
  },
  {
    id: "anthony-walker-jr", name: "Anthony Walker Jr.", team: "MIA",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 3045251,
    attr: {
      speed: 58, agility: 55, tackling: 82, coverage: 52, ballHawk: 50,
    },
    strengths: ["tackling"],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "antonio-hamilton-sr", name: "Antonio Hamilton Sr.", team: "ATL",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3056354,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "antonio-johnson", name: "Antonio Johnson", team: "JAX",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4429168,
    attr: {
      speed: 58, passRush: 41, runStop: 59, tackling: 62, coverage: 53, ballHawk: 55,
    },
    strengths: [],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "ardarius-washington", name: "Ar'Darius Washington", team: "NYG",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4362492,
    attr: {
      speed: 59, passRush: 44, runStop: 54, tackling: 57, coverage: 54, ballHawk: 52,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "arian-smith", name: "Arian Smith", team: "NYJ",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 4429105,
    attr: {
      speed: 55, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "arik-armstead", name: "Arik Armstead", team: "JAX",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 2971275,
    attr: {
      speed: 57, power: 56, passRush: 57, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "arnold-ebiketie", name: "Arnold Ebiketie", team: "PHI",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4257591,
    attr: {
      speed: 50, passRush: 58, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "arron-mosby", name: "Arron Mosby", team: "GB",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4242996,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "art-green", name: "Art Green", team: "NYG",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4689674,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "arthur-maulet", name: "Arthur Maulet", team: "DET",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 3916144,
    attr: {
      speed: 58, agility: 55, tackling: 50, coverage: 53, ballHawk: 54,
    },
    strengths: [],
    weaknesses: ["tackling","coverage"],
  },
  {
    id: "asante-samuel-jr", name: "Asante Samuel Jr.", team: "PIT",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4363034,
    attr: {
      speed: 58, agility: 55, tackling: 48, coverage: 52, ballHawk: 53,
    },
    strengths: [],
    weaknesses: ["tackling","coverage"],
  },
  {
    id: "ashton-gillotte", name: "Ashton Gillotte", team: "KC",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4684432,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 53, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "ashtyn-davis", name: "Ashtyn Davis", team: "SF",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3858271,
    attr: {
      speed: 55, passRush: 40, runStop: 61, tackling: 65, coverage: 50, ballHawk: 52,
    },
    strengths: [],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "austin-ajiake", name: "Austin Ajiake", team: "IND",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4374171,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "austin-booker", name: "Austin Booker", team: "CHI",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4683553,
    attr: {
      speed: 59, power: 58, passRush: 59, runStop: 52, tackling: 57, strength: 57,
    },
    strengths: [],
    weaknesses: ["run defense"],
  },
  {
    id: "austin-johnson", name: "Austin Johnson", team: "JAX",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 2979591,
    attr: {
      speed: 58, agility: 55, tackling: 45, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["tackling","ball skills"],
  },
  {
    id: "avery-williams", name: "Avery Williams", team: "NYJ",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4048259,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "azeez-ojulari", name: "Azeez Ojulari", team: "NYG",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4379409,
    attr: {
      speed: 50, passRush: 77, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "bj-green-ii", name: "B.J. Green II", team: "JAX",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4875266,
    attr: {
      speed: 57, power: 55, passRush: 57, runStop: 51, tackling: 51, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "bj-hill", name: "B.J. Hill", team: "CIN",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3116748,
    attr: {
      speed: 56, power: 57, passRush: 56, runStop: 53, tackling: 71, strength: 58,
    },
    strengths: [],
    weaknesses: ["run defense"],
  },
  {
    id: "bam-knight", name: "Bam Knight", team: "ARI",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4427728,
    attr: {
      speed: 55, agility: 55, power: 55, vision: 52, catching: 56, yac: 50, clutch: 60,
    },
    strengths: [],
    weaknesses: ["yards after catch","vision"],
  },
  {
    id: "bam-martin-scott", name: "Bam Martin-Scott", team: "CAR",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4880613,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "baron-browning", name: "Baron Browning", team: "ARI",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4241987,
    attr: {
      speed: 50, passRush: 50, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "barryn-sorrell", name: "Barryn Sorrell", team: "GB",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4683643,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "baylon-spector", name: "Baylon Spector", team: "BUF",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4239997,
    attr: {
      speed: 55, passRush: 48, runStop: 56, tackling: 59, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["ball skills","pass rush"],
  },
  {
    id: "ben-niemann", name: "Ben Niemann", team: "DET",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3140643,
    attr: {
      speed: 55, passRush: 41, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "benito-jones", name: "Benito Jones", team: "MIA",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4035299,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "benjamin-st-juste", name: "Benjamin St-Juste", team: "GB",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4258206,
    attr: {
      speed: 63, agility: 60, tackling: 60, coverage: 57, ballHawk: 53,
    },
    strengths: [],
    weaknesses: ["ball skills"],
  },
  {
    id: "bilal-nichols", name: "Bilal Nichols", team: "ARI",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3117922,
    attr: {
      speed: 55, passRush: 43, runStop: 51, tackling: 53, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "blake-whiteheart", name: "Blake Whiteheart", team: "CLE",
    position: "TE", overall: 58, tier: 4, startingBid: 2, espnId: 4362018,
    attr: {
      speed: 55, catching: 53, routeRunning: 48, separation: 48, contestedCatch: 51, yac: 50, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "bo-richter", name: "Bo Richter", team: "MIN",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4875564,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "bobby-brown-iii", name: "Bobby Brown III", team: "CAR",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4372518,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 56, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "bobby-wagner", name: "Bobby Wagner", team: "WSH",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 14979,
    attr: {
      speed: 58, agility: 55, tackling: 82, coverage: 52, ballHawk: 50,
    },
    strengths: ["tackling"],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "boye-mafe", name: "Boye Mafe", team: "CIN",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4240754,
    attr: {
      speed: 58, power: 58, passRush: 58, runStop: 53, tackling: 53, strength: 58,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "bradley-chubb", name: "Bradley Chubb", team: "BUF",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 3116733,
    attr: {
      speed: 50, passRush: 75, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "brady-russell", name: "Brady Russell", team: "SEA",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4243176,
    attr: {
      speed: 60, agility: 55, power: 55, vision: 58, catching: 45, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "braelon-allen", name: "Braelon Allen", team: "NYJ",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4685247,
    attr: {
      speed: 59, agility: 55, power: 55, vision: 56, catching: 48, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "braiden-mcgregor", name: "Braiden McGregor", team: "NYJ",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4429005,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "brandin-cooks", name: "Brandin Cooks", team: "BUF",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 16731,
    attr: {
      speed: 70, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 68, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "brandin-echols", name: "Brandin Echols", team: "NYJ",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4567979,
    attr: {
      speed: 61, agility: 58, tackling: 59, coverage: 55, ballHawk: 60,
    },
    strengths: [],
    weaknesses: ["coverage"],
  },
  {
    id: "brandon-codrington", name: "Brandon Codrington", team: "BUF",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4576069,
    attr: {
      speed: 58, agility: 55, tackling: 45, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["tackling","ball skills"],
  },
  {
    id: "brandon-mcmanus", name: "Brandon McManus", team: "GB",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 16339,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "brandon-pili", name: "Brandon Pili", team: "MIA",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4259651,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "branson-combs", name: "Branson Combs", team: "JAX",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4572704,
    attr: {
      speed: 51, passRush: 48, runStop: 55, tackling: 55, coverage: 47, ballHawk: 47, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "brashard-smith", name: "Brashard Smith", team: "KC",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4596602,
    attr: {
      speed: 55, agility: 55, power: 55, vision: 52, catching: 52, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["yards after catch","clutch"],
  },
  {
    id: "braxton-berrios", name: "Braxton Berrios", team: "NYG",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 3123075,
    attr: {
      speed: 55, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "brayden-willis", name: "Brayden Willis", team: "SF",
    position: "TE", overall: 58, tier: 4, startingBid: 2, espnId: 4360290,
    attr: {
      speed: 61, catching: 50, routeRunning: 49, separation: 49, contestedCatch: 49, yac: 58, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "brenden-schooler", name: "Brenden Schooler", team: "NE",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4047941,
    attr: {
      speed: 55, passRush: 44, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "brent-urban", name: "Brent Urban", team: "BAL",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 16831,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "brian-burns", name: "Brian Burns", team: "NYG",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4035631,
    attr: {
      speed: 50, passRush: 85, runStop: 62, tackling: 55, coverage: 57, ballHawk: 52, awareness: 55,
    },
    strengths: ["pass rush"],
    weaknesses: ["speed","ball skills"],
  },
  {
    id: "broderick-washington-jr", name: "Broderick Washington Jr.", team: "BAL",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3915837,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 51, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "bryce-oliver", name: "Bryce Oliver", team: "TEN",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4362617,
    attr: {
      speed: 55, passRush: 41, runStop: 50, tackling: 52, coverage: 50, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "bud-dupree", name: "Bud Dupree", team: "LAC",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 2576702,
    attr: {
      speed: 50, passRush: 62, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "buddy-johnson", name: "Buddy Johnson", team: "DAL",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4240900,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "byron-cowart", name: "Byron Cowart", team: "CHI",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3916922,
    attr: {
      speed: 55, power: 57, passRush: 55, runStop: 53, tackling: 50, strength: 58,
    },
    strengths: [],
    weaknesses: ["tackling","run defense"],
  },
  {
    id: "byron-young", name: "Byron Young", team: "PHI",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4875196,
    attr: {
      speed: 50, passRush: 71, runStop: 56, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "cj-brewer", name: "C.J. Brewer", team: "TB",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4052017,
    attr: {
      speed: 57, power: 56, passRush: 57, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "cj-goodwin", name: "C.J. Goodwin", team: "DAL",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 17474,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "cj-ham", name: "C.J. Ham", team: "MIN",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4012556,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "cj-west", name: "C.J. West", team: "SF",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4686308,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 52, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "caleb-farley", name: "Caleb Farley", team: "CAR",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4240859,
    attr: {
      speed: 55, passRush: 43, runStop: 51, tackling: 53, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "caleb-johnson", name: "Caleb Johnson", team: "JAX",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4051069,
    attr: {
      speed: 55, passRush: 42, runStop: 51, tackling: 52, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "caleb-murphy", name: "Caleb Murphy", team: "NE",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4911489,
    attr: {
      speed: 51, passRush: 46, runStop: 55, tackling: 55, coverage: 46, ballHawk: 46, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "cam-gill", name: "Cam Gill", team: "CAR",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4034496,
    attr: {
      speed: 51, passRush: 46, runStop: 55, tackling: 55, coverage: 46, ballHawk: 46, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "cam-jones", name: "Cam Jones", team: "KC",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4371959,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "cam-lewis", name: "Cam Lewis", team: "CHI",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 3916577,
    attr: {
      speed: 58, agility: 55, tackling: 62, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "cameron-goode", name: "Cameron Goode", team: "MIA",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4035857,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "cameron-latu", name: "Cameron Latu", team: "PHI",
    position: "TE", overall: 58, tier: 4, startingBid: 2, espnId: 4372026,
    attr: {
      speed: 61, catching: 64, routeRunning: 49, separation: 49, contestedCatch: 63, yac: 58, runBlock: 62, passBlock: 60, clutch: 51,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "cameron-mitchell", name: "Cameron Mitchell", team: "CLE",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4569607,
    attr: {
      speed: 59, agility: 56, tackling: 48, coverage: 53, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["tackling","ball skills"],
  },
  {
    id: "cameron-sample", name: "Cameron Sample", team: "CIN",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4243923,
    attr: {
      speed: 55, passRush: 58, runStop: 51, tackling: 52, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "cameron-thomas", name: "Cameron Thomas", team: "ATL",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4361510,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 54, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "carl-jones", name: "Carl Jones", team: "BAL",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4569428,
    attr: {
      speed: 51, passRush: 46, runStop: 55, tackling: 55, coverage: 46, ballHawk: 46, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "carrington-valentine", name: "Carrington Valentine", team: "GB",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4430965,
    attr: {
      speed: 61, agility: 58, tackling: 52, coverage: 55, ballHawk: 56,
    },
    strengths: [],
    weaknesses: ["tackling","coverage"],
  },
  {
    id: "carson-bruener", name: "Carson Bruener", team: "PIT",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4429490,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "carson-steele", name: "Carson Steele", team: "KC",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4714365,
    attr: {
      speed: 55, agility: 55, power: 55, vision: 52, catching: 45, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "casey-toohill", name: "Casey Toohill", team: "BUF",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3931408,
    attr: {
      speed: 55, passRush: 45, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "cedric-johnson", name: "Cedric Johnson", team: "CIN",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4430065,
    attr: {
      speed: 56, power: 55, passRush: 56, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "cedrick-wilson-jr", name: "Cedrick Wilson Jr.", team: "NO",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4036335,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "chad-muma", name: "Chad Muma", team: "JAX",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4361707,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "channing-tindall", name: "Channing Tindall", team: "ARI",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4379414,
    attr: {
      speed: 55, passRush: 43, runStop: 51, tackling: 53, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "charles-omenihu", name: "Charles Omenihu", team: "WSH",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3929865,
    attr: {
      speed: 56, power: 56, passRush: 57, runStop: 51, tackling: 50, strength: 56,
    },
    strengths: [],
    weaknesses: ["tackling","run defense"],
  },
  {
    id: "charles-snowden", name: "Charles Snowden", team: "LV",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4240849,
    attr: {
      speed: 58, agility: 55, tackling: 51, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","tackling"],
  },
  {
    id: "charles-woods", name: "Charles Woods", team: "NE",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4368113,
    attr: {
      speed: 58, agility: 55, tackling: 45, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["tackling","ball skills"],
  },
  {
    id: "charlie-jones", name: "Charlie Jones", team: "CIN",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 4257188,
    attr: {
      speed: 55, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "chase-lucas", name: "Chase Lucas", team: "SF",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4047846,
    attr: {
      speed: 55, passRush: 41, runStop: 50, tackling: 52, coverage: 50, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "chau-smith-wade", name: "Chau Smith-Wade", team: "CAR",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4697636,
    attr: {
      speed: 58, agility: 55, tackling: 63, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "chauncey-golston", name: "Chauncey Golston", team: "NYG",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4036132,
    attr: {
      speed: 57, power: 58, passRush: 58, runStop: 53, tackling: 62, strength: 58,
    },
    strengths: [],
    weaknesses: ["run defense"],
  },
  {
    id: "chazz-surratt", name: "Chazz Surratt", team: "SEA",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4037521,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "chimere-dike", name: "Chimere Dike", team: "TEN",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 4431268,
    attr: {
      speed: 55, catching: 73, routeRunning: 48, separation: 48, contestedCatch: 72, yac: 50, clutch: 52,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "chop-robinson", name: "Chop Robinson", team: "MIA",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4431586,
    attr: {
      speed: 50, passRush: 66, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "chris-board", name: "Chris Board", team: "BAL",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3060403,
    attr: {
      speed: 55, passRush: 42, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "chris-braswell", name: "Chris Braswell", team: "TB",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4428989,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "chris-conley", name: "Chris Conley", team: "SF",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 2578533,
    attr: {
      speed: 55, passRush: 42, runStop: 51, tackling: 52, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "chris-lammons", name: "Chris Lammons", team: "IND",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 3128630,
    attr: {
      speed: 58, agility: 55, tackling: 52, coverage: 52, ballHawk: 53,
    },
    strengths: [],
    weaknesses: ["coverage","tackling"],
  },
  {
    id: "chris-roland-wallace", name: "Chris Roland-Wallace", team: "KC",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4428383,
    attr: {
      speed: 58, agility: 55, tackling: 60, coverage: 52, ballHawk: 52,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "chris-rumph-ii", name: "Chris Rumph II", team: "NO",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4240475,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 57, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "chris-smith-ii", name: "Chris Smith II", team: "LV",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4379413,
    attr: {
      speed: 55, passRush: 43, runStop: 51, tackling: 53, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "chris-williams", name: "Chris Williams", team: "CHI",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4034530,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "christian-barmore", name: "Christian Barmore", team: "NE",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4372030,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "christian-harris", name: "Christian Harris", team: "HOU",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4567099,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "christian-izien", name: "Christian Izien", team: "TB",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4372459,
    attr: {
      speed: 55, passRush: 40, runStop: 66, tackling: 70, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "chuck-clark", name: "Chuck Clark", team: "DET",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3045463,
    attr: {
      speed: 55, passRush: 40, runStop: 66, tackling: 70, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "cj-okoye", name: "CJ Okoye", team: "NYG",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 5144942,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 51, tackling: 51, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "clark-phillips-iii", name: "Clark Phillips III", team: "ATL",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4429067,
    attr: {
      speed: 59, agility: 56, tackling: 49, coverage: 53, ballHawk: 53,
    },
    strengths: [],
    weaknesses: ["tackling","coverage"],
  },
  {
    id: "claudin-cherelus", name: "Claudin Cherelus", team: "CAR",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4256224,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "clelin-ferrell", name: "Clelin Ferrell", team: "MIA",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3728258,
    attr: {
      speed: 59, power: 57, passRush: 60, runStop: 50, tackling: 53, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "colby-wooden", name: "Colby Wooden", team: "NO",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4567224,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 59, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "cole-bishop", name: "Cole Bishop", team: "BUF",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4676004,
    attr: {
      speed: 57, passRush: 41, runStop: 64, tackling: 67, coverage: 52, ballHawk: 53,
    },
    strengths: [],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "cole-holcomb", name: "Cole Holcomb", team: "PIT",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 3116689,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "connor-heyward", name: "Connor Heyward", team: "LV",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4241961,
    attr: {
      speed: 55, agility: 55, power: 55, vision: 52, catching: 45, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "cooper-mcdonald", name: "Cooper McDonald", team: "KC",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4567826,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "cooper-rush", name: "Cooper Rush", team: "ATL",
    position: "QB", overall: 58, tier: 4, startingBid: 2, espnId: 2972515,
    attr: {
      armStrength: 51, shortAccuracy: 56, deepAccuracy: 44, pocketAwareness: 71, decisionMaking: 57, consistency: 59, clutch: 62, mobility: 47,
    },
    strengths: [],
    weaknesses: ["deep ball","mobility"],
  },
  {
    id: "corey-ballentine", name: "Corey Ballentine", team: "GB",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4411769,
    attr: {
      speed: 55, passRush: 43, runStop: 51, tackling: 53, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "cory-durden", name: "Cory Durden", team: "NE",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4240042,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 51, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "curtis-robinson", name: "Curtis Robinson", team: "SF",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4044448,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "curtis-samuel", name: "Curtis Samuel", team: "BUF",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 3121427,
    attr: {
      speed: 57, catching: 80, routeRunning: 48, separation: 48, contestedCatch: 79, yac: 52, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "dj-jones", name: "D.J. Jones", team: "DEN",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3894915,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 57, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "dangelo-ross", name: "D'Angelo Ross", team: "HOU",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 3139389,
    attr: {
      speed: 61, agility: 59, tackling: 50, coverage: 56, ballHawk: 51,
    },
    strengths: [],
    weaknesses: ["tackling","ball skills"],
  },
  {
    id: "danthony-bell", name: "D'Anthony Bell", team: "CLE",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4608386,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "dernest-johnson", name: "D'Ernest Johnson", team: "JAX",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3139602,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "dmarco-jackson", name: "D'Marco Jackson", team: "CHI",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4241007,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 47, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "donta-foreman", name: "D'Onta Foreman", team: "CLE",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 3125116,
    attr: {
      speed: 55, agility: 55, power: 55, vision: 52, catching: 46, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "dashawn-hand", name: "Da'Shawn Hand", team: "MIA",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3126352,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 53, tackling: 53, strength: 57,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "dallas-turner", name: "Dallas Turner", team: "MIN",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4565190,
    attr: {
      speed: 50, passRush: 70, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "dalvin-tomlinson", name: "Dalvin Tomlinson", team: "LAC",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 2979860,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "damone-clark", name: "Damone Clark", team: "DAL",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4362636,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "damontae-kazee", name: "Damontae Kazee", team: "PIT",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 2976099,
    attr: {
      speed: 58, agility: 55, tackling: 56, coverage: 52, ballHawk: 51,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "dane-jackson", name: "Dane Jackson", team: "BUF",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3895791,
    attr: {
      speed: 55, passRush: 42, runStop: 51, tackling: 52, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "daniel-ekuale", name: "Daniel Ekuale", team: "NE",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3052059,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 53, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "daniel-hardy", name: "Daniel Hardy", team: "CHI",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4365629,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "daniel-thomas", name: "Daniel Thomas", team: "DET",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4035505,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "danny-striggow", name: "Danny Striggow", team: "JAX",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4573319,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 51, tackling: 51, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "danny-stutsman", name: "Danny Stutsman", team: "NO",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4683215,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "dante-fowler-jr", name: "Dante Fowler Jr.", team: "WSH",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 2980100,
    attr: {
      speed: 50, passRush: 71, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "dante-stills", name: "Dante Stills", team: "ARI",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4362225,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 57, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "dante-trader-jr", name: "Dante Trader Jr.", team: "MIA",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4431664,
    attr: {
      speed: 55, passRush: 40, runStop: 56, tackling: 58, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "daquan-jones", name: "DaQuan Jones", team: "BUF",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 16910,
    attr: {
      speed: 58, agility: 55, tackling: 45, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["tackling","ball skills"],
  },
  {
    id: "dare-ogunbowale", name: "Dare Ogunbowale", team: "HOU",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 2983509,
    attr: {
      speed: 55, agility: 55, power: 55, vision: 52, catching: 50, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "darien-porter", name: "Darien Porter", team: "LV",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4430330,
    attr: {
      speed: 62, agility: 60, tackling: 63, coverage: 57, ballHawk: 51,
    },
    strengths: [],
    weaknesses: ["ball skills"],
  },
  {
    id: "darius-muasau", name: "Darius Muasau", team: "NYG",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4428072,
    attr: {
      speed: 56, passRush: 45, runStop: 62, tackling: 62, coverage: 45, ballHawk: 45, awareness: 61,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "darius-robinson", name: "Darius Robinson", team: "ARI",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4569480,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 58, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "darnay-holmes", name: "Darnay Holmes", team: "LV",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4242973,
    attr: {
      speed: 58, agility: 55, tackling: 56, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "darnell-savage", name: "Darnell Savage", team: "JAX",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 3915419,
    attr: {
      speed: 61, agility: 58, tackling: 56, coverage: 55, ballHawk: 52,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "daron-payne", name: "Daron Payne", team: "WSH",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3925354,
    attr: {
      speed: 56, power: 57, passRush: 56, runStop: 53, tackling: 60, strength: 58,
    },
    strengths: [],
    weaknesses: ["run defense"],
  },
  {
    id: "darrell-baker-jr", name: "Darrell Baker Jr.", team: "TEN",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4036660,
    attr: {
      speed: 62, agility: 60, tackling: 58, coverage: 57, ballHawk: 51,
    },
    strengths: [],
    weaknesses: ["ball skills"],
  },
  {
    id: "darrell-luter-jr", name: "Darrell Luter Jr.", team: "SF",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4685978,
    attr: {
      speed: 58, agility: 55, tackling: 54, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "darrell-taylor", name: "Darrell Taylor", team: "CHI",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3915396,
    attr: {
      speed: 55, passRush: 52, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "darren-hall", name: "Darren Hall", team: "ARI",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4261606,
    attr: {
      speed: 55, passRush: 42, runStop: 51, tackling: 52, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "daryl-worley", name: "Daryl Worley", team: "TEN",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 3042436,
    attr: {
      speed: 58, agility: 55, tackling: 78, coverage: 53, ballHawk: 54,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "david-long-jr", name: "David Long Jr.", team: "MIA",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 3916074,
    attr: {
      speed: 54, passRush: 46, runStop: 60, tackling: 59, coverage: 46, ballHawk: 46, awareness: 59,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "david-martin-robinson", name: "David Martin-Robinson", team: "TEN",
    position: "TE", overall: 58, tier: 4, startingBid: 2, espnId: 4360978,
    attr: {
      speed: 55, catching: 67, routeRunning: 48, separation: 48, contestedCatch: 66, yac: 50, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "david-moore", name: "David Moore", team: "CAR",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 4212909,
    attr: {
      speed: 67, catching: 54, routeRunning: 48, separation: 48, contestedCatch: 52, yac: 65, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "david-ojabo", name: "David Ojabo", team: "BAL",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4426507,
    attr: {
      speed: 55, passRush: 47, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "david-onyemata", name: "David Onyemata", team: "NYJ",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4002046,
    attr: {
      speed: 55, power: 56, passRush: 55, runStop: 55, tackling: 62, strength: 60,
    },
    strengths: [],
    weaknesses: ["pass rush","run defense"],
  },
  {
    id: "david-sills-v", name: "David Sills V", team: "ATL",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 3871102,
    attr: {
      speed: 66, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 64, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "davis-allen", name: "Davis Allen", team: "LAR",
    position: "TE", overall: 58, tier: 4, startingBid: 2, espnId: 4426553,
    attr: {
      speed: 55, catching: 73, routeRunning: 48, separation: 48, contestedCatch: 72, yac: 50, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "davis-mills", name: "Davis Mills", team: "HOU",
    position: "QB", overall: 58, tier: 4, startingBid: 2, espnId: 4242546,
    attr: {
      armStrength: 51, shortAccuracy: 47, deepAccuracy: 45, pocketAwareness: 84, decisionMaking: 67, consistency: 51, clutch: 55, mobility: 51,
    },
    strengths: ["pocket presence"],
    weaknesses: ["deep ball","short accuracy"],
  },
  {
    id: "davon-godchaux", name: "Davon Godchaux", team: "NO",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3115383,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 66, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "davon-hamilton", name: "DaVon Hamilton", team: "JAX",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3915520,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 63, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "dawuane-smoot", name: "Dawuane Smoot", team: "BUF",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3042476,
    attr: {
      speed: 55, passRush: 51, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "dayo-odeyingbo", name: "Dayo Odeyingbo", team: "CHI",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4242659,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 52, tackling: 50, strength: 57,
    },
    strengths: [],
    weaknesses: ["tackling","run defense"],
  },
  {
    id: "deane-leonard", name: "Deane Leonard", team: "LAC",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4690171,
    attr: {
      speed: 59, agility: 56, tackling: 45, coverage: 53, ballHawk: 54,
    },
    strengths: [],
    weaknesses: ["tackling","coverage"],
  },
  {
    id: "deangelo-malone", name: "DeAngelo Malone", team: "ATL",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4243457,
    attr: {
      speed: 50, passRush: 46, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "decamerion-richardson", name: "Decamerion Richardson", team: "NO",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4605498,
    attr: {
      speed: 58, agility: 55, tackling: 56, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "dee-eskridge", name: "Dee Eskridge", team: "MIA",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4043016,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "dee-williams", name: "Dee Williams", team: "SEA",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 5081362,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "deion-jones", name: "Deion Jones", team: "TB",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 2976545,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "delshawn-phillips", name: "Del'Shawn Phillips", team: "LAC",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4240528,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "dell-pettus", name: "Dell Pettus", team: "NE",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4428232,
    attr: {
      speed: 55, passRush: 43, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "demani-richardson", name: "Demani Richardson", team: "CAR",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4426926,
    attr: {
      speed: 58, agility: 55, tackling: 71, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "demarcco-hellams", name: "DeMarcco Hellams", team: "ATL",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4567111,
    attr: {
      speed: 55, passRush: 43, runStop: 51, tackling: 53, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "demarcus-lawrence", name: "DeMarcus Lawrence", team: "SEA",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 16802,
    attr: {
      speed: 50, passRush: 74, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "demarcus-walker", name: "DeMarcus Walker", team: "CHI",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3045377,
    attr: {
      speed: 55, passRush: 56, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "demetrius-flannigan-fowles", name: "Demetrius Flannigan-Fowles", team: "NYG",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 3931424,
    attr: {
      speed: 58, agility: 55, tackling: 57, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "demone-harris", name: "Demone Harris", team: "ATL",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3052926,
    attr: {
      speed: 55, passRush: 43, runStop: 51, tackling: 53, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "dennis-gardeck", name: "Dennis Gardeck", team: "JAX",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4334300,
    attr: {
      speed: 50, passRush: 56, runStop: 55, tackling: 55, coverage: 45, ballHawk: 47, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "denzel-perryman", name: "Denzel Perryman", team: "LAC",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 2579621,
    attr: {
      speed: 56, passRush: 45, runStop: 63, tackling: 62, coverage: 45, ballHawk: 45, awareness: 62,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "deommodore-lenoir", name: "Deommodore Lenoir", team: "SF",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4242488,
    attr: {
      speed: 62, agility: 59, tackling: 73, coverage: 56, ballHawk: 57,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "deone-walker", name: "Deone Walker", team: "BUF",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4831989,
    attr: {
      speed: 55, power: 59, passRush: 55, runStop: 60, tackling: 59, strength: 64,
    },
    strengths: [],
    weaknesses: ["pass rush","speed"],
  },
  {
    id: "derick-hall", name: "Derick Hall", team: "SEA",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4567226,
    attr: {
      speed: 50, passRush: 67, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "derrick-barnes", name: "Derrick Barnes", team: "DET",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4260409,
    attr: {
      speed: 53, passRush: 56, runStop: 60, tackling: 59, coverage: 50, ballHawk: 53, awareness: 59,
    },
    strengths: [],
    weaknesses: ["coverage","speed"],
  },
  {
    id: "derrick-brown", name: "Derrick Brown", team: "CAR",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4035495,
    attr: {
      speed: 58, power: 56, passRush: 58, runStop: 50, tackling: 76, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","strength"],
  },
  {
    id: "derrick-harmon", name: "Derrick Harmon", team: "PIT",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4682980,
    attr: {
      speed: 59, power: 55, passRush: 60, runStop: 50, tackling: 56, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","power"],
  },
  {
    id: "derrick-nnadi", name: "Derrick Nnadi", team: "KC",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3122930,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "deshawn-williams", name: "DeShawn Williams", team: "CAR",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 2576508,
    attr: {
      speed: 55, passRush: 42, runStop: 51, tackling: 52, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "desjuan-johnson", name: "Desjuan Johnson", team: "LAR",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4362294,
    attr: {
      speed: 57, power: 55, passRush: 57, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "devin-duvernay", name: "Devin Duvernay", team: "ARI",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 4039050,
    attr: {
      speed: 55, catching: 66, routeRunning: 48, separation: 48, contestedCatch: 64, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "devin-neal", name: "Devin Neal", team: "NO",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4682652,
    attr: {
      speed: 55, agility: 55, power: 55, vision: 53, catching: 54, yac: 51, clutch: 52,
    },
    strengths: [],
    weaknesses: ["yards after catch","clutch"],
  },
  {
    id: "devin-singletary", name: "Devin Singletary", team: "NYG",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4040761,
    attr: {
      speed: 58, agility: 55, power: 56, vision: 56, catching: 50, yac: 50, clutch: 55,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "devon-key", name: "Devon Key", team: "DEN",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4037559,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "diontae-johnson", name: "Diontae Johnson", team: "CAR",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 3932905,
    attr: {
      speed: 71, catching: 50, routeRunning: 53, separation: 53, contestedCatch: 48, yac: 70, clutch: 54,
    },
    strengths: [],
    weaknesses: ["contested catch","hands"],
  },
  {
    id: "dj-davidson", name: "DJ Davidson", team: "NYG",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4242899,
    attr: {
      speed: 55, passRush: 49, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["ball skills","pass rush"],
  },
  {
    id: "dj-ivey", name: "DJ Ivey", team: "CIN",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4362502,
    attr: {
      speed: 60, agility: 58, tackling: 45, coverage: 55, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["tackling","ball skills"],
  },
  {
    id: "dj-johnson", name: "DJ Johnson", team: "CAR",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4240623,
    attr: {
      speed: 55, passRush: 40, runStop: 51, tackling: 53, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "dj-reader", name: "DJ Reader", team: "NYG",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 2977670,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "dj-turner", name: "DJ Turner", team: "LV",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4036211,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "dj-wonnum", name: "DJ Wonnum", team: "DET",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4038849,
    attr: {
      speed: 50, passRush: 59, runStop: 55, tackling: 55, coverage: 49, ballHawk: 49, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "dominique-robinson", name: "Dominique Robinson", team: "HOU",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4244300,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "dondrea-tillman", name: "Dondrea Tillman", team: "DEN",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 5216101,
    attr: {
      speed: 50, passRush: 60, runStop: 55, tackling: 55, coverage: 45, ballHawk: 46, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "donovan-ezeiruaku", name: "Donovan Ezeiruaku", team: "DAL",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4683848,
    attr: {
      speed: 50, passRush: 48, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "donovan-mcmillon", name: "Donovan McMillon", team: "CLE",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4686027,
    attr: {
      speed: 55, passRush: 43, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "donovan-wilson", name: "Donovan Wilson", team: "DAL",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 3122135,
    attr: {
      speed: 58, agility: 56, tackling: 74, coverage: 53, ballHawk: 54,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "dontayvion-wicks", name: "Dontayvion Wicks", team: "PHI",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 4428850,
    attr: {
      speed: 73, catching: 51, routeRunning: 49, separation: 49, contestedCatch: 49, yac: 73, clutch: 54,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "dorian-mausi", name: "Dorian Mausi", team: "TEN",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4573318,
    attr: {
      speed: 51, passRush: 47, runStop: 55, tackling: 55, coverage: 47, ballHawk: 47, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "drake-thomas", name: "Drake Thomas", team: "SEA",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4428659,
    attr: {
      speed: 55, passRush: 49, runStop: 62, tackling: 61, coverage: 51, ballHawk: 50, awareness: 60,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "drew-lock", name: "Drew Lock", team: "SEA",
    position: "QB", overall: 58, tier: 4, startingBid: 2, espnId: 3924327,
    attr: {
      armStrength: 51, shortAccuracy: 55, deepAccuracy: 48, pocketAwareness: 73, decisionMaking: 60, consistency: 58, clutch: 61, mobility: 56,
    },
    strengths: [],
    weaknesses: ["deep ball","arm strength"],
  },
  {
    id: "drew-ogletree", name: "Drew Ogletree", team: "IND",
    position: "TE", overall: 58, tier: 4, startingBid: 2, espnId: 4722908,
    attr: {
      speed: 65, catching: 66, routeRunning: 48, separation: 48, contestedCatch: 64, yac: 62, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "dru-phillips", name: "Dru Phillips", team: "NYG",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4431321,
    attr: {
      speed: 62, agility: 60, tackling: 70, coverage: 57, ballHawk: 56,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "durham-smythe", name: "Durham Smythe", team: "BAL",
    position: "TE", overall: 58, tier: 4, startingBid: 2, espnId: 3052897,
    attr: {
      speed: 55, catching: 60, routeRunning: 48, separation: 48, contestedCatch: 58, yac: 50, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "dylan-horton", name: "Dylan Horton", team: "HOU",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4374066,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "dylan-laube", name: "Dylan Laube", team: "LV",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4366963,
    attr: {
      speed: 55, agility: 55, power: 55, vision: 52, catching: 45, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "dylan-sampson", name: "Dylan Sampson", team: "CLE",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 5081397,
    attr: {
      speed: 55, agility: 55, power: 55, vision: 52, catching: 60, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["yards after catch","clutch"],
  },
  {
    id: "easton-mascarenas-arnold", name: "Easton Mascarenas-Arnold", team: "CLE",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 5085888,
    attr: {
      speed: 51, passRush: 47, runStop: 55, tackling: 55, coverage: 47, ballHawk: 47, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "eddie-goldman", name: "Eddie Goldman", team: "WSH",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 2969924,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "eddie-jackson", name: "Eddie Jackson", team: "BAL",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3054847,
    attr: {
      speed: 55, passRush: 42, runStop: 54, tackling: 56, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "elandon-roberts", name: "Elandon Roberts", team: "PIT",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 2987743,
    attr: {
      speed: 54, passRush: 45, runStop: 61, tackling: 59, coverage: 45, ballHawk: 45, awareness: 59,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "elijah-arroyo", name: "Elijah Arroyo", team: "SEA",
    position: "TE", overall: 58, tier: 4, startingBid: 2, espnId: 4678006,
    attr: {
      speed: 75, catching: 56, routeRunning: 48, separation: 48, contestedCatch: 54, yac: 75, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "elijah-campbell", name: "Elijah Campbell", team: "MIA",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3932901,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "elijah-chatman", name: "Elijah Chatman", team: "NYG",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4429392,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "elijah-garcia", name: "Elijah Garcia", team: "ATL",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4039170,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 51, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "elijah-hicks", name: "Elijah Hicks", team: "CHI",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4242402,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "elijah-molden", name: "Elijah Molden", team: "LAC",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4243328,
    attr: {
      speed: 58, agility: 55, tackling: 73, coverage: 52, ballHawk: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "elijah-moore", name: "Elijah Moore", team: "DEN",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 4372414,
    attr: {
      speed: 56, catching: 59, routeRunning: 48, separation: 48, contestedCatch: 58, yac: 52, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "elijah-ponder", name: "Elijah Ponder", team: "NE",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4688432,
    attr: {
      speed: 50, passRush: 55, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "elijah-roberts", name: "Elijah Roberts", team: "TB",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4690795,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "emmanuel-ogbah", name: "Emmanuel Ogbah", team: "MIA",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 2977740,
    attr: {
      speed: 56, power: 58, passRush: 56, runStop: 55, tackling: 56, strength: 60,
    },
    strengths: [],
    weaknesses: ["run defense"],
  },
  {
    id: "eric-johnson-ii", name: "Eric Johnson II", team: "IND",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4050971,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "eric-kendricks", name: "Eric Kendricks", team: "DAL",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 2510863,
    attr: {
      speed: 58, agility: 55, tackling: 82, coverage: 52, ballHawk: 52,
    },
    strengths: ["tackling"],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "eric-stokes", name: "Eric Stokes", team: "LV",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4259561,
    attr: {
      speed: 58, agility: 55, tackling: 57, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "eric-watts", name: "Eric Watts", team: "NYJ",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4569016,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "esezi-otomewo", name: "Esezi Otomewo", team: "JAX",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4240759,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 51, tackling: 51, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "ethan-bonner", name: "Ethan Bonner", team: "MIA",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4360746,
    attr: {
      speed: 58, agility: 55, tackling: 46, coverage: 52, ballHawk: 53,
    },
    strengths: [],
    weaknesses: ["tackling","coverage"],
  },
  {
    id: "evan-anderson", name: "Evan Anderson", team: "SF",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4612182,
    attr: {
      speed: 55, passRush: 46, runStop: 50, tackling: 52, coverage: 50, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "eyioma-uwazurike", name: "Eyioma Uwazurike", team: "DEN",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4066109,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 58, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "ezekiel-elliott", name: "Ezekiel Elliott", team: "DAL",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 3051392,
    attr: {
      speed: 55, agility: 55, power: 55, vision: 52, catching: 45, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "fabian-moreau", name: "Fabian Moreau", team: "MIN",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 2971586,
    attr: {
      speed: 58, agility: 55, tackling: 45, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["tackling","ball skills"],
  },
  {
    id: "feleipe-franks", name: "Feleipe Franks", team: "CAR",
    position: "TE", overall: 58, tier: 4, startingBid: 2, espnId: 4034948,
    attr: {
      speed: 75, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 75, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "folorunso-fatukasi", name: "Folorunso Fatukasi", team: "LV",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3045172,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 51, tackling: 52, strength: 56,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "gabe-davis", name: "Gabe Davis", team: "JAX",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 4243537,
    attr: {
      speed: 70, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 69, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "gardner-minshew-ii", name: "Gardner Minshew II", team: "LV",
    position: "QB", overall: 58, tier: 4, startingBid: 2, espnId: 4038524,
    attr: {
      armStrength: 54, shortAccuracy: 70, deepAccuracy: 51, pocketAwareness: 67, decisionMaking: 49, consistency: 71, clutch: 57, mobility: 48,
    },
    strengths: [],
    weaknesses: ["mobility","decision-making"],
  },
  {
    id: "garret-wallow", name: "Garret Wallow", team: "SF",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4241807,
    attr: {
      speed: 51, passRush: 46, runStop: 55, tackling: 55, coverage: 46, ballHawk: 46, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "george-holani", name: "George Holani", team: "SEA",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4429835,
    attr: {
      speed: 55, agility: 55, power: 55, vision: 52, catching: 45, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "george-odum", name: "George Odum", team: "HOU",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3050199,
    attr: {
      speed: 61, passRush: 41, runStop: 50, tackling: 52, coverage: 57, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "gervon-dexter-sr", name: "Gervon Dexter Sr.", team: "ATL",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4429014,
    attr: {
      speed: 60, power: 58, passRush: 61, runStop: 50, tackling: 61, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","strength"],
  },
  {
    id: "grady-jarrett", name: "Grady Jarrett", team: "CHI",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 2576492,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 62, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "graham-gano", name: "Graham Gano", team: "NYG",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 12460,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "grant-stuard", name: "Grant Stuard", team: "DET",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4240255,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "greg-gaines", name: "Greg Gaines", team: "BUF",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3127294,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "greg-rousseau", name: "Greg Rousseau", team: "BUF",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4362506,
    attr: {
      speed: 50, passRush: 79, runStop: 55, tackling: 55, coverage: 46, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "grover-stewart", name: "Grover Stewart", team: "IND",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4058825,
    attr: {
      speed: 55, power: 56, passRush: 55, runStop: 55, tackling: 69, strength: 60,
    },
    strengths: [],
    weaknesses: ["pass rush","run defense"],
  },
  {
    id: "gus-edwards", name: "Gus Edwards", team: "LAC",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 3051926,
    attr: {
      speed: 55, agility: 55, power: 59, vision: 52, catching: 45, yac: 50, clutch: 56,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "haason-reddick", name: "Haason Reddick", team: "TB",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 2980504,
    attr: {
      speed: 55, passRush: 52, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "harold-landry-iii", name: "Harold Landry III", team: "TEN",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 3122793,
    attr: {
      speed: 50, passRush: 78, runStop: 58, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "harrison-bryant", name: "Harrison Bryant", team: "LV",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4040774,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "harrison-phillips", name: "Harrison Phillips", team: "NYJ",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3117255,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 64, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "hassan-haskins", name: "Hassan Haskins", team: "LAC",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4372071,
    attr: {
      speed: 55, agility: 55, power: 55, vision: 52, catching: 45, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "ifeatu-melifonwu", name: "Ifeatu Melifonwu", team: "MIA",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4240401,
    attr: {
      speed: 55, passRush: 47, runStop: 55, tackling: 58, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "ihmir-smith-marsette", name: "Ihmir Smith-Marsette", team: "NYG",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 4240573,
    attr: {
      speed: 62, catching: 66, routeRunning: 48, separation: 48, contestedCatch: 64, yac: 58, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "isaac-yiadom", name: "Isaac Yiadom", team: "SF",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 3122797,
    attr: {
      speed: 58, agility: 55, tackling: 54, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "isaiah-foskey", name: "Isaiah Foskey", team: "NO",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4426457,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "isaiah-hodgins", name: "Isaiah Hodgins", team: "NYG",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 4242540,
    attr: {
      speed: 64, catching: 55, routeRunning: 49, separation: 49, contestedCatch: 53, yac: 62, clutch: 51,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "isaiah-mcguire", name: "Isaiah McGuire", team: "CLE",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4427963,
    attr: {
      speed: 55, power: 60, passRush: 55, runStop: 60, tackling: 54, strength: 64,
    },
    strengths: [],
    weaknesses: ["tackling","pass rush"],
  },
  {
    id: "isaiah-oliver", name: "Isaiah Oliver", team: "NYJ",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3915437,
    attr: {
      speed: 55, passRush: 40, runStop: 59, tackling: 62, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "isaiah-rodgers", name: "Isaiah Rodgers", team: "MIN",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4044540,
    attr: {
      speed: 59, agility: 56, tackling: 56, coverage: 53, ballHawk: 51,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "isaiah-simmons", name: "Isaiah Simmons", team: "NYG",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4035462,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "isaiah-stalbird", name: "Isaiah Stalbird", team: "NO",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4361194,
    attr: {
      speed: 50, passRush: 48, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "isaiahh-loudermilk", name: "Isaiahh Loudermilk", team: "PIT",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4035798,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "isiah-pacheco", name: "Isiah Pacheco", team: "KC",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4361529,
    attr: {
      speed: 60, agility: 55, power: 60, vision: 57, catching: 50, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "israel-mukuamu", name: "Israel Mukuamu", team: "DAL",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4362855,
    attr: {
      speed: 58, agility: 55, tackling: 45, coverage: 52, ballHawk: 54,
    },
    strengths: [],
    weaknesses: ["tackling","coverage"],
  },
  {
    id: "jj-mccarthy", name: "J.J. McCarthy", team: "MIN",
    position: "QB", overall: 58, tier: 4, startingBid: 2, espnId: 4433970,
    attr: {
      armStrength: 59, shortAccuracy: 46, deepAccuracy: 56, pocketAwareness: 55, decisionMaking: 51, consistency: 51, clutch: 72, mobility: 62,
    },
    strengths: [],
    weaknesses: ["short accuracy","decision-making"],
  },
  {
    id: "jj-russell", name: "J.J. Russell", team: "TB",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4243366,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "jt-gray", name: "J.T. Gray", team: "NO",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3115481,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "jamarcus-ingram", name: "Ja'Marcus Ingram", team: "BUF",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4240059,
    attr: {
      speed: 58, agility: 55, tackling: 45, coverage: 52, ballHawk: 55,
    },
    strengths: [],
    weaknesses: ["tackling","coverage"],
  },
  {
    id: "jasir-taylor", name: "Ja'Sir Taylor", team: "NYJ",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4240434,
    attr: {
      speed: 58, agility: 55, tackling: 45, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["tackling","ball skills"],
  },
  {
    id: "jabrill-peppers", name: "Jabrill Peppers", team: "PIT",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 3115962,
    attr: {
      speed: 58, agility: 55, tackling: 71, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "jack-cochrane", name: "Jack Cochrane", team: "KC",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4249766,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "jack-sanborn", name: "Jack Sanborn", team: "CHI",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4372576,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "jack-sawyer", name: "Jack Sawyer", team: "PIT",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4431590,
    attr: {
      speed: 50, passRush: 46, runStop: 55, tackling: 55, coverage: 46, ballHawk: 52, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "jack-stoll", name: "Jack Stoll", team: "NO",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4034862,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "jacob-martin", name: "Jacob Martin", team: "TEN",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3138764,
    attr: {
      speed: 61, power: 56, passRush: 62, runStop: 50, tackling: 51, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "jaden-hicks", name: "Jaden Hicks", team: "KC",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4685232,
    attr: {
      speed: 56, passRush: 40, runStop: 50, tackling: 52, coverage: 52, ballHawk: 51,
    },
    strengths: [],
    weaknesses: ["pass rush","run defense"],
  },
  {
    id: "jaelan-phillips", name: "Jaelan Phillips", team: "CAR",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4242975,
    attr: {
      speed: 50, passRush: 64, runStop: 55, tackling: 55, coverage: 50, ballHawk: 47, awareness: 55,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "jahdae-barron", name: "Jahdae Barron", team: "DEN",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4430925,
    attr: {
      speed: 58, agility: 55, tackling: 49, coverage: 52, ballHawk: 51,
    },
    strengths: [],
    weaknesses: ["tackling","ball skills"],
  },
  {
    id: "jahlani-tavai", name: "Jahlani Tavai", team: "JAX",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 3124587,
    attr: {
      speed: 57, passRush: 45, runStop: 63, tackling: 63, coverage: 45, ballHawk: 45, awareness: 62,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "jake-haener", name: "Jake Haener", team: "NO",
    position: "QB", overall: 58, tier: 4, startingBid: 2, espnId: 4243322,
    attr: {
      armStrength: 52, shortAccuracy: 49, deepAccuracy: 47, pocketAwareness: 69, decisionMaking: 54, consistency: 52, clutch: 55, mobility: 49,
    },
    strengths: [],
    weaknesses: ["deep ball","short accuracy"],
  },
  {
    id: "jake-hansen", name: "Jake Hansen", team: "HOU",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4033812,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "jake-hummel", name: "Jake Hummel", team: "BAL",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4241250,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "jalen-davis", name: "Jalen Davis", team: "CIN",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 3125356,
    attr: {
      speed: 58, agility: 55, tackling: 57, coverage: 52, ballHawk: 53,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "jalen-reeves-maybin", name: "Jalen Reeves-Maybin", team: "DET",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3044729,
    attr: {
      speed: 55, passRush: 41, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "jalin-hyatt", name: "Jalin Hyatt", team: "NYG",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 4692590,
    attr: {
      speed: 55, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "jalyn-armour-davis", name: "Jalyn Armour-Davis", team: "TEN",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4372017,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "jalyn-holmes", name: "Jalyn Holmes", team: "NYJ",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3121414,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 51, tackling: 50, strength: 56,
    },
    strengths: [],
    weaknesses: ["tackling","run defense"],
  },
  {
    id: "jalyx-hunt", name: "Jalyx Hunt", team: "PHI",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4571162,
    attr: {
      speed: 50, passRush: 62, runStop: 55, tackling: 55, coverage: 45, ballHawk: 49, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "jamaal-williams", name: "Jamaal Williams", team: "NO",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 2980453,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "jamal-adams", name: "Jamal Adams", team: "TEN",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 3115373,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "jamal-hill", name: "Jamal Hill", team: "HOU",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4427479,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "jamaree-caldwell", name: "Jamaree Caldwell", team: "LAC",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 5089178,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 51, tackling: 57, strength: 56,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "jamari-thrash", name: "Jamari Thrash", team: "CLE",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 4428678,
    attr: {
      speed: 61, catching: 59, routeRunning: 48, separation: 48, contestedCatch: 58, yac: 58, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "james-houston", name: "James Houston", team: "DAL",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4240608,
    attr: {
      speed: 50, passRush: 63, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "james-lynch", name: "James Lynch", team: "CHI",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4259181,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "james-pearce-jr", name: "James Pearce Jr.", team: "ATL",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 5081394,
    attr: {
      speed: 50, passRush: 85, runStop: 55, tackling: 55, coverage: 52, ballHawk: 49, awareness: 55,
    },
    strengths: ["pass rush"],
    weaknesses: ["ball skills","speed"],
  },
  {
    id: "james-proche-ii", name: "James Proche II", team: "CLE",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3916204,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "james-smith-williams", name: "James Smith-Williams", team: "ATL",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3686690,
    attr: {
      speed: 55, passRush: 48, runStop: 51, tackling: 52, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "james-williams-sr", name: "James Williams Sr.", team: "TEN",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4431613,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "jamie-gillan", name: "Jamie Gillan", team: "NYG",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3936185,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "jamin-davis", name: "Jamin Davis", team: "WSH",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4240778,
    attr: {
      speed: 55, passRush: 48, runStop: 51, tackling: 52, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "jamison-crowder", name: "Jamison Crowder", team: "WSH",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 2576716,
    attr: {
      speed: 55, catching: 73, routeRunning: 49, separation: 49, contestedCatch: 72, yac: 51, clutch: 54,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "jarran-reed", name: "Jarran Reed", team: "SEA",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3115312,
    attr: {
      speed: 56, power: 55, passRush: 56, runStop: 50, tackling: 57, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","power"],
  },
  {
    id: "jason-pinnock", name: "Jason Pinnock", team: "NYG",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4240706,
    attr: {
      speed: 55, passRush: 45, runStop: 61, tackling: 64, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "javon-bullard", name: "Javon Bullard", team: "GB",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4688930,
    attr: {
      speed: 55, passRush: 40, runStop: 70, tackling: 75, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "javon-hargrave", name: "Javon Hargrave", team: "GB",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 2983055,
    attr: {
      speed: 57, power: 55, passRush: 57, runStop: 50, tackling: 63, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","power"],
  },
  {
    id: "javon-kinlaw", name: "Javon Kinlaw", team: "WSH",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4259491,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 52, tackling: 57, strength: 57,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "javon-solomon", name: "Javon Solomon", team: "BUF",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4428548,
    attr: {
      speed: 50, passRush: 50, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "javontae-jean-baptiste", name: "Javontae Jean-Baptiste", team: "WSH",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4361357,
    attr: {
      speed: 50, passRush: 47, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "jay-higgins-iv", name: "Jay Higgins IV", team: "BAL",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4565350,
    attr: {
      speed: 51, passRush: 47, runStop: 55, tackling: 55, coverage: 47, ballHawk: 47, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "jay-tufele", name: "Jay Tufele", team: "NYJ",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4259647,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "jay-ward", name: "Jay Ward", team: "MIN",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4568007,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "jaylahn-tuimoloau", name: "Jaylahn Tuimoloau", team: "IND",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4566154,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "jaylan-ford", name: "Jaylan Ford", team: "NO",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4566088,
    attr: {
      speed: 51, passRush: 46, runStop: 55, tackling: 55, coverage: 46, ballHawk: 46, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "jaylen-harrell", name: "Jaylen Harrell", team: "TEN",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4429058,
    attr: {
      speed: 50, passRush: 53, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "jaylen-mccollough", name: "Jaylen McCollough", team: "LAR",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4427120,
    attr: {
      speed: 55, passRush: 43, runStop: 50, tackling: 52, coverage: 50, ballHawk: 51,
    },
    strengths: [],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "jaylen-wright", name: "Jaylen Wright", team: "MIA",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4682745,
    attr: {
      speed: 61, agility: 56, power: 55, vision: 60, catching: 45, yac: 51, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "jaylinn-hawkins", name: "Jaylinn Hawkins", team: "BAL",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3858276,
    attr: {
      speed: 55, passRush: 40, runStop: 58, tackling: 61, coverage: 50, ballHawk: 51,
    },
    strengths: [],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "jaylon-carlies", name: "Jaylon Carlies", team: "IND",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4601021,
    attr: {
      speed: 50, passRush: 46, runStop: 55, tackling: 55, coverage: 46, ballHawk: 46, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "jaylon-jones", name: "Jaylon Jones", team: "IND",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4047655,
    attr: {
      speed: 63, agility: 61, tackling: 62, coverage: 58, ballHawk: 54,
    },
    strengths: [],
    weaknesses: ["ball skills"],
  },
  {
    id: "jd-bertrand", name: "JD Bertrand", team: "ATL",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4428872,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "jeff-okudah", name: "Jeff Okudah", team: "MIN",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4241984,
    attr: {
      speed: 55, passRush: 41, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "jeffrey-bassa", name: "Jeffrey Bassa", team: "KC",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4602389,
    attr: {
      speed: 51, passRush: 46, runStop: 55, tackling: 55, coverage: 46, ballHawk: 46, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "jerzhan-newton", name: "Jer'Zhan Newton", team: "WSH",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4430560,
    attr: {
      speed: 57, power: 58, passRush: 58, runStop: 54, tackling: 62, strength: 58,
    },
    strengths: [],
    weaknesses: ["run defense"],
  },
  {
    id: "jeremiah-ledbetter", name: "Jeremiah Ledbetter", team: "JAX",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3892689,
    attr: {
      speed: 55, passRush: 50, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "jeremiah-moon", name: "Jeremiah Moon", team: "CAR",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4034959,
    attr: {
      speed: 50, passRush: 46, runStop: 55, tackling: 55, coverage: 46, ballHawk: 46, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "jeremiah-pharms-jr", name: "Jeremiah Pharms Jr.", team: "NE",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 5081728,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 51, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "jeremiah-trotter-jr", name: "Jeremiah Trotter Jr.", team: "PHI",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4432777,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "jeremy-reaves", name: "Jeremy Reaves", team: "WSH",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3125248,
    attr: {
      speed: 55, passRush: 40, runStop: 57, tackling: 60, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "jermaine-johnson-ii", name: "Jermaine Johnson II", team: "TEN",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4567962,
    attr: {
      speed: 55, power: 56, passRush: 55, runStop: 52, tackling: 60, strength: 57,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "jerome-baker", name: "Jerome Baker", team: "SEA",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3915507,
    attr: {
      speed: 55, passRush: 49, runStop: 58, tackling: 61, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["ball skills","pass rush"],
  },
  {
    id: "jerry-tillery", name: "Jerry Tillery", team: "IND",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3863182,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "jesse-luketa", name: "Jesse Luketa", team: "ARI",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4361419,
    attr: {
      speed: 59, power: 59, passRush: 60, runStop: 54, tackling: 51, strength: 58,
    },
    strengths: [],
    weaknesses: ["tackling","run defense"],
  },
  {
    id: "jevon-holland", name: "Jevon Holland", team: "NYG",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4373809,
    attr: {
      speed: 59, passRush: 40, runStop: 62, tackling: 66, coverage: 55, ballHawk: 51,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "jihad-ward", name: "Jihad Ward", team: "MIN",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3115914,
    attr: {
      speed: 55, passRush: 56, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "jimmie-ward", name: "Jimmie Ward", team: "HOU",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 16717,
    attr: {
      speed: 61, agility: 59, tackling: 73, coverage: 56, ballHawk: 61,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "jimmy-horn-jr", name: "Jimmy Horn Jr.", team: "CAR",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 4708486,
    attr: {
      speed: 60, catching: 64, routeRunning: 48, separation: 48, contestedCatch: 62, yac: 57, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "jl-skinner", name: "JL Skinner", team: "DEN",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4428503,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "joe-andreessen", name: "Joe Andreessen", team: "BUF",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4366349,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "joe-bachie", name: "Joe Bachie", team: "TEN",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4036507,
    attr: {
      speed: 50, passRush: 46, runStop: 55, tackling: 55, coverage: 46, ballHawk: 46, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "joe-giles-harris", name: "Joe Giles-Harris", team: "CIN",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 3917797,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "joe-tryon-shoyinka", name: "Joe Tryon-Shoyinka", team: "TB",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4243333,
    attr: {
      speed: 55, passRush: 44, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "john-bullock", name: "John Bullock", team: "TB",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4569563,
    attr: {
      speed: 55, passRush: 43, runStop: 51, tackling: 53, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "john-jenkins", name: "John Jenkins", team: "LV",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 15846,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 58, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "john-metchie-iii", name: "John Metchie III", team: "PHI",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 4567096,
    attr: {
      speed: 58, catching: 75, routeRunning: 48, separation: 48, contestedCatch: 75, yac: 53, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "john-ridgeway-iii", name: "John Ridgeway III", team: "NO",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4248047,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "johnathan-edwards", name: "Johnathan Edwards", team: "IND",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4695991,
    attr: {
      speed: 59, agility: 56, tackling: 54, coverage: 54, ballHawk: 51,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "johnathan-hankins", name: "Johnathan Hankins", team: "SEA",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 15841,
    attr: {
      speed: 58, agility: 55, tackling: 45, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["tackling","ball skills"],
  },
  {
    id: "johnny-hekker", name: "Johnny Hekker", team: "CAR",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 15153,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "johnny-mundt", name: "Johnny Mundt", team: "MIN",
    position: "TE", overall: 58, tier: 4, startingBid: 2, espnId: 3052096,
    attr: {
      speed: 57, catching: 64, routeRunning: 48, separation: 48, contestedCatch: 63, yac: 53, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "johnny-wilson", name: "Johnny Wilson", team: "PHI",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 4686104,
    attr: {
      speed: 55, catching: 50, routeRunning: 49, separation: 49, contestedCatch: 49, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "jon-rhattigan", name: "Jon Rhattigan", team: "CAR",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4258485,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "jonah-elliss", name: "Jonah Elliss", team: "DEN",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4687592,
    attr: {
      speed: 50, passRush: 57, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "jonah-laulu", name: "Jonah Laulu", team: "LV",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4373956,
    attr: {
      speed: 55, power: 56, passRush: 55, runStop: 53, tackling: 59, strength: 57,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "jonah-williams", name: "Jonah Williams", team: "NO",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4032481,
    attr: {
      speed: 55, power: 56, passRush: 55, runStop: 52, tackling: 50, strength: 57,
    },
    strengths: [],
    weaknesses: ["tackling","run defense"],
  },
  {
    id: "jonathan-allen", name: "Jonathan Allen", team: "CIN",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3054840,
    attr: {
      speed: 58, power: 59, passRush: 59, runStop: 55, tackling: 66, strength: 60,
    },
    strengths: [],
    weaknesses: ["run defense"],
  },
  {
    id: "jonathan-bullard", name: "Jonathan Bullard", team: "DAL",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 2980097,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 52, tackling: 52, strength: 57,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "jonathan-ford", name: "Jonathan Ford", team: "GB",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4259762,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 52, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "jonathan-greenard", name: "Jonathan Greenard", team: "MIN",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 3916409,
    attr: {
      speed: 50, passRush: 77, runStop: 57, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "jonathan-jones", name: "Jonathan Jones", team: "NE",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 2971027,
    attr: {
      speed: 63, agility: 60, tackling: 64, coverage: 57, ballHawk: 51,
    },
    strengths: [],
    weaknesses: ["ball skills"],
  },
  {
    id: "jonathan-mingo", name: "Jonathan Mingo", team: "DAL",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 4426485,
    attr: {
      speed: 66, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 64, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "jonathan-owens", name: "Jonathan Owens", team: "IND",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4331768,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "jonathon-cooper", name: "Jonathon Cooper", team: "DEN",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4040608,
    attr: {
      speed: 50, passRush: 79, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "jordan-burch", name: "Jordan Burch", team: "ARI",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4428996,
    attr: {
      speed: 50, passRush: 49, runStop: 55, tackling: 55, coverage: 47, ballHawk: 46, awareness: 55,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "jordan-davis", name: "Jordan Davis", team: "PHI",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4381558,
    attr: {
      speed: 55, power: 57, passRush: 55, runStop: 54, tackling: 63, strength: 59,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "jordan-elliott", name: "Jordan Elliott", team: "TEN",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4039052,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "jordan-fuller", name: "Jordan Fuller", team: "ATL",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4040613,
    attr: {
      speed: 58, passRush: 45, runStop: 62, tackling: 64, coverage: 45, ballHawk: 45, awareness: 63,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "jordan-hancock", name: "Jordan Hancock", team: "BUF",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4596480,
    attr: {
      speed: 58, agility: 55, tackling: 52, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "jordan-howden", name: "Jordan Howden", team: "NO",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4360949,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "jordan-jackson", name: "Jordan Jackson", team: "DEN",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4261090,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "jordan-magee", name: "Jordan Magee", team: "WSH",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4568617,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "jordan-mims", name: "Jordan Mims", team: "TEN",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4243004,
    attr: {
      speed: 55, passRush: 42, runStop: 51, tackling: 52, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "jordan-phillips", name: "Jordan Phillips", team: "MIA",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 2577466,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "jordan-poyer", name: "Jordan Poyer", team: "BUF",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 15979,
    attr: {
      speed: 58, agility: 55, tackling: 82, coverage: 52, ballHawk: 50,
    },
    strengths: ["tackling"],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "jordon-riley", name: "Jordon Riley", team: "GB",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4240677,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "josaiah-stewart", name: "Josaiah Stewart", team: "LAR",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4682983,
    attr: {
      speed: 50, passRush: 50, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "josh-blackwell", name: "Josh Blackwell", team: "CHI",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4240459,
    attr: {
      speed: 58, agility: 55, tackling: 45, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["tackling","ball skills"],
  },
  {
    id: "josh-hayes", name: "Josh Hayes", team: "TB",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4248533,
    attr: {
      speed: 58, agility: 55, tackling: 51, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","tackling"],
  },
  {
    id: "josh-paschal", name: "Josh Paschal", team: "DET",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4259994,
    attr: {
      speed: 55, passRush: 51, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "josh-reynolds", name: "Josh Reynolds", team: "DEN",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 3115306,
    attr: {
      speed: 77, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 78, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "josh-ross", name: "Josh Ross", team: "BAL",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4258198,
    attr: {
      speed: 55, passRush: 43, runStop: 51, tackling: 53, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "josh-sweat", name: "Josh Sweat", team: "ARI",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 3693166,
    attr: {
      speed: 50, passRush: 85, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: ["pass rush"],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "josh-uche", name: "Josh Uche", team: "MIA",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4046528,
    attr: {
      speed: 50, passRush: 50, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "josh-wallace", name: "Josh Wallace", team: "LAR",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4572371,
    attr: {
      speed: 58, agility: 55, tackling: 45, coverage: 52, ballHawk: 51,
    },
    strengths: [],
    weaknesses: ["tackling","ball skills"],
  },
  {
    id: "josh-woods", name: "Josh Woods", team: "ATL",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 3128303,
    attr: {
      speed: 51, passRush: 47, runStop: 55, tackling: 55, coverage: 47, ballHawk: 47, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "joshua-farmer", name: "Joshua Farmer", team: "NE",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4611993,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "joshua-karty", name: "Joshua Karty", team: "LAR",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4566192,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "joshua-williams", name: "Joshua Williams", team: "KC",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4917635,
    attr: {
      speed: 59, agility: 56, tackling: 47, coverage: 53, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["tackling","ball skills"],
  },
  {
    id: "josiah-deguara", name: "Josiah Deguara", team: "JAX",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3914151,
    attr: {
      speed: 55, passRush: 41, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "jowon-briggs", name: "Jowon Briggs", team: "NYJ",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4426676,
    attr: {
      speed: 55, power: 58, passRush: 55, runStop: 56, tackling: 56, strength: 60,
    },
    strengths: [],
    weaknesses: ["pass rush","speed"],
  },
  {
    id: "juan-thornhill", name: "Juan Thornhill", team: "PIT",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 3917909,
    attr: {
      speed: 54, passRush: 45, runStop: 59, tackling: 60, coverage: 46, ballHawk: 45, awareness: 60,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "juanyeh-thomas", name: "Juanyeh Thomas", team: "DAL",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4360590,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "julian-okwara", name: "Julian Okwara", team: "ARI",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4046690,
    attr: {
      speed: 55, passRush: 48, runStop: 51, tackling: 52, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "junior-colson", name: "Junior Colson", team: "LAC",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4431212,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "justin-strnad", name: "Justin Strnad", team: "DEN",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 3919548,
    attr: {
      speed: 52, passRush: 55, runStop: 60, tackling: 58, coverage: 45, ballHawk: 46, awareness: 58,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "justin-tucker", name: "Justin Tucker", team: "BAL",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 15683,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "justin-watson", name: "Justin Watson", team: "HOU",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3118892,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "kj-britt", name: "K.J. Britt", team: "TB",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4242521,
    attr: {
      speed: 52, passRush: 45, runStop: 58, tackling: 58, coverage: 45, ballHawk: 45, awareness: 57,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "klavon-chaisson", name: "K'Lavon Chaisson", team: "WSH",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4242205,
    attr: {
      speed: 50, passRush: 75, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "kvon-wallace", name: "K'Von Wallace", team: "SEA",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4035463,
    attr: {
      speed: 58, agility: 55, tackling: 50, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","tackling"],
  },
  {
    id: "kaevon-merriweather", name: "Kaevon Merriweather", team: "HOU",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4360502,
    attr: {
      speed: 55, passRush: 43, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "kaiir-elam", name: "Kaiir Elam", team: "BUF",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4567399,
    attr: {
      speed: 58, agility: 55, tackling: 62, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "kaleb-johnson", name: "Kaleb Johnson", team: "GB",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4819231,
    attr: {
      speed: 55, agility: 55, power: 55, vision: 52, catching: 45, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "kalia-davis", name: "Kalia Davis", team: "SF",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4243541,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "kamu-grugier-hill", name: "Kamu Grugier-Hill", team: "MIN",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 3050851,
    attr: {
      speed: 58, agility: 55, tackling: 46, coverage: 52, ballHawk: 59,
    },
    strengths: [],
    weaknesses: ["tackling","coverage"],
  },
  {
    id: "kareem-hunt", name: "Kareem Hunt", team: "KC",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 3059915,
    attr: {
      speed: 58, agility: 55, power: 65, vision: 56, catching: 52, yac: 50, clutch: 66,
    },
    strengths: [],
    weaknesses: ["yards after catch","hands"],
  },
  {
    id: "karl-brooks", name: "Karl Brooks", team: "GB",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4373423,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "kayvon-thibodeaux", name: "Kayvon Thibodeaux", team: "NYG",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4426326,
    attr: {
      speed: 50, passRush: 65, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "keandre-lambert-smith", name: "KeAndre Lambert-Smith", team: "LAC",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 4430870,
    attr: {
      speed: 62, catching: 51, routeRunning: 49, separation: 49, contestedCatch: 49, yac: 59, clutch: 51,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "keeanu-benton", name: "Keeanu Benton", team: "PIT",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4426694,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 57, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "keitrel-clark", name: "Kei'Trel Clark", team: "ARI",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4426923,
    attr: {
      speed: 58, agility: 55, tackling: 46, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["tackling","ball skills"],
  },
  {
    id: "keion-white", name: "Keion White", team: "SF",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4243493,
    attr: {
      speed: 57, power: 56, passRush: 57, runStop: 50, tackling: 55, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "kelee-ringo", name: "Kelee Ringo", team: "PHI",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4428992,
    attr: {
      speed: 58, agility: 55, tackling: 51, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","tackling"],
  },
  {
    id: "kendall-williamson", name: "Kendall Williamson", team: "LAC",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4360745,
    attr: {
      speed: 55, passRush: 41, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "kendre-miller", name: "Kendre Miller", team: "NO",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4599739,
    attr: {
      speed: 63, agility: 58, power: 56, vision: 61, catching: 45, yac: 53, clutch: 51,
    },
    strengths: [],
    weaknesses: ["hands","clutch"],
  },
  {
    id: "kene-nwangwu", name: "Kene Nwangwu", team: "NYJ",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4035537,
    attr: {
      speed: 59, agility: 55, power: 55, vision: 57, catching: 45, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "kenneth-grant", name: "Kenneth Grant", team: "MIA",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4894654,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "kenneth-murray-jr", name: "Kenneth Murray Jr.", team: "TEN",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4241394,
    attr: {
      speed: 58, agility: 55, tackling: 82, coverage: 52, ballHawk: 50,
    },
    strengths: ["tackling"],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "kenny-clark", name: "Kenny Clark", team: "DAL",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3122752,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 55, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "kenny-mcintosh", name: "Kenny McIntosh", team: "SEA",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4427391,
    attr: {
      speed: 55, passRush: 41, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "kenny-pickett", name: "Kenny Pickett", team: "CAR",
    position: "QB", overall: 58, tier: 4, startingBid: 2, espnId: 4240703,
    attr: {
      armStrength: 52, shortAccuracy: 52, deepAccuracy: 47, pocketAwareness: 64, decisionMaking: 54, consistency: 55, clutch: 60, mobility: 50,
    },
    strengths: [],
    weaknesses: ["deep ball","mobility"],
  },
  {
    id: "kentavius-street", name: "Kentavius Street", team: "CHI",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3116726,
    attr: {
      speed: 57, power: 59, passRush: 57, runStop: 57, tackling: 53, strength: 61,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "keondre-coburn", name: "Keondre Coburn", team: "TEN",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4362117,
    attr: {
      speed: 55, passRush: 42, runStop: 51, tackling: 52, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "keondre-jackson", name: "Keondre Jackson", team: "BAL",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4878287,
    attr: {
      speed: 55, passRush: 41, runStop: 50, tackling: 52, coverage: 50, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "kevin-austin-jr", name: "Kevin Austin Jr.", team: "NO",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 4372758,
    attr: {
      speed: 76, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 76, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "kevin-king", name: "Kevin King", team: "ATL",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3052170,
    attr: {
      speed: 55, passRush: 41, runStop: 50, tackling: 52, coverage: 50, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "kevin-knowles", name: "Kevin Knowles", team: "TB",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4602648,
    attr: {
      speed: 58, agility: 55, tackling: 46, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["tackling","ball skills"],
  },
  {
    id: "kevin-winston-jr", name: "Kevin Winston Jr.", team: "TEN",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4685617,
    attr: {
      speed: 55, passRush: 48, runStop: 65, tackling: 69, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "keyon-martin", name: "Keyon Martin", team: "BAL",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4694334,
    attr: {
      speed: 58, agility: 55, tackling: 57, coverage: 53, ballHawk: 51,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "khaleke-hudson", name: "Khaleke Hudson", team: "CLE",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4046525,
    attr: {
      speed: 55, passRush: 42, runStop: 51, tackling: 52, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "khalen-saunders", name: "Khalen Saunders", team: "NO",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 3121634,
    attr: {
      speed: 58, agility: 55, tackling: 54, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "khalil-davis", name: "Khalil Davis", team: "HOU",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3699530,
    attr: {
      speed: 55, passRush: 49, runStop: 51, tackling: 53, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["ball skills","pass rush"],
  },
  {
    id: "khalil-dorsey", name: "Khalil Dorsey", team: "DET",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4027919,
    attr: {
      speed: 58, agility: 55, tackling: 45, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["tackling","ball skills"],
  },
  {
    id: "khalil-herbert", name: "Khalil Herbert", team: "CHI",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4035886,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "khalil-mack", name: "Khalil Mack", team: "LAC",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 16710,
    attr: {
      speed: 50, passRush: 73, runStop: 55, tackling: 55, coverage: 50, ballHawk: 48, awareness: 55,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "khyiris-tonga", name: "Khyiris Tonga", team: "KC",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4256074,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 52, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "kiko-mauigoa", name: "Kiko Mauigoa", team: "NYJ",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4700136,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "kingsley-enagbare", name: "Kingsley Enagbare", team: "NYJ",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4362840,
    attr: {
      speed: 50, passRush: 55, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "kitan-crawford", name: "Kitan Crawford", team: "ARI",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4430821,
    attr: {
      speed: 55, passRush: 41, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "kitan-oladapo", name: "Kitan Oladapo", team: "GB",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4374037,
    attr: {
      speed: 55, passRush: 41, runStop: 50, tackling: 52, coverage: 50, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "kobe-king", name: "Kobe King", team: "NYJ",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4588300,
    attr: {
      speed: 55, passRush: 42, runStop: 51, tackling: 52, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "konata-mumpfield", name: "Konata Mumpfield", team: "LAR",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 4710855,
    attr: {
      speed: 55, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "kris-abrams-draine", name: "Kris Abrams-Draine", team: "DEN",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4429193,
    attr: {
      speed: 58, agility: 55, tackling: 51, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","tackling"],
  },
  {
    id: "kris-boyd", name: "Kris Boyd", team: "HOU",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3929845,
    attr: {
      speed: 55, passRush: 43, runStop: 51, tackling: 53, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "kris-jenkins-jr", name: "Kris Jenkins Jr.", team: "CIN",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4432301,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 56, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "kristian-welch", name: "Kristian Welch", team: "GB",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4036153,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "krys-barnes", name: "Krys Barnes", team: "ARI",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4035817,
    attr: {
      speed: 55, passRush: 51, runStop: 54, tackling: 56, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "kyle-dugger", name: "Kyle Dugger", team: "NE",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4401811,
    attr: {
      speed: 57, passRush: 42, runStop: 67, tackling: 71, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "kyle-juszczyk", name: "Kyle Juszczyk", team: "SF",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 16002,
    attr: {
      speed: 55, agility: 55, power: 55, vision: 52, catching: 58, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["yards after catch","clutch"],
  },
  {
    id: "kyle-van-noy", name: "Kyle Van Noy", team: "MIN",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 16772,
    attr: {
      speed: 50, passRush: 73, runStop: 55, tackling: 55, coverage: 45, ballHawk: 46, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "kylen-granson", name: "Kylen Granson", team: "IND",
    position: "TE", overall: 58, tier: 4, startingBid: 2, espnId: 4039160,
    attr: {
      speed: 65, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 63, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "kyler-gordon", name: "Kyler Gordon", team: "CHI",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4361093,
    attr: {
      speed: 60, agility: 57, tackling: 72, coverage: 54, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "kyzir-white", name: "Kyzir White", team: "ARI",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4039254,
    attr: {
      speed: 58, agility: 55, tackling: 82, coverage: 52, ballHawk: 50,
    },
    strengths: ["tackling"],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "lj-collier", name: "L.J. Collier", team: "ARI",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3116449,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "ljarius-sneed", name: "L'Jarius Sneed", team: "KC",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4040432,
    attr: {
      speed: 58, agility: 55, tackling: 70, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "labryan-ray", name: "LaBryan Ray", team: "CAR",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4241473,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "larry-ogunjobi", name: "Larry Ogunjobi", team: "PIT",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3050122,
    attr: {
      speed: 55, passRush: 41, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "lathan-ransom", name: "Lathan Ransom", team: "CAR",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4429110,
    attr: {
      speed: 55, passRush: 41, runStop: 52, tackling: 54, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "laviska-shenault-jr", name: "Laviska Shenault Jr.", team: "SEA",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4243160,
    attr: {
      speed: 55, passRush: 41, runStop: 50, tackling: 52, coverage: 50, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "leki-fotu", name: "Leki Fotu", team: "HOU",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4035666,
    attr: {
      speed: 55, passRush: 49, runStop: 51, tackling: 53, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["ball skills","pass rush"],
  },
  {
    id: "leo-chenal", name: "Leo Chenal", team: "WSH",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4426901,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "leonard-taylor-iii", name: "Leonard Taylor III", team: "NYJ",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4431598,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "levi-drake-rodriguez", name: "Levi Drake Rodriguez", team: "MIN",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 5093973,
    attr: {
      speed: 55, power: 59, passRush: 55, runStop: 59, tackling: 58, strength: 63,
    },
    strengths: [],
    weaknesses: ["pass rush","speed"],
  },
  {
    id: "levi-onwuzurike", name: "Levi Onwuzurike", team: "DET",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4039020,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 51, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "levi-wallace", name: "Levi Wallace", team: "DEN",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3133440,
    attr: {
      speed: 55, passRush: 42, runStop: 51, tackling: 53, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "liljordan-humphrey", name: "Lil'Jordan Humphrey", team: "DEN",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 4039057,
    attr: {
      speed: 64, catching: 62, routeRunning: 48, separation: 48, contestedCatch: 60, yac: 61, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "linval-joseph", name: "Linval Joseph", team: "DAL",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 13281,
    attr: {
      speed: 55, passRush: 56, runStop: 50, tackling: 52, coverage: 50, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "logan-hall", name: "Logan Hall", team: "TB",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4360189,
    attr: {
      speed: 56, power: 55, passRush: 56, runStop: 50, tackling: 53, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "lonnie-johnson-jr", name: "Lonnie Johnson Jr.", team: "LV",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4240780,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "lorenzo-carter", name: "Lorenzo Carter", team: "ATL",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3128715,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "lukas-van-ness", name: "Lukas Van Ness", team: "GB",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4686906,
    attr: {
      speed: 58, power: 60, passRush: 59, runStop: 56, tackling: 57, strength: 61,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "luke-gifford", name: "Luke Gifford", team: "SF",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 3116097,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "mj-stewart", name: "M.J. Stewart", team: "HOU",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3116679,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "maason-smith", name: "Maason Smith", team: "ATL",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4431567,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "maema-njongmeta", name: "Maema Njongmeta", team: "CIN",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4428125,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "malachi-corley", name: "Malachi Corley", team: "CLE",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 4613104,
    attr: {
      speed: 55, catching: 84, routeRunning: 48, separation: 48, contestedCatch: 83, yac: 50, clutch: 50,
    },
    strengths: ["hands","contested catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "malaki-starks", name: "Malaki Starks", team: "BAL",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4685530,
    attr: {
      speed: 55, passRush: 41, runStop: 68, tackling: 73, coverage: 50, ballHawk: 51,
    },
    strengths: [],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "malcolm-koonce", name: "Malcolm Koonce", team: "LV",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4239719,
    attr: {
      speed: 59, power: 59, passRush: 60, runStop: 54, tackling: 51, strength: 59,
    },
    strengths: [],
    weaknesses: ["tackling","run defense"],
  },
  {
    id: "malcolm-roach", name: "Malcolm Roach", team: "DEN",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4039064,
    attr: {
      speed: 58, power: 58, passRush: 59, runStop: 52, tackling: 62, strength: 57,
    },
    strengths: [],
    weaknesses: ["run defense"],
  },
  {
    id: "malcolm-rodriguez", name: "Malcolm Rodriguez", team: "DET",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4241411,
    attr: {
      speed: 50, passRush: 48, runStop: 56, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "malik-harrison", name: "Malik Harrison", team: "NYG",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4040615,
    attr: {
      speed: 50, passRush: 45, runStop: 56, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "malik-heath", name: "Malik Heath", team: "GB",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4689334,
    attr: {
      speed: 55, passRush: 41, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "malik-hooker", name: "Malik Hooker", team: "DAL",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3121415,
    attr: {
      speed: 55, passRush: 40, runStop: 63, tackling: 67, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "malik-washington", name: "Malik Washington", team: "MIA",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 4569603,
    attr: {
      speed: 55, catching: 81, routeRunning: 48, separation: 48, contestedCatch: 80, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "marcelino-mccrary-ball", name: "Marcelino McCrary-Ball", team: "NYJ",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4045299,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "marco-wilson", name: "Marco Wilson", team: "CIN",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4240595,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "marcus-davenport", name: "Marcus Davenport", team: "DET",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3124058,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 51, tackling: 51, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "marcus-epps", name: "Marcus Epps", team: "PHI",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3139368,
    attr: {
      speed: 55, passRush: 40, runStop: 58, tackling: 60, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "marcus-harris", name: "Marcus Harris", team: "KC",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4570469,
    attr: {
      speed: 62, agility: 60, tackling: 56, coverage: 57, ballHawk: 51,
    },
    strengths: [],
    weaknesses: ["ball skills"],
  },
  {
    id: "marcus-maye", name: "Marcus Maye", team: "MIA",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 2980110,
    attr: {
      speed: 58, agility: 55, tackling: 65, coverage: 52, ballHawk: 52,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "marcus-williams", name: "Marcus Williams", team: "BAL",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3122882,
    attr: {
      speed: 55, passRush: 40, runStop: 55, tackling: 58, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "mario-edwards-jr", name: "Mario Edwards Jr.", team: "HOU",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 2969921,
    attr: {
      speed: 58, power: 55, passRush: 59, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "marist-liufau", name: "Marist Liufau", team: "DAL",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4427816,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "mark-robinson", name: "Mark Robinson", team: "PIT",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4249342,
    attr: {
      speed: 55, passRush: 41, runStop: 50, tackling: 52, coverage: 50, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "markees-watts", name: "Markees Watts", team: "TB",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4373706,
    attr: {
      speed: 55, passRush: 44, runStop: 51, tackling: 53, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "markquese-bell", name: "Markquese Bell", team: "DAL",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4241921,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "marlowe-wax", name: "Marlowe Wax", team: "LAC",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4431467,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "marques-sigle", name: "Marques Sigle", team: "SF",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4693337,
    attr: {
      speed: 55, passRush: 40, runStop: 65, tackling: 69, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "marshawn-kneeland", name: "Marshawn Kneeland", team: "DAL",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4429996,
    attr: {
      speed: 55, passRush: 42, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "marte-mapu", name: "Marte Mapu", team: "NE",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4248899,
    attr: {
      speed: 63, agility: 60, tackling: 53, coverage: 57, ballHawk: 55,
    },
    strengths: [],
    weaknesses: ["tackling","ball skills"],
  },
  {
    id: "martin-emerson-jr", name: "Martin Emerson Jr.", team: "NO",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4429568,
    attr: {
      speed: 58, agility: 55, tackling: 72, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "mason-graham", name: "Mason Graham", team: "CLE",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4873232,
    attr: {
      speed: 55, power: 57, passRush: 55, runStop: 58, tackling: 61, strength: 62,
    },
    strengths: [],
    weaknesses: ["pass rush","speed"],
  },
  {
    id: "mason-kinsey", name: "Mason Kinsey", team: "TEN",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4057082,
    attr: {
      speed: 55, passRush: 41, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "mason-tipton", name: "Mason Tipton", team: "NO",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 4573697,
    attr: {
      speed: 55, catching: 57, routeRunning: 48, separation: 48, contestedCatch: 55, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "matt-milano", name: "Matt Milano", team: "BUF",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3046287,
    attr: {
      speed: 58, power: 60, passRush: 58, runStop: 57, tackling: 84, strength: 61,
    },
    strengths: ["tackling"],
    weaknesses: [],
  },
  {
    id: "matt-prater", name: "Matt Prater", team: "BUF",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 11122,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "matthew-butler", name: "Matthew Butler", team: "MIA",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4242457,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "matthew-judon", name: "Matthew Judon", team: "ATL",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 3961466,
    attr: {
      speed: 58, agility: 55, tackling: 47, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["tackling","ball skills"],
  },
  {
    id: "matthew-wright", name: "Matthew Wright", team: "SF",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3128444,
    attr: {
      speed: 55, passRush: 42, runStop: 51, tackling: 52, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "maurice-hurst-ii", name: "Maurice Hurst II", team: "CLE",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3045220,
    attr: {
      speed: 55, passRush: 42, runStop: 51, tackling: 52, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "max-melton", name: "Max Melton", team: "ARI",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4698113,
    attr: {
      speed: 63, agility: 61, tackling: 56, coverage: 58, ballHawk: 51,
    },
    strengths: [],
    weaknesses: ["ball skills"],
  },
  {
    id: "mazi-smith", name: "Mazi Smith", team: "DAL",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4426347,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 56, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "mckinnley-jackson", name: "McKinnley Jackson", team: "CIN",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4692680,
    attr: {
      speed: 55, passRush: 45, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "mekhi-blackmon", name: "Mekhi Blackmon", team: "IND",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4360677,
    attr: {
      speed: 62, agility: 60, tackling: 64, coverage: 57, ballHawk: 57,
    },
    strengths: [],
    weaknesses: [],
  },
  {
    id: "michael-burton", name: "Michael Burton", team: "DEN",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 2515270,
    attr: {
      speed: 55, agility: 55, power: 55, vision: 52, catching: 46, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "michael-carter", name: "Michael Carter", team: "ARI",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4240657,
    attr: {
      speed: 56, agility: 55, power: 57, vision: 54, catching: 65, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["yards after catch","clutch"],
  },
  {
    id: "michael-carter-ii", name: "Michael Carter II", team: "PHI",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4240456,
    attr: {
      speed: 58, agility: 55, tackling: 51, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","tackling"],
  },
  {
    id: "michael-davis", name: "Michael Davis", team: "WSH",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3053795,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "michael-hoecht", name: "Michael Hoecht", team: "BUF",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4033234,
    attr: {
      speed: 58, power: 55, passRush: 58, runStop: 50, tackling: 66, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","power"],
  },
  {
    id: "michael-pierce", name: "Michael Pierce", team: "BAL",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 2972144,
    attr: {
      speed: 57, power: 55, passRush: 58, runStop: 50, tackling: 51, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "micheal-clemons", name: "Micheal Clemons", team: "NYJ",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4240896,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "mike-brown", name: "Mike Brown", team: "TEN",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4244310,
    attr: {
      speed: 55, passRush: 40, runStop: 52, tackling: 55, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "mike-danna", name: "Mike Danna", team: "KC",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3915487,
    attr: {
      speed: 55, power: 56, passRush: 55, runStop: 51, tackling: 58, strength: 56,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "mike-edwards", name: "Mike Edwards", team: "BUF",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3155647,
    attr: {
      speed: 55, passRush: 41, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "mike-ford-jr", name: "Mike Ford Jr.", team: "ATL",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 3050916,
    attr: {
      speed: 58, agility: 55, tackling: 45, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["tackling","ball skills"],
  },
  {
    id: "mike-green", name: "Mike Green", team: "BAL",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4683188,
    attr: {
      speed: 50, passRush: 53, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "mike-hall-jr", name: "Mike Hall Jr.", team: "CLE",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4600415,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 51, tackling: 50, strength: 56,
    },
    strengths: [],
    weaknesses: ["tackling","run defense"],
  },
  {
    id: "mike-hilton", name: "Mike Hilton", team: "IND",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 2980383,
    attr: {
      speed: 58, agility: 55, tackling: 70, coverage: 52, ballHawk: 51,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "mike-morris", name: "Mike Morris", team: "SEA",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4572055,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "mike-pennel", name: "Mike Pennel", team: "KC",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 17230,
    attr: {
      speed: 55, passRush: 46, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "miles-killebrew", name: "Miles Killebrew", team: "PIT",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 2575164,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "mo-alie-cox", name: "Mo Alie-Cox", team: "IND",
    position: "TE", overall: 58, tier: 4, startingBid: 2, espnId: 2998565,
    attr: {
      speed: 65, catching: 60, routeRunning: 48, separation: 48, contestedCatch: 59, yac: 63, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "mohamoud-diabate", name: "Mohamoud Diabate", team: "TEN",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4567403,
    attr: {
      speed: 51, passRush: 45, runStop: 58, tackling: 56, coverage: 45, ballHawk: 45, awareness: 56,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "montravius-adams", name: "Montravius Adams", team: "PIT",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3051894,
    attr: {
      speed: 55, passRush: 48, runStop: 51, tackling: 52, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "morgan-fox", name: "Morgan Fox", team: "LAC",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3059620,
    attr: {
      speed: 55, passRush: 60, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "moro-ojomo", name: "Moro Ojomo", team: "PHI",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4362116,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "mykal-walker", name: "Mykal Walker", team: "WSH",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4243009,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "mykel-williams", name: "Mykel Williams", team: "SF",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4685623,
    attr: {
      speed: 55, power: 57, passRush: 55, runStop: 57, tackling: 55, strength: 61,
    },
    strengths: [],
    weaknesses: ["pass rush","speed"],
  },
  {
    id: "myles-bryant", name: "Myles Bryant", team: "HOU",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4039010,
    attr: {
      speed: 58, agility: 55, tackling: 60, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "myles-harden", name: "Myles Harden", team: "CLE",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4695783,
    attr: {
      speed: 58, agility: 55, tackling: 53, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "myles-murphy", name: "Myles Murphy", team: "CIN",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4428985,
    attr: {
      speed: 56, power: 55, passRush: 56, runStop: 50, tackling: 58, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","power"],
  },
  {
    id: "myles-price", name: "Myles Price", team: "MIN",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 4430656,
    attr: {
      speed: 62, catching: 66, routeRunning: 48, separation: 48, contestedCatch: 64, yac: 58, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "naquan-jones", name: "Naquan Jones", team: "ARI",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4046716,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 52, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "nate-hobbs", name: "Nate Hobbs", team: "LV",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4240542,
    attr: {
      speed: 61, agility: 58, tackling: 66, coverage: 55, ballHawk: 53,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "nathan-shepherd", name: "Nathan Shepherd", team: "NO",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4076951,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 57, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "natrone-brooks", name: "Natrone Brooks", team: "ATL",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4689989,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "nazeeh-johnson", name: "Nazeeh Johnson", team: "KC",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4043625,
    attr: {
      speed: 55, passRush: 41, runStop: 57, tackling: 60, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "nazir-stackhouse", name: "Nazir Stackhouse", team: "TEN",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4429142,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 51, tackling: 51, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "nehemiah-pritchett", name: "Nehemiah Pritchett", team: "SEA",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4567222,
    attr: {
      speed: 60, agility: 58, tackling: 48, coverage: 55, ballHawk: 53,
    },
    strengths: [],
    weaknesses: ["tackling","ball skills"],
  },
  {
    id: "neville-gallimore", name: "Neville Gallimore", team: "CHI",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3892883,
    attr: {
      speed: 56, power: 55, passRush: 56, runStop: 50, tackling: 54, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "neville-hewitt", name: "Neville Hewitt", team: "NYG",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 3059880,
    attr: {
      speed: 58, agility: 55, tackling: 57, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "nic-scourton", name: "Nic Scourton", team: "CAR",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4833355,
    attr: {
      speed: 50, passRush: 62, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "nick-bellore", name: "Nick Bellore", team: "WSH",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 14471,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "nick-chubb", name: "Nick Chubb", team: "HOU",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 3128720,
    attr: {
      speed: 60, agility: 55, power: 61, vision: 57, catching: 45, yac: 50, clutch: 54,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "nick-hampton", name: "Nick Hampton", team: "LAR",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4360773,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "nick-herbig", name: "Nick Herbig", team: "PIT",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4429164,
    attr: {
      speed: 50, passRush: 74, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "nick-mccloud", name: "Nick McCloud", team: "NYG",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4036169,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "nick-niemann", name: "Nick Niemann", team: "GB",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4036141,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "nick-vigil", name: "Nick Vigil", team: "DAL",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 2971816,
    attr: {
      speed: 55, passRush: 42, runStop: 51, tackling: 52, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "nik-bonitto", name: "Nik Bonitto", team: "DEN",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4360259,
    attr: {
      speed: 50, passRush: 85, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: ["pass rush"],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "noah-igbinoghene", name: "Noah Igbinoghene", team: "WSH",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4242516,
    attr: {
      speed: 62, agility: 59, tackling: 59, coverage: 56, ballHawk: 51,
    },
    strengths: [],
    weaknesses: ["ball skills"],
  },
  {
    id: "noah-sewell", name: "Noah Sewell", team: "CHI",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4430822,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "nolan-smith-jr", name: "Nolan Smith Jr.", team: "PHI",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4426331,
    attr: {
      speed: 50, passRush: 69, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "odafe-oweh", name: "Odafe Oweh", team: "WSH",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4361422,
    attr: {
      speed: 50, passRush: 85, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: ["pass rush"],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "odell-beckham-jr", name: "Odell Beckham Jr.", team: "MIA",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 16733,
    attr: {
      speed: 55, catching: 51, routeRunning: 49, separation: 49, contestedCatch: 49, yac: 51, clutch: 51,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "ogbo-okoronkwo", name: "Ogbo Okoronkwo", team: "SF",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 3052667,
    attr: {
      speed: 50, passRush: 57, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "olamide-zaccheaus", name: "Olamide Zaccheaus", team: "ATL",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 3917914,
    attr: {
      speed: 58, catching: 73, routeRunning: 48, separation: 48, contestedCatch: 72, yac: 54, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "ollie-gordon-ii", name: "Ollie Gordon II", team: "MIA",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4711533,
    attr: {
      speed: 55, agility: 55, power: 55, vision: 52, catching: 45, yac: 50, clutch: 52,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "oren-burks", name: "Oren Burks", team: "CIN",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 3051746,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "osa-odighizuwa", name: "Osa Odighizuwa", team: "SF",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4035840,
    attr: {
      speed: 56, power: 56, passRush: 57, runStop: 51, tackling: 57, strength: 56,
    },
    strengths: [],
    weaknesses: ["run defense"],
  },
  {
    id: "otito-ogbonnia", name: "Otito Ogbonnia", team: "DAL",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4367210,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 53, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "owen-pappoe", name: "Owen Pappoe", team: "ARI",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4567219,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "pj-locke", name: "P.J. Locke", team: "DAL",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3929850,
    attr: {
      speed: 55, passRush: 40, runStop: 62, tackling: 66, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "pat-oconnor", name: "Pat O'Connor", team: "DET",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 2980206,
    attr: {
      speed: 55, passRush: 41, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "patrick-johnson", name: "Patrick Johnson", team: "LV",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4243916,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 51, tackling: 51, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "patrick-jones-ii", name: "Patrick Jones II", team: "CAR",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4036063,
    attr: {
      speed: 50, passRush: 77, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "patrick-oconnell", name: "Patrick O'Connell", team: "SEA",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4364623,
    attr: {
      speed: 50, passRush: 46, runStop: 55, tackling: 55, coverage: 46, ballHawk: 46, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "patrick-ricard", name: "Patrick Ricard", team: "NYG",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 2975417,
    attr: {
      speed: 55, agility: 55, power: 55, vision: 52, catching: 45, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "payton-turner", name: "Payton Turner", team: "NO",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4240269,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "percy-butler", name: "Percy Butler", team: "WSH",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4363097,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "phidarian-mathis", name: "Phidarian Mathis", team: "WSH",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4241468,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 52, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "pj-jules", name: "PJ Jules", team: "CIN",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4429946,
    attr: {
      speed: 55, passRush: 42, runStop: 51, tackling: 52, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "pj-mustipher", name: "PJ Mustipher", team: "ARI",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4361421,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "poona-ford", name: "Poona Ford", team: "LAR",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3125114,
    attr: {
      speed: 55, power: 57, passRush: 55, runStop: 54, tackling: 57, strength: 59,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "preston-smith", name: "Preston Smith", team: "GB",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 2577446,
    attr: {
      speed: 55, passRush: 54, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "princely-umanmielen", name: "Princely Umanmielen", team: "CAR",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4429166,
    attr: {
      speed: 50, passRush: 50, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "quandre-diggs", name: "Quandre Diggs", team: "TEN",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 2577553,
    attr: {
      speed: 54, passRush: 45, runStop: 58, tackling: 59, coverage: 45, ballHawk: 45, awareness: 59,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "que-robinson", name: "Que Robinson", team: "DEN",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4692048,
    attr: {
      speed: 51, passRush: 53, runStop: 55, tackling: 55, coverage: 47, ballHawk: 47, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "quinshon-judkins", name: "Quinshon Judkins", team: "CLE",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4685702,
    attr: {
      speed: 55, agility: 55, power: 72, vision: 52, catching: 55, yac: 50, clutch: 63,
    },
    strengths: [],
    weaknesses: ["yards after catch","vision"],
  },
  {
    id: "quintin-morris", name: "Quintin Morris", team: "JAX",
    position: "TE", overall: 58, tier: 4, startingBid: 2, espnId: 4244049,
    attr: {
      speed: 55, catching: 64, routeRunning: 48, separation: 48, contestedCatch: 62, yac: 50, runBlock: 62, passBlock: 60, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "quinton-bell", name: "Quinton Bell", team: "MIA",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3933407,
    attr: {
      speed: 55, passRush: 41, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "quinton-jefferson", name: "Quinton Jefferson", team: "BUF",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 2577078,
    attr: {
      speed: 55, passRush: 56, runStop: 50, tackling: 52, coverage: 50, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "qwantez-stiggers", name: "Qwan'tez Stiggers", team: "NYJ",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 5208977,
    attr: {
      speed: 58, agility: 55, tackling: 49, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["tackling","ball skills"],
  },
  {
    id: "raekwon-davis", name: "Raekwon Davis", team: "IND",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4040965,
    attr: {
      speed: 55, passRush: 41, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "raekwon-mcmillan", name: "Raekwon McMillan", team: "NE",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 3121423,
    attr: {
      speed: 57, passRush: 46, runStop: 62, tackling: 63, coverage: 46, ballHawk: 46, awareness: 63,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "raheem-blackshear", name: "Raheem Blackshear", team: "CAR",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4259308,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "raheem-mostert", name: "Raheem Mostert", team: "MIA",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 2576414,
    attr: {
      speed: 55, agility: 55, power: 55, vision: 52, catching: 50, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "rakeem-nunez-roches", name: "Rakeem Nunez-Roches", team: "TB",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 2575453,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 61, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "rashan-gary", name: "Rashan Gary", team: "DAL",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4046523,
    attr: {
      speed: 50, passRush: 74, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "rasheen-ali", name: "Rasheen Ali", team: "BAL",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4690013,
    attr: {
      speed: 55, agility: 55, power: 55, vision: 52, catching: 45, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "rayshawn-jenkins", name: "Rayshawn Jenkins", team: "PIT",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 2969961,
    attr: {
      speed: 55, passRush: 42, runStop: 53, tackling: 55, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "rayuan-lane-iii", name: "Rayuan Lane III", team: "JAX",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4880675,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "reddy-steward", name: "Reddy Steward", team: "DAL",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4428584,
    attr: {
      speed: 58, agility: 55, tackling: 64, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "reggie-gilliam", name: "Reggie Gilliam", team: "BUF",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4039505,
    attr: {
      speed: 55, agility: 55, power: 55, vision: 52, catching: 45, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "richie-grant", name: "Richie Grant", team: "ATL",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4042119,
    attr: {
      speed: 55, passRush: 43, runStop: 51, tackling: 53, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "rico-payton", name: "Rico Payton", team: "NO",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4368350,
    attr: {
      speed: 58, agility: 55, tackling: 45, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["tackling","ball skills"],
  },
  {
    id: "rj-harvey", name: "RJ Harvey", team: "DEN",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4568490,
    attr: {
      speed: 57, agility: 55, power: 58, vision: 54, catching: 67, yac: 50, clutch: 69,
    },
    strengths: [],
    weaknesses: ["yards after catch","vision"],
  },
  {
    id: "rj-mickens", name: "RJ Mickens", team: "LAC",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4429018,
    attr: {
      speed: 55, passRush: 41, runStop: 50, tackling: 52, coverage: 50, ballHawk: 54,
    },
    strengths: [],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "robert-beal-jr", name: "Robert Beal Jr.", team: "MIA",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4259558,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 51, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "rodney-mcleod-jr", name: "Rodney McLeod Jr.", team: "CLE",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 15222,
    attr: {
      speed: 60, passRush: 40, runStop: 50, tackling: 52, coverage: 55, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "rodney-thomas-ii", name: "Rodney Thomas II", team: "SEA",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4248455,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "roger-mccreary", name: "Roger McCreary", team: "DET",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4371973,
    attr: {
      speed: 58, agility: 55, tackling: 61, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "ronnie-harrison-jr", name: "Ronnie Harrison Jr.", team: "ATL",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 3859006,
    attr: {
      speed: 50, passRush: 52, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "roschon-johnson", name: "Roschon Johnson", team: "CHI",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4426386,
    attr: {
      speed: 55, agility: 55, power: 55, vision: 52, catching: 45, yac: 50, clutch: 55,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "roy-lopez", name: "Roy Lopez", team: "ARI",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4040805,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 54, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "roy-robertson-harris", name: "Roy Robertson-Harris", team: "JAX",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 2574891,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 52, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "ruke-orhorhoro", name: "Ruke Orhorhoro", team: "JAX",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4430271,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "ryan-miller", name: "Ryan Miller", team: "TB",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 4369466,
    attr: {
      speed: 72, catching: 58, routeRunning: 48, separation: 48, contestedCatch: 56, yac: 72, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "sam-eguavoen", name: "Sam Eguavoen", team: "NYJ",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 2577637,
    attr: {
      speed: 55, passRush: 42, runStop: 51, tackling: 52, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "sam-franklin-jr", name: "Sam Franklin Jr.", team: "BUF",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4044133,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "sam-hubbard", name: "Sam Hubbard", team: "CIN",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 3121416,
    attr: {
      speed: 58, agility: 55, tackling: 57, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "sam-kamara", name: "Sam Kamara", team: "CLE",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4033855,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 54, tackling: 51, strength: 58,
    },
    strengths: [],
    weaknesses: ["tackling","run defense"],
  },
  {
    id: "sam-okuayinonu", name: "Sam Okuayinonu", team: "SF",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4569497,
    attr: {
      speed: 55, power: 56, passRush: 55, runStop: 53, tackling: 55, strength: 58,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "sam-williams", name: "Sam Williams", team: "CLE",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4567242,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "samson-ebukam", name: "Samson Ebukam", team: "ATL",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3045527,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 51, tackling: 53, strength: 56,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "scott-matlock", name: "Scott Matlock", team: "LAC",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4373684,
    attr: {
      speed: 60, agility: 55, power: 55, vision: 58, catching: 45, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "scotty-miller", name: "Scotty Miller", team: "PIT",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 3914397,
    attr: {
      speed: 57, catching: 63, routeRunning: 49, separation: 49, contestedCatch: 61, yac: 53, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "sean-murphy-bunting", name: "Sean Murphy-Bunting", team: "ARI",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 3932886,
    attr: {
      speed: 59, agility: 56, tackling: 61, coverage: 53, ballHawk: 60,
    },
    strengths: [],
    weaknesses: ["coverage"],
  },
  {
    id: "sebastian-joseph-day", name: "Sebastian Joseph-Day", team: "PIT",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3047495,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 57, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "segun-olubi", name: "Segun Olubi", team: "LV",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4260703,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "shaka-heyward", name: "Shaka Heyward", team: "CIN",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4360413,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "shaquill-griffin", name: "Shaquill Griffin", team: "MIN",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 3054026,
    attr: {
      speed: 60, agility: 57, tackling: 54, coverage: 54, ballHawk: 56,
    },
    strengths: [],
    weaknesses: ["coverage","tackling"],
  },
  {
    id: "shaun-dolac", name: "Shaun Dolac", team: "LAR",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4693848,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "shavon-revel-jr", name: "Shavon Revel Jr.", team: "DAL",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 5095865,
    attr: {
      speed: 60, agility: 58, tackling: 69, coverage: 55, ballHawk: 51,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "shedeur-sanders", name: "Shedeur Sanders", team: "CLE",
    position: "QB", overall: 58, tier: 4, startingBid: 2, espnId: 4432762,
    attr: {
      armStrength: 57, shortAccuracy: 47, deepAccuracy: 54, pocketAwareness: 57, decisionMaking: 47, consistency: 51, clutch: 61, mobility: 64,
    },
    strengths: [],
    weaknesses: ["short accuracy","decision-making"],
  },
  {
    id: "shelby-harris", name: "Shelby Harris", team: "CLE",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 16837,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 53, tackling: 52, strength: 58,
    },
    strengths: [],
    weaknesses: ["tackling","run defense"],
  },
  {
    id: "sheldon-day", name: "Sheldon Day", team: "WSH",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 2976194,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "sheldon-rankins", name: "Sheldon Rankins", team: "HOU",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 2970204,
    attr: {
      speed: 56, power: 55, passRush: 56, runStop: 50, tackling: 55, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","power"],
  },
  {
    id: "shy-tuttle", name: "Shy Tuttle", team: "WSH",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3886601,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 55, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "sione-takitaki", name: "Sione Takitaki", team: "MIN",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3138834,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "sione-vaki", name: "Sione Vaki", team: "DET",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4912274,
    attr: {
      speed: 55, agility: 55, power: 55, vision: 52, catching: 45, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "siran-neal", name: "Siran Neal", team: "SF",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 3057524,
    attr: {
      speed: 58, agility: 55, tackling: 45, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["tackling","ball skills"],
  },
  {
    id: "smael-mondon-jr", name: "Smael Mondon Jr.", team: "PHI",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4431573,
    attr: {
      speed: 50, passRush: 46, runStop: 55, tackling: 55, coverage: 46, ballHawk: 46, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "solomon-thomas", name: "Solomon Thomas", team: "NYJ",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3117258,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "starling-thomas-v", name: "Starling Thomas V", team: "ARI",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4363408,
    attr: {
      speed: 60, agility: 57, tackling: 53, coverage: 54, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","tackling"],
  },
  {
    id: "swayze-bozeman", name: "Swayze Bozeman", team: "CIN",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4570546,
    attr: {
      speed: 51, passRush: 47, runStop: 55, tackling: 55, coverage: 47, ballHawk: 47, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "sydney-brown", name: "Sydney Brown", team: "ATL",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4360386,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "tj-sanders", name: "T.J. Sanders", team: "BUF",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4684527,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "tj-slaton-jr", name: "T.J. Slaton Jr.", team: "CIN",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4240612,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 59, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "tj-tampa", name: "T.J. Tampa", team: "BAL",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4575483,
    attr: {
      speed: 58, agility: 55, tackling: 45, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["tackling","ball skills"],
  },
  {
    id: "tj-watt", name: "T.J. Watt", team: "PIT",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 3045282,
    attr: {
      speed: 50, passRush: 85, runStop: 61, tackling: 55, coverage: 56, ballHawk: 56, awareness: 55,
    },
    strengths: ["pass rush"],
    weaknesses: ["speed","tackling"],
  },
  {
    id: "tvondre-sweat", name: "T'Vondre Sweat", team: "NYJ",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4428617,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 62, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "taquon-graham", name: "Ta'Quon Graham", team: "ATL",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4262197,
    attr: {
      speed: 55, passRush: 41, runStop: 50, tackling: 52, coverage: 50, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "tahj-brooks", name: "Tahj Brooks", team: "CIN",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4429299,
    attr: {
      speed: 55, agility: 55, power: 55, vision: 52, catching: 45, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "tanner-conner", name: "Tanner Conner", team: "MIA",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4047422,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "taron-johnson", name: "Taron Johnson", team: "LV",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 3121003,
    attr: {
      speed: 59, agility: 56, tackling: 73, coverage: 53, ballHawk: 52,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "taven-bryan", name: "Taven Bryan", team: "IND",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3115249,
    attr: {
      speed: 55, passRush: 46, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "tavierre-thomas", name: "Tavierre Thomas", team: "MIN",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4334405,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "tavius-robinson", name: "Tavius Robinson", team: "BAL",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4690179,
    attr: {
      speed: 50, passRush: 66, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "teair-tart", name: "Teair Tart", team: "LAC",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4374269,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 51, tackling: 51, strength: 56,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "terrance-ferguson", name: "Terrance Ferguson", team: "LAR",
    position: "TE", overall: 58, tier: 4, startingBid: 2, espnId: 4570037,
    attr: {
      speed: 95, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 92, runBlock: 62, passBlock: 60, clutch: 51,
    },
    strengths: ["speed","yards after catch"],
    weaknesses: ["route running","separation"],
  },
  {
    id: "terrell-burgess", name: "Terrell Burgess", team: "NO",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4035663,
    attr: {
      speed: 56, passRush: 41, runStop: 50, tackling: 52, coverage: 51, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "terrell-jennings", name: "Terrell Jennings", team: "NE",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4427600,
    attr: {
      speed: 55, agility: 55, power: 55, vision: 53, catching: 47, yac: 51, clutch: 51,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "theo-jackson", name: "Theo Jackson", team: "MIN",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4242436,
    attr: {
      speed: 55, passRush: 44, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "thomas-booker-iv", name: "Thomas Booker IV", team: "LV",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4360749,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 55, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "thomas-harper", name: "Thomas Harper", team: "DET",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4569323,
    attr: {
      speed: 59, passRush: 40, runStop: 50, tackling: 52, coverage: 55, ballHawk: 52,
    },
    strengths: [],
    weaknesses: ["pass rush","run defense"],
  },
  {
    id: "thomas-incoom", name: "Thomas Incoom", team: "CAR",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4714157,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "tim-settle", name: "Tim Settle", team: "WSH",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3929956,
    attr: {
      speed: 56, power: 60, passRush: 56, runStop: 58, tackling: 50, strength: 63,
    },
    strengths: [],
    weaknesses: ["tackling"],
  },
  {
    id: "tommy-eichenberg", name: "Tommy Eichenberg", team: "LV",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4429560,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "tommy-togiai", name: "Tommy Togiai", team: "HOU",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4361366,
    attr: {
      speed: 55, power: 56, passRush: 55, runStop: 54, tackling: 70, strength: 59,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "tomon-fox", name: "Tomon Fox", team: "NYG",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4037520,
    attr: {
      speed: 55, passRush: 43, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "travis-homer", name: "Travis Homer", team: "CHI",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4037457,
    attr: {
      speed: 55, agility: 55, power: 55, vision: 52, catching: 45, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "travis-jones", name: "Travis Jones", team: "BAL",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4362139,
    attr: {
      speed: 55, power: 58, passRush: 55, runStop: 55, tackling: 59, strength: 60,
    },
    strengths: [],
    weaknesses: ["pass rush","run defense"],
  },
  {
    id: "trayveon-williams", name: "Trayveon Williams", team: "CLE",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4035222,
    attr: {
      speed: 55, passRush: 41, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "tre-avery", name: "Tre Avery", team: "CLE",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4259300,
    attr: {
      speed: 55, passRush: 41, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "tre-brown", name: "Tre Brown", team: "SEA",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4241373,
    attr: {
      speed: 58, agility: 55, tackling: 59, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "tremon-smith", name: "Tremon Smith", team: "HOU",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 3134448,
    attr: {
      speed: 58, agility: 55, tackling: 45, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["tackling","ball skills"],
  },
  {
    id: "trenton-gill", name: "Trenton Gill", team: "TB",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4240128,
    attr: {
      speed: 55, passRush: 43, runStop: 51, tackling: 53, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "trenton-simpson", name: "Trenton Simpson", team: "BAL",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4430831,
    attr: {
      speed: 56, passRush: 48, runStop: 63, tackling: 62, coverage: 45, ballHawk: 45, awareness: 61,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "trevis-gipson", name: "Trevis Gipson", team: "CAR",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 3917016,
    attr: {
      speed: 50, passRush: 50, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "trevor-nowaske", name: "Trevor Nowaske", team: "DET",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 5144894,
    attr: {
      speed: 50, passRush: 47, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "trey-hendrickson", name: "Trey Hendrickson", team: "BAL",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 3052743,
    attr: {
      speed: 50, passRush: 85, runStop: 55, tackling: 55, coverage: 49, ballHawk: 47, awareness: 55,
    },
    strengths: ["pass rush"],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "trey-lance", name: "Trey Lance", team: "DAL",
    position: "QB", overall: 58, tier: 4, startingBid: 2, espnId: 4383351,
    attr: {
      armStrength: 52, shortAccuracy: 49, deepAccuracy: 47, pocketAwareness: 72, decisionMaking: 49, consistency: 52, clutch: 52, mobility: 58,
    },
    strengths: [],
    weaknesses: ["deep ball","short accuracy"],
  },
  {
    id: "trey-sermon", name: "Trey Sermon", team: "IND",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4241401,
    attr: {
      speed: 55, agility: 55, power: 55, vision: 52, catching: 46, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "treylon-burks", name: "Treylon Burks", team: "WSH",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 4567156,
    attr: {
      speed: 73, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 73, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "tristin-mccollum", name: "Tristin McCollum", team: "LV",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4250393,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "troy-dye", name: "Troy Dye", team: "LAC",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4038946,
    attr: {
      speed: 52, passRush: 45, runStop: 59, tackling: 58, coverage: 45, ballHawk: 45, awareness: 58,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "troy-franklin", name: "Troy Franklin", team: "DEN",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 4431280,
    attr: {
      speed: 67, catching: 59, routeRunning: 51, separation: 51, contestedCatch: 57, yac: 65, clutch: 54,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "troy-reeder", name: "Troy Reeder", team: "LAR",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 3116177,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "tucker-fisk", name: "Tucker Fisk", team: "LAC",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4242558,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "tuli-tuipulotu", name: "Tuli Tuipulotu", team: "LAC",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4431442,
    attr: {
      speed: 50, passRush: 85, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: ["pass rush"],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "ty-chandler", name: "Ty Chandler", team: "MIN",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4242431,
    attr: {
      speed: 55, agility: 55, power: 55, vision: 52, catching: 45, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "ty-hamilton", name: "Ty Hamilton", team: "LAR",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4431118,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "ty-okada", name: "Ty Okada", team: "SEA",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4247808,
    attr: {
      speed: 59, passRush: 44, runStop: 58, tackling: 61, coverage: 54, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "ty-summers", name: "Ty Summers", team: "NYG",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3116431,
    attr: {
      speed: 55, passRush: 41, runStop: 50, tackling: 52, coverage: 50, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "tyron-hopper", name: "Ty'Ron Hopper", team: "GB",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4567406,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "tycen-anderson", name: "Tycen Anderson", team: "DEN",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4257240,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "tyjae-spears", name: "Tyjae Spears", team: "TEN",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4428557,
    attr: {
      speed: 60, agility: 55, power: 55, vision: 58, catching: 63, yac: 50, clutch: 53,
    },
    strengths: [],
    weaknesses: ["yards after catch","clutch"],
  },
  {
    id: "tyleik-williams", name: "Tyleik Williams", team: "DET",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4431615,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "tyler-batty", name: "Tyler Batty", team: "MIN",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4608794,
    attr: {
      speed: 51, passRush: 46, runStop: 55, tackling: 55, coverage: 46, ballHawk: 46, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "tyler-davis", name: "Tyler Davis", team: "LAR",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4568217,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 57, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "tyler-lacy", name: "Tyler Lacy", team: "DET",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4361861,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 54, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "tyler-owens", name: "Tyler Owens", team: "WSH",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4572460,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "tyquan-lewis", name: "Tyquan Lewis", team: "IND",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 3040513,
    attr: {
      speed: 58, power: 58, passRush: 58, runStop: 52, tackling: 51, strength: 57,
    },
    strengths: [],
    weaknesses: ["tackling","run defense"],
  },
  {
    id: "tyrion-ingram-dawkins", name: "Tyrion Ingram-Dawkins", team: "MIN",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4629149,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "tyrus-wheat", name: "Tyrus Wheat", team: "DET",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4689333,
    attr: {
      speed: 50, passRush: 47, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "tyus-bowser", name: "Tyus Bowser", team: "MIA",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3040037,
    attr: {
      speed: 55, passRush: 43, runStop: 51, tackling: 53, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "uchenna-nwosu", name: "Uchenna Nwosu", team: "SEA",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 3120358,
    attr: {
      speed: 50, passRush: 63, runStop: 55, tackling: 55, coverage: 47, ballHawk: 48, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "upton-stout", name: "Upton Stout", team: "SF",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 4565200,
    attr: {
      speed: 59, agility: 56, tackling: 74, coverage: 53, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "ventrell-miller", name: "Ventrell Miller", team: "JAX",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4240610,
    attr: {
      speed: 51, passRush: 45, runStop: 57, tackling: 56, coverage: 46, ballHawk: 48, awareness: 56,
    },
    strengths: [],
    weaknesses: ["pass rush","coverage"],
  },
  {
    id: "victor-dimukeje", name: "Victor Dimukeje", team: "NYG",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4240464,
    attr: {
      speed: 55, passRush: 41, runStop: 50, tackling: 52, coverage: 50, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "von-miller", name: "Von Miller", team: "WSH",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 13976,
    attr: {
      speed: 50, passRush: 80, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "vonn-bell", name: "Vonn Bell", team: "CIN",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 3051388,
    attr: {
      speed: 58, agility: 55, tackling: 63, coverage: 52, ballHawk: 50,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "warren-brinson", name: "Warren Brinson", team: "GB",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4429136,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 51, tackling: 51, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "will-harris", name: "Will Harris", team: "NO",
    position: "CB", overall: 58, tier: 4, startingBid: 2, espnId: 3915297,
    attr: {
      speed: 60, agility: 58, tackling: 78, coverage: 55, ballHawk: 52,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "will-mallory", name: "Will Mallory", team: "IND",
    position: "TE", overall: 58, tier: 4, startingBid: 2, espnId: 4362523,
    attr: {
      speed: 55, catching: 52, routeRunning: 49, separation: 49, contestedCatch: 50, yac: 51, runBlock: 62, passBlock: 60, clutch: 51,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "william-gholston", name: "William Gholston", team: "TB",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 16019,
    attr: {
      speed: 55, passRush: 49, runStop: 51, tackling: 53, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["ball skills","pass rush"],
  },
  {
    id: "willie-gay-jr", name: "Willie Gay Jr.", team: "MIA",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4259804,
    attr: {
      speed: 50, passRush: 52, runStop: 55, tackling: 55, coverage: 46, ballHawk: 46, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "winston-reid", name: "Winston Reid", team: "CLE",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4251125,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "woody-marks", name: "Woody Marks", team: "HOU",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4429059,
    attr: {
      speed: 57, agility: 55, power: 66, vision: 54, catching: 54, yac: 50, clutch: 56,
    },
    strengths: [],
    weaknesses: ["yards after catch","vision"],
  },
  {
    id: "xavier-gipson", name: "Xavier Gipson", team: "NYJ",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4427278,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "xavier-hutchinson", name: "Xavier Hutchinson", team: "HOU",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 4686422,
    attr: {
      speed: 75, catching: 50, routeRunning: 48, separation: 48, contestedCatch: 48, yac: 75, clutch: 50,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "xavier-legette", name: "Xavier Legette", team: "CAR",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 4430034,
    attr: {
      speed: 63, catching: 50, routeRunning: 50, separation: 49, contestedCatch: 48, yac: 60, clutch: 51,
    },
    strengths: [],
    weaknesses: ["contested catch","separation"],
  },
  {
    id: "xavier-thomas", name: "Xavier Thomas", team: "ARI",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4360304,
    attr: {
      speed: 57, power: 55, passRush: 57, runStop: 50, tackling: 50, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","tackling"],
  },
  {
    id: "xavier-weaver", name: "Xavier Weaver", team: "ARI",
    position: "WR", overall: 58, tier: 4, startingBid: 2, espnId: 4428811,
    attr: {
      speed: 58, catching: 51, routeRunning: 49, separation: 49, contestedCatch: 49, yac: 55, clutch: 51,
    },
    strengths: [],
    weaknesses: ["route running","separation"],
  },
  {
    id: "yahya-black", name: "Yahya Black", team: "PIT",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4430947,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 55, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "yannick-ngakoue", name: "Yannick Ngakoue", team: "BAL",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3053044,
    attr: {
      speed: 55, passRush: 51, runStop: 50, tackling: 52, coverage: 50, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["ball skills","coverage"],
  },
  {
    id: "yasir-abdullah", name: "Yasir Abdullah", team: "JAX",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4360807,
    attr: {
      speed: 50, passRush: 45, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","pass rush"],
  },
  {
    id: "yaya-diaby", name: "Yaya Diaby", team: "TB",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4686334,
    attr: {
      speed: 50, passRush: 63, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "yetur-gross-matos", name: "Yetur Gross-Matos", team: "SF",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4259594,
    attr: {
      speed: 57, power: 58, passRush: 58, runStop: 53, tackling: 50, strength: 58,
    },
    strengths: [],
    weaknesses: ["tackling","run defense"],
  },
  {
    id: "younghoe-koo", name: "Younghoe Koo", team: "ATL",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3049899,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "zacch-pickens", name: "Zacch Pickens", team: "KC",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 4426332,
    attr: {
      speed: 55, passRush: 48, runStop: 51, tackling: 52, coverage: 51, ballHawk: 49,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "zachary-carter", name: "Zachary Carter", team: "ARI",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4240619,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 50, tackling: 60, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
  },
  {
    id: "zack-moss", name: "Zack Moss", team: "CIN",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4035676,
    attr: {
      speed: 55, agility: 55, power: 57, vision: 53, catching: 66, yac: 51, clutch: 58,
    },
    strengths: [],
    weaknesses: ["yards after catch","vision"],
  },
  {
    id: "zaire-barnes", name: "Zaire Barnes", team: "NYG",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4362234,
    attr: {
      speed: 51, passRush: 47, runStop: 55, tackling: 55, coverage: 46, ballHawk: 46, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "zamir-white", name: "Zamir White", team: "LV",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4361777,
    attr: {
      speed: 55, agility: 55, power: 55, vision: 52, catching: 45, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "zaven-collins", name: "Zaven Collins", team: "ARI",
    position: "LB", overall: 58, tier: 4, startingBid: 2, espnId: 4244606,
    attr: {
      speed: 50, passRush: 52, runStop: 55, tackling: 55, coverage: 45, ballHawk: 45, awareness: 55,
    },
    strengths: [],
    weaknesses: ["coverage","ball skills"],
  },
  {
    id: "zavier-scott", name: "Zavier Scott", team: "MIN",
    position: "RB", overall: 58, tier: 4, startingBid: 2, espnId: 4257364,
    attr: {
      speed: 55, agility: 55, power: 55, vision: 52, catching: 50, yac: 50, clutch: 50,
    },
    strengths: [],
    weaknesses: ["hands","yards after catch"],
  },
  {
    id: "zayne-anderson", name: "Zayne Anderson", team: "MIA",
    position: "S", overall: 58, tier: 4, startingBid: 2, espnId: 3932335,
    attr: {
      speed: 55, passRush: 40, runStop: 50, tackling: 52, coverage: 50, ballHawk: 48,
    },
    strengths: [],
    weaknesses: ["pass rush","ball skills"],
  },
  {
    id: "zeek-biggers", name: "Zeek Biggers", team: "MIA",
    position: "EDGE", overall: 58, tier: 4, startingBid: 2, espnId: 4683276,
    attr: {
      speed: 55, power: 55, passRush: 55, runStop: 51, tackling: 58, strength: 55,
    },
    strengths: [],
    weaknesses: ["run defense","pass rush"],
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
