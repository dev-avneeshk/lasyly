import { NextResponse } from "next/server"
import { settleParlayLegs } from "@/lib/parlays/settlement"

/**
 * POST /api/cron/settle-parlays
 *
 * Directly runs parlay leg settlement (checks game stats against prop lines).
 * Protected by CRON_SECRET header check.
 *
 * This is separate from resolve-parlays which uses the job queue.
 * Call this after scrapers finish to immediately settle any legs
 * that now have results available.
 */
export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await settleParlayLegs()

    return NextResponse.json({
      success: true,
      ...result,
      settledAt: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: "Settlement failed", details: message },
      { status: 500 }
    )
  }
}
