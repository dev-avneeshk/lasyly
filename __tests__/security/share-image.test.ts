import { describe, it, expect } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "@/app/api/props/share-image/route"

// AUTHZ-1: the public share-image renderer used to pass any query string into
// ImageResponse (GHSA-vcvr-r3jv-pc5j surface). Before the fix both attacks below
// returned 200 with a rendered image.
const call = (qs: string) => GET(new NextRequest(`http://localhost/api/props/share-image?${qs}`))

describe("GET /api/props/share-image input bounds", () => {
  it("rejects an oversized parameter", async () => {
    const res = await call(`player=${"A".repeat(5000)}`)
    expect(res.status).toBe(400)
  })

  it("rejects non-numeric line / hitRate", async () => {
    expect((await call("line=<svg>")).status).toBe(400)
    expect((await call("hitRate=1e999")).status).toBe(400)
  })

  it("renders a legit card", async () => {
    const res = await call("player=LeBron%20James&stat=pts&line=25.5&hitRate=70&team=LAL")
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("image/png")
  })
})
