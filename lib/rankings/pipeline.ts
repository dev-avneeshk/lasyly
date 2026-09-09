/**
 * NBA Ranking Engine — Pipeline Orchestrator
 *
 * The main entry point for the ranking system. Runs all 20 steps of the
 * ranking pipeline deterministically and writes results to Supabase.
 *
 * Usage:
 *   const result = await runRankingPipeline(config)
 *   // Check result.errors before publishing
 *
 * The pipeline is idempotent for the same ranking_version:
 * - Existing rows for the same version are upserted (not duplicated)
 * - Historical rankings (2025-26) are NOT regenerated unless explicitly configured
 *
 * Dry-run mode: if config.dry_run = true, computes everything but writes nothing.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import {
  loadHistoricalPlayerData,
  buildLeagueContext,
  computePlayerBreakdown,
  buildRankedRows,
} from "./engine/historical"
import {
  loadProjectionPlayerData,
  blendMultiSeasonStats,
} from "./engine/projection"
import {
  computeAllTeamPower,
} from "./engine/team"
import {
  buildDefaultConfig,
  ALGORITHM_VERSION,
  resolveQualification,
} from "./config"
import type {
  RankingConfig,
  PlayerRankingInput,
  NBAPlayerRankingRow,
  NBATeamRankingRow,
  PipelineResult,
  RankingType,
} from "./types"

// ─── Main Pipeline ────────────────────────────────────────────────────────────

export async function runRankingPipeline(config: RankingConfig): Promise<PipelineResult> {
  const start = Date.now()
  const warnings: string[] = []
  const errors: string[] = []
  let player_rankings_computed = 0
  let team_rankings_computed = 0

  const supabase = createAdminClient()

  console.log(`[pipeline] Starting ranking pipeline for ${config.season} (${config.ranking_version})`)
  console.log(`[pipeline] Dry run: ${config.dry_run}`)

  try {
    validateMetricOwnership()
    // ── Step 1: Upsert ranking version record ────────────────────────────────
    if (!config.dry_run) {
      if (config.ranking_mode === "historical") {
        const { data: existingVersion, error: existingVersionError } = await supabase
          .from("nba_ranking_versions")
          .select("status")
          .eq("ranking_version", config.ranking_version)
          .maybeSingle()
        if (existingVersionError) throw new Error(`Failed to inspect historical version: ${existingVersionError.message}`)
        if (existingVersion?.status === "published") {
          throw new Error(`Historical ranking version ${config.ranking_version} is published and immutable`)
        }
      }
      const { error: versionErr } = await supabase
        .from("nba_ranking_versions")
        .upsert({
          ranking_version: config.ranking_version,
          season: config.season,
          ranking_mode: config.ranking_mode,
          algorithm_version: config.algorithm_version,
          status: "draft",
          weights: config.weights as any,
          generated_at: new Date().toISOString(),
        }, { onConflict: "ranking_version" })

      if (versionErr) throw new Error(`Failed to upsert version: ${versionErr.message}`)
    }

    // ── Step 2: Load player data ──────────────────────────────────────────────
    console.log(`[pipeline] Loading player data...`)
    let playerInputs: PlayerRankingInput[]

    if (config.is_projection) {
      playerInputs = await loadProjectionPlayerData(config.historical_season, config.season)
    } else {
      playerInputs = await loadHistoricalPlayerData(config.historical_season)
    }

    console.log(`[pipeline] Loaded ${playerInputs.length} players`)

    if (playerInputs.length === 0) {
      errors.push("No player data found — check that nba_player_season_stats is populated")
      return makeResult(start, config, 0, 0, warnings, errors)
    }

    // ── Step 3: Apply multi-season blending for projections ──────────────────
    if (config.is_projection) {
      playerInputs = playerInputs.map((input) => {
        const { blended_per_game, blended_advanced, blended_per_100 } = blendMultiSeasonStats(input)
        return {
          ...input,
          per_game: blended_per_game,
          advanced: blended_advanced,
          per_100: blended_per_100,
        }
      })
    }

    // ── Step 4: Resolve player IDs from nba_players table ────────────────────
    const { data: playerIdRows } = await supabase
      .from("nba_players")
      .select("id, player_name")
    const playerIdMap = new Map<string, string>()
    for (const row of (playerIdRows ?? []) as any[]) {
      playerIdMap.set(row.player_name, row.id)
    }
    playerInputs = playerInputs.map((p) => ({
      ...p,
      player_id: playerIdMap.get(p.player_name) ?? null,
    }))

    // ── Step 5: Resolve team assignments for the target season ────────────────
    const { data: teamHistoryRows } = await supabase
      .from("nba_player_team_history")
      .select("player_name, team")
      .eq("season", config.season)
      .eq("is_primary", true)
    const team2627Map = new Map<string, string>()
    for (const row of (teamHistoryRows ?? []) as any[]) {
      team2627Map.set(row.player_name, row.team)
    }

    // ── Step 5.5: Resolve early-season qualification thresholds ───────────────
    // The league leader's games-played sets how mature the season is. Early on
    // (nobody near 20 games) the bar ramps down so the board isn't empty.
    const maxLeagueGames = playerInputs.reduce((m, p) => Math.max(m, p.games_played || 0), 0)
    config.qualification = resolveQualification(maxLeagueGames)
    console.log(`[pipeline] Qualification: >=${config.qualification.games}g & >=${config.qualification.minutes}min (league leader has ${maxLeagueGames}g)`)

    // ── Step 6: Build league context (for normalization) ──────────────────────
    console.log(`[pipeline] Building league context...`)
    const leagueContext = buildLeagueContext(playerInputs)

    // ── Step 7: Compute per-player score breakdowns ───────────────────────────
    console.log(`[pipeline] Computing player scores...`)
    const breakdowns = playerInputs.map((input) =>
      computePlayerBreakdown(input, leagueContext, config.is_projection)
    )

    // ── Step 7.5: Validate Metric Ownership ───────────────────────────────────
    // ── Step 8: Load prior ranking for rank_change ────────────────────────────
    // Query the previous season's overall ranking for all players
    const { data: priorRankRows } = await supabase
      .from("nba_player_rankings")
      .select("player_name, rank")
      .eq("season", config.historical_season)
      .eq("ranking_type", "overall")

    const priorRankMap = new Map<string, number>()
    for (const row of (priorRankRows ?? []) as any[]) {
      priorRankMap.set(row.player_name, Number(row.rank))
    }

    // ── Step 9: Build ranked rows for each ranking type ───────────────────────
    console.log(`[pipeline] Building ranked rows for ${config.ranking_types.length} ranking types...`)
    const allPlayerRankingRows: NBAPlayerRankingRow[] = []

    for (const rankingType of config.ranking_types) {
      const rows = buildRankedRows(
        breakdowns, config, rankingType, priorRankMap, config.is_projection
      )

      // Enrich with team assignments
      const enriched = rows.map((row) => ({
        ...row,
        projected_team: team2627Map.get(row.player_name) ?? playerInputs.find((p) => p.player_name === row.player_name)?.historical_team ?? null,
        historical_team: playerInputs.find((p) => p.player_name === row.player_name)?.historical_team ?? null,
        team: team2627Map.get(row.player_name) ?? playerInputs.find((p) => p.player_name === row.player_name)?.historical_team ?? null,
        multi_season_weight: config.is_projection ? config.weights.seasons : null,
      }))

      allPlayerRankingRows.push(...enriched)
      console.log(`[pipeline]   ${rankingType}: ${rows.length} players ranked`)
    }

    // ── Step 10: Validation ───────────────────────────────────────────────────
    const validationIssues = validatePlayerRankings(allPlayerRankingRows)
    if (validationIssues.length > 0) {
      // Validation failures are write barriers, never merely warnings.
      errors.push(...validationIssues)
      return makeResult(start, config, 0, 0, warnings, errors)
    }

    // ── Step 11: Write player rankings to DB ──────────────────────────────────
    if (!config.dry_run) {
      console.log(`[pipeline] Writing ${allPlayerRankingRows.length} player ranking rows...`)
      const BATCH_SIZE = 200
      for (let i = 0; i < allPlayerRankingRows.length; i += BATCH_SIZE) {
        const batch = allPlayerRankingRows.slice(i, i + BATCH_SIZE)
        const { error: insertErr } = await supabase
          .from("nba_player_rankings")
          .upsert(batch as any, {
            onConflict: "player_name,season,ranking_mode,ranking_type,ranking_version",
          })
        if (insertErr) {
          errors.push(`Failed to write player rankings batch ${i}: ${insertErr.message}`)
        }
      }
    }

    player_rankings_computed = allPlayerRankingRows.length

    // ── Step 12: Write to nba_ranking_history (immutable) ────────────────────
    if (!config.dry_run) {
      const historyRows = allPlayerRankingRows.map((r) => ({
        entity_type: "player",
        entity_id: r.player_id ?? undefined,
        entity_name: r.player_name,
        season: r.season,
        ranking_mode: r.ranking_mode,
        ranking_type: r.ranking_type,
        rank: r.rank,
        score: r.score,
        previous_rank: r.previous_rank,
        rank_change: r.rank_change,
        ranking_version: r.ranking_version,
      }))

      // History is append-only: don't upsert, use insert with on_conflict do nothing
      const { error: histErr } = await supabase
        .from("nba_ranking_history")
        .insert(historyRows as any)
      if (histErr && !histErr.message.includes("duplicate")) {
        warnings.push(`History insert issue: ${histErr.message}`)
      }
    }

    // ── Step 13: Compute team power rankings ──────────────────────────────────
    console.log(`[pipeline] Computing team power rankings...`)
    try {
      // Build team inputs from the newly computed player rows
      const teamInputs = allPlayerRankingRows
        .filter(r => r.ranking_type === "overall" && r.projected_team)
        .map(r => ({
          team: r.projected_team!,
          player_name: r.player_name,
          projected_score: r.score,
          availability_score: r.availability_score ?? 0,
          is_returning: r.projected_team === r.historical_team
        }))

      if (teamInputs.length > 0) {
        const teamBreakdowns = computeAllTeamPower(teamInputs)

        // Prior team rankings
        const { data: priorTeamRankRows } = await supabase
          .from("nba_team_rankings")
          .select("team, rank")
          .eq("season", config.historical_season)
          .eq("ranking_type", "power")
        const priorTeamRankMap = new Map<string, number>()
        for (const row of (priorTeamRankRows ?? []) as any[]) {
          priorTeamRankMap.set(row.team, Number(row.rank))
        }

        const teamRankingRows: NBATeamRankingRow[] = []
        // Sort teams by power score
        const sortedTeams = Array.from(teamBreakdowns.values()).sort((a, b) => b.team_power_score - a.team_power_score)
        
        let currentRank = 1
        for (const breakdown of sortedTeams) {
          const previous_rank = priorTeamRankMap.get(breakdown.team) ?? null
          teamRankingRows.push({
            team: breakdown.team,
            team_full_name: breakdown.team, // We can enrich this later if needed
            season: config.season,
            ranking_mode: config.ranking_mode,
            ranking_version: config.ranking_version,
            ranking_type: "power",
            rank: currentRank,
            power_score: breakdown.team_power_score,
            tier: "A", // Simplify tier assignment for now, or use tier logic
            offensive_score: breakdown.core_score,
            defensive_score: breakdown.depth_score,
            depth_score: breakdown.depth_score,
            star_power_score: breakdown.star_score,
            net_score: breakdown.team_avail_score,
            previous_rank,
            rank_change: previous_rank !== null ? previous_rank - currentRank : null,
            projected_wins: null,
            projected_win_pct: null,
            is_published: false,
            published_at: null,
            key_additions: [],
            key_losses: [],
            returning_core_pct: breakdown.continuity_score,
            explanation: null,
            why_ranked_here: null,
            team_class: null,
          })
          currentRank++
        }

        if (!config.dry_run) {
          const { error: teamErr } = await supabase
            .from("nba_team_rankings")
            .upsert(teamRankingRows as any, {
              onConflict: "team,season,ranking_mode,ranking_version,ranking_type",
            })
          if (teamErr) errors.push(`Failed to write team rankings: ${teamErr.message}`)
        }

        team_rankings_computed = teamRankingRows.length
        console.log(`[pipeline] Team rankings: ${teamRankingRows.length} teams`)
      } else {
        warnings.push("No team roster data found — team rankings skipped.")
      }
    } catch (teamErr) {
      warnings.push(`Team ranking failed (non-fatal): ${(teamErr as Error).message}`)
    }

    // ── Step 14: Update version record with counts ────────────────────────────
    if (!config.dry_run) {
      await supabase
        .from("nba_ranking_versions")
        .update({
          player_count: player_rankings_computed / config.ranking_types.length,
          team_count: team_rankings_computed,
          generated_at: new Date().toISOString(),
        })
        .eq("ranking_version", config.ranking_version)
    }

    console.log(`[pipeline] Done in ${Date.now() - start}ms`)

  } catch (err) {
    const msg = (err as Error).message
    console.error(`[pipeline] Fatal error:`, err)
    errors.push(msg)
  }

  return makeResult(start, config, player_rankings_computed, team_rankings_computed, warnings, errors)
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validatePlayerRankings(rows: NBAPlayerRankingRow[]): string[] {
  const issues: string[] = []

  // Check each ranking type
  const byType = new Map<string, NBAPlayerRankingRow[]>()
  for (const row of rows) {
    const key = `${row.season}-${row.ranking_type}-${row.ranking_version}`
    if (!byType.has(key)) byType.set(key, [])
    byType.get(key)!.push(row)
  }

  for (const [key, typeRows] of byType.entries()) {
    for (const row of typeRows) {
      if (!Number.isFinite(row.score) || row.score < 0 || row.score > 100) {
        issues.push(`[validation] Invalid score for ${row.player_name} in ${key}`)
      }
      if (!Number.isFinite(row.offense_score) || !Number.isFinite(row.defense_score) || !Number.isFinite(row.playmaking_score)) {
        issues.push(`[validation] Non-finite component for ${row.player_name} in ${key}`)
      }
    }
    const ranks = typeRows.map((r) => r.rank)
    const rankSet = new Set(ranks)

    if (rankSet.size !== ranks.length) {
      issues.push(`[validation] Duplicate ranks detected in ${key}`)
    }

    const rank1 = typeRows.filter((r) => r.rank === 1)
    if (rank1.length === 0) {
      issues.push(`[validation] No rank #1 found in ${key}`)
    } else if (rank1.length > 1) {
      issues.push(`[validation] Multiple rank #1 found in ${key}: ${rank1.map((r) => r.player_name).join(", ")}`)
    }
  }

  return issues
}

function validateMetricOwnership(): void {
  // Static validation is deterministic: ownership does not depend on which
  // metrics happened to be available for the first player in a pipeline run.
  const factorsUsed: Record<string, string[]> = {
    impact: ["bpm", "vorp", "ws_per_48"],
    offense: ["obpm", "ts_pct", "usg_pct", "pts_per_100"],
    defense: ["dbpm", "dws", "stl_pct", "blk_pct", "drb_pct"],
    playmaking: ["ast_pct", "ast_tov"],
    role_volume: ["total_minutes", "minutes_per_game"],
  }
  const allFactors = new Set<string>()
  const duplicates = new Set<string>()

  const checkFactors = (componentName: string) => {
    const factors = factorsUsed[componentName] || []
    for (const factor of factors) {
      if (allFactors.has(factor)) {
        duplicates.add(factor)
      } else {
        allFactors.add(factor)
      }
    }
  }

  // LPI v2 overall uses Impact, Offense, Defense, Playmaking, and Role/Volume.
  // `bpm`/`vorp`/`ws_per_48` are composite metrics that internally reflect
  // offense and defense, but they are distinct inputs from `obpm`/`dbpm` and so
  // do not constitute double-counting of the same raw column.
  checkFactors("impact")
  checkFactors("offense")
  checkFactors("defense")
  checkFactors("playmaking")
  checkFactors("role_volume")

  if (duplicates.size > 0) {
    throw new Error(`[validation] Metric ownership violation! The following metrics are used multiple times in LPI: ${Array.from(duplicates).join(", ")}`)
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeResult(
  start: number,
  config: RankingConfig,
  player_rankings_computed: number,
  team_rankings_computed: number,
  warnings: string[],
  errors: string[]
): PipelineResult {
  return {
    season: config.season,
    ranking_version: config.ranking_version,
    ranking_mode: config.ranking_mode,
    algorithm_version: config.algorithm_version,
    player_rankings_computed,
    team_rankings_computed,
    warnings,
    errors,
    duration_ms: Date.now() - start,
    dry_run: config.dry_run,
  }
}

// ─── Quick Trigger Helper ─────────────────────────────────────────────────────

/**
 * Convenience function to run a standard 2026-27 projection ranking.
 * Used by the API route POST /api/jobs/generate-rankings.
 */
export async function runProjectionRankings(season = "2026-27", historicalSeason = "2025-26", options?: {
  dryRun?: boolean
  version?: string
}): Promise<PipelineResult> {
  const version = options?.version ?? `${season}-v${Date.now()}`
  const config = buildDefaultConfig(
    season,
    historicalSeason,
    version,
    "projected",
    options?.dryRun ?? false
  )
  return runRankingPipeline(config)
}

/**
 * Run historical rankings (frozen — use sparingly, only for initial seed).
 */
export async function runHistoricalSeasonRankings(season = "2025-26", options?: {
  dryRun?: boolean
  version?: string
}): Promise<PipelineResult> {
  const version = options?.version ?? `${season}-v1`
  const config = buildDefaultConfig(
    season,
    season,
    version,
    "historical",
    options?.dryRun ?? false
  )
  return runRankingPipeline(config)
}
