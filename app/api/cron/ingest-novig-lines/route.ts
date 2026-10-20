/**
 * Novig prop-lines ingest cron.
 *
 * Stores each of today's NBA games' Novig main lines ONCE (lib/novig/ingest.ts),
 * spending as few ParlayAPI credits as possible: a free /events call, then at
 * most one sport-wide props call for all uncaptured games (3 credits), with
 * capped follow-ups only when the response was truncated. When new lines land,
 * the NBA default slate is re-precomputed so the props page picks them up.
 *
 * Scheduled by .github/workflows/ingest-novig-lines.yml (16:00 + 21:00 UTC).
 *
 * HTTP status: 200 ok/nothing_missing/no_slate/no_events/daily_cap/locked,
 * 503 credit_floor, 502 auth_error/credits_exhausted/api_error (so
 * scripts/ci/call-cron.sh turns the job red).
 *
 * Authorization: requires CRON_SECRET in the Authorization header.
 */
import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { precomputeNbaDefaultSlate } from "@/lib/data/precompute-nba"
import { runNovigIngest } from "@/lib/novig/ingest"
import { invalidateNovigReadCaches } from "@/lib/novig/lines"
import { createParlayApiClient, getParlayApiKey } from "@/lib/novig/parlayApi"
import { etDateOf } from "@/lib/novig/plan"
import { createSupabaseNovigStore } from "@/lib/novig/store"
import type { NovigIngestStatus } from "@/lib/novig/types"
import { getRedisClient } from "@/lib/redis"
import { isAuthorizedCron } from "@/lib/security/cronAuth"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

// Up to 4 paid calls (~10 s each) + free 503 waits + the NBA precompute.
export const maxDuration = 300

const LOCK_KEY = "novig-ingest:lock"
const LOCK_TTL_SECONDS = 300

const HTTP_STATUS: Record<NovigIngestStatus, number> = {
  ok: 200,
  nothing_missing: 200,
  no_slate: 200,
  no_events: 200,
  daily_cap: 200,
  locked: 200,
  credit_floor: 503,
  auth_error: 502,
  credits_exhausted: 502,
  api_error: 502,
}

/** Takes the overlap lock. Proceeds (returns a no-op release) when Redis is absent or erroring. */
async function acquireLock(): Promise<{ held: boolean; release: () => Promise<void> }> {
  const redis = getRedisClient()
  const noop = async () => {}
  if (!redis) return { held: true, release: noop }
  const token = randomUUID()
  try {
    const res = await redis.set(LOCK_KEY, token, { nx: true, ex: LOCK_TTL_SECONDS })
    if (res !== "OK") return { held: false, release: noop }
  } catch (e) {
    console.error("[novig-ingest] lock unavailable, proceeding:", e instanceof Error ? e.message : String(e))
    return { held: true, release: noop }
  }
  return {
    held: true,
    release: async () => {
      try {
        if ((await redis.get(LOCK_KEY)) === token) await redis.del(LOCK_KEY)
      } catch {
        // The lock expires on its own after LOCK_TTL_SECONDS.
      }
    },
  }
}

export const GET = withSecurity(
  async (request: Request) => {
    if (!isAuthorizedCron(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const apiKey = getParlayApiKey()
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "PARLAY_API_KEY is not configured" }, { status: 500 })
    }

    const startedAt = Date.now()
    const store = createSupabaseNovigStore()
    const lock = await acquireLock()
    if (!lock.held) {
      const slateDate = etDateOf(new Date())
      await store
        .logRun({
          slate_date: slateDate,
          status: "locked",
          needed_events: 0,
          missing_events: 0,
          captured_events: 0,
          rows_inserted: 0,
          paid_calls: 0,
          credits_used: 0,
          credits_remaining: null,
          truncated: false,
          detail: null,
        })
        .catch(() => {})
      return NextResponse.json({ success: true, status: "locked", slateDate, paidCalls: 0 })
    }

    try {
      const result = await runNovigIngest({ api: createParlayApiClient({ apiKey }), store })
      let precompute: Awaited<ReturnType<typeof precomputeNbaDefaultSlate>> | null = null
      if (result.rowsInserted > 0) {
        // Drop every cache holding pre-ingest (average) lines first, so the
        // precompute below and the next page load read the new Novig lines.
        await invalidateNovigReadCaches(result.slateDate)
        precompute = await precomputeNbaDefaultSlate(result.slateDate)
      }
      const httpStatus = HTTP_STATUS[result.status]
      return NextResponse.json(
        { success: httpStatus === 200, ...result, precompute, durationMs: Date.now() - startedAt },
        { status: httpStatus }
      )
    } finally {
      await lock.release()
    }
  },
  { cacheControl: CACHE_CONTROL.SENSITIVE }
)
