import { beforeEach, describe, expect, it, vi } from "vitest"

// Supabase mock: every query resolves to the next queued page; .range() calls
// and the table name are recorded.
const db = vi.hoisted(() => ({
  pages: [] as Array<{ data: unknown[] | null; error: { message: string; code?: string } | null }>,
  ranges: [] as Array<[number, number]>,
  tables: [] as string[],
  eqs: [] as Array<[string, unknown]>,
}))

vi.mock("@/lib/cache", () => ({
  cached: async (_k: string, fn: () => unknown) => fn(),
  invalidateCache: vi.fn(async () => {}),
  invalidateCachePrefix: vi.fn(async () => {}),
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      db.tables.push(table)
      const c: Record<string, unknown> = {
        select: () => c,
        eq: (col: string, v: unknown) => {
          db.eqs.push([col, v])
          return c
        },
        order: () => c,
        range: (from: number, to: number) => {
          db.ranges.push([from, to])
          return c
        },
        then: (r: (v: unknown) => unknown) => r(db.pages.shift() ?? { data: [], error: null }),
      }
      return c
    },
  }),
}))

const cache = await import("@/lib/cache")
const {
  NOVIG_LINES_TTL_MS,
  buildNovigLineIndex,
  getNovigLinesForSlate,
  invalidateNovigReadCaches,
  novigLinesCacheKey,
  resolvePropLine,
} = await import("@/lib/novig/lines")

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  line: 26.5,
  over_price: -104,
  under_price: -106,
  captured_at: "2026-10-20T16:00:05Z",
  stat: "pts",
  novig_player: "Jayson Tatum",
  betroom_player_name: "Jayson Tatum",
  ...over,
})

beforeEach(() => {
  db.pages = []
  db.ranges = []
  db.tables = []
  db.eqs = []
  vi.mocked(cache.invalidateCache).mockClear()
  vi.mocked(cache.invalidateCachePrefix).mockClear()
})

describe("novig lines cache key + TTL", () => {
  it("is versioned per slate date, 10 minutes", () => {
    expect(novigLinesCacheKey("2026-10-20")).toBe("novig-lines:v2:2026-10-20")
    expect(NOVIG_LINES_TTL_MS).toBe(600_000)
  })
})

describe("resolvePropLine", () => {
  it("uses the stored Novig line when present", async () => {
    db.pages = [{ data: [row()], error: null }]
    const index = buildNovigLineIndex(await getNovigLinesForSlate("2026-10-20"))
    expect(resolvePropLine("Jayson Tatum", "pts", 24, index)).toEqual({
      propLine: 26.5,
      lineSource: "market",
      marketLine: { book: "novig", line: 26.5, overPrice: -104, underPrice: -106, capturedAt: "2026-10-20T16:00:05Z" },
    })
    expect(db.tables).toEqual(["novig_prop_lines"])
    expect(db.eqs).toContainEqual(["game_date", "2026-10-20"])
  })

  it("keeps the average line when no Novig line is stored", () => {
    const index = buildNovigLineIndex([])
    expect(resolvePropLine("Jayson Tatum", "pts", 24, index)).toEqual({
      propLine: 24,
      lineSource: "average",
      marketLine: null,
    })
  })

  it("does not reuse another stat's line", async () => {
    db.pages = [{ data: [row()], error: null }]
    const index = buildNovigLineIndex(await getNovigLinesForSlate("2026-10-20"))
    expect(resolvePropLine("Jayson Tatum", "trb", 7.5, index).lineSource).toBe("average")
  })

  it("is accent-, case- and suffix-insensitive", async () => {
    db.pages = [
      {
        data: [
          row({ novig_player: "Nikola Jokić", betroom_player_name: null, stat: "trb", line: 12.5 }),
          row({ novig_player: "Jaren Jackson Jr.", betroom_player_name: null, stat: "blk", line: 1.5 }),
        ],
        error: null,
      },
    ]
    const index = buildNovigLineIndex(await getNovigLinesForSlate("2026-10-20"))
    expect(resolvePropLine("Nikola Jokic", "trb", 10, index)).toMatchObject({ propLine: 12.5, lineSource: "market" })
    expect(resolvePropLine("JAREN JACKSON", "blk", 2, index)).toMatchObject({ propLine: 1.5, lineSource: "market" })
  })

  it("finds a line by the matched Betroom name and by the Novig spelling", () => {
    const index = buildNovigLineIndex([
      {
        bookmaker: "novig",
        stat: "pts",
        novigPlayer: "Ronald Holland",
        betroomPlayerName: "Ron Holland",
        line: 9.5,
        overPrice: -110,
        underPrice: -110,
        capturedAt: "2026-10-20T16:00:05Z",
      },
    ])
    expect(resolvePropLine("Ron Holland", "pts", 8, index).propLine).toBe(9.5)
    expect(resolvePropLine("Ronald Holland", "pts", 8, index).propLine).toBe(9.5)
  })
})

