import { describe, expect, it, vi } from "vitest"
import fixture from "@/__tests__/fixtures/novig/nba-props-novig-2026-10-20.json"
import fixtureHeaders from "@/__tests__/fixtures/novig/props-headers-2026-10-20.json"
import { runNovigIngest } from "@/lib/novig/ingest"
import { createMemoryNovigStore, type MemoryNovigStoreSeed } from "@/lib/novig/memoryStore"
import { createParlayApiClient } from "@/lib/novig/parlayApi"
import type { NovigIngestRunRecord, NovigLineRecord, ParlayEvent } from "@/lib/novig/types"

// Real client + fake fetch + memory store. Zero network.
const NOW = new Date("2026-10-20T13:30:00Z")
const BOS_DET = "249f6ad5667cc3b1"
const EVENTS: ParlayEvent[] = [
  { id: "955b8cbd", canonical_event_id: BOS_DET, commence_time: "2026-10-20T19:00:00Z", home_team: "Detroit Pistons", away_team: "Boston Celtics" },
  { id: "f2e23dea", canonical_event_id: "bf32df940516e8a3", commence_time: "2026-10-20T23:00:00Z", home_team: "New York Knicks", away_team: "Philadelphia 76ers" },
  { id: "457f4301", canonical_event_id: "3a5c10c1a3bfc612", commence_time: "2026-10-21T01:30:00Z", home_team: "San Antonio Spurs", away_team: "Oklahoma City Thunder" },
  { id: "2ad53e01", canonical_event_id: "07bf528b67a70a96", commence_time: "2026-10-21T23:00:00Z", home_team: "Orlando Magic", away_team: "Atlanta Hawks" },
]
const FULL_SLATE = [
  { homeTeam: "DET", awayTeam: "BOS" },
  { homeTeam: "NYK", awayTeam: "PHI" },
  { homeTeam: "SAS", awayTeam: "OKC" },
]
const DET_ONLY = [FULL_SLATE[0]]
const COMPLETE = { ...fixtureHeaders, "x-result-truncated": "false" } as Record<string, string>

type Reply = { status: number; body?: unknown; headers?: Record<string, string> }

function harness(replies: Reply[], seed: MemoryNovigStoreSeed = {}, eventsReply: Reply = { status: 200, body: EVENTS }) {
  const propsUrls: string[] = []
  let eventCalls = 0
  const fetchImpl = vi.fn(async (input: string | URL | Request) => {
    const url = String(input)
    const reply = url.includes("/events") ? (eventCalls++, eventsReply) : (propsUrls.push(url), replies.shift())
    if (!reply) throw new Error(`unexpected request ${url}`)
    return new Response(JSON.stringify(reply.body ?? []), {
      status: reply.status,
      headers: { "content-type": "application/json", ...(reply.headers ?? {}) },
    })
  })
  const api = createParlayApiClient({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch, log: () => {} })
  const store = createMemoryNovigStore({ teamPool: ["Jayson Tatum", "Cade Cunningham"], ...seed })
  const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {})
  const lines: string[] = []
  const run = () => runNovigIngest({ api, store, now: NOW, sleep, log: (l) => lines.push(l) })
  return { run, store, propsUrls, sleep, lines, eventCalls: () => eventCalls }
}

const ok = (headers: Record<string, string> = COMPLETE, body: unknown = fixture): Reply => ({ status: 200, body, headers })
const marker = (id: string) => ({
  canonical_event_id: id,
  game_date: "2026-10-20",
  commence_time: "2026-10-20T19:00:00.000Z",
  home_team: "X",
  away_team: "Y",
  line_count: 1,
})
const priorRun = (over: Partial<NovigIngestRunRecord>): NovigIngestRunRecord => ({
  slate_date: "2026-10-20",
  status: "ok",
  needed_events: 3,
  missing_events: 3,
  captured_events: 1,
  rows_inserted: 1,
  paid_calls: 0,
  credits_used: 0,
  credits_remaining: null,
  truncated: false,
  detail: null,
  ...over,
})

