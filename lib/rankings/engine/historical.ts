/**
 * NBA Ranking Engine — Historical Rankings (2025-26)
 *
 * Computes and stores HISTORICAL rankings for the completed 2025-26 season.
 * These rankings reflect actual performance — no projections, no age adjustments.
 *
 * Historical rankings are FROZEN once written. A new pipeline run for 2026-27
 * projections will NOT modify the 2025-26 historical rankings.
 *
 * Data flow:
 *   nba_player_season_stats (season='2025-26') → component scores → overall score → DB
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { computeOffenseScore } from "../scores/offense"
import { computeDefenseScore } from "../scores/defense"
import { computeScoringScore } from "../scores/scoring"
import { computePlaymakingScore } from "../scores/playmaking"
import { computeReboundingScore } from "../scores/rebounding"
import { computeShootingScore } from "../scores/shooting"
import { computeAvailabilityScore } from "../scores/availability"
import { computeTwoWayScore } from "../scores/twoWay"
import { computeImpactScore } from "../scores/impact"
import { computeRoleVolumeScore } from "../scores/roleVolume"
import { 
  assignTier, 
  getStrengths, 
  getWeaknesses, 
  generatePlayerExplanation,
  generateSignature,
  generatePlayerClass,
  generatePotential,
  generateCeiling,
  generateStatus
} from "./explanations"
import { projectPlayerOverallScore } from "./projection"
import { buildPopulation, weightedAverage, clampScore, getRoleGroup } from "../normalize"
import { parsePosition } from "@/lib/analytics/position"
import {
  OVERALL_WEIGHTS,
  MIN_GAMES_FOR_RANKING,
  MIN_MINUTES_FOR_RANKING,
  isQualified,
  EXPECTED_FACTOR_COUNTS,
  MIN_FACTOR_COVERAGE,
  YOUNG_MAX_AGE,
  BREAKOUT_SCORE_DELTA,
  BREAKOUT_MIN_SCORE,
  DECLINE_SCORE_DELTA,
} from "../config"
import type {
  RankingConfig,
  PlayerRankingInput,
  PlayerScoreBreakdown,
  NBAPlayerRankingRow,
  LeagueMetricContext,
  RankingType,
  PlayerAdvancedStats
} from "../types"

// ─── Data Loading ─────────────────────────────────────────────────────────────

/**
 * Loads all player data needed for the historical ranking computation.
 * Queries: nba_player_season_stats, nba_player_advanced_stats, nba_player_stats (game log).
 */
