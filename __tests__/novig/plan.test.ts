import { describe, expect, it } from "vitest"
import { assignRowsToEvents, etDateOf, parseCommenceTime, selectNeededEvents } from "@/lib/novig/plan"
import type { NovigRow, ParlayEvent } from "@/lib/novig/types"

// The free /events response for 2026-10-20 (shape confirmed against ParlayAPI).
const EVENTS: ParlayEvent[] = [
  { id: "955b8cbd", canonical_event_id: "249f6ad5667cc3b1", commence_time: "2026-10-20T19:00:00Z", home_team: "Detroit Pistons", away_team: "Boston Celtics" },
  { id: "f2e23dea", canonical_event_id: "bf32df940516e8a3", commence_time: "2026-10-20T23:00:00Z", home_team: "New York Knicks", away_team: "Philadelphia 76ers" },
  { id: "457f4301", canonical_event_id: "3a5c10c1a3bfc612", commence_time: "2026-10-21T01:30:00Z", home_team: "San Antonio Spurs", away_team: "Oklahoma City Thunder" },
  { id: "2ad53e01", canonical_event_id: "07bf528b67a70a96", commence_time: "2026-10-21T23:00:00Z", home_team: "Orlando Magic", away_team: "Atlanta Hawks" },
  // Phantom entry not in nba_games.
  { id: "phantom", canonical_event_id: "phantom", commence_time: "2026-10-20T13:23:00Z", home_team: "Denver Nuggets", away_team: "Charlotte Hornets" },
]
const SLATE = [
  { homeTeam: "DET", awayTeam: "BOS" },
  { homeTeam: "NYK", awayTeam: "PHI" },
  { homeTeam: "SAS", awayTeam: "OKC" },
]
const MORNING = new Date("2026-10-20T13:00:00Z")

describe("parseCommenceTime / etDateOf", () => {
  it("parses the commence_time variants ParlayAPI returns", () => {
    expect(parseCommenceTime("2026-10-20T15:00:00.000-04:00")?.toISOString()).toBe("2026-10-20T19:00:00.000Z")
    expect(parseCommenceTime("2026-10-20T19:00:00.0000000Z")?.toISOString()).toBe("2026-10-20T19:00:00.000Z")
    expect(parseCommenceTime("2026-10-20T19:05:00.000+00:00")?.toISOString()).toBe("2026-10-20T19:05:00.000Z")
    expect(parseCommenceTime("not a date")).toBeNull()
    expect(parseCommenceTime(null)).toBeNull()
  })

  it("uses the ET calendar date", () => {
    expect(etDateOf(new Date("2026-10-21T01:30:00Z"))).toBe("2026-10-20")
    expect(etDateOf(new Date("2026-10-21T04:30:00Z"))).toBe("2026-10-21")
  })
})

describe("selectNeededEvents", () => {
  it("keeps today's ET slate games that are in nba_games", () => {
    const needed = selectNeededEvents(EVENTS, SLATE, MORNING)
    expect(needed.map((e) => e.canonicalEventId)).toEqual(["249f6ad5667cc3b1", "bf32df940516e8a3", "3a5c10c1a3bfc612"])
    expect(needed[2]).toMatchObject({ homeTeam: "SAS", awayTeam: "OKC", gameDate: "2026-10-20", eventId: "457f4301" })
  })

  it("drops games that started or tip within 10 minutes", () => {
    expect(selectNeededEvents(EVENTS, SLATE, new Date("2026-10-20T18:55:00Z")).map((e) => e.homeTeam)).toEqual([
      "NYK",
      "SAS",
    ])
    expect(selectNeededEvents(EVENTS, SLATE, new Date("2026-10-20T18:49:00Z"))).toHaveLength(3)
    expect(selectNeededEvents(EVENTS, SLATE, new Date("2026-10-21T02:00:00Z"))).toEqual([])
  })

  it("drops events not in nba_games and returns nothing for an empty slate", () => {
    expect(selectNeededEvents(EVENTS, [{ homeTeam: "DET", awayTeam: "BOS" }], MORNING)).toHaveLength(1)
    expect(selectNeededEvents(EVENTS, [], MORNING)).toEqual([])
  })

  it("skips unparseable times and dedupes canonical ids", () => {
    const events = [{ ...EVENTS[0], commence_time: "garbage" }, EVENTS[1], { ...EVENTS[1], id: "dup" }]
    expect(selectNeededEvents(events, SLATE, MORNING).map((e) => e.canonicalEventId)).toEqual(["bf32df940516e8a3"])
  })
})

describe("assignRowsToEvents", () => {
  const needed = selectNeededEvents(EVENTS, SLATE, MORNING)
  const base: NovigRow = {
    bookmaker: "novig",
    player: "Jayson Tatum",
    market_key: "player_points",
    period: "FULL",
    line: 26.5,
    over_price: -104,
    under_price: -106,
  }

  it("assigns by canonical id, else by teams + ET date", () => {
    const rows: NovigRow[] = [
      { ...base, canonical_event_id: "249f6ad5667cc3b1" },
      // Different canonical id, same teams + ET date (19:05 vs 19:00 tip).
      { ...base, canonical_event_id: "other", home_team: "Detroit Pistons", away_team: "Boston Celtics", commence_time: "2026-10-20T19:05:00.000+00:00" },
      // Late tip in UTC is still the 20th in ET.
      { ...base, canonical_event_id: null, home_team: "San Antonio Spurs", away_team: "Oklahoma City Thunder", commence_time: "2026-10-21T01:35:00Z" },
      // Tomorrow's game: not needed.
      { ...base, canonical_event_id: "07bf528b67a70a96", home_team: "Orlando Magic", away_team: "Atlanta Hawks", commence_time: "2026-10-21T23:00:00Z" },
    ]
    const map = assignRowsToEvents(rows, needed)
    expect(map.get("249f6ad5667cc3b1")).toHaveLength(2)
    expect(map.get("3a5c10c1a3bfc612")).toHaveLength(1)
    expect(map.has("07bf528b67a70a96")).toBe(false)
    expect(map.has("bf32df940516e8a3")).toBe(false)
  })
})
