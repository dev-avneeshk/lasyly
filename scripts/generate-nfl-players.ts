/**
 * Generate lib/nfl/data/players-2025.ts for the FULL NFL player pool.
 *
 * Pulls every player in nfl_player_stats, aggregates their season stats, derives
 * the position-relevant attributes (see lib/nfl/data/derive-attributes.ts),
 * applies hand-reviewed overrides, resolves ESPN headshot ids, and writes a
 * complete NflPlayer[] data file. Mirrors scripts/generate-arena-players.ts.
 *
 * Run:  npx tsx scripts/generate-nfl-players.ts
 *
 * Output is a generated artifact — do not hand-edit it; edit ./overrides.ts or
 * the deriver and re-run this script instead.
 */

import { config } from "dotenv"
config({ path: ".env.local" })

import { writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { createAdminClient } from "../lib/supabase/admin"
import {
  derivePlayer,
  deriveTier,
  deriveStartingBid,
  type NflStatTotals,
} from "../lib/nfl/data/derive-attributes"
import { PLAYER_OVERRIDES } from "../lib/nfl/data/overrides"

const SEASON = "2025"
const PAGE = 1000

/**
 * Minimum games played to be included. NFL box-score data spans multiple
 * seasons, so this filters the long tail of one-off / practice-squad
 * appearances down to real, rosterable contributors while still keeping a deep
 * pool. (Kept generous so backups and rotational players are still draftable.)
 */
const MIN_GAMES = 8

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0)

