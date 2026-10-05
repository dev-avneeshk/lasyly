import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

// DB-02: routes that read the cookie session (or query through the RLS-scoped
// cookie client) were sent `public, s-maxage=30`, so a shared CDN could serve
// one viewer's private-room data or `liked_by_me` flags to another.
// Guard: such routes must not use a PUBLIC_* cache preset.
const API = path.resolve(__dirname, "../../app/api")
// Cookie client used, but the cached response is provably viewer-independent.
const ALLOW = new Set([
  "parlays/feed/route.ts", // `.eq("visibility","public")` only
])

const routes = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() ? routes(full) : name.startsWith("route.") ? [full] : []
  })

describe("Cache-Control on session-scoped routes", () => {
  it("never marks a cookie-client route publicly cacheable", () => {
    const offenders = routes(API)
      .map((f) => [path.relative(API, f), readFileSync(f, "utf8")] as const)
      .filter(([rel]) => !ALLOW.has(rel))
      .filter(([, src]) => /@\/lib\/supabase\/server"|auth\.getUser\(/.test(src))
      .filter(([, src]) => /CACHE_CONTROL\.PUBLIC_|["']public, (max-age|s-maxage)/.test(src))
      .map(([rel]) => rel)
    expect(offenders).toEqual([])
  })
})
