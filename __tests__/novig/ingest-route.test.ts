import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { NovigIngestResult } from "@/lib/novig/ingest"

// The route must refuse before ANY work: no ParlayAPI, Redis or Supabase
// request (all of them go through fetch) without the right secret or key.
const db = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => db }))

// The authorized path: the ingest itself, the read-cache invalidation and the
// precompute are stubbed so the order of the post-ingest steps can be asserted.
const steps = vi.hoisted(() => ({
  order: [] as string[],
  result: null as unknown,
  runNovigIngest: vi.fn(),
  invalidateNovigReadCaches: vi.fn(),
  precomputeNbaDefaultSlate: vi.fn(),
}))
vi.mock("@/lib/novig/ingest", () => ({ runNovigIngest: steps.runNovigIngest }))
vi.mock("@/lib/novig/lines", () => ({ invalidateNovigReadCaches: steps.invalidateNovigReadCaches }))
vi.mock("@/lib/data/precompute-nba", () => ({ precomputeNbaDefaultSlate: steps.precomputeNbaDefaultSlate }))
vi.mock("@/lib/redis", () => ({ getRedisClient: () => null }))

const { GET } = await import("@/app/api/cron/ingest-novig-lines/route")

const SECRET = "test-cron-secret-0123456789abcdef"

const call = (auth?: string) =>
  GET(new Request("http://localhost/api/cron/ingest-novig-lines", auth ? { headers: { authorization: auth } } : {}))

const ingestResult = (over: Partial<NovigIngestResult> = {}): NovigIngestResult => ({
  status: "ok",
  slateDate: "2026-10-20",
  neededEvents: 3,
  missingEvents: 3,
  capturedEvents: 1,
  rowsInserted: 44,
  paidCalls: 1,
  creditsUsed: 3,
  creditsRemaining: 988,
  truncated: false,
  stoppedBy: null,
  errors: [],
  ...over,
})

describe("GET /api/cron/ingest-novig-lines", () => {
  const fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }))

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchSpy)
    vi.stubEnv("CRON_SECRET", SECRET)
    vi.stubEnv("PARLAY_API_KEY", "test-parlay-key")
    fetchSpy.mockClear()
    db.from.mockClear()
    steps.order = []
    steps.result = ingestResult()
    steps.runNovigIngest.mockReset().mockImplementation(async () => {
      steps.order.push("ingest")
      return steps.result
    })
    steps.invalidateNovigReadCaches.mockReset().mockImplementation(async () => {
      steps.order.push("invalidate")
    })
    steps.precomputeNbaDefaultSlate.mockReset().mockImplementation(async () => {
      steps.order.push("precompute")
      return { written: 1 }
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("401 without a secret and makes no request", async () => {
    const res = await call()
    expect(res.status).toBe(401)
    expect(res.headers.get("Cache-Control")).toContain("no-store")
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(db.from).not.toHaveBeenCalled()
    expect(steps.runNovigIngest).not.toHaveBeenCalled()
  })

  it("401 with the wrong secret and makes no request", async () => {
    const res = await call("Bearer wrong")
    expect(res.status).toBe(401)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(db.from).not.toHaveBeenCalled()
    expect(steps.runNovigIngest).not.toHaveBeenCalled()
  })

  it("500 when PARLAY_API_KEY is missing, with no request", async () => {
    vi.stubEnv("PARLAY_API_KEY", "")
    const res = await call(`Bearer ${SECRET}`)
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ error: "PARLAY_API_KEY is not configured" })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(db.from).not.toHaveBeenCalled()
    expect(steps.runNovigIngest).not.toHaveBeenCalled()
  })

  it("invalidates the read caches for the slate before re-precomputing when lines were inserted", async () => {
    const res = await call(`Bearer ${SECRET}`)
    expect(res.status).toBe(200)
    expect(steps.invalidateNovigReadCaches).toHaveBeenCalledWith("2026-10-20")
    expect(steps.precomputeNbaDefaultSlate).toHaveBeenCalledWith("2026-10-20")
    expect(steps.order).toEqual(["ingest", "invalidate", "precompute"])
    expect(await res.json()).toMatchObject({ success: true, rowsInserted: 44, precompute: { written: 1 } })
  })

  it("leaves the caches alone when nothing was inserted", async () => {
    steps.result = ingestResult({ status: "nothing_missing", rowsInserted: 0, paidCalls: 0, creditsUsed: 0 })
    const res = await call(`Bearer ${SECRET}`)
    expect(res.status).toBe(200)
    expect(steps.invalidateNovigReadCaches).not.toHaveBeenCalled()
    expect(steps.precomputeNbaDefaultSlate).not.toHaveBeenCalled()
    expect(await res.json()).toMatchObject({ status: "nothing_missing", precompute: null })
  })
})