describe("getNovigLinesForSlate", () => {
  it("returns [] on a supabase error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    db.pages = [{ data: null, error: { message: "connection reset" } }]
    expect(await getNovigLinesForSlate("2026-10-20")).toEqual([])
    warn.mockRestore()
  })

  it("returns [] when the table does not exist yet (migration not applied)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    db.pages = [
      {
        data: null,
        error: { code: "PGRST205", message: "Could not find the table 'public.novig_prop_lines' in the schema cache" },
      },
    ]
    const index = buildNovigLineIndex(await getNovigLinesForSlate("2026-10-20"))
    expect(resolvePropLine("Jayson Tatum", "pts", 24, index)).toMatchObject({ propLine: 24, lineSource: "average" })
    warn.mockRestore()
  })

  it("requests a second page when the first returns 1000 rows", async () => {
    const full = Array.from({ length: 1000 }, (_, i) => row({ novig_player: `Player ${i}`, betroom_player_name: null }))
    db.pages = [
      { data: full, error: null },
      { data: [row({ novig_player: "Last Player", betroom_player_name: null })], error: null },
    ]
    const entries = await getNovigLinesForSlate("2026-10-20")
    expect(db.ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ])
    expect(entries).toHaveLength(1001)
  })

  it("stops after one page when it is short", async () => {
    db.pages = [{ data: [row()], error: null }]
    await getNovigLinesForSlate("2026-10-20")
    expect(db.ranges).toEqual([[0, 999]])
  })

  it("drops rows without a usable line or prices", async () => {
    db.pages = [{ data: [row({ line: 0 }), row({ over_price: null }), row({ stat: "ast", line: "5.5" })], error: null }]
    const entries = await getNovigLinesForSlate("2026-10-20")
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ stat: "ast", line: 5.5 })
  })
})

describe("invalidateNovigReadCaches", () => {
  it("drops the lines, engine, route and precomputed-slate caches for the date", async () => {
    await invalidateNovigReadCaches("2026-10-20")
    expect(vi.mocked(cache.invalidateCache).mock.calls.map((c) => c[0]).sort()).toEqual([
      "novig-lines:v2:2026-10-20",
      "precomputed-slate:NBA:all:all:2026-10-20",
    ])
    expect(vi.mocked(cache.invalidateCachePrefix).mock.calls.map((c) => c[0]).sort()).toEqual([
      "matchup-props:v6:NBA:",
      "nba-props:v5:",
    ])
  })
})

describe("multi-book lines", () => {
  const entry = (bookmaker: string, line: number, overPrice: number, underPrice: number) => ({
    bookmaker,
    stat: "pts",
    novigPlayer: "Jayson Tatum",
    betroomPlayerName: "Jayson Tatum",
    line,
    overPrice,
    underPrice,
    capturedAt: "2026-10-20T16:00:05Z",
  })

  it("prefers the sharpest book when several price the same player/stat", () => {
    const index = buildNovigLineIndex([entry("draftkings", 27.5, -110, -110), entry("pinnacle", 26.5, -105, -115), entry("novig", 26.5, -104, -106)])
    expect(resolvePropLine("Jayson Tatum", "pts", 24, index)).toMatchObject({
      propLine: 26.5,
      lineSource: "market",
      marketLine: { book: "pinnacle", overPrice: -105, underPrice: -115 },
    })
  })

  it("skips a lopsided alternate line and falls back to the next book", () => {
    const index = buildNovigLineIndex([entry("pinnacle", 34.5, 257, -335), entry("draftkings", 30.5, -110, -110)])
    expect(resolvePropLine("Jayson Tatum", "pts", 24, index).marketLine).toMatchObject({ book: "draftkings", line: 30.5 })
  })

  it("uses the average when every book's line is lopsided", () => {
    const index = buildNovigLineIndex([entry("pinnacle", 34.5, 257, -335)])
    expect(resolvePropLine("Jayson Tatum", "pts", 24, index)).toMatchObject({ propLine: 24, lineSource: "average" })
  })
})
