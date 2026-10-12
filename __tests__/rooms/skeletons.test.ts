import { describe, it, expect } from "vitest"

async function render(name: "RoomShellSkeleton" | "RoomsListSkeleton") {
  const { renderToStaticMarkup } = await import("react-dom/server")
  const { createElement } = await import("react")
  const mod = await import("@/components/room/skeletons")
  return { html: renderToStaticMarkup(createElement(mod[name])), mod }
}

describe("RoomShellSkeleton", () => {
  it("uses the real room shell geometry and is announced as loading", async () => {
    const { html, mod } = await render("RoomShellSkeleton")
    for (const cls of mod.ROOM_SHELL.split(" ")) expect(html).toContain(cls)
    expect(html).toContain("data-chat-shell")
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain("w-[240px]")
    expect(html).toContain("w-[280px]")
    expect(html).toContain("h-[56px]")
  })

  it("renders deterministic markup (no hydration mismatch)", async () => {
    const a = await render("RoomShellSkeleton")
    const b = await render("RoomShellSkeleton")
    expect(a.html).toBe(b.html)
  })
})

describe("BetslipCardSkeleton", () => {
  async function renderBetslip() {
    const { renderToStaticMarkup } = await import("react-dom/server")
    const { createElement } = await import("react")
    const mod = await import("@/components/room/skeletons")
    return renderToStaticMarkup(createElement(mod.BetslipCardSkeleton))
  }

  it("renders a header bar and exactly two meta cells, with no Multiplier/odds cell", async () => {
    const html = await renderBetslip()
    // Mirrors BetslipCardView geometry.
    expect(html).toContain("max-w-[320px]")
    // Header bar (bottom border) + status pill.
    expect(html).toContain("border-b")
    expect(html).toContain("rounded-full")
    // Exactly two meta cells (Hit rate, Entry) — guards against a third
    // Multiplier/odds cell regressing back in.
    expect(html.match(/flex flex-col gap-1\.5/g)).toHaveLength(2)
  })

  it("renders deterministic markup (no hydration mismatch)", async () => {
    const a = await renderBetslip()
    const b = await renderBetslip()
    expect(a).toBe(b)
  })
})

describe("MessageListSkeleton", () => {
  it("deterministically interleaves BetslipCardSkeleton cards (no Math.random)", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server")
    const { createElement } = await import("react")
    const mod = await import("@/components/room/skeletons")
    const render = () => renderToStaticMarkup(createElement(mod.MessageListSkeleton, {}))
    const a = render()
    const b = render()
    expect(a).toBe(b)
    // Default 6 rows -> every 3rd row (index 2, 5) shows a card -> 2 cards.
    expect(a.match(/max-w-\[320px\]/g)).toHaveLength(2)
  })
})

describe("RoomsListSkeleton", () => {
  it("uses the rooms-list shell and palette, with 6 cards", async () => {
    const { html, mod } = await render("RoomsListSkeleton")
    expect(html).toContain(`class="${mod.ROOMS_LIST_SHELL}"`)
    expect(html.match(/h-\[120px\]/g)).toHaveLength(6)
    for (const old of ["#313338", "#2b2d31", "#1e1f22"]) expect(html).not.toContain(old)
  })

  it("renders deterministic markup", async () => {
    const a = await render("RoomsListSkeleton")
    const b = await render("RoomsListSkeleton")
    expect(a.html).toBe(b.html)
  })
})