describe("runNovigIngest", () => {
  it("(a) makes 0 props calls when every needed game is captured", async () => {
    const h = harness([], {
      slateGames: FULL_SLATE,
      events: [marker(BOS_DET), marker("bf32df940516e8a3"), marker("3a5c10c1a3bfc612")],
    })
    const r = await h.run()
    expect(r).toMatchObject({ status: "nothing_missing", neededEvents: 3, missingEvents: 0, paidCalls: 0 })
    expect(h.propsUrls).toEqual([])
    expect(h.eventCalls()).toBe(1)
    expect(h.store.state.runs).toHaveLength(1)
    expect(h.lines).toEqual([expect.stringMatching(/^\[novig-ingest\] status=nothing_missing .*paid_calls=0 credits_used=0/)])
  })

  it("(b) covers 3 missing games with exactly one sport-wide call and stores BOS@DET once", async () => {
    const h = harness([ok()], { slateGames: FULL_SLATE })
    const r = await h.run()
    expect(h.propsUrls).toHaveLength(1)
    expect(h.propsUrls[0]).not.toContain("eventId")
    expect(r).toMatchObject({
      status: "ok",
      neededEvents: 3,
      missingEvents: 3,
      capturedEvents: 1,
      rowsInserted: 44,
      paidCalls: 1,
      creditsUsed: 3,
      creditsRemaining: 991,
      truncated: false,
    })
    expect(h.store.state.events.get(BOS_DET)).toMatchObject({ line_count: 44, home_team: "DET", away_team: "BOS", game_date: "2026-10-20" })
    expect(h.store.state.events.size).toBe(1)
    const tatum = h.store.state.lines.get(`${BOS_DET}|novig|jayson tatum|player_points`)
    expect(tatum).toMatchObject({ line: 26.5, over_price: -104, under_price: -106, stat: "pts", match_method: "exact", betroom_player_name: "Jayson Tatum" })
    expect(h.store.state.runs[0]).toMatchObject({ status: "ok", paid_calls: 1, credits_used: 3, credits_remaining: 991 })
  })

  it("(c) follows has-more to a 2nd page and never a 3rd", async () => {
    const more = { ...COMPLETE, "x-result-has-more": "true", "x-next-offset": "10000" }
    const h = harness([ok(more), ok(more), ok(more)], { slateGames: DET_ONLY })
    const r = await h.run()
    expect(h.propsUrls).toHaveLength(2)
    expect(h.propsUrls[0]).toContain("offset=0")
    expect(h.propsUrls[1]).toContain("offset=10000")
    expect(r).toMatchObject({ status: "ok", paidCalls: 2, creditsUsed: 6, truncated: true, capturedEvents: 1 })
  })

  it("(d) follows up per event only when truncated, capped at 2", async () => {
    const truncated = harness([ok(fixtureHeaders), ok(COMPLETE, []), ok(COMPLETE, [])], { slateGames: FULL_SLATE })
    const r1 = await truncated.run()
    expect(truncated.propsUrls).toHaveLength(3)
    expect(truncated.propsUrls[1]).toContain("eventId=bf32df940516e8a3")
    expect(truncated.propsUrls[2]).toContain("eventId=3a5c10c1a3bfc612")
    expect(r1).toMatchObject({ status: "ok", paidCalls: 3, truncated: true, capturedEvents: 1 })

    // Pretend ORL@ATL tips today too, so 3 games are still missing after the main call.
    const events = [...EVENTS.slice(0, 3), { ...EVENTS[3], commence_time: "2026-10-20T23:30:00Z" }]
    const capped = harness(
      [ok(fixtureHeaders), ok(COMPLETE, []), ok(COMPLETE, []), ok(COMPLETE, [])],
      { slateGames: [...FULL_SLATE, { homeTeam: "ORL", awayTeam: "ATL" }] },
      { status: 200, body: events },
    )
    const r2 = await capped.run()
    expect(capped.propsUrls).toHaveLength(3)
    expect(r2).toMatchObject({ neededEvents: 4, missingEvents: 4, paidCalls: 3 })

    // Complete response + still-missing games -> no follow-ups (catch-up run retries).
    const complete = harness([ok()], { slateGames: FULL_SLATE })
    await complete.run()
    expect(complete.propsUrls).toHaveLength(1)
  })

  it("(e) makes 0 calls once the daily cap is reached", async () => {
    const h = harness([ok()], { slateGames: FULL_SLATE, runs: [priorRun({ paid_calls: 4 }), priorRun({ paid_calls: 2 })] })
    const r = await h.run()
    expect(r).toMatchObject({ status: "daily_cap", paidCalls: 0 })
    expect(h.propsUrls).toEqual([])
    expect(h.store.state.runs.at(-1)).toMatchObject({ status: "daily_cap", paid_calls: 0 })
  })

  it("(e2) the daily cap also bounds calls within a run", async () => {
    const h = harness([ok(fixtureHeaders), ok(COMPLETE, [])], { slateGames: FULL_SLATE, runs: [priorRun({ paid_calls: 5 })] })
    const r = await h.run()
    expect(h.propsUrls).toHaveLength(1)
    expect(r).toMatchObject({ status: "ok", paidCalls: 1, stoppedBy: "daily_cap" })
  })

  it("(f) respects the credit floor before the first call and between calls", async () => {
    const low = harness([ok()], { slateGames: FULL_SLATE, runs: [priorRun({ credits_remaining: 99 })] })
    expect(await low.run()).toMatchObject({ status: "credit_floor", paidCalls: 0 })
    expect(low.propsUrls).toEqual([])

    const dropping = harness([ok({ ...fixtureHeaders, "x-requests-remaining": "50" }), ok(COMPLETE, [])], {
      slateGames: FULL_SLATE,
      runs: [priorRun({ credits_remaining: 500 })],
    })
    const r = await dropping.run()
    expect(dropping.propsUrls).toHaveLength(1)
    expect(r).toMatchObject({ status: "ok", paidCalls: 1, creditsRemaining: 50, stoppedBy: "credit_floor" })
  })

  it("(g) retries a 503 at the same offset for free, bounded", async () => {
    const h = harness([{ status: 503, headers: { "retry-after": "60" } }, ok()], { slateGames: DET_ONLY })
    const r = await h.run()
    expect(h.propsUrls).toHaveLength(2)
    expect(h.propsUrls[0]).toBe(h.propsUrls[1])
    expect(h.sleep).toHaveBeenCalledTimes(1)
    expect(h.sleep.mock.calls[0][0]).toBeLessThanOrEqual(15_000)
    expect(r).toMatchObject({ status: "ok", paidCalls: 1, creditsUsed: 3, capturedEvents: 1 })

    const down = harness([{ status: 503 }, { status: 503 }, { status: 503 }, ok()], { slateGames: DET_ONLY })
    const r2 = await down.run()
    expect(down.propsUrls).toHaveLength(3)
    expect(down.sleep).toHaveBeenCalledTimes(2)
    expect(r2).toMatchObject({ status: "api_error", paidCalls: 0, creditsUsed: 0, capturedEvents: 0 })
  })

  it("(h) stops on 401 and 403 with no further calls", async () => {
    const unauthorized = harness([{ status: 401 }, ok()], { slateGames: FULL_SLATE })
    expect(await unauthorized.run()).toMatchObject({ status: "auth_error", paidCalls: 0 })
    expect(unauthorized.propsUrls).toHaveLength(1)

    const exhausted = harness([{ status: 403 }, ok()], { slateGames: FULL_SLATE })
    expect(await exhausted.run()).toMatchObject({ status: "credits_exhausted", paidCalls: 0 })
    expect(exhausted.propsUrls).toHaveLength(1)

    const badEventsKey = harness([ok()], { slateGames: FULL_SLATE }, { status: 401 })
    expect(await badEventsKey.run()).toMatchObject({ status: "auth_error", paidCalls: 0 })
    expect(badEventsKey.propsUrls).toEqual([])
  })

  it("(i) an empty slate makes no calls at all", async () => {
    const h = harness([ok()], { slateGames: [] })
    expect(await h.run()).toMatchObject({ status: "no_slate", paidCalls: 0 })
    expect(h.propsUrls).toEqual([])
    expect(h.eventCalls()).toBe(0)
    expect(h.store.state.runs).toEqual([expect.objectContaining({ status: "no_slate" })])
  })

  it("(i2) no needed events (all tipped) makes no paid calls", async () => {
    const h = harness([ok()], { slateGames: FULL_SLATE })
    const late = runNovigIngest({
      api: createParlayApiClient({
        apiKey: "k",
        fetchImpl: (async () => new Response(JSON.stringify(EVENTS), { status: 200 })) as unknown as typeof fetch,
        log: () => {},
      }),
      store: h.store,
      now: new Date("2026-10-21T02:00:00Z"),
      log: () => {},
    })
    expect(await late).toMatchObject({ status: "no_events", paidCalls: 0 })
  })

  it("(j) a second run over the same store makes 0 paid calls and never overwrites lines", async () => {
    const seeded: NovigLineRecord = {
      canonical_event_id: BOS_DET,
      bookmaker: "novig",
      player_key: "jayson tatum",
      market_key: "player_points",
      stat: "pts",
      game_date: "2026-10-20",
      commence_time: "2026-10-20T19:00:00.000Z",
      home_team: "DET",
      away_team: "BOS",
      novig_player: "Jayson Tatum",
      betroom_player_id: null,
      betroom_player_name: null,
      match_method: "exact",
      line: 99.5,
      over_price: -110,
      under_price: -110,
      vig: 0.0476,
      novig_last_update: null,
    }
    const h = harness([ok(), ok()], { slateGames: DET_ONLY, lines: [seeded] })
    const r1 = await h.run()
    expect(r1).toMatchObject({ status: "ok", paidCalls: 1, rowsInserted: 43, capturedEvents: 1 })
    expect(h.store.state.lines.get(`${BOS_DET}|novig|jayson tatum|player_points`)?.line).toBe(99.5)

    const r2 = await h.run()
    expect(r2).toMatchObject({ status: "nothing_missing", paidCalls: 0, rowsInserted: 0 })
    expect(h.propsUrls).toHaveLength(1)
    expect(h.store.state.lines.size).toBe(44)
  })
})
