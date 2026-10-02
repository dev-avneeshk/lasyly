import { describe, it, expect, vi } from "vitest"
import { NextRequest } from "next/server"

// AUTHZ-4: the proxy keyed the rate-limit bucket on any `sb-*auth-token*`
// cookie without validating it, so a fresh forged cookie per request got a
// fresh bucket. Before the fix, 500 such requests from one IP saw zero 429s.
vi.stubEnv("UPSTASH_REDIS_REST_URL", "")
vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "")

const { proxy } = await import("@/proxy")

const call = (ip: string, cookie?: string) =>
  proxy(
    new NextRequest("http://localhost/api/props/share-image", {
      headers: { "x-real-ip": ip, ...(cookie ? { cookie } : {}) },
    })
  )

const count429 = async (n: number, make: (i: number) => Promise<Response>) => {
  let limited = 0
  for (let i = 0; i < n; i++) if ((await make(i)).status === 429) limited++
  return limited
}

// REV-9: the AUTHZ-4 fix capped every signed-in user on one IP at the
// per-user 240/min, so a few users behind one CGNAT/office IP locked it out.
describe("proxy API rate limit", () => {
  // REV-19: rotating cookies reached the 2400/min session flood guard (20x the
  // 120/min anonymous budget); before the fix 300 such requests saw 0 x 429.
  // Now the first 50 distinct cookies are admitted, later ones share the
  // anonymous per-IP 120/min: 300 - 50 - 120 = 130 limited.
  it("rotating forged session cookies get the anonymous budget past 50 sessions", async () => {
    const limited = await count429(300, (i) => call("203.0.113.7", `sb-x-auth-token=forged-${i}`))
    expect(limited).toBe(130)
  })
  it("rotating forged cookies drain the same budget as cookie-less traffic from that IP", async () => {
    await count429(50, (i) => call("203.0.113.11", `sb-x-auth-token=warm-${i}`))
    expect(await count429(120, () => call("203.0.113.11"))).toBe(0)
    expect((await call("203.0.113.11", "sb-x-auth-token=new-forged")).status).toBe(429)
  })
  it("many real sessions behind one NAT IP are not limited by each other (was: 429 after 240)", async () => {
    const limited = await count429(1000, (i) => call("203.0.113.9", `sb-x-auth-token=session-${i % 10}`))
    expect(limited).toBe(0)
  })
  it("one session still hits its own per-user cap", async () => {
    const limited = await count429(300, () => call("203.0.113.10", "sb-x-auth-token=busy-session"))
    expect(limited).toBe(60)
  })

  it("a single session under the cap is never limited", async () => {
    const limited = await count429(100, () => call("203.0.113.8", "sb-x-auth-token=real-session"))
    expect(limited).toBe(0)
  })
})
