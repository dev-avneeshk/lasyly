import { describe, it, expect } from "vitest"

// The OG images used to run on the (deprecated) edge runtime, so they were only
// rendered on request. On the Node runtime they are prerendered by `next build`,
// and a satori layout error fails the whole build. Render each one here.
const images = {
  root: () => import("@/app/opengraph-image"),
  blog: () => import("@/app/(marketing)/blog/opengraph-image"),
  propsGuide: () => import("@/app/(marketing)/blog/nba-player-props-guide/opengraph-image"),
  shareBetslip: () => import("@/app/(marketing)/blog/why-share-your-betslip/opengraph-image"),
  readAnalytics: () => import("@/app/(marketing)/blog/how-to-read-prop-analytics/opengraph-image"),
}

describe("opengraph images render", () => {
  it.each(Object.entries(images))("%s", async (_name, load) => {
    const mod = await load()
    const res = await (mod.default as () => Response | Promise<Response>)()
    const png = new Uint8Array(await res.arrayBuffer())
    expect(png.length).toBeGreaterThan(1000)
  })
})
