/**
 * NFL Ranking Pipeline — orchestrator (data I/O + write).
 *
 * Loads recent nfl_player_stats box scores, aggregates per player, scores them
 * with the pure engine, ranks each ranking_type, and upserts into
 * nfl_player_rankings under a fixed ranking_version. Designed to run daily and
 * overwrite in place (idempotent per version).
 *
 * Dry-run mode computes everything but writes nothing — used to verify the
 * engine against live data before the table exists.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import {
  ALGORITHM_VERSION,
  aggregatePlayer,
  buildRankedRowsInput,
  resolveMinGames,
  scoreAll,
} from "./engine-helpers"
import { buildTeamRankings } from "./team"
import type {
  NflStatRow,
  NflPlayerAggregate,
  NflRankingRow,
  NflRankingType,
  NflPipelineResult,
} from "./types"

export interface NflRankingConfig {
  season: string // '2026'
  ranking_version: string // 'nfl-2026-v1'
  /** How far back (days) to pull box scores. A full-ish season. */
  history_days: number
  ranking_types: NflRankingType[]
  dry_run: boolean
}

export function buildDefaultNflConfig(
  season = String(new Date().getUTCFullYear()),
  version = `nfl-${season}-v1`,
  dryRun = false
): NflRankingConfig {
  return {
    season,
    ranking_version: version,
    history_days: 400,
    ranking_types: ["overall", "offense", "defense", "scoring", "playmaking"],
    dry_run: dryRun,
  }
}

const SELECT_COLUMNS = [
  "player_name", "athlete_id", "team", "position", "game_date",
  "pass_yds", "pass_td", "pass_int", "pass_att", "pass_c", "pass_rtg",
  "rush_att", "rush_yds", "rush_td",
  "rec", "rec_yds", "rec_td", "targets",
  "fumbles_lost", "tackles_total", "sacks", "def_int", "def_td", "passes_def",
].join(", ")

/** Load & group box-score rows by player over the history window. */
async function loadAggregates(config: NflRankingConfig): Promise<NflPlayerAggregate[]> {
  const supabase = createAdminClient()

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - config.history_days)
  const cutoffStr = cutoff.toISOString().split("T")[0]

  const byPlayer = new Map<string, NflStatRow[]>()

  const pageSize = 1000
  const maxRows = 60_000
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const { data, error } = await supabase
      .from("nfl_player_stats")
      .select(SELECT_COLUMNS)
      .gte("game_date", cutoffStr)
      .order("game_date", { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error) {
      throw new Error(`nfl_player_stats query failed: ${error.message}`)
    }
    if (!data || data.length === 0) break

    for (const raw of data as any[]) {
      const name = raw.player_name as string
      if (!name) continue
      const row: NflStatRow = {
        player_name: name,
        athlete_id: raw.athlete_id ?? null,
        team: raw.team ?? null,
        position: raw.position ?? null,
        game_date: raw.game_date ?? "",
        pass_yds: Number(raw.pass_yds) || 0,
        pass_td: Number(raw.pass_td) || 0,
        pass_int: Number(raw.pass_int) || 0,
        pass_att: Number(raw.pass_att) || 0,
        pass_c: Number(raw.pass_c) || 0,
        pass_rtg: Number(raw.pass_rtg) || 0,
        rush_att: Number(raw.rush_att) || 0,
        rush_yds: Number(raw.rush_yds) || 0,
        rush_td: Number(raw.rush_td) || 0,
        rec: Number(raw.rec) || 0,
        rec_yds: Number(raw.rec_yds) || 0,
        rec_td: Number(raw.rec_td) || 0,
        targets: Number(raw.targets) || 0,
        fumbles_lost: Number(raw.fumbles_lost) || 0,
        tackles_total: Number(raw.tackles_total) || 0,
        sacks: Number(raw.sacks) || 0,
        def_int: Number(raw.def_int) || 0,
        def_td: Number(raw.def_td) || 0,
        passes_def: Number(raw.passes_def) || 0,
      }
      if (!byPlayer.has(name)) byPlayer.set(name, [])
      byPlayer.get(name)!.push(row)
    }

    if (data.length < pageSize) break
  }

  return [...byPlayer.values()].map(aggregatePlayer)
}

/** Load the previous version's ranks so rank_change can be computed. */
async function loadPriorRanks(
  version: string,
  season: string
): Promise<Map<string, Map<NflRankingType, number>>> {
  const out = new Map<string, Map<NflRankingType, number>>()
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("nfl_player_rankings")
    .select("player_name, ranking_type, rank")
    .eq("ranking_version", version)
    .eq("season", season)

  for (const row of (data ?? []) as any[]) {
    const name = row.player_name as string
    if (!out.has(name)) out.set(name, new Map())
    out.get(name)!.set(row.ranking_type as NflRankingType, Number(row.rank))
  }
  return out
}

/** Load the previous version's team ranks for rank_change. */
async function loadPriorTeamRanks(version: string, season: string): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("nfl_team_rankings")
    .select("team, rank")
    .eq("ranking_version", version)
    .eq("season", season)
    .eq("ranking_type", "power")
  for (const row of (data ?? []) as any[]) {
    out.set(row.team as string, Number(row.rank))
  }
  return out
}

