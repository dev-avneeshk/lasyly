import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { rateLimited } from "@/lib/rateLimit"

// REV-6 was accepted because the proxy's per-IP limit is only a coarse flood
// guard (a fake session cookie picks its tier). That holds only if every coin,
// parlay, betslip, arena, room/chat, careers and auth mutation has its own
// per-user or per-route limit, keyed on a verified identity. 17 routes didn't.
const API = path.resolve(__dirname, "../../app/api")
const AREAS = /^(wallet|parlays|props\/parlay|betslips|arena|nfl|rooms|careers|auth|jobs\/enqueue)\//
// Mutations that need no limit of their own, and why.
const EXEMPT = new Set([
  "auth/guest/route.ts", // stateless signed cookie, no DB or external call
  "auth/logout/route.ts", // clears the caller's own cookies
])

const routes = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() ? routes(full) : name.startsWith("route.") ? [full] : []
  })

describe("per-route rate limits on mutations", () => {
  it("every mutation route in the money/social/auth areas has its own limiter", () => {
    const missing = routes(API)
      .map((f) => [path.relative(API, f), readFileSync(f, "utf8")] as const)
      .filter(([rel]) => AREAS.test(rel) && !EXEMPT.has(rel))
      .filter(([, src]) => /export (const|async function) (POST|PATCH|PUT|DELETE)\b/.test(src))
      .filter(([, src]) => !/checkRateLimit|rateLimited\(/.test(src))
      .map(([rel]) => rel)
    expect(missing).toEqual([])
  })

  it("rateLimited returns 429 with Retry-After once the key is over its budget", async () => {
    const config = { maxRequests: 2, windowMs: 60_000 }
    const key = `test-limit:${Math.random()}`
    expect(await rateLimited(key, config)).toBeNull()
    expect(await rateLimited(key, config)).toBeNull()
    const res = await rateLimited(key, config)
    expect(res?.status).toBe(429)
    expect(Number(res?.headers.get("Retry-After"))).toBeGreaterThan(0)
  })
})
