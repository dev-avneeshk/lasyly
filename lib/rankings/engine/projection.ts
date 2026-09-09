/**
 * NBA Ranking Engine — 2026-27 Projection Engine (LPI v1)
 *
 * Extends the historical engine to produce projected rankings for the upcoming season.
 * Key differences from historical:
 *
 * 1. Multi-season blending: 2025-26 (66.67%) + 2024-25 (22.22%) + 2023-24 (11.11%)
 * 2. LPI_26_27 = BASE + TREND + AGE + AVAILABILITY + TEAMFIT + ROLEFIT
 * 3. Trend = LPI_25_26 - LPI_23_24
 */

import { createAdminClient } from "@/lib/supabase/admin"
import type { PlayerRankingInput, PriorSeasonData } from "../types"
import { loadHistoricalPlayerData } from "./historical"
import { SEASON_WEIGHTS, MIN_SEASONS_FOR_BLENDING, getAgeAdjustment, PROJECTION_WEIGHTS, TREND_CLAMP, AVAIL_CLAMP } from "../config"
import { clampScore } from "../normalize"

export async function loadProjectionPlayerData(
  primarySeason: string,    // '2025-26'
  projectionSeason: string, // '2026-27'
): Promise<PlayerRankingInput[]> {
  const supabase = createAdminClient()

  // 1. Start with historical data for the primary season
  const primaryInputs = await loadHistoricalPlayerData(primarySeason)

  // 2. Load prior season stats (2024-25 and 2023-24)
  const priorSeasons = Object.keys(SEASON_WEIGHTS)
    .filter((s) => s !== primarySeason)
    .sort()
    .reverse()  // most recent first


  const priorDataByPlayer = new Map<string, PriorSeasonData[]>()

  for (const season of priorSeasons) {
    // Stats are stored as JSONB inside the `stats` column
    const { data: priorRows } = await supabase
      .from('nba_player_season_stats')
      .select('player_name, games, stats')
      .eq('season', season)
      .eq('stat_type', 'per_game')
      .eq('is_playoff', false)

    // Advanced stats are in a separate stat_type row (includes DWS, OWS, DBPM, etc.)
    const { data: priorAdvRows } = await supabase
      .from('nba_player_season_stats')
      .select('player_name, stats')
      .eq('season', season)
      .eq('stat_type', 'advanced')
      .eq('is_playoff', false)

    // per_100 from per_poss stat_type
    const { data: priorPerPossRows } = await supabase
      .from('nba_player_season_stats')
      .select('player_name, stats')
      .eq('season', season)
      .eq('stat_type', 'per_poss')
      .eq('is_playoff', false)

    const advMap = new Map<string, any>()
    if (priorAdvRows) for (const r of priorAdvRows as any[]) advMap.set(r.player_name, r.stats ?? {})

    const perPossMap = new Map<string, any>()
    if (priorPerPossRows) for (const r of priorPerPossRows as any[]) perPossMap.set(r.player_name, r.stats)

    if (priorRows) {
      for (const row of priorRows as any[]) {
        const name = row.player_name
        const s = row.stats ?? {}
        const adv = advMap.get(name) ?? {}
        if (!priorDataByPlayer.has(name)) priorDataByPlayer.set(name, [])
        priorDataByPlayer.get(name)!.push({
          season,
          games_played: Number(row.games) || 0,
          per_100: perPossMap.get(name) ? { pts: toNum(perPossMap.get(name).pts_per_poss), trb: toNum(perPossMap.get(name).trb_per_poss), ast: toNum(perPossMap.get(name).ast_per_poss), stl: toNum(perPossMap.get(name).stl_per_poss), blk: toNum(perPossMap.get(name).blk_per_poss), ast_tov: null, off_rtg: toNum(perPossMap.get(name).off_rtg), def_rtg: toNum(perPossMap.get(name).def_rtg) } : null,
          per_game: {
            pts: toNum(s.pts_per_g), trb: toNum(s.trb_per_g), ast: toNum(s.ast_per_g),
            stl: toNum(s.stl_per_g), blk: toNum(s.blk_per_g), tov: toNum(s.tov_per_g),
            fg: toNum(s.fg_per_g), fga: toNum(s.fga_per_g), fg_pct: toNum(s.fg_pct),
            fg3: toNum(s.fg3_per_g), fg3a: toNum(s.fg3a_per_g), fg3_pct: toNum(s.fg3_pct),
            ft: toNum(s.ft_per_g), fta: toNum(s.fta_per_g), ft_pct: toNum(s.ft_pct),
            orb: toNum(s.orb_per_g), drb: toNum(s.drb_per_g), mp: toNum(s.mp_per_g),
            efg_pct: toNum(s.efg_pct), pf: toNum(s.pf_per_g),
          },
          advanced: {
            per: toNum(adv.per), ts_pct: toNum(adv.ts_pct), usg_pct: toNum(adv.usg_pct),
            obpm: toNum(adv.obpm), dbpm: toNum(adv.dbpm), bpm: toNum(adv.bpm),
            vorp: toNum(adv.vorp), ws: toNum(adv.ws), ws_per_48: toNum(adv.ws_per_48),
            ows: toNum(adv.ows), dws: toNum(adv.dws),
            orb_pct: toNum(adv.orb_pct), drb_pct: toNum(adv.drb_pct), trb_pct: toNum(adv.trb_pct),
            ast_pct: toNum(adv.ast_pct), stl_pct: toNum(adv.stl_pct), blk_pct: toNum(adv.blk_pct),
            tov_pct: toNum(adv.tov_pct), off_rtg: toNum(adv.off_rtg), def_rtg: toNum(adv.def_rtg),
            fg3a_per_fga_pct: toNum(adv.fg3a_per_fga_pct),
            ast_tov: ratioOrNull(toNum(s.ast_per_g), toNum(s.tov_per_g)),
          },
        })
      }
    }
  }

  // Trend may only use the exact published historical version for each season.
  // If a season is absent or unpublished, trend remains unavailable rather than
  // selecting an arbitrary row from multiple ranking versions.
  const { data: versionRows } = await supabase
    .from("nba_ranking_versions")
    .select("season, ranking_version")
    .in("season", ["2025-26", "2023-24"])
    .eq("ranking_mode", "historical")
    .eq("status", "published")
  const publishedVersionBySeason = new Map<string, string>()
  for (const row of (versionRows ?? []) as any[]) {
    if (!publishedVersionBySeason.has(row.season)) publishedVersionBySeason.set(row.season, row.ranking_version)
  }

  const { data: rankRows, error: rankError } = await supabase
    .from("nba_player_rankings")
    .select("player_name, season, score, ranking_version")
    .in("season", ["2025-26", "2023-24"])
    .eq("ranking_mode", "historical")
    .eq("ranking_type", "overall")
  if (rankError) throw new Error(`[projection] Failed to load historical LPI: ${rankError.message}`)

  const historicalLpiScores = new Map<string, { lpi_25_26?: number, lpi_23_24?: number }>()
  if (rankRows) {
    for (const row of rankRows) {
      if (publishedVersionBySeason.get(row.season) !== row.ranking_version) continue
      if (!historicalLpiScores.has(row.player_name)) historicalLpiScores.set(row.player_name, {})
      const entry = historicalLpiScores.get(row.player_name)!
      if (row.season === "2025-26" && entry.lpi_25_26 == null) entry.lpi_25_26 = row.score
      if (row.season === "2023-24" && entry.lpi_23_24 == null) entry.lpi_23_24 = row.score
    }
  }

  // 3. Load 2026-27 team assignments
  const { data: teamHistoryRows } = await supabase
    .from("nba_player_team_history")
    .select("player_name, team, team_full_name, is_primary")
    .eq("season", projectionSeason)
    .eq("is_primary", true)

  const team2627Map = new Map<string, string>()
  if (teamHistoryRows) {
    for (const row of teamHistoryRows as any[]) {
      team2627Map.set(row.player_name, row.team)
    }
  }

  // 4. Load 2026-27 team stats (if available) or fall back to 2025-26 team stats
  const { data: teamStatsRows } = await supabase
    .from("nba_team_stats")
    .select("team, off_rtg, def_rtg, pace, season")
    .in("season", [projectionSeason, primarySeason])

  const teamStatsMap = new Map<string, { off_rtg: number | null; def_rtg: number | null; pace: number | null }>()
  if (teamStatsRows) {
    // Prefer newer season stats; fall back to older
    const sorted = (teamStatsRows as any[]).sort((a, b) => b.season.localeCompare(a.season))
    for (const row of sorted) {
      if (!teamStatsMap.has(row.team)) {
        teamStatsMap.set(row.team, { off_rtg: row.off_rtg, def_rtg: row.def_rtg, pace: row.pace })
      }
    }
  }

  const allTeamStats = Array.from(teamStatsMap.values())
  const leagueAvgOffRtg = allTeamStats.length > 0
    ? allTeamStats.reduce((s, t) => s + (t.off_rtg ?? 0), 0) / allTeamStats.length
    : 113
  const leagueAvgDefRtg = leagueAvgOffRtg
  const leagueAvgPace = allTeamStats.length > 0
    ? allTeamStats.reduce((s, t) => s + (t.pace ?? 0), 0) / allTeamStats.length
    : 100

  // 5. Enrich primary inputs with prior seasons + 2026-27 team assignments
  return primaryInputs.map((input) => {
    const priorSeasonsList = priorDataByPlayer.get(input.player_name) ?? []
    const projectedTeam = team2627Map.get(input.player_name) ?? input.historical_team
    const teamStats = projectedTeam ? teamStatsMap.get(projectedTeam) : null
    
    // Add LPI scores for trend calculation
    const lpiScores = historicalLpiScores.get(input.player_name) ?? {}

    return {
      ...input,
      projected_team: projectedTeam,
      prior_seasons: priorSeasonsList,
      lpi_25_26: lpiScores.lpi_25_26 ?? null,
      lpi_23_24: lpiScores.lpi_23_24 ?? null,
      projected_team_stats: teamStats
        ? {
            team: projectedTeam!,
            off_rtg: teamStats.off_rtg,
            def_rtg: teamStats.def_rtg,
            pace: teamStats.pace,
            league_avg_off_rtg: leagueAvgOffRtg,
            league_avg_def_rtg: leagueAvgDefRtg,
            league_avg_pace: leagueAvgPace,
          }
        : null,
    }
  })
}

