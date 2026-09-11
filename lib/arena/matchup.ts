/**
 * MatchupEngine — assigns individual defensive matchups between the two
 * starting fives and scores the advantages/mismatches.
 *
 * Matchups are assigned by position where possible (PG guards PG, etc.), which
 * is how basketball actually works, and then each offensive player's edge over
 * their defender is computed. The simulation uses these edges per possession;
 * the analyzer surfaces the biggest mismatches ("Team 2 hunted the Luka vs
 * small-guard switch").
 */

import type { OwnedPlayer, Position, RosterState, SeasonPlayer } from "./types"
import { starters } from "./roster"
import { POSITIONS } from "./types"

const A = (p: SeasonPlayer) => p.attributes

export interface Matchup {
  offense: SeasonPlayer
  defense: SeasonPlayer
  position: Position
  /** Positive = offense has the edge; negative = defender wins. Roughly -40..40 */
  edge: number
  kind: "iso" | "post" | "shooting" | "speed" | "size" | "even"
  note: string
}

/** Map each starter to the position slot they were drafted into. */
function startersBySlot(roster: RosterState): Record<Position, OwnedPlayer | null> {
  const out: Record<Position, OwnedPlayer | null> = {
    PG: null, SG: null, SF: null, PF: null, C: null,
  }
  for (const o of starters(roster)) {
    if (o.slot !== "BENCH") out[o.slot as Position] = o
  }
  return out
}

/**
 * Offensive edge of `off` attacking `def`. Considers the dominant way `off`
 * scores vs the relevant defensive resistance, plus physical mismatches
 * (speed vs slow defender; strength/size vs small defender).
 */
export function matchupEdge(
  off: SeasonPlayer,
  def: SeasonPlayer
): { edge: number; kind: Matchup["kind"]; note: string } {
  const ao = A(off)
  const ad = A(def)

  // Identify the offensive player's primary weapon.
  const weapons: { kind: Matchup["kind"]; off: number; def: number }[] = [
    { kind: "shooting", off: ao.threePointShooting * 0.6 + ao.midrange * 0.4, def: ad.perimeterDefense },
    { kind: "iso", off: ao.scoring * 0.5 + ao.ballHandling * 0.5, def: ad.perimeterDefense * 0.6 + ad.athleticism * 0.4 },
    { kind: "post", off: ao.finishing * 0.5 + ao.strength * 0.5, def: ad.interiorDefense * 0.6 + ad.strength * 0.4 },
    { kind: "speed", off: ao.speed * 0.6 + ao.finishing * 0.4, def: ad.perimeterDefense * 0.5 + ad.speed * 0.5 },
  ]
  // Pick the weapon with the biggest raw offensive rating (their identity),
  // then measure the edge against the matching defensive resistance.
  weapons.sort((a, b) => b.off - a.off)
  const primary = weapons[0]

  // Physical mismatch modifiers.
  let physical = 0
  if (ao.speed - ad.speed > 15) physical += (ao.speed - ad.speed) * 0.2 // blow-by
  if (ao.strength - ad.strength > 15 && ao.finishing > 70) physical += (ao.strength - ad.strength) * 0.15 // bully ball
  // Rim protection blunts finishing.
  const rimTax = primary.kind === "speed" || primary.kind === "post" ? ad.rimProtection * 0.12 : 0

  let edge = (primary.off - primary.def) * 0.6 + physical - rimTax
  edge = Math.max(-40, Math.min(40, edge))

  const note = describeMatchup(off, def, primary.kind, edge)
  const kind: Matchup["kind"] = Math.abs(edge) < 6 ? "even" : primary.kind
  return { edge, kind, note }
}

function describeMatchup(
  off: SeasonPlayer,
  def: SeasonPlayer,
  kind: Matchup["kind"],
  edge: number
): string {
  if (Math.abs(edge) < 6) return `${off.name} vs ${def.name} is an even matchup.`
  const winner = edge > 0 ? off.name : def.name
  const loser = edge > 0 ? def.name : off.name
  if (edge > 0) {
    switch (kind) {
      case "shooting": return `${winner} has a shooting edge — ${loser} can't contest cleanly.`
      case "iso": return `${winner} can isolate ${loser} off the dribble.`
      case "post": return `${winner} can punish ${loser} in the post.`
      case "speed": return `${winner} is too quick for ${loser} off the bounce.`
      default: return `${winner} has the advantage over ${loser}.`
    }
  }
  return `${winner} locks up ${loser} on the perimeter.`
}

export interface MatchupSet {
  matchups: Matchup[]
  /** Net edge for the team (sum of favorable minus unfavorable). */
  netEdge: number
}

/**
 * Assign matchups for `offense` team attacking `defense` team, position vs
 * position. Where a slot is missing (shouldn't happen with full rosters) we
 * fall back to nearest available defender.
 */
export function assignMatchups(
  offRoster: RosterState,
  defRoster: RosterState
): MatchupSet {
  const offBySlot = startersBySlot(offRoster)
  const defBySlot = startersBySlot(defRoster)
  const defList = starters(defRoster)

  const matchups: Matchup[] = []
  let net = 0
  for (const pos of POSITIONS) {
    const off = offBySlot[pos]
    if (!off) continue
    let def = defBySlot[pos]
    if (!def) def = defList[0] ?? null
    if (!def) continue
    const { edge, kind, note } = matchupEdge(off.player, def.player)
    matchups.push({ offense: off.player, defense: def.player, position: pos, edge, kind, note })
    net += edge
  }
  return { matchups, netEdge: net }
}