export async function loadHistoricalPlayerData(
  season: string
): Promise<PlayerRankingInput[]> {
  const supabase = createAdminClient()

  // Load per-game stats (regular season only — playoff stats are stored separately)
  const { data: perGameRows, error: pgError } = await supabase
    .from("nba_player_season_stats")
    .select("*")
    .eq("season", season)
    .eq("stat_type", "per_game")
    .eq("is_playoff", false)

  if (pgError) throw new Error(`[historical] Failed to load per_game stats: ${pgError.message}`)
  const canonicalPerGameRows = selectCanonicalPlayerRows(perGameRows ?? [])

  // Load advanced stats (regular season only)
  const { data: advancedRows, error: advError } = await supabase
    .from("nba_player_season_stats")
    .select("*")
    .eq("season", season)
    .eq("stat_type", "advanced")
    .eq("is_playoff", false)

  if (advError) throw new Error(`[historical] Failed to load advanced stats: ${advError.message}`)

  // Shooting profile (nba_player_advanced_stats) is optional and no longer
  // feeds any ranking component after PGA was removed. It is still loaded so the
  // PlayerShootingProfile type stays populated for any future non-ranking use;
  // a failed query simply leaves it null.
  const { data: shootingRows, error: shootError } = await supabase
    .from("nba_player_advanced_stats")
    .select("*")
    .eq("season", season)
  const shootingMap = new Map<string, any>()
  if (!shootError && shootingRows) for (const row of shootingRows) shootingMap.set(row.player_name, row)

  // Load team stats for context
  const { data: teamStatsRows } = await supabase
    .from("nba_team_stats")
    .select("team, off_rtg, def_rtg, pace")
    .eq("season", season)

  const teamStatsMap = new Map<string, { off_rtg: number | null; def_rtg: number | null; pace: number | null }>()
  if (teamStatsRows) {
    for (const row of teamStatsRows) {
      teamStatsMap.set(row.team, { off_rtg: row.off_rtg, def_rtg: row.def_rtg, pace: row.pace })
    }
  }

  // Load recent game logs (last 20 games for each player)
  const { data: gameLogRows } = await supabase
    .from("nba_player_stats")
    .select("player_name, pts, trb, ast, nba_games!inner(game_date, season)")
    .eq("nba_games.season", season)
    .order("nba_games(game_date)", { ascending: false })

  const gameLogMap = new Map<string, { pts: number[]; trb: number[]; ast: number[] }>()
  if (gameLogRows) {
    for (const row of gameLogRows as any[]) {
      const name = row.player_name
      if (!gameLogMap.has(name)) gameLogMap.set(name, { pts: [], trb: [], ast: [] })
      const log = gameLogMap.get(name)!
      if (log.pts.length < 20) {
        log.pts.push(Number(row.pts) || 0)
        log.trb.push(Number(row.trb) || 0)
        log.ast.push(Number(row.ast) || 0)
      }
    }
  }

  // Build advanced stats map
  const advancedMap = new Map<string, any>()
  if (advancedRows) {
    for (const row of selectCanonicalPlayerRows(advancedRows)) {
      advancedMap.set(row.player_name, row)
    }
  }

  // Compute league average offensive/defensive rating for context
  const allTeamStats = teamStatsRows ?? []
  const leagueAvgOffRtg = allTeamStats.length > 0
    ? allTeamStats.reduce((s, t) => s + (t.off_rtg ?? 0), 0) / allTeamStats.length
    : 113
  const leagueAvgDefRtg = allTeamStats.length > 0
    ? allTeamStats.reduce((s, t) => s + (t.def_rtg ?? 0), 0) / allTeamStats.length
    : 113
  const leagueAvgPace = allTeamStats.length > 0
    ? allTeamStats.reduce((s, t) => s + (t.pace ?? 0), 0) / allTeamStats.length
    : 100

  // Load per_poss stats for true pts_per_100 calculation
  const { data: perPossRows } = await supabase
    .from("nba_player_season_stats")
    .select("player_name, stats")
    .eq("season", season)
    .eq("stat_type", "per_poss")
    .eq("is_playoff", false)

  const perPossMap = new Map<string, any>()
  if (perPossRows) {
    for (const row of selectCanonicalPlayerRows(perPossRows)) {
      perPossMap.set(row.player_name, row.stats)
    }
  }

  // Combine into PlayerRankingInput[]
  const inputs: PlayerRankingInput[] = []
  const seenPlayers = new Set<string>()
  
  for (const pg of canonicalPerGameRows) {
    if (seenPlayers.has(pg.player_name)) continue
    seenPlayers.add(pg.player_name)

    const adv = advancedMap.get(pg.player_name)
    const shooting = shootingMap.get(pg.player_name)
    const gameLogs = gameLogMap.get(pg.player_name) ?? { pts: [], trb: [], ast: [] }
    const team = pg.team as string
    const teamStats = teamStatsMap.get(team)
    const per_poss = perPossMap.get(pg.player_name) ?? null

    inputs.push({
      player_name: pg.player_name,
      player_id: null,  // resolved later from nba_players table
      position: parsePosition(pg.position || adv?.position),
      age: pg.age ? Number(pg.age) : null,
      birth_date: null,
      historical_team: team,
      projected_team: team,  // same for historical rankings
      current_season: season,
      games_played: Number(pg.games) || 0,
      games_started: Number(pg.games_started) || 0,
      minutes_per_game: Number(pg.stats?.mp_per_g) || 0,
      per_100: per_poss ? { pts: toNum(per_poss.pts_per_poss), trb: toNum(per_poss.trb_per_poss), ast: toNum(per_poss.ast_per_poss), stl: toNum(per_poss.stl_per_poss), blk: toNum(per_poss.blk_per_poss), ast_tov: null, off_rtg: toNum(per_poss.off_rtg), def_rtg: toNum(per_poss.def_rtg) } : null,
      per_game: {
        pts: toNum(pg.stats?.pts_per_g), trb: toNum(pg.stats?.trb_per_g), ast: toNum(pg.stats?.ast_per_g),
        stl: toNum(pg.stats?.stl_per_g), blk: toNum(pg.stats?.blk_per_g), tov: toNum(pg.stats?.tov_per_g),
        fg: toNum(pg.stats?.fg_per_g), fga: toNum(pg.stats?.fga_per_g), fg_pct: toNum(pg.stats?.fg_pct),
        fg3: toNum(pg.stats?.fg3_per_g), fg3a: toNum(pg.stats?.fg3a_per_g), fg3_pct: toNum(pg.stats?.fg3_pct),
        ft: toNum(pg.stats?.ft_per_g), fta: toNum(pg.stats?.fta_per_g), ft_pct: toNum(pg.stats?.ft_pct),
        orb: toNum(pg.stats?.orb_per_g), drb: toNum(pg.stats?.drb_per_g), mp: toNum(pg.stats?.mp_per_g),
        efg_pct: toNum(pg.stats?.efg_pct), pf: toNum(pg.stats?.pf_per_g),
      },
      advanced: adv ? {
        per: toNum(adv.stats?.per), ts_pct: toNum(adv.stats?.ts_pct), usg_pct: toNum(adv.stats?.usg_pct),
        obpm: toNum(adv.stats?.obpm), dbpm: toNum(adv.stats?.dbpm), bpm: toNum(adv.stats?.bpm),
        vorp: toNum(adv.stats?.vorp), ws: toNum(adv.stats?.ws), ws_per_48: toNum(adv.stats?.ws_per_48),
        ows: toNum(adv.stats?.ows), dws: toNum(adv.stats?.dws),
        orb_pct: toNum(adv.stats?.orb_pct), drb_pct: toNum(adv.stats?.drb_pct), trb_pct: toNum(adv.stats?.trb_pct),
        ast_pct: toNum(adv.stats?.ast_pct), stl_pct: toNum(adv.stats?.stl_pct), blk_pct: toNum(adv.stats?.blk_pct),
        tov_pct: toNum(adv.stats?.tov_pct), off_rtg: toNum(adv.stats?.off_rtg), def_rtg: toNum(adv.stats?.def_rtg),
        fg3a_per_fga_pct: toNum(adv.stats?.fg3a_per_fga_pct),
        ast_tov: ratioOrNull(toNum(pg.stats?.ast_per_g), toNum(pg.stats?.tov_per_g)),
      } as unknown as PlayerAdvancedStats : null,
      shooting_profile: shooting ? {
        fga_pct_0_3ft: toNum(shooting.fga_pct_0_3ft), fga_pct_3_10ft: toNum(shooting.fga_pct_3_10ft),
        fga_pct_10_16ft: toNum(shooting.fga_pct_10_16ft), fga_pct_16_3pt: toNum(shooting.fga_pct_16_3pt),
        fga_pct_3pt: toNum(shooting.fga_pct_3pt), pct_2p_assisted: toNum(shooting.pct_2p_assisted),
        pct_3p_assisted: toNum(shooting.pct_3p_assisted), trb_pct: toNum(shooting.trb_pct),
        orb_pct: toNum(shooting.orb_pct), drb_pct: toNum(shooting.drb_pct),
        ast_pct: toNum(shooting.ast_pct), pga: toNum(shooting.pga), games_played: toNum(shooting.games_played),
      } : null,
      prior_seasons: [],  // historical: no multi-season blending
      game_log_pts: gameLogs.pts,
      game_log_trb: gameLogs.trb,
      game_log_ast: gameLogs.ast,
      projected_team_stats: teamStats ? {
        team,
        off_rtg: teamStats.off_rtg,
        def_rtg: teamStats.def_rtg,
        pace: teamStats.pace,
        league_avg_off_rtg: leagueAvgOffRtg,
        league_avg_def_rtg: leagueAvgDefRtg,
        league_avg_pace: leagueAvgPace,
      } : null,
    })
  }

  return inputs
}

