/**
 * POST /api/cron/retention
 *
 * Prunes the append-only tables (notifications, scraper time series, expired
 * caches, decided join requests). Protected by CRON_SECRET.
 *
 * ── Why this loops instead of calling the RPC once ───────────────────────────
 * `cleanup_expired_data(batch)` performs ONE bounded pass and returns
 * `has_more`. Each RPC call is its own transaction, so looping here is what
 * makes the batching real: every pass commits and releases its locks before the
 * next begins.
 *
 * The previous chat cleanup did the loop *inside* the plpgsql function, which
 * meant the entire backlog was deleted in a single transaction — dead tuples and
 * locks accumulated for the whole run, which is exactly what batching is
 * supposed to prevent.
 *
 * Both the pass count and the wall-clock budget are bounded so this can never
 * outlive the serverless function's own timeout. Whatever is left over is picked
 * up by the next scheduled run.
 */
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAuthorizedCron } from "@/lib/security/cronAuth"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

/** Rows per table per pass. Small enough to keep each transaction short. */
const BATCH_SIZE = 2_000

/** Hard cap on passes, so a huge backlog can't run forever. */
const MAX_PASSES = 20

/** Stop starting new passes after this long, well inside the function timeout. */
const TIME_BUDGET_MS = 45_000

type Summary = Record<string, number | boolean | string>

export const POST = withSecurity(async (request: Request) => {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startedAt = Date.now()
  const supabase = createAdminClient()

  const totals: Record<string, number> = {}
  let passes = 0
  let hasMore = false

  try {
    for (passes = 1; passes <= MAX_PASSES; passes++) {
      const { data, error } = await supabase.rpc("cleanup_expired_data", {
        p_batch_size: BATCH_SIZE,
      })

      if (error) {
        console.error("[retention] cleanup_expired_data failed:", error.message)
        return NextResponse.json({ error: "Retention pass failed" }, { status: 500 })
      }

      const summary = (data ?? {}) as Summary
      for (const [key, value] of Object.entries(summary)) {
        if (typeof value === "number") totals[key] = (totals[key] ?? 0) + value
      }

      hasMore = summary.has_more === true
      if (!hasMore) break
      if (Date.now() - startedAt > TIME_BUDGET_MS) break
    }

    // Chat retention has its own function (messages / mutes / audit log), same
    // one-pass-per-call shape.
    const chatTotals: Record<string, number> = {}
    let chatPasses = 0
    let chatHasMore = false

    for (chatPasses = 1; chatPasses <= MAX_PASSES; chatPasses++) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        chatHasMore = true
        break
      }

      const { data, error } = await supabase.rpc("cleanup_old_chat_data", {
        p_batch_size: 5_000,
      })

      if (error) {
        console.error("[retention] cleanup_old_chat_data failed:", error.message)
        return NextResponse.json({ error: "Chat retention pass failed" }, { status: 500 })
      }

      const summary = (data ?? {}) as Summary
      for (const [key, value] of Object.entries(summary)) {
        if (typeof value === "number") chatTotals[key] = (chatTotals[key] ?? 0) + value
      }

      chatHasMore = summary.has_more === true
      if (!chatHasMore) break
    }

    return NextResponse.json({
      success: true,
      // `incomplete: true` means a backlog remains; the next scheduled run
      // continues from where this one stopped. Worth alerting on if it stays
      // true across consecutive runs.
      incomplete: hasMore || chatHasMore,
      passes: { expired: passes, chat: chatPasses },
      deleted: { ...totals, ...chatTotals },
      durationMs: Date.now() - startedAt,
    })
  } catch (err) {
    console.error("[retention] failed:", err)
    return NextResponse.json({ error: "Retention failed" }, { status: 500 })
  }
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
