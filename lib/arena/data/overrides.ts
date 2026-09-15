/**
 * Manual audit overrides for the generated arena pool.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 * `players-2025-26.ts` is generated from real season stats (see
 * scripts/generate-arena-players.ts + ./derive-attributes.ts). A pure stat model
 * gets most players right but occasionally disagrees with the eye test — e.g. a
 * player's overall lands low relative to their skills, or a shooting rating is
 * miscalibrated for their archetype.
 *
 * This file captures those hand-reviewed corrections so they SURVIVE a
 * regeneration. The generator applies these on top of the derived values as its
 * final step, then recomputes tier + startingBid from any overridden `overall`.
 *
 * To add/adjust an override: add or edit an entry keyed by the player's id (the
 * slugified name, matching the `id` field in players-2025-26.ts). Set `overall`
 * to force a new overall; set individual `attr` values to force those attributes.
 * Everything you don't specify keeps its stat-derived value.
 */

import type { PlayerAttributes } from "../types"

export interface PlayerOverride {
  /** Force a new overall (0-99). Tier + startingBid are recomputed from this. */
  overall?: number
  /** Force specific attribute values (0-99). Unspecified attrs stay derived. */
  attr?: Partial<Record<keyof PlayerAttributes, number>>
  /** Optional note explaining the correction (for future maintainers). */
  note?: string
}

/**
 * id → override. Source: QA audit pass, 2025-26 season.
 * Kept intentionally sparse — only players where the stat model was clearly off.
 */
export const PLAYER_OVERRIDES: Record<string, PlayerOverride> = {
  // ── Overall raises (stat model undervalued two-way / high-usage impact) ──
  "shai-gilgeous-alexander": { overall: 93, note: "MVP-level 2025-26 production" },
  "luka-doncic": { overall: 92, attr: { freeThrow: 78 }, note: "league-leading scoring; FT was low vs 78% season FT" },
  "giannis-antetokounmpo": { overall: 91, attr: { freeThrow: 60, interiorDefense: 65 }, note: "overall understated two-way impact; FT too conservative" },
  "kawhi-leonard": { overall: 90, attr: { perimeterDefense: 82 }, note: "elite two-way when available" },
  "cade-cunningham": { overall: 87, note: "lead-guard creation underrepresented" },
  "jalen-duren": { overall: 86, attr: { rebounding: 88 }, note: "rebounding/finishing deserves more weight" },
  "tyrese-maxey": { overall: 87, note: "28+ PPG high-volume scoring + efficiency" },
  "alperen-sengun": { overall: 84, attr: { decisionMaking: 65 }, note: "offensive hub; 83 slightly conservative" },
  "donovan-mitchell": { overall: 84, note: "27.9 PPG elite scoring tier" },
  "chet-holmgren": { overall: 84, note: "elite defense + finishing/shooting combo" },
  "jalen-johnson": { overall: 84, note: "playmaking/size/transition impact" },
  "kevin-durant": { overall: 84, note: "26 PPG, 41.3% 3P, 58.8 eFG" },
  "anthony-edwards": { overall: 84, note: "28.8 PPG, ~40% 3P" },
  "deni-avdija": { overall: 84, attr: { threePointShooting: 76 }, note: "breakout scoring/playmaking; shooting too low" },
  "karl-anthony-towns": { overall: 84, attr: { rebounding: 90 }, note: "11.9 RPG makes rebounding too low" },
  "stephen-curry": { overall: 83, note: "shooting/FT/efficiency too strong for 81" },
  "evan-mobley": { overall: 83, note: "defensive impact + efficient finishing" },
  "jaylen-brown": { overall: 85, note: "28.7 PPG two-way production" },
  "lebron-james": { overall: 82, note: "passing/IQ/clutch combination" },
  "amen-thompson": { overall: 80, note: "elite athletic/defensive upside" },
  "austin-reaves": { overall: 80, note: "efficient scoring + strong FT/decisions" },
  "derrick-white": { overall: 79, note: "two-way guard slightly under-rated" },
  "jalen-brunson": { overall: 81, note: "26 PPG + strong playmaking" },
  "jarrett-allen": { overall: 79, note: "elite finishing/efficiency/rebounding" },
  "ausar-thompson": { overall: 79, attr: { threePointShooting: 55 }, note: "defense/steals/athleticism; 43 3PT too harsh" },
  "bam-adebayo": { overall: 80, note: "two-way center undervalued" },
  "devin-booker": { overall: 81, attr: { threePointShooting: 76 }, note: "26.1 PPG + elite FT/scoring" },
  "josh-giddey": { overall: 79, note: "92/91 playmaking-passing + rebounding" },
  "rudy-gobert": { overall: 78, note: "rebounding/rim protection" },
  "deaaron-fox": { overall: 78, note: "lead-guard scoring/creation underweighted" },
  "lauri-markkanen": { overall: 78, note: "elite shooting/scoring" },
  "trey-murphy-iii": { overall: 78, note: "efficient scoring + shooting" },
  "anthony-davis": { overall: 80, note: "attribute profile far too good for 75" },
  "franz-wagner": { overall: 79, note: "scoring/efficiency/size under-rated" },
  "jalen-williams": { overall: 82, note: "scoring/playmaking/decisions shouldn't yield 75" },
  "jayson-tatum": { overall: 83, note: "largest overall mismatch; attributes support higher tier" },
  "paolo-banchero": { overall: 79, note: "scoring/playmaking/rebounding under-rated" },
  "pascal-siakam": { overall: 76, note: "24.0 PPG" },
  "trae-young": { overall: 79, attr: { threePointShooting: 73 }, note: "92/91 playmaking can't sit at 72; shooting undershoots" },
  "mikal-bridges": { overall: 74, note: "two-way durability/defense/shooting" },
  "myles-turner": { overall: 75, note: "81 rim protection + 80 3PT modern center" },
  "coby-white": { overall: 71, note: "scoring/3PT/playmaking" },
  "desmond-bane": { overall: 75, note: "major scoring/shooting mismatch" },
  "draymond-green": { overall: 74, note: "elite passing/defensive IQ shouldn't land at 68" },
  "ja-morant": { overall: 73, note: "high-end downhill creator, 89 playmaking" },
  "jaden-ivey": { overall: 71, note: "athleticism/FT/3PT" },

  // ── Overall lower ──
  "neemias-queta": { overall: 77, note: "overstates offensive/decision impact for his role" },

  // ── Attribute fixes (shooting ratings miscalibrated for archetype) ──
  "jamal-murray": { overall: 82, attr: { threePointShooting: 82, freeThrow: 90 }, note: "93 3PT overstated actual shooting" },
  "james-harden": { overall: 82, attr: { threePointShooting: 77 }, note: "still elite passer; shooting a little low" },
  "donovan-clingan": { attr: { threePointShooting: 25, rebounding: 87 }, note: "perimeter shooting far too high for archetype" },
  "ty-jerome": { attr: { threePointShooting: 87 }, note: "93 too close to elite marksman tier" },
  "kon-knueppel": { attr: { threePointShooting: 87 }, note: "93 excessive for a rookie rating" },
  "payton-pritchard": { attr: { threePointShooting: 87 }, note: "shooting specialist grade should be higher" },
  "walker-kessler": { attr: { threePointShooting: 28 }, note: "3PT inconsistent with player archetype" },
  "miles-mcbride": { attr: { threePointShooting: 82 }, note: "91 too high vs league scale" },
  "luke-kennard": { attr: { threePointShooting: 88 }, note: "one of the league's best pure shooters" },
  "buddy-hield": { attr: { threePointShooting: 82 }, note: "career-level movement/spot-up shooting" },
}
