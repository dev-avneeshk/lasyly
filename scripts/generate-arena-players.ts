/**
 * Generate lib/arena/data/players-2025-26.ts for the FULL player pool.
 *
 * Pulls every player in nba_players, joins their 2025-26 per_game + advanced
 * season stats from nba_player_season_stats, derives the 24 arena attributes
 * (see ./lib/arena/data/derive-attributes.ts), and writes a complete
 * SeasonPlayer[] data file.
 *
 * Run:  npx tsx scripts/generate-arena-players.ts
 *
 * The output file is a generated artifact — do not hand-edit it; re-run this
 * script instead (or tune the deriver / overrides below).
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
  type DerivationInput,
  type PerGameStats,
  type AdvancedStats,
} from "../lib/arena/data/derive-attributes"
import { PLAYER_OVERRIDES } from "../lib/arena/data/overrides"
// Official NBA person ids for headshots, keyed by our slug id. Generated for the
// FULL pool by scripts/resolve-nba-ids.ts (run that after adding players).
import { NBA_IDS } from "../lib/arena/data/nba-ids"

const SEASON = "2025-26"
const PAGE = 1000

/** Team abbreviation → full name for display. Falls back to the abbrev. */
const TEAM_NAMES: Record<string, string> = {
  ATL: "Atlanta Hawks", BOS: "Boston Celtics", BRK: "Brooklyn Nets", BKN: "Brooklyn Nets",
  CHO: "Charlotte Hornets", CHA: "Charlotte Hornets", CHI: "Chicago Bulls", CLE: "Cleveland Cavaliers",
  DAL: "Dallas Mavericks", DEN: "Denver Nuggets", DET: "Detroit Pistons", GSW: "Golden State Warriors",
  HOU: "Houston Rockets", IND: "Indiana Pacers", LAC: "LA Clippers", LAL: "Los Angeles Lakers",
  MEM: "Memphis Grizzlies", MIA: "Miami Heat", MIL: "Milwaukee Bucks", MIN: "Minnesota Timberwolves",
  NOP: "New Orleans Pelicans", NYK: "New York Knicks", OKC: "Oklahoma City Thunder", ORL: "Orlando Magic",
  PHI: "Philadelphia 76ers", PHO: "Phoenix Suns", PHX: "Phoenix Suns", POR: "Portland Trail Blazers",
  SAC: "Sacramento Kings", SAS: "San Antonio Spurs", TOR: "Toronto Raptors", UTA: "Utah Jazz",
  WAS: "Washington Wizards",
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

const norm = (s: string) =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")

// Some seasons include synthetic aggregate rows in nba_player_season_stats
// (e.g. a "League Average" baseline) that are NOT real players and must never
// enter the auction pool. Filter them by normalized name.
const NON_PLAYER_NAMES = new Set(["leagueaverage"])
const isNonPlayerRow = (name: string) => NON_PLAYER_NAMES.has(norm(name))

async function fetchAllPaged<T>(
  run: (from: number, to: number) => PromiseLike<{ data: T[] | null }>
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data } = await run(from, from + PAGE - 1)
    out.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return out
}

