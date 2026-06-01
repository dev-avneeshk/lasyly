/**
 * Job Handlers Registry
 *
 * Maps job types to their async handler functions.
 * Each handler receives the job payload and returns a result.
 * Throwing an error triggers retry logic.
 */

import { createAdminClient } from "@/lib/supabase/admin"

// ─── Job Type Constants ─────────────────────────────────────────────────────

export const JOB_TYPES = {
  RESOLVE_PARLAYS: "resolve-parlays",
  COMPUTE_CORRELATIONS: "compute-correlations",
  GENERATE_AI_WRITEUP: "generate-ai-writeup",
  SUBMIT_INDEXNOW: "submit-indexnow",
  EXPORT_BETS: "export-bets",
  CLEANUP_CHAT: "cleanup-chat",
} as const

// ─── Handler: Resolve Parlays ───────────────────────────────────────────────

async function handleResolveParlays(_payload: { limit?: number }) {
  // Use the settlement module which:
  // 1. Finds pending parlay legs
  // 2. Checks actual game stats against prop lines
  // 3. Marks legs as won/lost/push
  // 4. Resolves parlays where all legs are settled
  const { settleParlayLegs } = await import("@/lib/parlays/settlement")
  const result = await settleParlayLegs()
  return result
}

// ─── Handler: Compute Correlations ──────────────────────────────────────────

async function handleComputeCorrelations(payload: { sports?: string[] }) {
  // Dynamic import to avoid loading heavy analytics code at module level
  const { computeAllCorrelations } = await import("@/lib/analytics/correlations")
  const { NBA_STAT_FILTERS } = await import("@/lib/props/constants")

  const supabase = createAdminClient()
  const sports = payload.sports ?? ["NBA", "Tennis"]
  const results: Record<string, number> = {}

  if (sports.includes("NBA")) {
    const { data } = await supabase
      .from("nba_player_stats")
      .select("player_name, game_id, pts, trb, ast, tp, stl, blk")
      .limit(10000)

    if (data && data.length > 0) {
      const playerGames = new Map<string, typeof data>()
      for (const row of data) {
        const games = playerGames.get(row.player_name) ?? []
        games.push(row)
        playerGames.set(row.player_name, games)
      }

      const props: { id: string; values: number[] }[] = []
      for (const statFilter of NBA_STAT_FILTERS) {
        const stat = statFilter.key
        for (const [playerName, games] of playerGames) {
          if (games.length < 10) continue
          const values = games.map((g: any) => {
            switch (stat) {
              case "pts": return g.pts ?? 0
              case "trb": return g.trb ?? 0
              case "ast": return g.ast ?? 0
              case "tp": return g.tp ?? 0
              case "stl": return g.stl ?? 0
              case "blk": return g.blk ?? 0
              case "pra": return (g.pts ?? 0) + (g.trb ?? 0) + (g.ast ?? 0)
              default: return 0
            }
          })
          props.push({ id: `${playerName}-${stat}`, values })
        }
      }

      if (props.length > 0) {
        const correlations = computeAllCorrelations(props, 500)

        // Delete old and insert new
        await supabase.from("correlations_cache").delete().eq("sport", "NBA")

        const BATCH_SIZE = 500
        let inserted = 0
        for (let i = 0; i < correlations.length; i += BATCH_SIZE) {
          const batch = correlations.slice(i, i + BATCH_SIZE).map((r) => ({
            sport: "NBA",
            prop_a: r.propA,
            prop_b: r.propB,
            coefficient: r.coefficient,
            overlapping_games: r.overlappingGames,
            computed_at: new Date().toISOString(),
          }))
          await supabase.from("correlations_cache").insert(batch)
          inserted += batch.length
        }
        results.NBA = inserted
      }
    } else {
      results.NBA = 0
    }
  }

  if (sports.includes("Tennis")) {
    const { data } = await supabase
      .from("tennis_serve_stats")
      .select("player_name, surface, stat_year, matches_played, first_serve_pct, aces_per_match")
      .gte("matches_played", 10)
      .limit(5000)

    if (data && data.length > 0) {
      const playerStats = new Map<string, typeof data>()
      for (const row of data) {
        const entries = playerStats.get(row.player_name) ?? []
        entries.push(row)
        playerStats.set(row.player_name, entries)
      }

      const props: { id: string; values: number[] }[] = []
      const statMappings = [
        { key: "aces", getter: (r: any) => Number(r.aces_per_match ?? 0) },
        { key: "first_serve", getter: (r: any) => Number(r.first_serve_pct ?? 0) },
      ]

      for (const { key, getter } of statMappings) {
        for (const [playerName, rows] of playerStats) {
          if (rows.length < 10) continue
          props.push({ id: `${playerName}-${key}`, values: rows.map(getter) })
        }
      }

      if (props.length > 0) {
        const correlations = computeAllCorrelations(props, 500)
        await supabase.from("correlations_cache").delete().eq("sport", "Tennis")

        const BATCH_SIZE = 500
        let inserted = 0
        for (let i = 0; i < correlations.length; i += BATCH_SIZE) {
          const batch = correlations.slice(i, i + BATCH_SIZE).map((r) => ({
            sport: "Tennis",
            prop_a: r.propA,
            prop_b: r.propB,
            coefficient: r.coefficient,
            overlapping_games: r.overlappingGames,
            computed_at: new Date().toISOString(),
          }))
          await supabase.from("correlations_cache").insert(batch)
          inserted += batch.length
        }
        results.Tennis = inserted
      }
    } else {
      results.Tennis = 0
    }
  }

  return { totalCorrelations: Object.values(results).reduce((a, b) => a + b, 0), breakdown: results }
}

