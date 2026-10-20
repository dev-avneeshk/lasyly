/**
 * Credit-minimal Novig ingest: stores each of today's NBA games' Novig main
 * lines ONCE.
 *
 *   1. nba_games slate for today's ET date (empty -> no_slate, 0 calls)
 *   2. free /events -> needed games (today ET, > 10 min to tip, in nba_games)
 *   3. drop games that already have a novig_prop_events marker (none left -> 0 paid calls)
 *   4. ONE sport-wide props call (all stored books, 7 markets); next page only on
 *      x-result-has-more, at most maxPagesPerQuery pages
 *   5. per-event follow-ups ONLY when a needed game is still missing AND the
 *      response was truncated/degraded, at most maxFollowupsPerRun
 *
 * Every paid call is gated by the per-run cap, the per-day cap (summed from
 * novig_ingest_runs) and the credit floor (last known x-requests-remaining).
 * A 503 (props board degraded) is free: wait min(Retry-After, cap) and retry
 * the same offset. 401/403 stop the run. One novig_ingest_runs row is always
 * logged, plus one summary log line.
 */
import { ParlayApiError, type NovigPropsPage, type ParlayApiClient } from "./parlayApi"
import { matchPlayer, type PlayerPools } from "./names"
import { assignRowsToEvents, DEFAULT_MIN_LEAD_MS, etDateOf, parseCommenceTime, selectNeededEvents } from "./plan"
import { selectMainLines } from "./selectMainLine"
import { isStoredBook } from "./markets"
import type {
  NeededEvent,
  NovigIngestStatus,
  NovigLineRecord,
  NovigRow,
  NovigStore,
} from "./types"

export interface IngestLimits {
  maxPagesPerQuery: number
  maxFollowupsPerRun: number
  maxPaidCallsPerRun: number
  maxPaidCallsPerDay: number
  /** Stop before a paid call when the last known remaining credits are below this. */
  creditFloor: number
  /** Retries of a 503 per request (attempts = 1 + this). */
  max503Retries: number
  retryAfterCapMs: number
  /** Wait used when a 503 has no Retry-After. */
  default503WaitMs: number
  minLeadMs: number
}

export const DEFAULT_INGEST_LIMITS: Readonly<IngestLimits> = {
  maxPagesPerQuery: 2,
  maxFollowupsPerRun: 2,
  maxPaidCallsPerRun: 4,
  maxPaidCallsPerDay: 6,
  creditFloor: 100,
  max503Retries: 2,
  retryAfterCapMs: 15_000,
  default503WaitMs: 5_000,
  minLeadMs: DEFAULT_MIN_LEAD_MS,
}

/** Credits per props call when x-requests-last is missing. */
export const PROPS_CALL_CREDITS = 3

export type IngestStop = "credit_floor" | "daily_cap" | "run_cap"

export interface NovigIngestResult {
  status: NovigIngestStatus
  slateDate: string
  neededEvents: number
  missingEvents: number
  capturedEvents: number
  rowsInserted: number
  paidCalls: number
  creditsUsed: number
  creditsRemaining: number | null
  truncated: boolean
  /** A cap/floor that cut the run short after it started paying (status stays "ok"). */
  stoppedBy: IngestStop | null
  errors: string[]
}

export interface RunNovigIngestOptions {
  api: ParlayApiClient
  store: NovigStore
  now?: Date
  sleep?: (ms: number) => Promise<void>
  limits?: Partial<IngestLimits>
  log?: (line: string) => void
}

interface QueryResult {
  rows: NovigRow[]
  /** Response said truncated/degraded, or the page cap cut off has-more. */
  incomplete: boolean
  stop: IngestStop | null
  fatal: unknown
}

const round4 = (n: number) => Math.round(n * 10_000) / 10_000

function statusForError(e: unknown): NovigIngestStatus {
  if (e instanceof ParlayApiError) {
    if (e.kind === "unauthorized") return "auth_error"
    if (e.kind === "credits_exhausted") return "credits_exhausted"
  }
  return "api_error"
}

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

