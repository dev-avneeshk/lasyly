import { NextResponse } from "next/server"
import { settleParlayLegs } from "@/lib/parlays/settlement"
import { isAuthorizedCron } from "@/lib/security/cronAuth"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

/**
 * POST /api/cron/settle-parlays
 *
 * Directly runs parlay leg settlement (checks game stats against prop lines).
 * Protected by CRON_SECRET (constant-time comparison, header only).
 *
 * This is separate from resolve-parlays which uses the job queue.
 * Call this after scrapers finish to immediately settle any legs
 * that now have results available.
 */
export const POST = withSecurity(async (request: Request) => {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await settleParlayLegs()

    if (result.skipped) {
      // Settlement couldn't run (e.g. missing migration). Surface it loudly so
      // the cron log shows the reason, but don't 500 — the request itself
      // succeeded, there's just nothing we can settle until it's fixed.
      console.warn(`[settle-parlays] skipped: ${result.skipped}`)
    }

    return NextResponse.json({
      success: true,
      ...result,
      settledAt: new Date().toISOString(),
    })
  } catch (err: unknown) {
    // Log the detail, return none. Settlement errors carry table names,
    // constraint names and occasionally row values.
    console.error("[settle-parlays] failed:", err)
    return NextResponse.json({ error: "Settlement failed" }, { status: 500 })
  }
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
