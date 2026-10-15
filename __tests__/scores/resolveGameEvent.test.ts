/**
 * Unit tests for lib/scores/resolveGameEvent.
 *
 * The resolver maps a clicked performance-chart bar to a LiveMatch the boxscore
 * modal can open. NFL carries a stored ESPN event id (synchronous); NBA resolves
 * the event from the ESPN scoreboard for the game date by opponent abbreviation.
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { resolveBoxscoreMatch } from "@/lib/scores/resolveGameEvent"
import type { LiveMatch } from "@/types"

const nbaScoreboard: LiveMatch[] = [
  {
    id: "espn-401",
    eventId: "401584690",
    league: "NBA",
    sport: "Basketball",
    status: "Finished",
    homeTeam: "Oklahoma City Thunder",
    awayTeam: "Denver Nuggets",
    homeScore: 120,
    awayScore: 110,
  },
  {
    id: "espn-402",
    eventId: "401584691",
    league: "NBA",
    sport: "Basketball",
    status: "Finished",
    homeTeam: "Los Angeles Lakers",
    awayTeam: "Boston Celtics",
    homeScore: 101,
    awayScore: 99,
  },
]

describe("resolveBoxscoreMatch", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns an NFL match synchronously from a passed eventId (no fetch)", async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)

    const match = await resolveBoxscoreMatch({
      sport: "NFL",
      playerTeam: "SEA",
      opponent: "SF",
      date: "2025-09-21",
      eventId: "401772510",
    })

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(match).toMatchObject({
      eventId: "401772510",
      league: "NFL",
      sport: "American Football",
      status: "Finished",
      homeTeam: "SEA",
      awayTeam: "SF",
    })
    // With no real names passed, logos still resolve from the abbreviation.
    expect(match?.homeLogo).toBeTruthy()
    expect(match?.awayLogo).toBeTruthy()

    vi.unstubAllGlobals()
  })

  it("threads real NFL team identity (names/logos/colors) into the modal header", async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)

    const match = await resolveBoxscoreMatch({
      sport: "NFL",
      playerTeam: "SEA",
      opponent: "SF",
      date: "2025-09-21",
      eventId: "401772510",
      playerTeamName: "Seattle Seahawks",
      playerTeamLogo: "https://logos.example/sea.png",
      playerTeamColor: "#002244",
      opponentName: "San Francisco 49ers",
      opponentLogo: "https://logos.example/sf.png",
      opponentColor: "#AA0000",
    })

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(match).toMatchObject({
      eventId: "401772510",
      league: "NFL",
      homeTeam: "Seattle Seahawks",
      awayTeam: "San Francisco 49ers",
      homeLogo: "https://logos.example/sea.png",
      awayLogo: "https://logos.example/sf.png",
      homeColor: "#002244",
      awayColor: "#AA0000",
    })

    vi.unstubAllGlobals()
  })

  it("resolves the correct NBA event by opponent abbreviation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ data: nbaScoreboard, success: true }),
      }))
    )

    // Player faced DEN (Denver Nuggets) — should resolve the first event.
    const match = await resolveBoxscoreMatch({
      sport: "NBA",
      playerTeam: "OKC",
      opponent: "DEN",
      date: "2025-10-21",
    })

    expect(match?.eventId).toBe("401584690")
    expect(match?.status).toBe("Finished")

    vi.unstubAllGlobals()
  })

  it("queries the scoreboard with the date converted to YYYYMMDD and Basketball", async () => {
    const fetchSpy = vi.fn(async (_url: string) => ({
      ok: true,
      json: async () => ({ data: nbaScoreboard }),
    }))
    vi.stubGlobal("fetch", fetchSpy)

    await resolveBoxscoreMatch({
      sport: "NBA",
      playerTeam: "LAL",
      opponent: "BOS",
      date: "2025-10-21",
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const url = String(fetchSpy.mock.calls[0][0])
    expect(url).toContain("date=20251021")
    expect(url).toContain("sport=Basketball")

    vi.unstubAllGlobals()
  })

  it("returns null when no scoreboard event matches the opponent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ data: nbaScoreboard }),
      }))
    )

    const match = await resolveBoxscoreMatch({
      sport: "NBA",
      playerTeam: "MIA",
      opponent: "PHX", // not in the scoreboard
      date: "2025-10-21",
    })

    expect(match).toBeNull()

    vi.unstubAllGlobals()
  })

  it("returns null for an unknown sport without fetching", async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)

    const match = await resolveBoxscoreMatch({
      sport: "NHL",
      playerTeam: "BOS",
      opponent: "MTL",
      date: "2025-10-21",
    })

    expect(match).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  it("returns null gracefully when the scoreboard fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) }))
    )

    const match = await resolveBoxscoreMatch({
      sport: "NBA",
      playerTeam: "OKC",
      opponent: "DEN",
      date: "2025-10-21",
    })

    expect(match).toBeNull()

    vi.unstubAllGlobals()
  })
})
