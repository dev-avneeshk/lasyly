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

describe("proxy API rate limit", () => {
  // REV-19: 10 reused forged cookies from one IP were admitted 2400 times a
  // minute (each cookie its own 240 bucket under a 2400 per-IP flood guard).
  // Now one counter keyed only by IP caps every request at 600/min.
  it("10 stable forged cookies from one IP cannot exceed the 600/min IP ceiling (was 2400)", async () => {
    const limited = await count429(2500, (i) => call("203.0.113.7", `sb-x-auth-token=forged-${i % 10}`))
    expect(2500 - limited).toBe(600)
  })
  it("rotating forged cookies hit the same ceiling", async () => {
    const limited = await count429(700, (i) => call("203.0.113.12", `sb-x-auth-token=rotate-${i}`))
    expect(limited).toBe(100)
  })
  it("cookie-bearing and cookie-less requests share the IP ceiling", async () => {
    await count429(600, (i) => call("203.0.113.11", `sb-x-auth-token=warm-${i}`))
    expect((await call("203.0.113.11")).status).toBe(429)
  })
  // REV-9: the AUTHZ-4 fix capped every signed-in user on one IP at the
  // per-user 240/min, so a few users behind one CGNAT/office IP locked it out.
  // REV-31: since REV-19 the NAT budget is the 600/min IP ceiling, shared by
  // every client on the IP (anonymous included): 10 sessions x 100 = 400 x 429.
  it("sessions behind one NAT IP share 600/min (was: 429 after 240)", async () => {
    expect(await count429(600, (i) => call("203.0.113.9", `sb-x-auth-token=session-${i % 10}`))).toBe(0)
    expect(await count429(400, (i) => call("203.0.113.9", `sb-x-auth-token=session-${i % 10}`))).toBe(400)
  })
  it("one session still hits its own per-user cap", async () => {
    const limited = await count429(300, () => call("203.0.113.10", "sb-x-auth-token=busy-session"))
    expect(limited).toBe(60)
  })
  it("anonymous traffic keeps the 120/min per-IP budget", async () => {
    expect(await count429(150, () => call("203.0.113.13"))).toBe(30)
  })
  it("a signed-in user under the caps is never limited", async () => {
    const limited = await count429(200, () => call("203.0.113.8", "sb-x-auth-token=real-session"))
    expect(limited).toBe(0)
  })
})