// ─── League Context Builder ───────────────────────────────────────────────────

export function buildLeagueContext(inputs: PlayerRankingInput[]): LeagueMetricContext {
  const get = <K extends keyof any>(key: K, src: "per_game" | "advanced") =>
    buildPopulation(inputs, (p) => {
      const obj = p[src] as any
      return obj ? obj[key] : null
    })

  // Role-group populations keyed by GUARD/WING/BIG — MUST match getRoleGroup() output.
  // The old code keyed by exact position (PG/SG/SF/PF/C) which was incompatible
  // with roleAwarePercentileRank which expects GUARD/WING/BIG.
  const getByRoleGroup = (getValue: (p: PlayerRankingInput) => number | null) => {
    const map: Partial<Record<"GUARD" | "WING" | "BIG", number[]>> = {}
    for (const p of inputs) {
      const v = getValue(p)
      if (v == null) continue
      const role = getRoleGroup(p.position)
      if (!role) continue
      if (!map[role]) map[role] = []
      map[role]!.push(v)
    }
    return map
  }

  return {
    pts_per_g: get("pts", "per_game"),
    trb_per_g: get("trb", "per_game"),
    ast_per_g: get("ast", "per_game"),
    stl_per_g: get("stl", "per_game"),
    blk_per_g: get("blk", "per_game"),
    tov_per_g: get("tov", "per_game"),
    fg3_per_g: get("fg3", "per_game"),
    fg3a_per_g: get("fg3a", "per_game"),
    fta_per_g: get("fta", "per_game"),
    fg_pct: get("fg_pct", "per_game"),
    fg3_pct: get("fg3_pct", "per_game"),
    ft_pct: get("ft_pct", "per_game"),
    ts_pct: get("ts_pct", "advanced"),
    efg_pct: get("efg_pct", "per_game"),
    usg_pct: get("usg_pct", "advanced"),
    obpm: get("obpm", "advanced"),
    dbpm: get("dbpm", "advanced"),
    bpm: get("bpm", "advanced"),
    per: get("per", "advanced"),
    ws: get("ws", "advanced"),
    ws_per_48: get("ws_per_48", "advanced"),
    dws: get("dws", "advanced"),
    vorp: get("vorp", "advanced"),
    minutes_played: buildPopulation(inputs, (p) => p.games_played * p.minutes_per_game),
    minutes_per_game: buildPopulation(inputs, (p) => p.minutes_per_game),
    off_rtg: get("off_rtg", "advanced"),
    def_rtg: get("def_rtg", "advanced"),
    orb_pct: get("orb_pct", "advanced"),
    drb_pct: get("drb_pct", "advanced"),
    trb_pct: get("trb_pct", "advanced"),
    ast_pct: get("ast_pct", "advanced"),
    stl_pct: get("stl_pct", "advanced"),
    blk_pct: get("blk_pct", "advanced"),
    tov_pct: get("tov_pct", "advanced"),
    ast_tov: get("ast_tov", "advanced"),
    pts_per_100: buildPopulation(inputs, (p) => p.per_100?.pts ?? null),
    fg3a_rate: buildPopulation(inputs, (p) => {
      const pg = p.per_game
      if (!pg?.fga || pg.fga === 0) return null
      return (pg.fg3a ?? 0) / pg.fga
    }),
    trb_pct_by_role: getByRoleGroup((p) => p.advanced?.trb_pct ?? null),
    orb_pct_by_role: getByRoleGroup((p) => p.advanced?.orb_pct ?? null),
    drb_pct_by_role: getByRoleGroup((p) => p.advanced?.drb_pct ?? null),
    stl_pct_by_role: getByRoleGroup((p) => p.advanced?.stl_pct ?? null),
    blk_pct_by_role: getByRoleGroup((p) => p.advanced?.blk_pct ?? null),
    ast_pct_by_role: getByRoleGroup((p) => p.advanced?.ast_pct ?? null),
  }
}

