import { describe, it, expect } from "vitest"
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server"
import { config } from "@/proxy"

// Routing Middleware runs before the CDN, so every matched request pays for a
// proxy run (Upstash rate-limit calls, SHA-256, header work) even when the CDN
// would have answered from cache. These tests pin which paths skip the proxy
// and that every page is still covered by its auth guard.
//
// The proxy() auth-guard regressions live in proxy-rate-limit.test.ts:
// importing next/experimental/testing/server in the same module makes proxy()
// throw an AsyncLocalStorage invariant on API paths under vitest.

const matches = (url: string, headers?: Record<string, string>) =>
  unstable_doesMiddlewareMatch({ config, url, headers })

describe("proxy matcher", () => {
  it.each([
    "/_next/static/chunks/a.js",
    "/_next/image?url=x",
    "/hero.png",
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
    "/manifest.json",
    "/fonts/x.woff2",
    "/api/scores",
    "/api/scores/",
    "/api/scores?date=20261004",
    "/api/webhooks/stripe",
    "/api/cron/retention",
    "/api/jobs/process",
  ])("does not run for %s", (url) => {
    expect(matches(url)).toBe(false)
  })

  it.each([
    "/",
    "/explore",
    "/scores",
    "/login",
    "/rooms",
    "/rooms/create",
    "/profile",
    "/admin/careers",
    "/analysis",
    "/nfl/players/1",
    "/logo.svg",
    "/api/scores/search?q=x",
    "/api/scores/history",
    "/api/scores/1/summary",
    "/api/scoresx",
    "/api/jobs/enqueue",
    "/api/jobs/abc",
    "/api/jobs/processx",
    "/api/props",
    "/api/auth/guest",
    "/api/arena/x",
    "/api/feed/posts",
    "/api/players/headshot",
  ])("runs for %s", (url) => {
    expect(matches(url)).toBe(true)
  })

  it("skips Next prefetches", () => {
    expect(matches("/rooms", { "next-router-prefetch": "1" })).toBe(false)
    expect(matches("/explore", { purpose: "prefetch" })).toBe(false)
  })
})