export async function runNflRankingPipeline(config: NflRankingConfig): Promise<NflPipelineResult> {
  const start = Date.now()
  const warnings: string[] = []
  const errors: string[] = []
  let computed = 0

  try {
    console.log(`[nfl-rankings] Loading box scores (${config.history_days}d window)...`)
    const aggregates = await loadAggregates(config)
    console.log(`[nfl-rankings] Aggregated ${aggregates.length} players`)

    if (aggregates.length === 0) {
      errors.push("No player data found — nfl_player_stats is empty for the window")
      return makeResult(start, config, 0, warnings, errors)
    }

    const maxGames = aggregates.reduce((m, a) => Math.max(m, a.games), 0)
    const minGames = resolveMinGames(maxGames)
    const qualified = aggregates.filter((a) => a.games >= minGames)
    console.log(`[nfl-rankings] ${qualified.length} qualified (>=${minGames}g; leader ${maxGames}g)`)

    // Load prior ranks BEFORE we overwrite them (best-effort; table may be new).
    let priorRanks = new Map<string, Map<NflRankingType, number>>()
    if (!config.dry_run) {
      try {
        priorRanks = await loadPriorRanks(config.ranking_version, config.season)
      } catch (e) {
        warnings.push(`Prior-rank lookup skipped: ${(e as Error).message}`)
      }
    }

    // Score + rank every ranking_type.
    const rows: NflRankingRow[] = buildRankedRowsInput(
      qualified,
      maxGames,
      config,
      priorRanks
    )

    // Team power rankings, derived from the same scored player pool.
    let priorTeamRanks = new Map<string, number>()
    if (!config.dry_run) {
      try {
        priorTeamRanks = await loadPriorTeamRanks(config.ranking_version, config.season)
      } catch (e) {
        warnings.push(`Prior team-rank lookup skipped: ${(e as Error).message}`)
      }
    }
    const scored = scoreAll(qualified, maxGames)
    const teamRows = buildTeamRankings(scored, config.season, config.ranking_version, priorTeamRanks)

    // Validate before writing.
    const issues = validate(rows)
    if (issues.length > 0) {
      errors.push(...issues)
      return makeResult(start, config, 0, warnings, errors)
    }

    computed = rows.length

    if (!config.dry_run) {
      const supabase = createAdminClient()

      // Version registry (draft → published in one shot; NFL publishes live).
      const { error: verErr } = await supabase
        .from("nfl_ranking_versions")
        .upsert(
          {
            ranking_version: config.ranking_version,
            season: config.season,
            algorithm_version: ALGORITHM_VERSION,
            status: "published",
            player_count: qualified.length,
            generated_at: new Date().toISOString(),
            published_at: new Date().toISOString(),
          },
          { onConflict: "ranking_version" }
        )
      if (verErr) warnings.push(`Version upsert issue: ${verErr.message}`)

      // Remove ranks for players who dropped out of this run (stale slate),
      // scoped to this version, so the board never shows yesterday's leftovers.
      const keepNames = [...new Set(rows.map((r) => r.player_name))]
      const { error: delErr } = await supabase
        .from("nfl_player_rankings")
        .delete()
        .eq("ranking_version", config.ranking_version)
        .not("player_name", "in", `(${keepNames.map((n) => `"${n.replace(/"/g, "")}"`).join(",")})`)
      if (delErr) warnings.push(`Stale cleanup issue: ${delErr.message}`)

      const BATCH = 200
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH)
        const { error } = await supabase
          .from("nfl_player_rankings")
          .upsert(batch as any, {
            onConflict: "player_name,season,ranking_type,ranking_version",
          })
        if (error) errors.push(`Write batch ${i} failed: ${error.message}`)
      }

      // Team power rankings (best-effort — a missing nfl_team_rankings table
      // must not fail the player board, which is the primary product).
      if (teamRows.length > 0) {
        const { error: teamErr } = await supabase
          .from("nfl_team_rankings")
          .upsert(teamRows as any, {
            onConflict: "team,season,ranking_type,ranking_version",
          })
        if (teamErr) warnings.push(`Team rankings write issue: ${teamErr.message}`)
      }
    }

    console.log(
      `[nfl-rankings] Done in ${Date.now() - start}ms — ${computed} player rows, ${teamRows.length} team rows`
    )
  } catch (err) {
    console.error("[nfl-rankings] Fatal:", err)
    errors.push((err as Error).message)
  }

  return makeResult(start, config, computed, warnings, errors)
}

function validate(rows: NflRankingRow[]): string[] {
  const issues: string[] = []
  const byType = new Map<NflRankingType, NflRankingRow[]>()
  for (const r of rows) {
    if (!byType.has(r.ranking_type)) byType.set(r.ranking_type, [])
    byType.get(r.ranking_type)!.push(r)
  }
  for (const [type, group] of byType) {
    const ranks = group.map((g) => g.rank)
    if (new Set(ranks).size !== ranks.length) issues.push(`Duplicate ranks in ${type}`)
    if (!group.some((g) => g.rank === 1)) issues.push(`No rank #1 in ${type}`)
    for (const g of group) {
      if (!Number.isFinite(g.score) || g.score < 0 || g.score > 100) {
        issues.push(`Invalid score for ${g.player_name} in ${type}`)
      }
    }
  }
  return issues
}

function makeResult(
  start: number,
  config: NflRankingConfig,
  computed: number,
  warnings: string[],
  errors: string[]
): NflPipelineResult {
  return {
    season: config.season,
    ranking_version: config.ranking_version,
    algorithm_version: ALGORITHM_VERSION,
    player_rankings_computed: computed,
    warnings,
    errors,
    duration_ms: Date.now() - start,
    dry_run: config.dry_run,
  }
}

export async function runDailyNflRankings(options?: {
  season?: string
  version?: string
  dryRun?: boolean
}): Promise<NflPipelineResult> {
  const config = buildDefaultNflConfig(options?.season, options?.version, options?.dryRun ?? false)
  return runNflRankingPipeline(config)
}
