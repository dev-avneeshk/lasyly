import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/**
 * GET /api/health
 *
 * Health check endpoint for monitoring and load balancer probes.
 * Returns service status, uptime, and dependency health.
 */
export async function GET() {
  const startTime = Date.now()
  const checks: Record<string, { status: "ok" | "degraded" | "down"; latencyMs?: number }> = {}

  // Check Supabase connectivity
  try {
    const dbStart = Date.now()
    const supabase = await createClient()
    const { error } = await supabase.from("rooms").select("id").limit(1)
    const dbLatency = Date.now() - dbStart

    checks.database = error
      ? { status: "degraded", latencyMs: dbLatency }
      : { status: "ok", latencyMs: dbLatency }
  } catch {
    checks.database = { status: "down" }
  }

  // Overall status: down if any critical service is down, degraded if any is degraded
  const statuses = Object.values(checks).map((c) => c.status)
  const overallStatus = statuses.includes("down")
    ? "down"
    : statuses.includes("degraded")
      ? "degraded"
      : "ok"

  const httpStatus = overallStatus === "down" ? 503 : overallStatus === "degraded" ? 200 : 200

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "0.1.0",
      uptime: process.uptime ? Math.floor(process.uptime()) : undefined,
      checks,
      responseTimeMs: Date.now() - startTime,
    },
    {
      status: httpStatus,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  )
}
