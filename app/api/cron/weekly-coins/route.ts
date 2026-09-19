/**
 * POST /api/cron/weekly-coins
 *
 * Grants every player a weekly, level-scaled Coins bonus (100 + level*50) once
 * per ISO week. Protected by CRON_SECRET.
 *
 * ── Why this pages instead of one big UPDATE ─────────────────────────────────
 * The grant is a money movement, so it must go through the hardened
 * grant_weekly_level_bonus RPC (advisory lock + FOR UPDATE + append-only ledger
 * row + idempotency on (user, week)). We page through profiles here and call
 * the RPC per user: each call is its own short transaction, and the per-(user,
 * week) unique index makes the whole job replay-safe — re-running it (retry, or
 * a second scheduled trigger) only ever fills in users who were missed, never
 * double-pays. A wall-clock budget keeps it inside the serverless timeout;
 * whatever's left is picked up by the next run (still the same ISO week).
 *
 * The level curve lives in lib/economy/arena.ts (weeklyLevelBonus) so there's a
 * single source of truth; the RPC just clamps the amount to > 0.
 */
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAuthorizedCron } from "@/lib/security/cronAuth"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { getRedisClient } from "@/lib/redis"
import { grantWeeklyLevelBonus } from "@/lib/economy/wallet"
import { isoWeekKey, weeklyLevelBonus } from "@/lib/economy/arena"

/** Profiles per page. Keeps each Supabase round-trip bounded. */
const PAGE_SIZE = 500

/** Stop starting new pages after this long, well inside the function timeout. */
const TIME_BUDGET_MS = 45_000

/** Redis key for the cached level leaderboard, invalidated after a payout. */
const LEADERBOARD_CACHE_KEY = "arena:leaderboard:v1"

export const POST = withSecurity(async (request: Request) => {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startedAt = Date.now()
  const supabase = createAdminClient()
  const weekKey = isoWeekKey()

  let granted = 0
  let skipped = 0
  let failed = 0
  let processed = 0
  let page = 0
  let incomplete = false

  try {
    for (;;) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        incomplete = true
        break
      }

      const from = page * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      const { data: rows, error } = await supabase
        .from("profiles")
        .select("id, level")
        .order("id", { ascending: true })
        .range(from, to)

      if (error) {
        console.error("[weekly-coins] profile page fetch failed:", error.message)
        return NextResponse.json({ error: "Failed to read profiles." }, { status: 500 })
      }

      if (!rows || rows.length === 0) break

      for (const row of rows) {
        processed++
        const level = Number(row.level ?? 1)
        const amount = weeklyLevelBonus(level)
        const result = await grantWeeklyLevelBonus({
          userId: row.id as string,
          weekKey,
          amount,
        })
        if (result === "completed") granted++
        else if (result === "duplicate") skipped++
        else failed++
      }

      if (rows.length < PAGE_SIZE) break
      page++
    }

    // Invalidate the cached leaderboard so the next read reflects new balances.
    const redis = getRedisClient()
    if (redis) {
      try {
        await redis.del(LEADERBOARD_CACHE_KEY)
      } catch (e) {
        // Cache invalidation is best-effort; a stale leaderboard self-heals on TTL.
        console.warn("[weekly-coins] leaderboard cache invalidation failed:", e)
      }
    }

    return NextResponse.json({
      success: true,
      week: weekKey,
      // incomplete: true means the run hit its time budget; the next scheduled
      // run continues (same week, idempotent, so already-paid users are skipped).
      incomplete,
      processed,
      granted,
      skipped, // already paid this week
      failed,
      durationMs: Date.now() - startedAt,
    })
  } catch (err) {
    console.error("[weekly-coins] failed:", err)
    return NextResponse.json({ error: "Weekly payout failed." }, { status: 500 })
  }
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