async function main() {
  const supabase = createAdminClient()

  // 1. Pull all stat rows.
  const rows: any[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("nfl_player_stats")
      .select("player_name, athlete_id, team, position, game_date, pass_yds, pass_td, pass_int, pass_c, pass_att, rush_att, rush_yds, rush_td, rec, rec_yds, rec_td, targets, tackles_total, sacks, tackles_tfl, passes_def, def_int, def_td, fumbles_lost")
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  console.log("stat rows:", rows.length)

  // 2. Aggregate per player.
  interface Agg {
    name: string
    athleteId: number | null
    team: string
    rawPosition: string | null
    posCounts: Map<string, number>
    totals: NflStatTotals
  }
  const byPlayer = new Map<string, Agg>()
  for (const r of rows) {
    const name = r.player_name as string
    if (!name) continue
    let e = byPlayer.get(name)
    if (!e) {
      e = {
        name,
        athleteId: r.athlete_id != null ? Number(r.athlete_id) : null,
        team: r.team ?? "",
        rawPosition: r.position ?? null,
        posCounts: new Map(),
        totals: {
          games: 0, passYds: 0, passTd: 0, passInt: 0, passC: 0, passAtt: 0,
          rushAtt: 0, rushYds: 0, rushTd: 0, rec: 0, recYds: 0, recTd: 0, targets: 0,
          tacklesTotal: 0, sacks: 0, tacklesTfl: 0, passesDef: 0, defInt: 0, defTd: 0, fumblesLost: 0,
        },
      }
      byPlayer.set(name, e)
    }
    const t = e.totals
    t.games += 1
    t.passYds += n(r.pass_yds); t.passTd += n(r.pass_td); t.passInt += n(r.pass_int)
    t.passC += n(r.pass_c); t.passAtt += n(r.pass_att)
    t.rushAtt += n(r.rush_att); t.rushYds += n(r.rush_yds); t.rushTd += n(r.rush_td)
    t.rec += n(r.rec); t.recYds += n(r.rec_yds); t.recTd += n(r.rec_td); t.targets += n(r.targets)
    t.tacklesTotal += n(r.tackles_total); t.sacks += n(r.sacks); t.tacklesTfl += n(r.tackles_tfl)
    t.passesDef += n(r.passes_def); t.defInt += n(r.def_int); t.defTd += n(r.def_td)
    t.fumblesLost += n(r.fumbles_lost)
    // Track the most recent team + most common position token.
    if (r.team) e.team = r.team
    if (r.position) e.posCounts.set(r.position, (e.posCounts.get(r.position) ?? 0) + 1)
    if (r.athlete_id != null && e.athleteId == null) e.athleteId = Number(r.athlete_id)
  }
  console.log("distinct players:", byPlayer.size)

  // 3. Derive each; keep only draftable skill/defense players with enough games.
  const usedIds = new Set<string>()
  const built: any[] = []
  let skippedPos = 0
  let skippedGames = 0
  let overridesApplied = 0

  for (const e of byPlayer.values()) {
    if (e.totals.games < MIN_GAMES) { skippedGames++; continue }
    // Most common position token becomes the raw position.
    let rawPos = e.rawPosition
    if (e.posCounts.size) rawPos = [...e.posCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]

    const derived = derivePlayer({ totals: e.totals, rawPosition: rawPos })
    if (!derived) { skippedPos++; continue }

    let id = slugify(e.name)
    let suffix = 2
    while (usedIds.has(id)) id = `${slugify(e.name)}-${suffix++}`
    usedIds.add(id)

    let overall = derived.overall
    let tier = derived.tier
    let startingBid = derived.startingBid
    const attr = { ...derived.attr }
    const ov = PLAYER_OVERRIDES[id]
    if (ov) {
      overridesApplied++
      if (ov.overall != null) { overall = ov.overall; tier = deriveTier(overall); startingBid = deriveStartingBid(tier) }
      if (ov.attr) for (const [k, v] of Object.entries(ov.attr)) (attr as any)[k] = v
    }

    built.push({
      id,
      name: e.name,
      team: e.team || "Free Agent",
      position: derived.position,
      overall,
      tier,
      startingBid,
      espnId: e.athleteId ?? undefined,
      attr,
      strengths: derived.strengths,
      weaknesses: derived.weaknesses,
    })
  }

  built.sort((a, b) => b.overall - a.overall || a.name.localeCompare(b.name))

  const withHead = built.filter((p) => p.espnId != null).length
  console.log(`built ${built.length} players | skipped: ${skippedGames} (games<${MIN_GAMES}), ${skippedPos} (non-draftable pos)`)
  console.log(`headshots: ${withHead}/${built.length} | overrides: ${overridesApplied}/${Object.keys(PLAYER_OVERRIDES).length}`)
  const tierCounts = built.reduce((m, p) => ((m[p.tier] = (m[p.tier] ?? 0) + 1), m), {} as Record<number, number>)
  const posCounts = built.reduce((m, p) => ((m[p.position] = (m[p.position] ?? 0) + 1), m), {} as Record<string, number>)
  console.log("tier distribution:", tierCounts)
  console.log("position distribution:", posCounts)

  writeFile(built)
  console.log("wrote lib/nfl/data/players-2025.ts")
}

function writeFile(players: any[]) {
  const ATTR_KEYS = [
    "armStrength", "shortAccuracy", "deepAccuracy", "pocketAwareness", "decisionMaking",
    "speed", "agility", "power", "vision",
    "catching", "routeRunning", "separation", "contestedCatch", "yac",
    "runBlock", "passBlock", "passRush", "runStop", "tackling", "strength",
    "coverage", "ballHawk", "awareness", "stamina", "consistency", "clutch", "mobility",
  ] as const

  const body = players
    .map((p) => {
      const espn = p.espnId != null ? ` espnId: ${p.espnId},` : ""
      const attrPairs = ATTR_KEYS.filter((k) => p.attr[k] != null).map((k) => `${k}: ${p.attr[k]}`)
      const attrStr = attrPairs.length ? `\n      ${attrPairs.join(", ")},\n    ` : ""
      return `  {
    id: ${JSON.stringify(p.id)}, name: ${JSON.stringify(p.name)}, team: ${JSON.stringify(p.team)},
    position: ${JSON.stringify(p.position)}, overall: ${p.overall}, tier: ${p.tier}, startingBid: ${p.startingBid},${espn}
    attr: {${attrStr}},
    strengths: ${JSON.stringify(p.strengths)},
    weaknesses: ${JSON.stringify(p.weaknesses)},
  },`
    })
    .join("\n")

  const fileHead = `/**
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
${body}
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
`

  writeFileSync(resolve("lib/nfl/data/players-2025.ts"), fileHead)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
