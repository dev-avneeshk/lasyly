import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

type Entry = { name: string }

const st = vi.hoisted(() => ({
  keys: [] as string[],
  calls: [] as Array<{ bucket: string; folder: string; limit: number; offset: number }>,
  // Pages per folder, served in order. A folder with no pages lists empty.
  pages: {} as Record<string, Entry[][]>,
  // When set, every list() call for this folder returns a full page.
  alwaysFull: null as string | null,
  error: null as { message: string } | null,
}))

vi.mock("@/lib/cache", () => ({
  cached: async (key: string, fn: () => unknown) => {
    st.keys.push(key)
    return fn()
  },
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: (bucket: string) => ({
        list: async (folder: string, opts: { limit: number; offset: number }) => {
          st.calls.push({ bucket, folder, ...opts })
          if (st.error) return { data: null, error: st.error }
          if (st.alwaysFull === folder) {
            return {
              data: Array.from({ length: opts.limit }, (_, i) => ({ name: `${opts.offset + i}.webp` })),
              error: null,
            }
          }
          const page = Math.floor(opts.offset / opts.limit)
          return { data: st.pages[folder]?.[page] ?? [], error: null }
        },
      }),
    },
  }),
}))

const { getStoredHeadshotIds } = await import("@/lib/data/headshot-storage")

const ids = (n: number, from = 0): Entry[] => Array.from({ length: n }, (_, i) => ({ name: `${from + i}.webp` }))

beforeEach(() => {
  st.keys = []
  st.calls = []
  st.pages = {}
  st.alwaysFull = null
  st.error = null
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe("getStoredHeadshotIds", () => {
  it("lg (default) lists the namespace root under the unchanged v2 key and skips folder entries", async () => {
    st.pages.nfl = [[{ name: "sm" }, { name: "xl" }, { name: "1.webp" }, { name: "2.webp" }, { name: "notes.txt" }]]
    const got = await getStoredHeadshotIds("NFL")
    expect([...got]).toEqual(["1", "2"])
    expect(st.keys).toEqual(["headshots-stored:v2:nfl"])
    expect(st.calls.map((c) => c.folder)).toEqual(["nfl"])
    expect(st.calls[0].bucket).toBe("player-headshots")
  })

  it("xl lists its own folder under its own key", async () => {
    st.pages["nfl/xl"] = [[{ name: "3139477.webp" }]]
    const got = await getStoredHeadshotIds("nfl", "xl")
    expect([...got]).toEqual(["3139477"])
    expect(st.keys).toEqual(["headshots-stored:xl:v1:nfl"])
    expect(st.calls.map((c) => c.folder)).toEqual(["nfl/xl"])
  })

  it("pages until a short page: 1000 + 3 entries is 1003 ids", async () => {
    st.pages["nfl/xl"] = [ids(1000), ids(3, 1000)]
    const got = await getStoredHeadshotIds("nfl", "xl")
    expect(got.size).toBe(1003)
    expect(st.calls.map((c) => c.offset)).toEqual([0, 1000])
  })

  it("stops after 20 pages when every page is full", async () => {
    st.alwaysFull = "nbacdn"
    const got = await getStoredHeadshotIds("nbacdn")
    expect(st.calls).toHaveLength(20)
    expect(got.size).toBe(20_000)
  })

  it("a list error degrades to an empty set instead of throwing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    st.error = { message: "boom" }
    await expect(getStoredHeadshotIds("nfl", "xl")).resolves.toEqual(new Set())
    expect(console.error).toHaveBeenCalledWith('[headshot-storage] list failed for "nfl/xl":', "boom")
  })
})