// ─── Score Computation ────────────────────────────────────────────────────────

export function computePlayerBreakdown(
  input: PlayerRankingInput,
  league: LeagueMetricContext,
  isProjection: boolean
): PlayerScoreBreakdown {
  const minutes_played = input.games_played * input.minutes_per_game

  const offenseResult = computeOffenseScore(
    { per_game: input.per_game, advanced: input.advanced, per_100: input.per_100, minutes_played },
    league
  )
  const defenseResult = computeDefenseScore(
    { per_game: input.per_game, advanced: input.advanced, position: input.position, minutes_played },
    league
  )
  const scoringResult = computeScoringScore(
    { per_game: input.per_game, advanced: input.advanced, per_100: input.per_100, game_log_pts: input.game_log_pts, minutes_played },
    league
  )
  const playmakingResult = computePlaymakingScore(
    { per_game: input.per_game, advanced: input.advanced, minutes_played },
    league
  )
  const reboundingResult = computeReboundingScore(
    { per_game: input.per_game, advanced: input.advanced, position: input.position, minutes_played },
    league
  )
  const shootingResult = computeShootingScore(
    { per_game: input.per_game, advanced: input.advanced, minutes_played },
    league
  )
  const impactResult = computeImpactScore(
    { advanced: input.advanced, minutes_played },
    league
  )
  const roleVolumeResult = computeRoleVolumeScore(
    { minutes_played, minutes_per_game: input.minutes_per_game },
    league
  )
  const availabilityResult = computeAvailabilityScore({
    games_played: input.games_played,
    full_season_games: 82,
    minutes_per_game: input.minutes_per_game,
    prior_games_played: input.prior_seasons.map((s) => s.games_played),
  })

  // Two-Way uses raw (un-stretched) offense and defense scores — spec §12
  const twoWayResult = computeTwoWayScore({ offense_score: offenseResult.score, defense_score: defenseResult.score })

  // ── Historical Overall (LPI v2) ───────────────────────────────────────────
  // overall = 0.30*IMPACT + 0.26*OFF + 0.18*DEF + 0.14*PLAY + 0.12*ROLE_VOLUME
  // No stretch, no playoff boost, and no post-processing transformation.
  //
  // A component with ZERO available factors is omitted entirely and its weight
  // is redistributed across the components that do have data. Blending in a
  // full-weight neutral 50 would silently fabricate evidence — e.g. a player
  // whose ast_pct and ast_tov are both missing from the scrape would be scored
  // as a league-average playmaker rather than as unknown.
  const candidateComponents = [
    { key: "impact",     value: impactResult.score,     weight: OVERALL_WEIGHTS.impact,     used: impactResult.factors_used.length,     expected: EXPECTED_FACTOR_COUNTS.impact },
    { key: "offense",    value: offenseResult.score,    weight: OVERALL_WEIGHTS.offense,    used: offenseResult.factors_used.length,    expected: EXPECTED_FACTOR_COUNTS.offense },
    { key: "defense",    value: defenseResult.score,    weight: OVERALL_WEIGHTS.defense,    used: defenseResult.factors_used.length,    expected: EXPECTED_FACTOR_COUNTS.defense },
    { key: "playmaking", value: playmakingResult.score, weight: OVERALL_WEIGHTS.playmaking, used: playmakingResult.factors_used.length, expected: EXPECTED_FACTOR_COUNTS.playmaking },
    { key: "roleVolume", value: roleVolumeResult.score, weight: OVERALL_WEIGHTS.roleVolume, used: roleVolumeResult.factors_used.length, expected: EXPECTED_FACTOR_COUNTS.roleVolume },
  ]

  // Fully dead: no factors at all. The component is dropped and its weight
  // redistributed rather than blended in as a fabricated neutral 50.
  const missing_components = candidateComponents.filter((c) => c.used === 0).map((c) => c.key)

  // Degraded: the component survived but on a minority of its inputs. This is
  // how a scrape that loses 4 of 5 defensive metrics (e.g. dbpm/dws/blk%/drb%
  // absent, leaving only stl%) produces a confident-looking but thinly
  // sourced score. Such players must not be presented as fully evidenced.
  const degraded_components = candidateComponents
    .filter((c) => c.used > 0 && c.used / c.expected < MIN_FACTOR_COVERAGE)
    .map((c) => c.key)

  const overallComponents = candidateComponents.filter((c) => c.used > 0)

  // weightedAverage() renormalizes the surviving weights to sum to 1.
  let historical_overall_score = overallComponents.length > 0
    ? clampScore(weightedAverage(overallComponents))
    : 50

  // ── Invariant Check ───────────────────────────────────────────────────────
  // historical_overall_score MUST equal the weighted sum within tolerance.
  const expectedOverall = overallComponents.reduce((s, c) => s + c.value * c.weight, 0)
  if (Math.abs(historical_overall_score - expectedOverall) > 0.1) {
    console.error(
      `[INVARIANT VIOLATION] ${input.player_name}: historical_overall=${historical_overall_score} but formula gives ${expectedOverall}`
    )
  }

  // Projected overall: projection handles its own adjustment logic
  let projected_overall_score = historical_overall_score
  let age_adjustment = 0
  let team_context_score = 50

  if (isProjection) {
    const projResult = projectPlayerOverallScore(
      historical_overall_score,
      input,
      0.1 // k_A — from PROJECTION_WEIGHTS.k_A
    )
    projected_overall_score = projResult.projected_score
    age_adjustment = projResult.age_adj
    team_context_score = 50  // v1: team_fit = 0
    // Do NOT overwrite availabilityResult.score here.
    // The canonical availability is the score from computeAvailabilityScore.
    // The projection uses avail_adj separately for score adjustment only.
  }

  return {
    player_name: input.player_name,
    player_id: input.player_id,
    position: input.position,
    age: input.age,
    impact_score: impactResult.score,
    role_volume_score: roleVolumeResult.score,
    offense_score: offenseResult.score,
    defense_score: defenseResult.score,
    scoring_score: scoringResult.score,
    playmaking_score: playmakingResult.score,
    rebounding_score: reboundingResult.score,
    shooting_score: shootingResult.score,
    availability_score: availabilityResult.score,   // canonical 0-100 availability — never overwritten
    team_context_score,
    two_way_score: twoWayResult.score,
    age_adjustment,
    multi_season_score: historical_overall_score,
    historical_overall_score,
    projected_overall_score,
    confidence: availabilityResult.confidence,
    // A player missing or thinly sourcing an LPI component is low-confidence
    // regardless of games played — the score rests on redistributed weight.
    low_confidence:
      availabilityResult.low_confidence ||
      missing_components.length > 0 ||
      degraded_components.length > 0,
    missing_components,
    degraded_components,
    games_played: input.games_played,
    minutes_per_game: input.minutes_per_game,
    factors_used: {
      impact: impactResult.factors_used,
      role_volume: roleVolumeResult.factors_used,
      offense: offenseResult.factors_used,
      defense: defenseResult.factors_used,
      scoring: scoringResult.factors_used,
      playmaking: playmakingResult.factors_used,
      rebounding: reboundingResult.factors_used,
      shooting: shootingResult.factors_used,
    },
  }
}

