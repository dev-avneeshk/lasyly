import { afterEach, describe, expect, it, vi } from "vitest"
import fixture from "@/__tests__/fixtures/novig/nba-props-novig-2026-10-20.json"
import fixtureHeaders from "@/__tests__/fixtures/novig/props-headers-2026-10-20.json"
import { ParlayApiError, createParlayApiClient } from "@/lib/novig/parlayApi"

// Zero paid calls: every request here is served by a mocked fetch.
const KEY = "test-key-do-not-log-1234567890"

function respond(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  })
}

function mockFetch(make: () => Response) {
  return vi.fn<(url: string | URL | Request, init?: RequestInit) => Promise<Response>>(async () => make())
}

afterEach(() => vi.restoreAllMocks())

describe("ParlayAPI client", () => {
  it("requests Novig props with the exact query and parses rows + headers", async () => {
    const fetchImpl = mockFetch(() => respond(200, fixture, fixtureHeaders))
    const client = createParlayApiClient({ apiKey: KEY, fetchImpl: fetchImpl as unknown as typeof fetch, log: () => {} })
    const page = await client.getNbaNovigProps({ offset: 0 })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(String(url)).toBe(
      "https://parlay-api.com/v1/sports/basketball_nba/props?bookmakers=novig" +
        "&markets=player_points,player_rebounds,player_assists,player_threes,player_steals,player_blocks,player_turnovers" +
        "&limit=10000&offset=0",
    )
    expect(String(url)).not.toContain(KEY)
    expect((init?.headers as Record<string, string>)["X-API-Key"]).toBe(KEY)

    // 315 fixture rows minus the 9 line-less player_first_basket rows (dropped by the lenient parse).
    expect(page.rows).toHaveLength(306)
    expect(page.rows.filter((r) => r.bookmaker === "novig")).toHaveLength(301)
    expect(page.rows.some((r) => r.market_key === "player_first_basket")).toBe(false)
    expect(page.meta).toEqual({
      requestsLast: 3,
      requestsUsed: 9,
      requestsRemaining: 991,
      hasMore: false,
      nextOffset: null,
      truncated: true,
      degraded: false,
    })
  })

  it("adds offset and eventId, and reads pagination headers", async () => {
    const fetchImpl = mockFetch(() =>
      respond(200, { data: [{ player: "A B", market_key: "player_points", line: 1.5, over_price: null }] }, {
        "x-result-has-more": "true",
        "x-next-offset": "10000",
        "x-result-degraded": "true",
      }),
    )
    const client = createParlayApiClient({ apiKey: KEY, fetchImpl: fetchImpl as unknown as typeof fetch, log: () => {} })
    const page = await client.getNbaNovigProps({ offset: 10000, eventId: "249f6ad5667cc3b1" })
    expect(String(fetchImpl.mock.calls[0][0])).toMatch(/&limit=10000&offset=10000&eventId=249f6ad5667cc3b1$/)
    expect(page.rows).toHaveLength(1)
    expect(page.meta).toMatchObject({ hasMore: true, nextOffset: 10000, degraded: true, requestsRemaining: null })
  })

  it("drops rows missing required fields instead of failing", async () => {
    const fetchImpl = mockFetch(() =>
      respond(200, [
        { player: "Ok Row", market_key: "player_points", line: 10.5, over_price: -110, under_price: -110 },
        { player: "No Line", market_key: "player_points" },
        { market_key: "player_points", line: 3.5 },
        "garbage",
      ]),
    )
    const client = createParlayApiClient({ apiKey: KEY, fetchImpl: fetchImpl as unknown as typeof fetch, log: () => {} })
    expect((await client.getNbaNovigProps({ offset: 0 })).rows.map((r) => r.player)).toEqual(["Ok Row"])
  })

  it("lists events from the free endpoint", async () => {
    const fetchImpl = mockFetch(() =>
      respond(200, [
        { id: "955b", canonical_event_id: "249f", sport_key: "basketball_nba", commence_time: "2026-10-20T19:00:00Z", home_team: "Detroit Pistons", away_team: "Boston Celtics" },
      ]),
    )
    const client = createParlayApiClient({ apiKey: KEY, fetchImpl: fetchImpl as unknown as typeof fetch, log: () => {} })
    const events = await client.getNbaEvents()
    expect(String(fetchImpl.mock.calls[0][0])).toBe("https://parlay-api.com/v1/sports/basketball_nba/events")
    expect(events).toEqual([
      { id: "955b", canonical_event_id: "249f", commence_time: "2026-10-20T19:00:00Z", home_team: "Detroit Pistons", away_team: "Boston Celtics" },
    ])
  })

  it.each([
    [401, "unauthorized", null],
    [403, "credits_exhausted", null],
    [503, "degraded", 7000],
    [500, "http", null],
  ] as const)("maps HTTP %i to %s", async (status, kind, retryAfterMs) => {
    const fetchImpl = mockFetch(() => respond(status, { error: "x" }, status === 503 ? { "retry-after": "7" } : {}))
    const client = createParlayApiClient({ apiKey: KEY, fetchImpl: fetchImpl as unknown as typeof fetch, log: () => {} })
    const err = await client.getNbaNovigProps({ offset: 0 }).catch((e) => e)
    expect(err).toBeInstanceOf(ParlayApiError)
    expect(err).toMatchObject({ kind, status, retryAfterMs })
  })

  it("maps network failures to an http error with status 0", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed")
    })
    const client = createParlayApiClient({ apiKey: KEY, fetchImpl: fetchImpl as unknown as typeof fetch, log: () => {} })
    await expect(client.getNbaEvents()).rejects.toMatchObject({ kind: "http", status: 0 })
  })

  it("never writes the key to the console", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    )
    const responses = [respond(200, fixture, fixtureHeaders), respond(401, {}), respond(503, {})]
    const fetchImpl = vi.fn(async () => responses.shift() as Response)
    const client = createParlayApiClient({ apiKey: KEY, fetchImpl: fetchImpl as unknown as typeof fetch })
    await client.getNbaNovigProps({ offset: 0 })
    await client.getNbaNovigProps({ offset: 0 }).catch(() => {})
    await client.getNbaNovigProps({ offset: 0 }).catch(() => {})
    const logged = spies.flatMap((s) => s.mock.calls.flat().map((a) => (typeof a === "string" ? a : JSON.stringify(a))))
    expect(logged.length).toBeGreaterThan(0)
    for (const line of logged) expect(line).not.toContain(KEY)
  })
})