async function main() {
  const supabase = createAdminClient()

  // Season stats (per_game, advanced) for 2025-26 regular season. The season
  // stats table — NOT nba_players — is the authoritative roster of who actually
  // played: it's more complete (includes stars missing from the identity table,
  // e.g. Jokić, Dončić) and every entry has real stats to derive from.
  const perGameRows = await fetchAllPaged<any>((from, to) =>
    supabase
      .from("nba_player_season_stats")
      .select("player_name, team, position, games, stats")
      .eq("season", SEASON)
      .eq("stat_type", "per_game")
      .eq("is_playoff", false)
      .range(from, to)
  )
  const advRows = await fetchAllPaged<any>((from, to) =>
    supabase
      .from("nba_player_season_stats")
      .select("player_name, stats")
      .eq("season", SEASON)
      .eq("stat_type", "advanced")
      .eq("is_playoff", false)
      .range(from, to)
  )
  console.log("per_game rows:", perGameRows.length, "| advanced rows:", advRows.length)

  // For players traded mid-season there can be multiple rows (per team + a TOT
  // row). Prefer the row with the most minutes (mp_per_g) as the representative.
  const perGameByName = new Map<string, any>()
  for (const r of perGameRows) {
    if (isNonPlayerRow(r.player_name)) continue
    const mp = Number(r.stats?.mp_per_g) || 0
    const prev = perGameByName.get(norm(r.player_name))
    if (!prev || mp > (Number(prev.stats?.mp_per_g) || 0)) perGameByName.set(norm(r.player_name), r)
  }
  const advByName = new Map<string, any>()
  for (const r of advRows) {
    const mp = Number(r.stats?.mp) || 0
    const prev = advByName.get(norm(r.player_name))
    if (!prev || mp > (Number(prev.stats?.mp) || 0)) advByName.set(norm(r.player_name), r)
  }

  // Derive each distinct player (from the deduped per_game rows).
  const usedIds = new Set<string>()
  const built: any[] = []
  let overridesApplied = 0

  const players = [...perGameByName.values()].sort((a, b) =>
    String(a.player_name).localeCompare(String(b.player_name))
  )

  for (const pgRow of players) {
    const key = norm(pgRow.player_name)
    const advRow = advByName.get(key)

    const perGame = (pgRow?.stats ?? null) as PerGameStats | null
    const advanced = (advRow?.stats ?? null) as AdvancedStats | null

    const input: DerivationInput = {
      perGame,
      advanced,
      position: pgRow.position ?? null,
      games: pgRow ? Number(pgRow.games) : null,
    }
    const derived = derivePlayer(input)

    // Stable, unique id.
    let id = slugify(pgRow.player_name)
    let suffix = 2
    while (usedIds.has(id)) id = `${slugify(pgRow.player_name)}-${suffix++}`
    usedIds.add(id)

    const teamAbbr = (pgRow?.team ?? "").toUpperCase()
    const team = TEAM_NAMES[teamAbbr] ?? (teamAbbr || "Free Agent")

    // Apply hand-reviewed audit overrides ON TOP of the derived values, so they
    // survive regeneration. An overridden `overall` re-derives tier + bid.
    let overall = derived.overall
    let tier = derived.tier
    let startingBid = derived.startingBid
    const attributes = { ...derived.attributes }
    const override = PLAYER_OVERRIDES[id]
    if (override) {
      overridesApplied++
      if (override.overall != null) {
        overall = override.overall
        tier = deriveTier(overall)
        startingBid = deriveStartingBid(tier)
      }
      if (override.attr) {
        for (const [k, v] of Object.entries(override.attr)) {
          ;(attributes as any)[k] = v
        }
      }
    }

    built.push({
      id,
      name: pgRow.player_name,
      team,
      primaryPosition: derived.primaryPosition,
      secondaryPositions: derived.secondaryPositions,
      overall,
      tier,
      startingBid,
      nbaId: NBA_IDS[id],
      attributes,
      strengths: derived.strengths,
      weaknesses: derived.weaknesses,
    })
  }

  // Sort by overall desc so the file reads nicely (tier 1 first).
  built.sort((a, b) => b.overall - a.overall || a.name.localeCompare(b.name))

  console.log(`built ${built.length} players | ${overridesApplied}/${Object.keys(PLAYER_OVERRIDES).length} overrides applied`)
  const overrideMisses = Object.keys(PLAYER_OVERRIDES).filter((id) => !built.some((p) => p.id === id))
  if (overrideMisses.length) console.log("WARNING — override ids not matched:", overrideMisses.join(", "))
  const tierCounts = built.reduce((m, p) => ((m[p.tier] = (m[p.tier] ?? 0) + 1), m), {} as Record<number, number>)
  console.log("tier distribution:", tierCounts)

  writeFile(built)
  console.log("wrote lib/arena/data/players-2025-26.ts")
}