// ─── Multi-Season Weighted Stats ──────────────────────────────────────────────

export function blendMultiSeasonStats(input: PlayerRankingInput): {
  blended_per_game: PlayerRankingInput["per_game"]
  blended_advanced: PlayerRankingInput["advanced"]
  blended_per_100: any | null
  seasons_used: string[]
} {
  const availableSeasons: Array<{
    season: string
    weight: number
    per_game: PlayerRankingInput["per_game"]
    advanced: PlayerRankingInput["advanced"]
    per_100?: any | null
  }> = [
    { season: input.current_season, weight: SEASON_WEIGHTS[input.current_season] ?? 1.0, per_game: input.per_game, advanced: input.advanced, per_100: input.per_100 },
    ...input.prior_seasons.map((s) => ({
      season: s.season,
      weight: SEASON_WEIGHTS[s.season] ?? 0,
      per_game: s.per_game,
      advanced: s.advanced,
      per_100: s.per_100
    })),
  ]

  // Only use seasons with weight > 0
  const usableSeason = availableSeasons.filter((s) => s.weight > 0)
  const seasons_used = usableSeason.map((s) => s.season)

  if (usableSeason.length < MIN_SEASONS_FOR_BLENDING) {
    // Use only current season
    return { blended_per_game: input.per_game, blended_advanced: input.advanced, blended_per_100: input.per_100 ?? null, seasons_used }
  }

  // Normalize weights dynamically from raw values, only among available seasons.
  // This ensures a player with 2 seasons gets a 3:1 split, not 3:1:0 divided by 4.5.
  const totalWeight = usableSeason.reduce((s, w) => s + w.weight, 0)
  const normalized = usableSeason.map((s) => ({ ...s, weight: s.weight / totalWeight }))

  // Blend per_game / advanced stats
  const blendStat = (key: string, src: "per_game" | "advanced" | "per_100"): number | null => {
    const values = normalized
      .map((s) => {
        const obj = s[src] as any
        const v = obj?.[key]
        return v != null ? { value: Number(v), weight: s.weight } : null
      })
      .filter((v): v is { value: number; weight: number } => v !== null)

    if (values.length === 0) return null
    const totalW = values.reduce((s, v) => s + v.weight, 0)
    return values.reduce((s, v) => s + (v.value * v.weight) / totalW, 0)
  }

  const blended_per_game = input.per_game ? {
    pts: blendStat("pts", "per_game"), trb: blendStat("trb", "per_game"),
    ast: blendStat("ast", "per_game"), stl: blendStat("stl", "per_game"),
    blk: blendStat("blk", "per_game"), tov: blendStat("tov", "per_game"),
    fg: blendStat("fg", "per_game"), fga: blendStat("fga", "per_game"),
    fg_pct: blendStat("fg_pct", "per_game"), fg3: blendStat("fg3", "per_game"),
    fg3a: blendStat("fg3a", "per_game"), fg3_pct: blendStat("fg3_pct", "per_game"),
    ft: blendStat("ft", "per_game"), fta: blendStat("fta", "per_game"),
    ft_pct: blendStat("ft_pct", "per_game"), orb: blendStat("orb", "per_game"),
    drb: blendStat("drb", "per_game"), mp: blendStat("mp", "per_game"),
    efg_pct: blendStat("efg_pct", "per_game"), pf: blendStat("pf", "per_game"),
  } : null

  const blended_advanced = input.advanced ? {
    per: blendStat("per", "advanced"), ts_pct: blendStat("ts_pct", "advanced"),
    usg_pct: blendStat("usg_pct", "advanced"), obpm: blendStat("obpm", "advanced"),
    dbpm: blendStat("dbpm", "advanced"), bpm: blendStat("bpm", "advanced"),
    vorp: blendStat("vorp", "advanced"), ws: blendStat("ws", "advanced"),
    ws_per_48: blendStat("ws_per_48", "advanced"), ows: blendStat("ows", "advanced"),
    dws: blendStat("dws", "advanced"), orb_pct: blendStat("orb_pct", "advanced"),
    drb_pct: blendStat("drb_pct", "advanced"), trb_pct: blendStat("trb_pct", "advanced"),
    ast_pct: blendStat("ast_pct", "advanced"), stl_pct: blendStat("stl_pct", "advanced"),
    blk_pct: blendStat("blk_pct", "advanced"), tov_pct: blendStat("tov_pct", "advanced"),
    off_rtg: blendStat("off_rtg", "advanced"), def_rtg: blendStat("def_rtg", "advanced"),
    fg3a_per_fga_pct: blendStat("fg3a_per_fga_pct", "advanced"), ast_tov: blendStat("ast_tov", "advanced")
  } : null

  const blended_per_100 = input.per_100 ? {
    pts: blendStat("pts", "per_100"), trb: blendStat("trb", "per_100"),
    ast: blendStat("ast", "per_100"), stl: blendStat("stl", "per_100"),
    blk: blendStat("blk", "per_100"), ast_tov: blendStat("ast_tov", "per_100"),
    off_rtg: blendStat("off_rtg", "per_100"), def_rtg: blendStat("def_rtg", "per_100")
  } : null

  return { blended_per_game, blended_advanced, blended_per_100, seasons_used }
}

