import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// The route must refuse before ANY work: no ParlayAPI, Redis or Supabase
// request (all of them go through fetch) without the right secret or key.
const db = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => db }))

const { GET } = await import("@/app/api/cron/ingest-novig-lines/route")

const call = (auth?: string) =>
  GET(new Request("http://localhost/api/cron/ingest-novig-lines", auth ? { headers: { authorization: auth } } : {}))

describe("GET /api/cron/ingest-novig-lines", () => {
  const fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }))

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchSpy)
    vi.stubEnv("CRON_SECRET", "test-cron-secret-0123456789abcdef")
    vi.stubEnv("PARLAY_API_KEY", "test-parlay-key")
    fetchSpy.mockClear()
    db.from.mockClear()
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
  })

  it("401 with the wrong secret and makes no request", async () => {
    const res = await call("Bearer wrong")
    expect(res.status).toBe(401)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(db.from).not.toHaveBeenCalled()
  })

  it("500 when PARLAY_API_KEY is missing, with no request", async () => {
    vi.stubEnv("PARLAY_API_KEY", "")
    const res = await call("Bearer test-cron-secret-0123456789abcdef")
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ error: "PARLAY_API_KEY is not configured" })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(db.from).not.toHaveBeenCalled()
  })
})
