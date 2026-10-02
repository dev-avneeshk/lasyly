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
  it("rotating forged session cookies cannot escape the per-IP cap", async () => {
    const limited = await count429(300, (i) => call("203.0.113.7", `sb-x-auth-token=forged-${i}`))
    expect(limited).toBeGreaterThan(0)
  })

  it("a single session under the cap is never limited", async () => {
    const limited = await count429(100, () => call("203.0.113.8", "sb-x-auth-token=real-session"))
    expect(limited).toBe(0)
  })
})