// ─── Handler: Generate AI Writeup ──────────────────────────────────────────

async function handleGenerateAIWriteup(payload: {
  propId: string
  sport: "NBA" | "Tennis"
  player: string
  stat: string
}) {
  const { propId, sport, player, stat } = payload
  const supabase = createAdminClient()

  // Fetch player stats
  const column = stat.toLowerCase()
  let gameValues: number[] = []
  let opponent: string | null = null

  if (sport === "NBA") {
    const NBA_STAT_COLUMNS: Record<string, string> = {
      pts: "pts", points: "pts", reb: "trb", rebounds: "trb",
      ast: "ast", assists: "ast", stl: "stl", blk: "blk",
      "3pm": "tp", threes: "tp",
    }
    const col = NBA_STAT_COLUMNS[column] ?? column

    const { data } = await supabase
      .from("nba_player_stats")
      .select(`${col}, opponent, nba_games!inner(game_date)`)
      .eq("player_name", player)
      .order("nba_games(game_date)", { ascending: false })
      .limit(10)

    if (!data || data.length < 3) {
      return { writeup: null, error: "Insufficient data" }
    }

    gameValues = (data as any[]).map((row) => Number(row[col]) || 0)
    opponent = (data as any[])[0]?.opponent ?? null
  }

  // Get prop line
  const { data: lineData } = await supabase
    .from("prop_line_history")
    .select("line_value")
    .eq("player_name", player)
    .eq("stat_category", stat)
    .eq("sport", sport)
    .order("recorded_at", { ascending: false })
    .limit(1)

  const propLine = lineData?.[0]?.line_value ?? computeMedian(gameValues)

  // Compute hit rates
  const l5Values = gameValues.slice(0, 5)
  const l10Values = gameValues.slice(0, 10)
  const l5Hit = l5Values.length > 0
    ? Math.round((l5Values.filter((v) => v >= propLine).length / l5Values.length) * 100)
    : 0
  const l10Hit = l10Values.length > 0
    ? Math.round((l10Values.filter((v) => v >= propLine).length / l10Values.length) * 100)
    : 0

  // Build prompt
  const prompt = `You are a sports betting analyst. Write a 3-5 sentence analysis (max 500 chars) for this prop:
Player: ${player}, Stat: ${stat}, Line: ${propLine}
Last 10 games: ${gameValues.join(", ")}
L5 hit rate: ${l5Hit}%, L10 hit rate: ${l10Hit}%
Matchup: vs ${opponent ?? "Unknown"}

Cover: recent form trend, matchup quality, and whether the line offers value.
Be concise and actionable. No disclaimers.`

  // Call OpenAI
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured")
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
        temperature: 0.7,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const writeup = data.choices?.[0]?.message?.content?.trim()?.substring(0, 500)

    if (!writeup) {
      throw new Error("Empty response from OpenAI")
    }

    // Cache the writeup
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
    await supabase.from("ai_writeup_cache").upsert(
      {
        prop_identifier: propId,
        sport,
        writeup,
        prop_line_at_generation: propLine,
        generated_at: new Date().toISOString(),
        expires_at: expiresAt,
      },
      { onConflict: "prop_identifier,sport" }
    )

    return { writeup, cached: true }
  } catch (err: any) {
    clearTimeout(timeoutId)
    throw err
  }
}

