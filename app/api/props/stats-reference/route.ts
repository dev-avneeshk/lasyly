/**
 * GET /api/props/stats-reference
 *
 * Returns detailed stats reference data for a given player and stat category.
 * Used by the StatsPanel component to display raw stats, derived metrics,
 * league averages, and prop-specific cheat sheets.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10
 */

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cached } from "@/lib/cache"
import { withSecurity, checkQueryParams, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { computeDerivedStats, roundTo, type DerivedStatsInput } from "@/lib/analytics/derived-stats"
import { getCheatSheet } from "@/lib/analytics/cheat-sheet"

// ─── Constants ──────────────────────────────────────────────────────────────

/** Cache TTL: 5 minutes */
const STATS_REFERENCE_CACHE_TTL = 300_000

/** Maximum player name length */
const MAX_PLAYER_LENGTH = 100

/** Minimum games required for derived stats */
const MIN_GAMES_FOR_DERIVED = 3

/** Valid stat categories for this endpoint */
const VALID_STAT_CATEGORIES = new Set(["pts", "trb", "ast", "tp", "stl", "blk", "pra"])

/** Maps stat categories to cheat sheet prop types */
const STAT_TO_PROP_TYPE: Record<string, string> = {
  pts: "points",
  trb: "rebounds",
  ast: "assists",
  pra: "pra",
  tp: "threes",
  stl: "steals",
  blk: "blocks",
}

/** Maps stat categories to nba_team_defense_stats stat_category values */
const STAT_TO_DEFENSE_CATEGORY: Record<string, string> = {
  pts: "pts",
  trb: "trb",
  ast: "ast",
  tp: "tp",
  stl: "stl",
  blk: "blk",
  pra: "pts", // PRA uses pts as primary defense category
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface RawStatsData {
  shooting: {
    fgaPerGame: number
    ftaPerGame: number
    ftmPerGame: number
    ftPct: number
    tpaPerGame: number
    tpmPerGame: number
    tpPct: number
    ptsPerGame: number
  }
  shotDistribution: {
    fgaPct0_3ft: number | null
    fgaPct3_10ft: number | null
    fgaPct10_16ft: number | null
    fgaPct16_3pt: number | null
    fgaPct3pt: number | null
    pct2pAssisted: number | null
    pct3pAssisted: number | null
  }
  rebounding: {
    trbPct: number | null
    orbPct: number | null
    drbPct: number | null
  }
  playmaking: {
    astPct: number | null
    astPerGame: number
    tovPerGame: number
    astTovRatio: number | null
    pgaPerGame: number | null
  }
  defense: {
    stlPerGame: number
    blkPerGame: number
  }
}

interface CheatSheetStat {
  key: string
  label: string
  category: "primary" | "secondary" | "context"
  explanation: string
  value: number | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Computes the arithmetic mean of an array of numbers.
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/**
 * Safely computes a ratio, returning null if denominator is 0.
 */
function safeRatio(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  return numerator / denominator
}

// ─── Route Handler ──────────────────────────────────────────────────────────

export const GET = withSecurity(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const player = searchParams.get("player")
  const stat = searchParams.get("stat")

  // ─── Injection Check ────────────────────────────────────────────────────────
  const injectionCheck = checkQueryParams({
    player: searchParams.get("player"),
    stat: searchParams.get("stat"),
  })
  if (injectionCheck) return injectionCheck

  // ─── Validate player param ──────────────────────────────────────────────────
  if (!player || player.trim().length === 0) {
    return NextResponse.json(
      {
        error: "Invalid player parameter: player name is required.",
        code: "VALIDATION_ERROR",
      },
      { status: 400 }
    )
  }

  if (player.length > MAX_PLAYER_LENGTH) {
    return NextResponse.json(
      {
        error: `Invalid player parameter: player name must not exceed ${MAX_PLAYER_LENGTH} characters.`,
        code: "VALIDATION_ERROR",
      },
      { status: 400 }
    )
  }

  // ─── Validate stat param ────────────────────────────────────────────────────
  if (!stat || stat.trim().length === 0) {
    return NextResponse.json(
      {
        error: "Invalid stat parameter: stat category is required.",
        code: "VALIDATION_ERROR",
      },
      { status: 400 }
    )
  }

  if (!VALID_STAT_CATEGORIES.has(stat.toLowerCase())) {
    return NextResponse.json(
      {
        error: `Invalid stat parameter: "${stat}" is not a valid stat category. Allowed values: ${[...VALID_STAT_CATEGORIES].join(", ")}.`,
        code: "VALIDATION_ERROR",
      },
      { status: 400 }
    )
  }

  const normalizedStat = stat.toLowerCase()
  const isPlayoff = searchParams.get("playoff") === "true"

  // ─── Fetch data with caching ────────────────────────────────────────────────
  const cacheKey = `stats-reference:${player.toLowerCase()}:${normalizedStat}:${isPlayoff ? "playoff" : "reg"}`

  const result = await cached(cacheKey, async () => {
    return fetchStatsReferenceData(player, normalizedStat, isPlayoff)
  }, STATS_REFERENCE_CACHE_TTL)

  // Handle not found
  if (result === null) {
    return NextResponse.json(
      {
        error: "Player not found",
        code: "NOT_FOUND",
      },
      { status: 404 }
    )
  }

  return NextResponse.json(result)
}, { cacheControl: CACHE_CONTROL.PUBLIC_SHORT })

// ─── Data Fetching Logic ────────────────────────────────────────────────────

async function fetchStatsReferenceData(player: string, stat: string, isPlayoff: boolean = false) {
  const supabase = createAdminClient()

  // 1. Query last 20 games from nba_player_stats ordered by game date descending
  const { data: playerGames, error: playerError } = await supabase
    .from("nba_player_stats")
    .select(`
      player_name,
      team,
      opponent,
      position,
      minutes,
      pts,
      trb,
      ast,
      tp,
      tpa,
      stl,
      blk,
      fg,
      fga,
      ft,
      fta,
      ft_pct,
      tp_pct,
      tov,
      orb,
      drb,
      nba_games!inner(game_date, home_team, away_team)
    `)
    .ilike("player_name", player)
    .order("nba_games(game_date)", { ascending: false })
    .limit(30)

  if (playerError) {
    console.error("[stats-reference] Failed to fetch player stats:", playerError.message)
    throw new Error("Database query failed")
  }

  if (!playerGames || playerGames.length === 0) {
    return null // Player not found
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const games = playerGames as any[]
  const gameCount = games.length
  const playerName = games[0].player_name as string
  const team = games[0].team as string
  const position = (games[0].position as string) || null

  // 2. Compute per-game averages from the games
  const rawStats = computeRawStats(games)

  // 3. Check insufficient data
  const insufficientData = gameCount < MIN_GAMES_FOR_DERIVED

  // 4. Query nba_player_advanced_stats for shooting distribution and advanced metrics
  const { data: advancedStats } = await supabase
    .from("nba_player_advanced_stats")
    .select("*")
    .ilike("player_name", player)
    .order("season", { ascending: false })
    .limit(1)

  // 4b. Query nba_player_season_stats for shooting zone FG% data
  const { data: shootingStats } = await supabase
    .from("nba_player_season_stats")
    .select("stats")
    .ilike("player_name", player)
    .eq("stat_type", "shooting")
    .eq("is_playoff", isPlayoff)
    .order("season", { ascending: false })
    .limit(1)

  // 4c. Query season per_game and advanced stats for full season context
  const { data: perGameStats } = await supabase
    .from("nba_player_season_stats")
    .select("stats")
    .ilike("player_name", player)
    .eq("stat_type", "per_game")
    .eq("is_playoff", isPlayoff)
    .order("season", { ascending: false })
    .limit(1)

  const { data: advancedSeasonStats } = await supabase
    .from("nba_player_season_stats")
    .select("stats")
    .ilike("player_name", player)
    .eq("stat_type", "advanced")
    .eq("is_playoff", isPlayoff)
    .order("season", { ascending: false })
    .limit(1)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const advanced = advancedStats && advancedStats.length > 0 ? advancedStats[0] as any : null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shootingRaw = shootingStats && shootingStats.length > 0 ? (shootingStats[0] as any).stats : null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perGameRaw = perGameStats && perGameStats.length > 0 ? (perGameStats[0] as any).stats : null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const advancedRaw = advancedSeasonStats && advancedSeasonStats.length > 0 ? (advancedSeasonStats[0] as any).stats : null

  // Build season stats object from per_game and advanced data
  const seasonStats = (perGameRaw || advancedRaw) ? {
    // Per game averages
    ppg: perGameRaw?.pts_per_g != null ? Number(perGameRaw.pts_per_g) : null,
    apg: perGameRaw?.ast_per_g != null ? Number(perGameRaw.ast_per_g) : null,
    rpg: perGameRaw?.trb_per_g != null ? Number(perGameRaw.trb_per_g) : null,
    spg: perGameRaw?.stl_per_g != null ? Number(perGameRaw.stl_per_g) : null,
    bpg: perGameRaw?.blk_per_g != null ? Number(perGameRaw.blk_per_g) : null,
    mpg: perGameRaw?.mp_per_g != null ? Number(perGameRaw.mp_per_g) : null,
    fgPct: perGameRaw?.fg_pct != null ? Number(perGameRaw.fg_pct) : null,
    fg3Pct: perGameRaw?.fg3_pct != null ? Number(perGameRaw.fg3_pct) : null,
    ftPct: perGameRaw?.ft_pct != null ? Number(perGameRaw.ft_pct) : null,
    efgPct: perGameRaw?.efg_pct != null ? Number(perGameRaw.efg_pct) : null,
    fgaPerG: perGameRaw?.fga_per_g != null ? Number(perGameRaw.fga_per_g) : null,
    ftaPerG: perGameRaw?.fta_per_g != null ? Number(perGameRaw.fta_per_g) : null,
    fg3aPerG: perGameRaw?.fg3a_per_g != null ? Number(perGameRaw.fg3a_per_g) : null,
    fg3PerG: perGameRaw?.fg3_per_g != null ? Number(perGameRaw.fg3_per_g) : null,
    tovPerG: perGameRaw?.tov_per_g != null ? Number(perGameRaw.tov_per_g) : null,
    orbPerG: perGameRaw?.orb_per_g != null ? Number(perGameRaw.orb_per_g) : null,
    drbPerG: perGameRaw?.drb_per_g != null ? Number(perGameRaw.drb_per_g) : null,
    // Advanced
    tsPct: advancedRaw?.ts_pct != null ? Number(advancedRaw.ts_pct) : null,
    usgPct: advancedRaw?.usg_pct != null ? Number(advancedRaw.usg_pct) : null,
    astPct: advancedRaw?.ast_pct != null ? Number(advancedRaw.ast_pct) : null,
    per: advancedRaw?.per != null ? Number(advancedRaw.per) : null,
    ws: advancedRaw?.ws != null ? Number(advancedRaw.ws) : null,
    bpm: advancedRaw?.bpm != null ? Number(advancedRaw.bpm) : null,
    obpm: advancedRaw?.obpm != null ? Number(advancedRaw.obpm) : null,
    dbpm: advancedRaw?.dbpm != null ? Number(advancedRaw.dbpm) : null,
    vorp: advancedRaw?.vorp != null ? Number(advancedRaw.vorp) : null,
    offRtg: advancedRaw?.off_rtg != null ? Number(advancedRaw.off_rtg) : null,
    defRtg: advancedRaw?.def_rtg != null ? Number(advancedRaw.def_rtg) : null,
    tovPct: advancedRaw?.tov_pct != null ? Number(advancedRaw.tov_pct) : null,
  } : null

  // Build shooting zone accuracy from the shooting page data
  const shootingZones = shootingRaw ? {
    fgPct0_3ft: shootingRaw.fg_pct_00_03 != null ? Number(shootingRaw.fg_pct_00_03) : null,
    fgPct3_10ft: shootingRaw.fg_pct_03_10 != null ? Number(shootingRaw.fg_pct_03_10) : null,
    fgPct10_16ft: shootingRaw.fg_pct_10_16 != null ? Number(shootingRaw.fg_pct_10_16) : null,
    fgPct16_3pt: shootingRaw.fg_pct_16_xx != null ? Number(shootingRaw.fg_pct_16_xx) : null,
    fgPct3pt: shootingRaw.fg_pct_fg3a != null ? Number(shootingRaw.fg_pct_fg3a) : null,
    fg3PctCorner: shootingRaw.fg_pct_corner3 != null ? Number(shootingRaw.fg_pct_corner3) : null,
    pctFga0_3ft: shootingRaw.pct_fga_00_03 != null ? Number(shootingRaw.pct_fga_00_03) * 100 : null,
    pctFga3_10ft: shootingRaw.pct_fga_03_10 != null ? Number(shootingRaw.pct_fga_03_10) * 100 : null,
    pctFga10_16ft: shootingRaw.pct_fga_10_16 != null ? Number(shootingRaw.pct_fga_10_16) * 100 : null,
    pctFga16_3pt: shootingRaw.pct_fga_16_xx != null ? Number(shootingRaw.pct_fga_16_xx) * 100 : null,
    pctFga3pt: shootingRaw.pct_fga_fg3a != null ? Number(shootingRaw.pct_fga_fg3a) * 100 : null,
    pctFg3aCorner: shootingRaw.pct_fg3a_corner3 != null ? Number(shootingRaw.pct_fg3a_corner3) * 100 : null,
    avgDist: shootingRaw.avg_dist != null ? Number(shootingRaw.avg_dist) : null,
    pctFgaDunk: shootingRaw.pct_fga_dunk != null ? Number(shootingRaw.pct_fga_dunk) * 100 : null,
    dunksMade: shootingRaw.fg_dunk != null ? Number(shootingRaw.fg_dunk) : null,
  } : null

  // Populate shot distribution and advanced metrics from advanced stats
  const shotDistribution = {
    fgaPct0_3ft: advanced?.fga_pct_0_3ft != null ? Number(advanced.fga_pct_0_3ft) : null,
    fgaPct3_10ft: advanced?.fga_pct_3_10ft != null ? Number(advanced.fga_pct_3_10ft) : null,
    fgaPct10_16ft: advanced?.fga_pct_10_16ft != null ? Number(advanced.fga_pct_10_16ft) : null,
    fgaPct16_3pt: advanced?.fga_pct_16_3pt != null ? Number(advanced.fga_pct_16_3pt) : null,
    fgaPct3pt: advanced?.fga_pct_3pt != null ? Number(advanced.fga_pct_3pt) : null,
    pct2pAssisted: advanced?.pct_2p_assisted != null ? Number(advanced.pct_2p_assisted) : null,
    pct3pAssisted: advanced?.pct_3p_assisted != null ? Number(advanced.pct_3p_assisted) : null,
  }

  const rebounding = {
    trbPct: advanced?.trb_pct != null ? Number(advanced.trb_pct) : null,
    orbPct: advanced?.orb_pct != null ? Number(advanced.orb_pct) : null,
    drbPct: advanced?.drb_pct != null ? Number(advanced.drb_pct) : null,
  }

  const playmaking = {
    astPct: advanced?.ast_pct != null ? Number(advanced.ast_pct) : null,
    astPerGame: rawStats.shooting.fgaPerGame > 0 ? rawStats.playmaking.astPerGame : 0,
    tovPerGame: rawStats.playmaking.tovPerGame,
    astTovRatio: rawStats.playmaking.astTovRatio,
    pgaPerGame: advanced?.pga != null ? Number(advanced.pga) : null,
  }

  // Merge advanced data into rawStats
  rawStats.shotDistribution = shotDistribution
  rawStats.rebounding = rebounding
  rawStats.playmaking = {
    ...rawStats.playmaking,
    astPct: playmaking.astPct,
    pgaPerGame: playmaking.pgaPerGame,
  }

  // 5. Query nba_team_defense_stats for league averages by position
  const defenseCategory = STAT_TO_DEFENSE_CATEGORY[stat] ?? stat
  const leagueAverages = await fetchLeagueAverages(supabase, position, defenseCategory)

  // 6. Compute derived stats (only when sufficient data)
  let derivedStats = null
  if (!insufficientData) {
    // Compute mid-range percentage as sum of mid-range zones
    const fgaPctMidRange = computeMidRangePct(shotDistribution)

    // Get team total rebounds per game from defense stats
    const teamTotalRebPerGame = await fetchTeamTotalRebounds(supabase, team)

    const derivedInput: DerivedStatsInput = {
      fgaPerGame: rawStats.shooting.fgaPerGame,
      ftaPerGame: rawStats.shooting.ftaPerGame,
      ptsPerGame: rawStats.shooting.ptsPerGame,
      astPerGame: rawStats.playmaking.astPerGame,
      tovPerGame: rawStats.playmaking.tovPerGame,
      stlPerGame: rawStats.defense.stlPerGame,
      blkPerGame: rawStats.defense.blkPerGame,
      fgaPct0_3ft: shotDistribution.fgaPct0_3ft,
      fgaPctMidRange,
      pct2pAssisted: shotDistribution.pct2pAssisted,
      pct3pAssisted: shotDistribution.pct3pAssisted,
      fgaPct3pt: shotDistribution.fgaPct3pt,
      trbPct: rebounding.trbPct,
      pgaPerGame: playmaking.pgaPerGame,
      teamTotalRebPerGame,
    }

    derivedStats = computeDerivedStats(derivedInput)
  }

  // 7. Get cheat sheet for the stat category
  const propType = STAT_TO_PROP_TYPE[stat] ?? stat
  const cheatSheetConfig = getCheatSheet(propType)

  // Build cheat sheet with values
  let cheatSheet = null
  if (cheatSheetConfig) {
    const statValues = buildCheatSheetValues(rawStats, derivedStats, playmaking, rebounding)
    cheatSheet = {
      propType: cheatSheetConfig.propType,
      stats: cheatSheetConfig.stats.map((s) => ({
        key: s.key,
        label: s.label,
        category: s.category,
        explanation: s.explanation,
        value: statValues[s.key] ?? null,
      })) as CheatSheetStat[],
    }
  }

  // 8. Compute rolling window averages (L5, L10, L15, L30) for the Filtered Averages panel
  const rollingAverages = computeRollingAverages(games)

  // 9. Build per-game breakdown for charts (assists, FGM/FGA, OREB/DREB, 3PM/3PA)
  const gameBreakdown = buildGameBreakdown(games)

  return {
    player: playerName,
    team,
    position,
    statCategory: stat,
    insufficientData,
    rawStats,
    derivedStats,
    leagueAverages,
    cheatSheet,
    rollingAverages,
    shootingZones,
    seasonStats,
    gameBreakdown,
  }
}

// ─── Computation Helpers ────────────────────────────────────────────────────

/**
 * Computes per-game averages from an array of game rows.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeRawStats(games: any[]): RawStatsData {
  const n = games.length

  const sumPts = games.reduce((s, g) => s + (Number(g.pts) || 0), 0)
  const sumFga = games.reduce((s, g) => s + (Number(g.fga) || 0), 0)
  const sumFta = games.reduce((s, g) => s + (Number(g.fta) || 0), 0)
  const sumFt = games.reduce((s, g) => s + (Number(g.ft) || 0), 0)
  const sumTpa = games.reduce((s, g) => s + (Number(g.tpa) || 0), 0)
  const sumTp = games.reduce((s, g) => s + (Number(g.tp) || 0), 0)
  const sumAst = games.reduce((s, g) => s + (Number(g.ast) || 0), 0)
  const sumTov = games.reduce((s, g) => s + (Number(g.tov) || 0), 0)
  const sumStl = games.reduce((s, g) => s + (Number(g.stl) || 0), 0)
  const sumBlk = games.reduce((s, g) => s + (Number(g.blk) || 0), 0)

  const fgaPerGame = roundTo(sumFga / n, 1)
  const ftaPerGame = roundTo(sumFta / n, 1)
  const ftmPerGame = roundTo(sumFt / n, 1)
  const tpaPerGame = roundTo(sumTpa / n, 1)
  const tpmPerGame = roundTo(sumTp / n, 1)
  const ptsPerGame = roundTo(sumPts / n, 1)
  const astPerGame = roundTo(sumAst / n, 1)
  const tovPerGame = roundTo(sumTov / n, 1)
  const stlPerGame = roundTo(sumStl / n, 1)
  const blkPerGame = roundTo(sumBlk / n, 1)

  // Compute percentages from totals (more accurate than averaging percentages)
  const ftPct = sumFta > 0 ? roundTo((sumFt / sumFta) * 100, 1) : 0
  const tpPct = sumTpa > 0 ? roundTo((sumTp / sumTpa) * 100, 1) : 0

  return {
    shooting: {
      fgaPerGame,
      ftaPerGame,
      ftmPerGame,
      ftPct,
      tpaPerGame,
      tpmPerGame,
      tpPct,
      ptsPerGame,
    },
    shotDistribution: {
      fgaPct0_3ft: null,
      fgaPct3_10ft: null,
      fgaPct10_16ft: null,
      fgaPct16_3pt: null,
      fgaPct3pt: null,
      pct2pAssisted: null,
      pct3pAssisted: null,
    },
    rebounding: {
      trbPct: null,
      orbPct: null,
      drbPct: null,
    },
    playmaking: {
      astPct: null,
      astPerGame,
      tovPerGame,
      astTovRatio: safeRatio(astPerGame, tovPerGame) != null
        ? roundTo(safeRatio(astPerGame, tovPerGame)!, 2)
        : null,
      pgaPerGame: null,
    },
    defense: {
      stlPerGame,
      blkPerGame,
    },
  }
}

/**
 * Computes rolling window averages (L5, L10, L15, L30) for the Filtered Averages panel.
 * Returns per-metric averages for each window size.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeRollingAverages(games: any[]) {
  const windows = [5, 10, 15, 30] as const

  function avgForWindow(slice: typeof games, extractor: (g: typeof games[0]) => number | null): number | null {
    const values = slice.map(extractor).filter((v): v is number => v !== null && !isNaN(v))
    if (values.length === 0) return null
    return roundTo(values.reduce((s, v) => s + v, 0) / values.length, 1)
  }

  function pctForWindow(slice: typeof games, madeKey: string, attKey: string): number | null {
    const totalMade = slice.reduce((s, g) => s + (Number(g[madeKey]) || 0), 0)
    const totalAtt = slice.reduce((s, g) => s + (Number(g[attKey]) || 0), 0)
    if (totalAtt === 0) return null
    return roundTo((totalMade / totalAtt) * 100, 1)
  }

  const result: Record<string, Record<string, number | null>> = {}

  for (const w of windows) {
    const slice = games.slice(0, Math.min(w, games.length))
    if (slice.length === 0) {
      result[`L${w}`] = {}
      continue
    }

    result[`L${w}`] = {
      PTS: avgForWindow(slice, (g) => Number(g.pts) || 0),
      AST: avgForWindow(slice, (g) => Number(g.ast) || 0),
      REB: avgForWindow(slice, (g) => Number(g.trb) || 0),
      STL: avgForWindow(slice, (g) => Number(g.stl) || 0),
      BLK: avgForWindow(slice, (g) => Number(g.blk) || 0),
      "3PM": avgForWindow(slice, (g) => Number(g.tp) || 0),
      "3PA": avgForWindow(slice, (g) => Number(g.tpa) || 0),
      TOV: avgForWindow(slice, (g) => Number(g.tov) || 0),
      MIN: avgForWindow(slice, (g) => {
        // Minutes stored as "MM:SS" string or number
        const mp = g.minutes
        if (!mp) return null
        if (typeof mp === "number") return mp
        const parts = String(mp).split(":")
        return parts.length === 2 ? parseInt(parts[0]) + parseInt(parts[1]) / 60 : parseFloat(mp) || null
      }),
      FGA: avgForWindow(slice, (g) => Number(g.fga) || 0),
      FGM: avgForWindow(slice, (g) => Number(g.fg) || 0),
      FTA: avgForWindow(slice, (g) => Number(g.fta) || 0),
      FTM: avgForWindow(slice, (g) => Number(g.ft) || 0),
      OREB: avgForWindow(slice, (g) => Number(g.orb) || 0),
      DREB: avgForWindow(slice, (g) => Number(g.drb) || 0),
      "2PA": avgForWindow(slice, (g) => (Number(g.fga) || 0) - (Number(g.tpa) || 0)),
      "2PM": avgForWindow(slice, (g) => (Number(g.fg) || 0) - (Number(g.tp) || 0)),
      "FG%": pctForWindow(slice, "fg", "fga"),
      "FG3%": pctForWindow(slice, "tp", "tpa"),
      "FT%": pctForWindow(slice, "ft", "fta"),
      "2P%": (() => {
        const made = slice.reduce((s, g) => s + ((Number(g.fg) || 0) - (Number(g.tp) || 0)), 0)
        const att = slice.reduce((s, g) => s + ((Number(g.fga) || 0) - (Number(g.tpa) || 0)), 0)
        if (att === 0) return null
        return roundTo((made / att) * 100, 1)
      })(),
      PRA: avgForWindow(slice, (g) => (Number(g.pts) || 0) + (Number(g.trb) || 0) + (Number(g.ast) || 0)),
    }
  }

  return result
}

/**
 * Computes mid-range percentage as sum of 3-10ft, 10-16ft, and 16-3pt zones.
 */
function computeMidRangePct(shotDistribution: RawStatsData["shotDistribution"]): number | null {
  const { fgaPct3_10ft, fgaPct10_16ft, fgaPct16_3pt } = shotDistribution
  if (fgaPct3_10ft === null && fgaPct10_16ft === null && fgaPct16_3pt === null) {
    return null
  }
  return (fgaPct3_10ft ?? 0) + (fgaPct10_16ft ?? 0) + (fgaPct16_3pt ?? 0)
}

/**
 * Fetches league averages from nba_team_defense_stats.
 * Uses position-specific averages if available, falls back to all-position mean.
 */
async function fetchLeagueAverages(
  supabase: ReturnType<typeof createAdminClient>,
  position: string | null,
  statCategory: string
): Promise<Record<string, number | null>> {
  // Query all defense stats for this stat category
  const { data, error } = await supabase
    .from("nba_team_defense_stats")
    .select("position, value_per_game, pace")
    .eq("stat_category", statCategory)

  if (error || !data || data.length === 0) {
    return {}
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = data as any[]

  // Try position-specific average first
  if (position) {
    const positionRows = rows.filter((r) => r.position === position)
    if (positionRows.length > 0) {
      const values = positionRows
        .filter((r) => r.value_per_game != null)
        .map((r) => Number(r.value_per_game))
      const paceValues = positionRows
        .filter((r) => r.pace != null)
        .map((r) => Number(r.pace))

      return {
        valuePerGame: values.length > 0 ? roundTo(mean(values), 1) : null,
        pace: paceValues.length > 0 ? roundTo(mean(paceValues), 1) : null,
      }
    }
  }

  // Fallback: all-position mean
  const allValues = rows
    .filter((r) => r.value_per_game != null && r.position !== "TEAM")
    .map((r) => Number(r.value_per_game))
  const allPaceValues = rows
    .filter((r) => r.pace != null && r.position !== "TEAM")
    .map((r) => Number(r.pace))

  return {
    valuePerGame: allValues.length > 0 ? roundTo(mean(allValues), 1) : null,
    pace: allPaceValues.length > 0 ? roundTo(mean(allPaceValues), 1) : null,
  }
}

/**
 * Fetches team total rebounds per game from nba_team_defense_stats.
 */
async function fetchTeamTotalRebounds(
  supabase: ReturnType<typeof createAdminClient>,
  team: string
): Promise<number | null> {
  const { data, error } = await supabase
    .from("nba_team_defense_stats")
    .select("value_per_game")
    .eq("team", team)
    .eq("stat_category", "trb")
    .eq("position", "TEAM")
    .limit(1)

  if (error || !data || data.length === 0) return null
  return Number(data[0].value_per_game) || null
}

/**
 * Builds a map of stat keys to their current values for the cheat sheet.
 */
function buildCheatSheetValues(
  rawStats: RawStatsData,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  derivedStats: any | null,
  playmaking: { astPct: number | null; pgaPerGame: number | null },
  rebounding: { trbPct: number | null; orbPct: number | null; drbPct: number | null }
): Record<string, number | null> {
  return {
    fgaPerGame: rawStats.shooting.fgaPerGame,
    ftaPerGame: rawStats.shooting.ftaPerGame,
    tpaPerGame: rawStats.shooting.tpaPerGame,
    ePPS: derivedStats?.ePPS?.value ?? null,
    rimAttemptsPerGame: derivedStats?.rimAttemptsPerGame?.value ?? null,
    selfCreatedFGAPerGame: derivedStats?.selfCreatedFGAPerGame?.value ?? null,
    trbPct: rebounding.trbPct,
    orbPct: rebounding.orbPct,
    drbPct: rebounding.drbPct,
    projectedReboundsPerGame: derivedStats?.projectedReboundsPerGame?.value ?? null,
    astPct: playmaking.astPct,
    pgaPerGame: playmaking.pgaPerGame,
    pgaConversionRate: derivedStats?.pgaConversionRate?.value ?? null,
    astTovRatio: derivedStats?.astTovRatio?.value ?? null,
    // Context stats that may not be directly available
    opponentPace: null, // Would need matchup context
    teamPace: null, // Would need team pace data
    minutesPerGame: null, // Not tracked in current per-game averages
  }
}

/**
 * Builds per-game breakdown data for charts (assists, FGM/FGA, OREB/DREB, 3PM/3PA).
 * Returns the last 15 games in chronological order (oldest first).
 */
/** Maps full team names (as stored in nba_games) to 3-letter abbreviations */
const TEAM_NAME_TO_ABBR: Record<string, string> = {
  "Atlanta Hawks": "ATL", "Boston Celtics": "BOS", "Brooklyn Nets": "BKN",
  "Charlotte Hornets": "CHA", "Chicago Bulls": "CHI", "Cleveland Cavaliers": "CLE",
  "Dallas Mavericks": "DAL", "Denver Nuggets": "DEN", "Detroit Pistons": "DET",
  "Golden State Warriors": "GSW", "Houston Rockets": "HOU", "Indiana Pacers": "IND",
  "LA Clippers": "LAC", "LA Lakers": "LAL", "Memphis Grizzlies": "MEM",
  "Miami Heat": "MIA", "Milwaukee Bucks": "MIL", "Minnesota Timberwolves": "MIN",
  "New Orleans Pelicans": "NOP", "New York Knicks": "NYK", "Oklahoma City Thunder": "OKC",
  "Orlando Magic": "ORL", "Philadelphia 76ers": "PHI", "Phoenix Suns": "PHX",
  "Portland Trail Blazers": "POR", "Sacramento Kings": "SAC", "San Antonio Spurs": "SAS",
  "Toronto Raptors": "TOR", "Utah Jazz": "UTA", "Washington Wizards": "WAS",
}

/** Convert a full team name to its 3-letter abbreviation, or return the input if already short */
function toAbbr(name: string): string {
  if (!name) return name
  if (name.length <= 3) return name.toUpperCase()
  return TEAM_NAME_TO_ABBR[name] ?? name
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildGameBreakdown(games: any[]) {
  // games are ordered most recent first — reverse for chronological display
  const slice = games.slice(0, 15).reverse()

  return slice.map((g) => {
    const gameDate = g.nba_games?.game_date ?? null
    // Use the opponent column directly — stored as 3-letter abbreviation in nba_player_stats
    const opponent = (g.opponent ?? "").toUpperCase() || (() => {
      // Fallback: derive from home/away team names if opponent column is missing
      const playerTeamAbbr = (g.team ?? "").toUpperCase()
      const homeTeamAbbr = toAbbr(g.nba_games?.home_team ?? "")
      const awayTeamAbbr = toAbbr(g.nba_games?.away_team ?? "")
      return homeTeamAbbr && awayTeamAbbr
        ? (playerTeamAbbr === homeTeamAbbr ? awayTeamAbbr : homeTeamAbbr)
        : playerTeamAbbr
    })()
    const fg = Number(g.fg) || 0
    const fga = Number(g.fga) || 0
    const tp = Number(g.tp) || 0
    const tpa = Number(g.tpa) || 0
    const ft = Number(g.ft) || 0
    const fta = Number(g.fta) || 0
    const orb = Number(g.orb) || 0
    const drb = Number(g.drb) || 0
    const ast = Number(g.ast) || 0
    const pts = Number(g.pts) || 0
    const trb = Number(g.trb) || 0
    const stl = Number(g.stl) || 0
    const blk = Number(g.blk) || 0
    const tov = Number(g.tov) || 0

    return {
      date: gameDate,
      opponent,
      fg,
      fga,
      tp,
      tpa,
      ft,
      fta,
      orb,
      drb,
      ast,
      pts,
      trb,
      stl,
      blk,
      tov,
      fg2m: fg - tp,
      fg2a: fga - tpa,
    }
  })
}
