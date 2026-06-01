/**
 * POST /api/cron/cleanup-chat
 *
 * Daily cleanup of old chat messages (30+ days), expired mutes,
 * and old audit logs (90+ days). Protected by CRON_SECRET.
 *
 * Trigger via GitHub Actions cron (daily at 3am UTC).
 */

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()

  try {
    const supabase = createAdminClient()

    // Call the cleanup function directly (bypasses RLS via service role)
    const { data, error } = await supabase.rpc("cleanup_old_chat_data")

    if (error) {
      console.error("[cleanup-chat] RPC error:", error.message)
      return NextResponse.json(
        { error: "Cleanup failed", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      ...data,
      durationMs: Date.now() - startTime,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[cleanup-chat] Error:", message)
    return NextResponse.json(
      { error: "Cleanup failed", details: message },
      { status: 500 }
    )
  }
}
