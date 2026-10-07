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
