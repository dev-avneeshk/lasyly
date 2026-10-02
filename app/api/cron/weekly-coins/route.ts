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
 * whatever's left is picked up by the next call: the last paid id is kept in
 * Redis per week (keyset cursor), and the workflow calls again while the
 * response says `incomplete`. Restarting from the first page every time (as
 * before) re-walked the same already-paid users and never reached the tail.
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

/** Grants in flight at once (per-user locks, so users don't contend). */
const CONCURRENCY = 10

export const maxDuration = 60

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
  let incomplete = false
  const redis = getRedisClient()
  const cursorKey = `weekly-coins:cursor:${weekKey}`
  let cursor = redis ? await redis.get<string>(cursorKey).catch(() => null) : null

  try {
    for (;;) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        incomplete = true
        break
      }

      let query = supabase.from("profiles").select("id, level").order("id", { ascending: true }).limit(PAGE_SIZE)
      if (cursor) query = query.gt("id", cursor)
      const { data: rows, error } = await query

      if (error) {
        console.error("[weekly-coins] profile page fetch failed:", error.message)
        return NextResponse.json({ error: "Failed to read profiles." }, { status: 500 })
      }

      if (!rows || rows.length === 0) break

      for (let i = 0; i < rows.length; i += CONCURRENCY) {
        const results = await Promise.all(
          rows.slice(i, i + CONCURRENCY).map((row) =>
            grantWeeklyLevelBonus({ userId: row.id as string, weekKey, amount: weeklyLevelBonus(Number(row.level ?? 1)) })
          )
        )
        for (const result of results) {
          processed++
          if (result === "completed") granted++
          else if (result === "duplicate") skipped++
          else failed++
        }
      }

      cursor = rows[rows.length - 1].id as string
      await redis?.set(cursorKey, cursor, { ex: 8 * 24 * 60 * 60 }).catch(() => {})
      if (rows.length < PAGE_SIZE) break
    }

    // Done: drop the cursor so a later manual run re-walks everyone (paid users skip).
    if (!incomplete) await redis?.del(cursorKey).catch(() => {})

    // Invalidate the cached leaderboard so the next read reflects new balances.
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