// ─── Ranking Builder ──────────────────────────────────────────────────────────

/**
 * Takes computed breakdowns and builds ranked rows for a specific ranking type.
 * Deterministic: ties broken by offense_score → defense_score → player_name (alphabetical).
 */
export function buildRankedRows(
  breakdowns: PlayerScoreBreakdown[],
  config: RankingConfig,
  rankingType: RankingType,
  priorRankMap: Map<string, number>,
  isProjection: boolean
): NBAPlayerRankingRow[] {
  // Get the score for this ranking type
  const getScore = (b: PlayerScoreBreakdown): number => {
    switch (rankingType) {
      case "overall":     return isProjection ? b.projected_overall_score : b.historical_overall_score
      case "offense":     return b.offense_score
      case "defense":     return b.defense_score
      case "scoring":     return b.scoring_score
      case "playmaking":  return b.playmaking_score
      case "rebounding":  return b.rebounding_score
      case "shooting":    return b.shooting_score
      case "two_way":     return b.two_way_score
      case "young":       return isProjection ? b.projected_overall_score : b.historical_overall_score
      case "breakout":    return isProjection ? b.projected_overall_score : b.historical_overall_score
      default:            return isProjection ? b.projected_overall_score : b.historical_overall_score
    }
  }

  // Filter based on ranking type, with canonical BOTH-condition qualification
  let eligible = breakdowns

  // Canonical dual-condition qualification: games AND minutes.
  // Thresholds ramp down early in the season when they are provided on config;
  // absent, isQualified() applies the full-season 20/400 bar.
  eligible = eligible.filter((b) => {
    const minutes_played = b.games_played * b.minutes_per_game
    return isQualified(b.games_played, minutes_played, config.qualification)
  })

  if (rankingType === "young") {
    eligible = eligible.filter((b) => b.age != null && b.age <= YOUNG_MAX_AGE)
  }

  if (rankingType === "breakout" && isProjection) {
    // Breakout = significant positive own-score improvement, not rank change
    eligible = eligible.filter((b) => {
      const lpiChange = b.projected_overall_score - b.historical_overall_score
      return lpiChange >= BREAKOUT_SCORE_DELTA && b.projected_overall_score >= BREAKOUT_MIN_SCORE
    })
  }

  if (rankingType === "decline" && isProjection) {
    // Decline = significant negative own-score regression
    eligible = eligible.filter((b) => {
      const lpiChange = b.projected_overall_score - b.historical_overall_score
      return lpiChange <= DECLINE_SCORE_DELTA
    })
  }

  // Sort deterministically
  const sorted = [...eligible].sort((a, b) => {
    const sa = getScore(a)
    const sb = getScore(b)
    if (sb !== sa) return sb - sa  // higher score = better rank
    if (b.offense_score !== a.offense_score) return b.offense_score - a.offense_score
    if (b.defense_score !== a.defense_score) return b.defense_score - a.defense_score
    return a.player_name.localeCompare(b.player_name)  // alphabetical tie-breaker
  })

  const topN = sorted.slice(0, config.top_n)

  return topN.map((b, i) => {
    const rank = i + 1
    const score = getScore(b)
    const tier = assignTier(score)
    const previousRank = priorRankMap.get(b.player_name) ?? null
    const rankChange = previousRank !== null ? previousRank - rank : null
    const isNew = previousRank === null

    const strengths = getStrengths(b)
    const weaknesses = getWeaknesses(b)
    const { explanation, outlook } = generatePlayerExplanation(
      b.player_name, rank, score, tier, b.position, null, null,
      rankChange, isNew, isProjection, b
    )

    const signature = generateSignature(b)
    const player_class = generatePlayerClass(b)
    const potential = generatePotential(b.age, rankChange, score)
    const ceiling = generateCeiling(tier, potential)
    const status = generateStatus(rankChange, isNew)

    return {
      player_id: b.player_id,
      player_name: b.player_name,
      position: b.position,
      age: b.age,
      season: config.season,
      ranking_type: rankingType,
      ranking_version: config.ranking_version,
      ranking_mode: config.ranking_mode,
      rank,
      score,
      tier,
      previous_rank: previousRank,
      rank_change: rankChange,
      team: null,     // resolved by pipeline from team history
      historical_team: null,
      projected_team: null,
      is_published: false,
      published_at: null,
      confidence: b.confidence,
      is_new: isNew,
      low_confidence: b.low_confidence,
      games_played: b.games_played,
      minutes_per_game: b.minutes_per_game,
      impact_score: b.impact_score,
      role_volume_score: b.role_volume_score,
      offense_score: b.offense_score,
      defense_score: b.defense_score,
      scoring_score: b.scoring_score,
      playmaking_score: b.playmaking_score,
      rebounding_score: b.rebounding_score,
      shooting_score: b.shooting_score,
      two_way_score: b.two_way_score,
      availability_score: b.availability_score,
      team_context_score: 50,
      age_adjustment: 0,
      multi_season_weight: null,
      explanation,
      strengths,
      weaknesses,
      outlook,
      signature,
      player_class,
      potential,
      ceiling,
      status,
    }
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

/**
 * Basketball Reference stores a traded player's aggregate row as `2TM`, `3TM`,
 * etc. Prefer that row over team stints so a player enters the real population
 * exactly once. Players with only one stint keep their actual team row.
 */
function selectCanonicalPlayerRows(rows: any[]): any[] {
  const byPlayer = new Map<string, any[]>()
  for (const row of rows) {
    if (!row.player_name || row.player_name === "League Average") continue
    const group = byPlayer.get(row.player_name) ?? []
    group.push(row)
    byPlayer.set(row.player_name, group)
  }

  // NOTE: the pattern below must be /^\d+TM$/ — an earlier version used
  // /^\\d+TM$/, which matches a literal backslash and therefore never matched
  // any real "2TM"/"3TM" row, silently ranking traded players off a single stint.
  return Array.from(byPlayer.values()).map((group) =>
    group.find((row) => row.team === "TOT" || /^\d+TM$/.test(row.team ?? "")) ?? group[0]
  )
}
