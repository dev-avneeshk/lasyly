import { describe, it, expect, vi } from "vitest"
import { NextRequest } from "next/server"

// REV-41: IndexNow built apex (https://lasyly.me) URLs that 308 to www, while
// canonicals and the sitemap use SITE_URL (www).
vi.stubEnv("CRON_SECRET", "s")
vi.stubEnv("INDEXNOW_KEY", "k")
const { POST } = await import("@/app/api/indexnow/route")

describe("POST /api/indexnow", () => {
  it("submits www URLs under the www host", async () => {
    const fetchSpy = vi.fn(async () => new Response(null, { status: 200 }))
    vi.stubGlobal("fetch", fetchSpy)
    const res = await POST(new NextRequest("http://localhost/api/indexnow", { method: "POST", headers: { authorization: "Bearer s" } }))
    expect(res.status).toBe(200)
    const body = JSON.parse((fetchSpy.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body.host).toBe("www.lasyly.me")
    expect(body.urlList.every((u: string) => u.startsWith("https://www.lasyly.me"))).toBe(true)
    vi.unstubAllGlobals()
  })
  // AUTHZ-18: the bearer check was a plain string compare; it now uses the
  // shared constant-time cron check (wrong or missing secret → 401, no fetch).
  it.each([["Bearer x"], ["Bearer ss"], [""]])("rejects authorization %j", async (authorization) => {
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)
    const res = await POST(new NextRequest("http://localhost/api/indexnow", { method: "POST", headers: { authorization } }))
    expect(res.status).toBe(401)
    expect(fetchSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
