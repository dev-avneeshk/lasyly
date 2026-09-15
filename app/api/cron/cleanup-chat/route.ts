/**
 * POST /api/cron/cleanup-chat
 *
 * Daily cleanup of old chat messages (30+ days), expired mutes, and old audit
 * logs (90+ days). Protected by CRON_SECRET (constant-time, header only).
 *
 * Trigger via GitHub Actions cron (daily at 3am UTC).
 */
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAuthorizedCron } from "@/lib/security/cronAuth"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

/** Messages deleted per pass. */
const BATCH_SIZE = 5_000

/** Hard cap on passes so a large backlog can't run unbounded. */
const MAX_PASSES = 20

/** Stop starting new passes after this long, well inside the function timeout. */
const TIME_BUDGET_MS = 45_000

export const POST = withSecurity(async (request: Request) => {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()

  try {
    const supabase = createAdminClient()

    // cleanup_old_chat_data now performs ONE bounded pass per call and reports
    // `has_more`, so the loop lives here. That is the point: each RPC call is a
    // separate transaction, so every batch commits and releases its locks before
    // the next starts. The old version looped inside plpgsql, which drained the
    // whole backlog in a single transaction and accumulated dead tuples and
    // locks for the entire run.
    const totals: Record<string, number> = {}
    let passes = 0
    let hasMore = false

    for (passes = 1; passes <= MAX_PASSES; passes++) {
      const { data, error } = await supabase.rpc("cleanup_old_chat_data", {
        p_batch_size: BATCH_SIZE,
      })

      if (error) {
        // Detail to the log, not the response: Postgres errors carry table,
        // column and constraint names.
        console.error("[cleanup-chat] RPC error:", error.message)
        return NextResponse.json({ error: "Cleanup failed" }, { status: 500 })
      }

      const summary = (data ?? {}) as Record<string, number | boolean | string>
      for (const [key, value] of Object.entries(summary)) {
        if (typeof value === "number") totals[key] = (totals[key] ?? 0) + value
      }

      hasMore = summary.has_more === true
      if (!hasMore) break
      // Leave headroom against the function timeout; the next scheduled run
      // continues where this one stopped.
      if (Date.now() - startTime > TIME_BUDGET_MS) break
    }

    return NextResponse.json({
      success: true,
      ...totals,
      passes,
      incomplete: hasMore,
      durationMs: Date.now() - startTime,
    })
  } catch (err: unknown) {
    console.error("[cleanup-chat] Error:", err)
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 })
  }
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