export async function runNovigIngest(options: RunNovigIngestOptions): Promise<NovigIngestResult> {
  const { api, store } = options
  const limits: IngestLimits = { ...DEFAULT_INGEST_LIMITS, ...options.limits }
  const now = options.now ?? new Date()
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const log = options.log ?? ((line: string) => console.log(line))
  const slateDate = etDateOf(now)

  const result: NovigIngestResult = {
    status: "ok",
    slateDate,
    neededEvents: 0,
    missingEvents: 0,
    capturedEvents: 0,
    rowsInserted: 0,
    paidCalls: 0,
    creditsUsed: 0,
    creditsRemaining: null,
    truncated: false,
    stoppedBy: null,
    errors: [],
  }
  const detail: Record<string, unknown> = {}
  let paidToday = 0
  let remaining: number | null = null

  /** One paid props request, gated by caps + floor, with free 503 retries. */
  async function paidCall(params: { offset: number; eventId?: string }): Promise<NovigPropsPage | IngestStop> {
    if (result.paidCalls >= limits.maxPaidCallsPerRun) return "run_cap"
    if (paidToday + result.paidCalls >= limits.maxPaidCallsPerDay) return "daily_cap"
    if (remaining != null && remaining < limits.creditFloor) return "credit_floor"
    for (let attempt = 0; ; attempt++) {
      try {
        const page = await api.getNbaNovigProps(params)
        result.paidCalls++
        result.creditsUsed += page.meta.requestsLast ?? PROPS_CALL_CREDITS
        if (page.meta.requestsRemaining != null) remaining = page.meta.requestsRemaining
        result.creditsRemaining = remaining
        return page
      } catch (e) {
        if (e instanceof ParlayApiError && e.kind === "degraded" && attempt < limits.max503Retries) {
          await sleep(Math.min(e.retryAfterMs ?? limits.default503WaitMs, limits.retryAfterCapMs))
          continue
        }
        throw e
      }
    }
  }

  /** A props query (sport-wide or one event), following has-more up to the page cap. */
  async function query(eventId?: string): Promise<QueryResult> {
    const out: QueryResult = { rows: [], incomplete: false, stop: null, fatal: null }
    let offset = 0
    for (let page = 0; page < limits.maxPagesPerQuery; page++) {
      let res: NovigPropsPage | IngestStop
      try {
        res = await paidCall({ offset, eventId })
      } catch (e) {
        out.fatal = e
        return out
      }
      if (typeof res === "string") {
        out.stop = res
        return out
      }
      out.rows.push(...res.rows)
      if (res.meta.truncated || res.meta.degraded) out.incomplete = true
      if (!res.meta.hasMore) return out
      offset = res.meta.nextOffset ?? offset + res.rows.length
    }
    out.incomplete = true // has-more left unread at the page cap
    return out
  }

  const captured = new Set<string>()

  /** Store lines, then the capture marker, for each needed event that has Novig rows. */
  async function storeCaptured(rows: NovigRow[], events: NeededEvent[]): Promise<void> {
    const novigRows = rows.filter((r) => isStoredBook(r.bookmaker))
    const byEvent = assignRowsToEvents(novigRows, events.filter((e) => !captured.has(e.canonicalEventId)))
    for (const event of events) {
      const eventRows = byEvent.get(event.canonicalEventId)
      if (!eventRows || eventRows.length === 0) continue
      // Rows matched by teams + date may carry another canonical id; group under ours.
      const mains = selectMainLines(eventRows.map((r) => ({ ...r, canonical_event_id: event.canonicalEventId })))
      let pools: PlayerPools = { teamPool: [], leaguePool: [] }
      try {
        pools = await store.getPlayerPools([event.homeTeam, event.awayTeam])
      } catch (e) {
        result.errors.push(`player pools: ${messageOf(e)}`)
      }
      const records: NovigLineRecord[] = mains.map((m) => {
        const match = matchPlayer(m.player, pools)
        return {
          canonical_event_id: event.canonicalEventId,
          bookmaker: m.bookmaker,
          player_key: m.playerKey,
          market_key: m.marketKey,
          stat: m.stat,
          game_date: event.gameDate,
          commence_time: event.commenceTime,
          home_team: event.homeTeam,
          away_team: event.awayTeam,
          novig_player: m.player,
          betroom_player_id: match.playerId,
          betroom_player_name: match.playerName,
          match_method: match.method,
          line: m.line,
          over_price: m.overPrice,
          under_price: m.underPrice,
          vig: round4(m.vig),
          novig_last_update: parseCommenceTime(m.lastUpdate)?.toISOString() ?? null,
        }
      })
      if (records.length > 0) result.rowsInserted += await store.insertLines(records)
      await store.markEventsCaptured([
        {
          canonical_event_id: event.canonicalEventId,
          game_date: event.gameDate,
          commence_time: event.commenceTime,
          home_team: event.homeTeam,
          away_team: event.awayTeam,
          line_count: records.length,
        },
      ])
      captured.add(event.canonicalEventId)
      result.capturedEvents++
    }
  }

  async function run(): Promise<NovigIngestStatus> {
    const slate = await store.getSlateGames(slateDate)
    if (slate.length === 0) return "no_slate"

    let events
    try {
      events = await api.getNbaEvents()
    } catch (e) {
      result.errors.push(`events: ${messageOf(e)}`)
      return statusForError(e)
    }
    const needed = selectNeededEvents(events, slate, now, limits.minLeadMs)
    result.neededEvents = needed.length
    if (needed.length === 0) return "no_events"

    const already = await store.getCapturedEventIds(needed.map((e) => e.canonicalEventId))
    const missing = needed.filter((e) => !already.has(e.canonicalEventId))
    result.missingEvents = missing.length
    detail.missing = missing.map((e) => `${e.awayTeam}@${e.homeTeam}`)
    if (missing.length === 0) return "nothing_missing"

    paidToday = await store.getPaidCallsForDate(slateDate)
    remaining = await store.getLastKnownRemaining()
    result.creditsRemaining = remaining
    if (paidToday >= limits.maxPaidCallsPerDay) return "daily_cap"
    if (remaining != null && remaining < limits.creditFloor) return "credit_floor"

    // One sport-wide call covers every missing game.
    const main = await query()
    result.truncated = main.incomplete
    await storeCaptured(main.rows, missing)
    if (main.fatal) {
      result.errors.push(messageOf(main.fatal))
      return statusForError(main.fatal)
    }
    if (main.stop) {
      if (result.paidCalls === 0) return main.stop === "run_cap" ? "daily_cap" : main.stop
      result.stoppedBy = main.stop
    }

    // Follow-ups only when the board was incomplete; a complete board missing a
    // game means Novig hasn't posted it, and the catch-up run will retry.
    const stillMissing = missing.filter((e) => !captured.has(e.canonicalEventId))
    detail.stillMissing = stillMissing.map((e) => `${e.awayTeam}@${e.homeTeam}`)
    let followups = 0
    if (stillMissing.length > 0 && main.incomplete && !main.stop) {
      for (const event of stillMissing.slice(0, limits.maxFollowupsPerRun)) {
        const paidBefore = result.paidCalls
        const res = await query(event.canonicalEventId)
        if (result.paidCalls > paidBefore) followups++
        await storeCaptured(res.rows, [event])
        if (res.fatal) {
          result.errors.push(messageOf(res.fatal))
          detail.followups = followups
          return statusForError(res.fatal)
        }
        if (res.stop) {
          result.stoppedBy = res.stop
          break
        }
      }
    }
    detail.followups = followups
    return "ok"
  }

  try {
    result.status = await run()
  } catch (e) {
    result.errors.push(messageOf(e))
    result.status = "api_error"
  }
  if (result.stoppedBy) detail.stoppedBy = result.stoppedBy
  if (result.errors.length > 0) detail.errors = result.errors

  try {
    await store.logRun({
      slate_date: slateDate,
      status: result.status,
      needed_events: result.neededEvents,
      missing_events: result.missingEvents,
      captured_events: result.capturedEvents,
      rows_inserted: result.rowsInserted,
      paid_calls: result.paidCalls,
      credits_used: result.creditsUsed,
      credits_remaining: result.creditsRemaining,
      truncated: result.truncated,
      detail: Object.keys(detail).length > 0 ? detail : null,
    })
  } catch (e) {
    result.errors.push(`log run: ${messageOf(e)}`)
  }

  log(
    `[novig-ingest] status=${result.status} slate=${slateDate} needed=${result.neededEvents} ` +
      `missing=${result.missingEvents} captured=${result.capturedEvents} rows=${result.rowsInserted} ` +
      `paid_calls=${result.paidCalls} credits_used=${result.creditsUsed} remaining=${result.creditsRemaining ?? "?"}` +
      (result.stoppedBy ? ` stopped_by=${result.stoppedBy}` : ""),
  )
  return result
}