function writeFile(players: any[]) {
  const body = players
    .map((p) => {
      const a = p.attributes
      const nbaId = p.nbaId != null ? `\n    nbaId: ${p.nbaId},` : ""
      return `  {
    id: ${JSON.stringify(p.id)},
    name: ${JSON.stringify(p.name)},
    team: ${JSON.stringify(p.team)},
    primaryPosition: ${JSON.stringify(p.primaryPosition)},
    secondaryPositions: ${JSON.stringify(p.secondaryPositions)},
    overall: ${p.overall},
    tier: ${p.tier},
    startingBid: ${p.startingBid},${nbaId}
    attr: {
      scoring: ${a.scoring}, threePointShooting: ${a.threePointShooting}, midrange: ${a.midrange}, finishing: ${a.finishing}, freeThrow: ${a.freeThrow},
      playmaking: ${a.playmaking}, ballHandling: ${a.ballHandling}, passing: ${a.passing}, rebounding: ${a.rebounding},
      interiorDefense: ${a.interiorDefense}, perimeterDefense: ${a.perimeterDefense}, rimProtection: ${a.rimProtection}, steal: ${a.steal}, block: ${a.block},
      speed: ${a.speed}, athleticism: ${a.athleticism}, strength: ${a.strength}, stamina: ${a.stamina},
      clutch: ${a.clutch}, basketballIQ: ${a.basketballIQ}, decisionMaking: ${a.decisionMaking}, usage: ${a.usage}, efficiency: ${a.efficiency}, turnoverRisk: ${a.turnoverRisk},
    },
    strengths: ${JSON.stringify(p.strengths)},
    weaknesses: ${JSON.stringify(p.weaknesses)},
  },`
    })
    .join("\n")

  const fileHead = `/**
 * 2025-26 NBA player pool for the Auction Arena — FULL POOL (generated).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * GENERATED FILE — DO NOT HAND-EDIT.
 * ─────────────────────────────────────────────────────────────────────────────
 * Produced by scripts/generate-arena-players.ts from real 2025-26 season stats
 * (nba_player_season_stats: per_game + advanced) run through the attribute
 * deriver in ./derive-attributes.ts, with hand-reviewed corrections from
 * ./overrides.ts applied on top. To change a rating permanently, edit
 * ./overrides.ts (NOT this file) and regenerate:
 *
 *     npx tsx scripts/generate-arena-players.ts
 *
 * Ratings are DESIGNER ESTIMATES derived from production stats — a game-balance
 * model, not official statistics. Attributes are on a 0-99 scale.
 */

import type { SeasonPlayer, PlayerAttributes, Position, PlayerTier } from "../types"

const SEASON = "2025-26"

const BASE: PlayerAttributes = {
  scoring: 60, threePointShooting: 55, midrange: 55, finishing: 60, freeThrow: 70,
  playmaking: 50, ballHandling: 55, passing: 55, rebounding: 50,
  interiorDefense: 55, perimeterDefense: 55, rimProtection: 45, steal: 50, block: 40,
  speed: 65, athleticism: 65, strength: 60, stamina: 75,
  clutch: 60, basketballIQ: 65, decisionMaking: 65, usage: 55, efficiency: 60, turnoverRisk: 40,
}

interface RawPlayer {
  id: string
  name: string
  team: string
  primaryPosition: Position
  secondaryPositions?: Position[]
  overall: number
  tier: PlayerTier
  startingBid: number
  nbaId?: number
  attr: Partial<PlayerAttributes>
  strengths: string[]
  weaknesses: string[]
}

const RAW: RawPlayer[] = [
${body}
]

function build(raw: RawPlayer): SeasonPlayer {
  return {
    id: raw.id,
    name: raw.name,
    team: raw.team,
    season: SEASON,
    primaryPosition: raw.primaryPosition,
    secondaryPositions: raw.secondaryPositions ?? [],
    overall: raw.overall,
    tier: raw.tier,
    startingBid: raw.startingBid,
    nbaId: raw.nbaId,
    attributes: { ...BASE, ...raw.attr },
    strengths: raw.strengths,
    weaknesses: raw.weaknesses,
  }
}

export const PLAYERS_2025_26: SeasonPlayer[] = RAW.map(build)
`

  writeFileSync(resolve("lib/arena/data/players-2025-26.ts"), fileHead)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
