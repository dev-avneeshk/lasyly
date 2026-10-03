import { describe, it, expect } from "vitest"
import { NextResponse } from "next/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

// DB-20: withSecurity stamped the public preset on 4xx/5xx too, so a CDN could
// cache a 404/429/500 for every visitor.
const route = (status: number) =>
  withSecurity(async () => NextResponse.json({}, { status }), { cacheControl: CACHE_CONTROL.PUBLIC_SHORT })

describe("withSecurity Cache-Control", () => {
  it("keeps the public preset on a 200", async () => {
    expect((await route(200)(new Request("http://localhost/x"))).headers.get("Cache-Control")).toBe(CACHE_CONTROL.PUBLIC_SHORT)
  })
  it.each([404, 429, 500])("a %i is not publicly cacheable (was: public preset)", async (status) => {
    const res = await route(status)(new Request("http://localhost/x"))
    expect(res.headers.get("Cache-Control")).toBe(CACHE_CONTROL.SENSITIVE)
  })
})
