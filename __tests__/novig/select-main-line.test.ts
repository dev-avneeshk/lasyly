import { describe, expect, it } from "vitest"
import fixture from "@/__tests__/fixtures/novig/nba-props-novig-2026-10-20.json"
import { MAX_VIG, americanToProb, selectMainLines } from "@/lib/novig/selectMainLine"
import type { NovigRow } from "@/lib/novig/types"

const rows = fixture as NovigRow[]
const lines = selectMainLines(rows)
const find = (playerKey: string, stat: string) => lines.find((l) => l.playerKey === playerKey && l.stat === stat)

const row = (over: number | null, under: number | null, line: number, extra: Partial<NovigRow> = {}): NovigRow => ({
  canonical_event_id: "evt",
  bookmaker: "novig",
  period: "FULL",
  player: "Test Player",
  market_key: "player_points",
  line,
  over_price: over,
  under_price: under,
  ...extra,
})

describe("americanToProb", () => {
  it("converts valid American odds and rejects invalid ones", () => {
    expect(americanToProb(-110)).toBeCloseTo(110 / 210)
    expect(americanToProb(100)).toBeCloseTo(0.5)
    expect(americanToProb(150)).toBeCloseTo(0.4)
    for (const bad of [-50, 0, 99, -99, null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(americanToProb(bad as number)).toBeNull()
    }
  })
})

describe("selectMainLines on the 2026-10-20 BOS@DET fixture", () => {
  it("yields 44 main lines across 14 players", () => {
    expect(lines).toHaveLength(44)
    expect(new Set(lines.map((l) => l.playerKey)).size).toBe(14)
    for (const l of lines) {
      expect(l.vig).toBeGreaterThanOrEqual(0)
      expect(l.vig).toBeLessThanOrEqual(MAX_VIG)
      expect(l.canonicalEventId).toBe("249f6ad5667cc3b1")
    }
  })

  it("picks the expected main lines", () => {
    expect(find("jayson tatum", "pts")).toMatchObject({ line: 26.5, overPrice: -104, underPrice: -106, marketKey: "player_points" })
    expect(find("jayson tatum", "trb")).toMatchObject({ line: 8.5, overPrice: -115, underPrice: 108 })
    expect(find("cade cunningham", "trb")).toMatchObject({ line: 4.5, overPrice: -160, underPrice: 117 })
    expect(find("ausar thompson", "trb")).toMatchObject({ line: 6.5, overPrice: 113, underPrice: -120 })
  })

  it("rejects high-vig quotes (Cade REB 3.5 at -335/-292; John Collins PTS has none)", () => {
    expect(find("cade cunningham", "trb")?.line).not.toBe(3.5)
    expect(find("john collins", "pts")).toBeUndefined()
  })

  it("ignores non-Novig rows (the Bovada ' (BOS)' rows)", () => {
    expect(lines.some((l) => l.player.includes("(BOS)"))).toBe(false)
  })
})

describe("selectMainLines rules", () => {
  it("ignores one-sided rows, non-FULL rows, other books and invalid odds", () => {
    expect(
      selectMainLines([
        row(-110, null, 10.5),
        row(null, -110, 11.5),
        row(-110, -110, 12.5, { period: "Q1" }),
        row(-110, -110, 13.5, { bookmaker: "bovada" }),
        row(-50, -110, 14.5),
        row(0, -110, 15.5),
        row(-110, -110, 16.5, { market_key: "player_pts_rebs_asts" }),
      ]),
    ).toEqual([])
  })

  it("picks the line closest to 50/50", () => {
    const [main] = selectMainLines([row(-200, 160, 18.5), row(-110, -110, 20.5), row(150, -190, 22.5)])
    expect(main.line).toBe(20.5)
  })

  it("breaks a fair-probability tie on lower vig, then lower line", () => {
    const [lowVig] = selectMainLines([row(-120, -120, 20.5), row(-105, -105, 21.5)])
    expect(lowVig.line).toBe(21.5)
    const [lowLine] = selectMainLines([row(-110, -110, 21.5), row(-110, -110, 20.5)])
    expect(lowLine.line).toBe(20.5)
  })

  it("resolves market aliases to the canonical key", () => {
    const [main] = selectMainLines([row(-110, -110, 2.5, { market_key: "player_threes_made" })])
    expect(main).toMatchObject({ stat: "tp", marketKey: "player_threes" })
  })
})

describe("selectMainLines across books", () => {
  const r = (bookmaker: string, line: number, over: number, under: number): NovigRow => ({
    canonical_event_id: "evt",
    bookmaker,
    period: "FULL",
    player: "Test Player",
    market_key: "player_points",
    line,
    over_price: over,
    under_price: under,
  })

  it("keeps one main line per book, and ignores DFS and unlisted books", () => {
    const lines = selectMainLines([
      r("pinnacle", 20.5, -110, -110),
      r("pinnacle", 24.5, 200, -260),
      r("draftkings", 21.5, -115, -105),
      r("prizepicks", 20.5, 100, -100),
      r("underdog", 20.5, -120, -110),
      r("bovada", 19.5, -110, -110),
    ])
    expect(lines.map((l) => [l.bookmaker, l.line]).sort()).toEqual([
      ["draftkings", 21.5],
      ["pinnacle", 20.5],
    ])
  })
})