// ─── Handler: Submit IndexNow ───────────────────────────────────────────────

async function handleSubmitIndexNow(payload: { urls?: string[] }) {
  const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://lasyly.me"
  const INDEXNOW_KEY = process.env.INDEXNOW_KEY

  if (!INDEXNOW_KEY) {
    throw new Error("INDEXNOW_KEY not configured")
  }

  const DEFAULT_URLS = [
    BASE_URL,
    `${BASE_URL}/explore`,
    `${BASE_URL}/scores`,
    `${BASE_URL}/news`,
    `${BASE_URL}/features`,
    `${BASE_URL}/tipsters`,
    `${BASE_URL}/blog`,
  ]

  const urlsToSubmit = payload.urls ?? DEFAULT_URLS

  const indexPayload = {
    host: new URL(BASE_URL).hostname,
    key: INDEXNOW_KEY,
    keyLocation: `${BASE_URL}/${INDEXNOW_KEY}.txt`,
    urlList: urlsToSubmit,
  }

  const response = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(indexPayload),
  })

  return { success: true, urls: urlsToSubmit.length, status: response.status }
}

// ─── Handler: Cleanup Chat ──────────────────────────────────────────────────

async function handleCleanupChat(_payload: Record<string, unknown>) {
  const supabase = createAdminClient()

  // Call the DB function that handles all cleanup
  const { data, error } = await supabase.rpc("cleanup_old_chat_data")

  if (error) {
    throw new Error(`Chat cleanup failed: ${error.message}`)
  }

  return data
}

// ─── Handler: Export Bets ───────────────────────────────────────────────────

async function handleExportBets(payload: { userId: string }) {
  const supabase = createAdminClient()

  const { data: betslips, error } = await supabase
    .from("betslips")
    .select("*")
    .eq("user_id", payload.userId)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch bet history: ${error.message}`)
  }

  const headers = ["Date", "Player", "Sport", "Stat", "Line", "Direction", "Odds", "Stake", "Status", "Payout"]
  const rows = (betslips ?? []).map((bet: any) => [
    new Date(bet.created_at).toLocaleDateString("en-US"),
    bet.player_name ?? "",
    bet.sport ?? "",
    bet.stat_type ?? "",
    bet.line ?? "",
    bet.direction ?? "",
    bet.odds ?? "",
    bet.stake ?? "",
    bet.status ?? "",
    bet.payout ?? "",
  ])

  const csvContent = [
    headers.join(","),
    ...rows.map((row: string[]) =>
      row.map((cell) => {
        const str = String(cell ?? "")
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }).join(",")
    ),
  ].join("\n")

  // Store the CSV in Redis for retrieval (expires in 1 hour)
  const { Redis } = await import("@upstash/redis")
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })

  const exportKey = `exports:${payload.userId}:${Date.now()}`
  await redis.set(exportKey, csvContent, { ex: 3600 })

  return { exportKey, rowCount: rows.length }
}

// ─── Utility ────────────────────────────────────────────────────────────────

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

// ─── Handler Registry ───────────────────────────────────────────────────────

export const jobHandlers: Record<string, (payload: any) => Promise<unknown>> = {
  [JOB_TYPES.RESOLVE_PARLAYS]: handleResolveParlays,
  [JOB_TYPES.COMPUTE_CORRELATIONS]: handleComputeCorrelations,
  [JOB_TYPES.GENERATE_AI_WRITEUP]: handleGenerateAIWriteup,
  [JOB_TYPES.SUBMIT_INDEXNOW]: handleSubmitIndexNow,
  [JOB_TYPES.EXPORT_BETS]: handleExportBets,
  [JOB_TYPES.CLEANUP_CHAT]: handleCleanupChat,
}
