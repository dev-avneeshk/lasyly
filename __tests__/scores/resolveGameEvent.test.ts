/**
 * Unit tests for lib/scores/resolveGameEvent.
 *
 * The resolver maps a clicked performance-chart bar to a LiveMatch the boxscore
 * modal can open. Only NFL goes through here now (it carries a stored ESPN event
 * id, resolved synchronously). NBA reads its boxscore from our own DB by game id
 * elsewhere, so it is not resolved here; any other sport returns null.
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { resolveBoxscoreMatch } from "@/lib/scores/resolveGameEvent"

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

  it("returns null for NBA without fetching (boxscore comes from our DB)", async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)

    const match = await resolveBoxscoreMatch({
      sport: "NBA",
      playerTeam: "OKC",
      opponent: "DEN",
      date: "2025-10-21",
    })

    expect(match).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()

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
})