// ─── Project LPI v1 Score ─────────────────────────────────────────────────────

export function projectPlayerOverallScore(
  baseScore: number,
  input: PlayerRankingInput,
  k_A: number = PROJECTION_WEIGHTS.k_A,
): {
  projected_score: number
  trend_adj: number
  age_adj: number
  avail_adj: number
  team_fit: number
  role_fit: number
  trend_available: boolean
} {
  // 1. Trend Adjustment
  let trend_adj = 0
  let trend_available = false
  if (input.lpi_25_26 != null && input.lpi_23_24 != null) {
    const trend_raw = (input.lpi_25_26 - input.lpi_23_24) * PROJECTION_WEIGHTS.k_T
    trend_adj = Math.max(TREND_CLAMP.min, Math.min(TREND_CLAMP.max, trend_raw))
    trend_available = true
  }

  // 2. Age Adjustment
  const age_adj = getAgeAdjustment(input.age) * PROJECTION_WEIGHTS.k_Age

  // 3. Availability Adjustment
  // Availability = 0.70 * RecentGP% + 0.30 * HistoricalGP%
  const currentGP_Pct = (input.games_played / 82) * 100
  
  // Get prior gp pct
  let historicalGPPct: number | null = null
  const season24_25 = input.prior_seasons.find(s => s.season === "2024-25")
  const season23_24 = input.prior_seasons.find(s => s.season === "2023-24")

  if (season24_25 && season23_24) {
    const gp24_25 = (season24_25.games_played / 82) * 100
    const gp23_24 = (season23_24.games_played / 82) * 100
    historicalGPPct = (1.0 * gp24_25 + 0.5 * gp23_24) / 1.5
  } else if (season24_25) {
    historicalGPPct = (season24_25.games_played / 82) * 100
  } else if (season23_24) {
    historicalGPPct = (season23_24.games_played / 82) * 100
  }

  // Do not invent historical games when no prior season exists.
  const availability = historicalGPPct == null
    ? currentGP_Pct
    : 0.70 * currentGP_Pct + 0.30 * historicalGPPct
  const avail_raw = k_A * (availability - 75)
  // clip -3 to +1
  const avail_adj = Math.max(-3, Math.min(1, avail_raw))

  // 4. Team Fit (0 unless reliable independently sourced data)
  const team_fit = 0
  const role_fit = 0

  const raw_adj = trend_adj + age_adj + avail_adj + team_fit + role_fit
  
  // Bound the aggregate adjustment by the player's remaining distance to the upper and lower score boundaries.
  // Ensures 0 <= BASE + ADJ <= 100 without a blind final clamp
  const maxUp = 100 - baseScore
  const maxDown = baseScore

  const bounded_adj = Math.max(-maxDown, Math.min(maxUp, raw_adj))

  // clampScore is kept strictly as a defensive programming safeguard
  const projected_score = clampScore(baseScore + bounded_adj)

  return {
    projected_score,
    trend_adj,
    age_adj,
    avail_adj,
    team_fit,
    role_fit,
    trend_available
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function toNum(value: any): number | null {
  if (value == null) return null
  const n = Number(value)
  return isFinite(n) ? n : null
}

function ratioOrNull(numerator: number | null, denominator: number | null): number | null {
  return numerator != null && denominator != null && denominator > 0
    ? numerator / denominator
    : null
}
