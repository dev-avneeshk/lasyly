/**
 * Minimal ParlayAPI client for the Novig ingest.
 *
 *   getNbaEvents()       GET /sports/basketball_nba/events             (free)
 *   getNbaNovigProps()   GET /sports/basketball_nba/props?bookmakers=novig&markets=<7>&limit=10000&offset=<n>[&eventId=]
 *                        (3 credits per call/page)
 *
 * The API key travels only in the X-API-Key header. Logs carry the path and
 * query only, never the key or the headers object.
 */
import { z } from "zod"
import { REQUESTED_MARKETS } from "./markets"
import type { NovigRow, ParlayEvent } from "./types"

export const PARLAY_API_BASE_URL = "https://parlay-api.com/v1"

/** The server-only PARLAY_API_KEY (the one place it is read), or null when unset. */
export function getParlayApiKey(): string | null {
  const key = process.env.PARLAY_API_KEY?.trim()
  return key ? key : null
}
export const PROPS_PAGE_LIMIT = 10_000

export type ParlayApiErrorKind = "unauthorized" | "credits_exhausted" | "degraded" | "http"

export class ParlayApiError extends Error {
  readonly kind: ParlayApiErrorKind
  /** HTTP status (0 for network errors / timeouts). */
  readonly status: number
  /** From Retry-After on a 503, when present. */
  readonly retryAfterMs: number | null

  constructor(kind: ParlayApiErrorKind, status: number, message: string, retryAfterMs: number | null = null) {
    super(message)
    this.name = "ParlayApiError"
    this.kind = kind
    this.status = status
    this.retryAfterMs = retryAfterMs
  }
}

export interface NovigPropsMeta {
  /** x-requests-last: credits charged for this call. */
  requestsLast: number | null
  requestsUsed: number | null
  requestsRemaining: number | null
  hasMore: boolean
  nextOffset: number | null
  truncated: boolean
  degraded: boolean
}

export interface NovigPropsPage {
  rows: NovigRow[]
  meta: NovigPropsMeta
}

export interface ParlayApiClient {
  getNbaEvents(): Promise<ParlayEvent[]>
  getNbaNovigProps(params: { offset: number; eventId?: string }): Promise<NovigPropsPage>
}

export interface ParlayApiClientOptions {
  apiKey: string
  fetchImpl?: typeof fetch
  baseUrl?: string
  timeoutMs?: number
  log?: (message: string) => void
}

const optionalString = z.string().nullish().catch(null)
const optionalPrice = z.number().nullish().catch(null)

const RowSchema = z.object({
  event_id: optionalString,
  canonical_event_id: optionalString,
  game_date: optionalString,
  home_team: optionalString,
  away_team: optionalString,
  commence_time: optionalString,
  bookmaker: optionalString,
  player: z.string(),
  market_key: z.string(),
  period: optionalString,
  market: optionalString,
  line: z.number(),
  over_price: optionalPrice,
  under_price: optionalPrice,
  last_update: optionalString,
})

const EventSchema = z.object({
  id: z.string(),
  canonical_event_id: optionalString,
  commence_time: z.string(),
  home_team: z.string(),
  away_team: z.string(),
})

/** Accepts a bare array or a `{ data: [...] }` envelope. */
function listOf(body: unknown): unknown[] {
  if (Array.isArray(body)) return body
  if (body && typeof body === "object" && Array.isArray((body as { data?: unknown }).data)) {
    return (body as { data: unknown[] }).data
  }
  return []
}

function parseList<T>(body: unknown, schema: z.ZodType<T>): T[] {
  const out: T[] = []
  for (const item of listOf(body)) {
    const parsed = schema.safeParse(item)
    if (parsed.success) out.push(parsed.data)
  }
  return out
}

function intHeader(headers: Headers, name: string): number | null {
  const raw = headers.get(name)
  if (raw == null || raw.trim() === "") return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

const boolHeader = (headers: Headers, name: string) => headers.get(name)?.trim().toLowerCase() === "true"

function retryAfterMs(headers: Headers): number | null {
  const raw = headers.get("retry-after")
  if (!raw) return null
  const seconds = Number(raw)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const at = Date.parse(raw)
  return Number.isNaN(at) ? null : Math.max(0, at - Date.now())
}

export function parsePropsMeta(headers: Headers): NovigPropsMeta {
  return {
    requestsLast: intHeader(headers, "x-requests-last"),
    requestsUsed: intHeader(headers, "x-requests-used"),
    requestsRemaining: intHeader(headers, "x-requests-remaining"),
    hasMore: boolHeader(headers, "x-result-has-more"),
    nextOffset: intHeader(headers, "x-next-offset"),
    truncated: boolHeader(headers, "x-result-truncated"),
    degraded: boolHeader(headers, "x-result-degraded"),
  }
}

export function createParlayApiClient(options: ParlayApiClientOptions): ParlayApiClient {
  const {
    apiKey,
    fetchImpl = fetch,
    baseUrl = PARLAY_API_BASE_URL,
    timeoutMs = 30_000,
    log = (message: string) => console.log(message),
  } = options

  async function get(pathAndQuery: string): Promise<{ body: unknown; headers: Headers }> {
    let res: Response
    try {
      res = await fetchImpl(`${baseUrl}${pathAndQuery}`, {
        method: "GET",
        headers: { "X-API-Key": apiKey, Accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      })
    } catch (e) {
      const reason = e instanceof Error ? e.name : "error"
      log(`[parlay-api] GET ${pathAndQuery} failed (${reason})`)
      throw new ParlayApiError("http", 0, `network error (${reason})`)
    }
    log(`[parlay-api] GET ${pathAndQuery} -> ${res.status}`)
    if (res.status === 401) throw new ParlayApiError("unauthorized", 401, "ParlayAPI rejected the API key")
    if (res.status === 403) throw new ParlayApiError("credits_exhausted", 403, "ParlayAPI credits exhausted")
    if (res.status === 503) {
      throw new ParlayApiError("degraded", 503, "ParlayAPI props board degraded", retryAfterMs(res.headers))
    }
    if (!res.ok) throw new ParlayApiError("http", res.status, `ParlayAPI HTTP ${res.status}`)
    let body: unknown
    try {
      body = await res.json()
    } catch {
      throw new ParlayApiError("http", res.status, "ParlayAPI returned invalid JSON")
    }
    return { body, headers: res.headers }
  }

  return {
    async getNbaEvents() {
      const { body } = await get("/sports/basketball_nba/events")
      return parseList(body, EventSchema)
    },

    async getNbaNovigProps({ offset, eventId }) {
      // Market keys are [a-z_] only, so the commas stay literal.
      let query =
        `bookmakers=novig&markets=${REQUESTED_MARKETS.join(",")}` +
        `&limit=${PROPS_PAGE_LIMIT}&offset=${Math.max(0, Math.trunc(offset))}`
      if (eventId) query += `&eventId=${encodeURIComponent(eventId)}`
      const { body, headers } = await get(`/sports/basketball_nba/props?${query}`)
      return { rows: parseList(body, RowSchema), meta: parsePropsMeta(headers) }
    },
  }
}
