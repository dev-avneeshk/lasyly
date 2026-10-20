import "server-only"
/**
 * Read path for stored Novig main lines (novig_prop_lines, written once per
 * game by lib/novig/ingest.ts).
 *
 * The NBA engine (lib/analytics/engine-v2.ts) calls getNovigLinesForSlate()
 * once per stat compute and resolvePropLine() once per player: a stored Novig
 * line wins, otherwise the existing L10-average line (computePropLine) stays.
 *
 * Cache-aside via cached() (AGENTS.md): Redis shares the slate's lines across
 * instances and coalesces the six parallel stat computes of stat=all into one
 * read. The ingest route calls invalidateNovigReadCaches() after it stores new
 * lines, so the page picks them up without waiting for the TTL.
 */
import { cached, invalidateCache, invalidateCachePrefix } from "@/lib/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizePersonName } from "./names"

export const NOVIG_LINES_TTL_MS = 10 * 60_000

/** PostgREST caps a response at 1000 rows; a full slate can exceed that. */
const PAGE_SIZE = 1000
/** Safety bound on pages (~15 games x ~12 players x 7 stats is ~1300 rows). */
const MAX_PAGES = 20

export function novigLinesCacheKey(date: string): string {
  return `novig-lines:v1:${date}`
}

/** One stored main line, trimmed to what the read path needs. */
export interface StoredNovigLine {
  stat: string
  novigPlayer: string
  betroomPlayerName: string | null
  line: number
  overPrice: number
  underPrice: number
  capturedAt: string
}

export interface NovigMarketLine {
  book: "novig"
  line: number
  overPrice: number
  underPrice: number
  capturedAt: string
}

export type NovigLineIndex = Map<string, NovigMarketLine>

export interface ResolvedPropLine {
  propLine: number
  lineSource: "novig" | "average"
  marketLine: NovigMarketLine | null
}

interface NovigLineRow {
  line: number | string | null
  over_price: number | string | null
  under_price: number | string | null
  captured_at: string | null
  stat: string | null
  novig_player: string | null
  betroom_player_name: string | null
}

const SELECT_COLUMNS = "line,over_price,under_price,captured_at,stat,novig_player,betroom_player_name"

/** Number(null) is 0, so nulls and blanks must become NaN explicitly. */
function toNumber(v: number | string | null): number {
  return v === null || v === "" ? NaN : Number(v)
}

function toEntry(row: NovigLineRow): StoredNovigLine | null {
  const line = toNumber(row.line)
  const overPrice = toNumber(row.over_price)
  const underPrice = toNumber(row.under_price)
  if (!row.stat || !row.novig_player) return null
  if (!Number.isFinite(line) || line <= 0) return null
  if (!Number.isFinite(overPrice) || !Number.isFinite(underPrice)) return null
  return {
    stat: row.stat,
    novigPlayer: row.novig_player,
    betroomPlayerName: row.betroom_player_name ?? null,
    line,
    overPrice,
    underPrice,
    capturedAt: row.captured_at ?? "",
  }
}

/** Pages novig_prop_lines for one ET slate date. Throws on any DB error. */
async function fetchNovigLinesUncached(date: string): Promise<StoredNovigLine[]> {
  const supabase = createAdminClient()
  const entries: StoredNovigLine[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE
    const { data, error } = await supabase
      .from("novig_prop_lines")
      .select(SELECT_COLUMNS)
      .eq("game_date", date)
      .order("canonical_event_id", { ascending: true })
      .order("player_key", { ascending: true })
      .order("market_key", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as NovigLineRow[]
    for (const row of rows) {
      const entry = toEntry(row)
      if (entry) entries.push(entry)
    }
    if (rows.length < PAGE_SIZE) break
  }
  return entries
}

/**
 * Stored Novig main lines for an ET slate date (cache-aside, 10 min).
 * Returns [] on ANY error, including the table not existing before the
 * migration is applied, so callers fall back to the average line.
 */
export async function getNovigLinesForSlate(date: string): Promise<StoredNovigLine[]> {
  try {
    return await cached(novigLinesCacheKey(date), () => fetchNovigLinesUncached(date), NOVIG_LINES_TTL_MS)
  } catch (e) {
    console.warn("[novig-lines] read failed, using average lines:", e instanceof Error ? e.message : String(e))
    return []
  }
}

function indexKey(name: string, stat: string): string {
  return `${normalizePersonName(name)}|${stat}`
}

/**
 * Lookup keyed `normalizePersonName(name)|stat`. The primary key uses the
 * matched Betroom name (falling back to the Novig name); a second key from the
 * Novig spelling is added when it differs. Primary keys always win a collision.
 */
export function buildNovigLineIndex(entries: readonly StoredNovigLine[]): NovigLineIndex {
  const index: NovigLineIndex = new Map()
  const toMarket = (e: StoredNovigLine): NovigMarketLine => ({
    book: "novig",
    line: e.line,
    overPrice: e.overPrice,
    underPrice: e.underPrice,
    capturedAt: e.capturedAt,
  })
  for (const e of entries) {
    const key = indexKey(e.betroomPlayerName ?? e.novigPlayer, e.stat)
    if (!index.has(key)) index.set(key, toMarket(e))
  }
  for (const e of entries) {
    if (!e.betroomPlayerName) continue
    const key = indexKey(e.novigPlayer, e.stat)
    if (!index.has(key)) index.set(key, toMarket(e))
  }
  return index
}

/** The stored Novig line for this player/stat when present, else the average line. */
export function resolvePropLine(
  playerName: string,
  statColumn: string,
  averageLine: number,
  index: NovigLineIndex,
): ResolvedPropLine {
  const market = index.get(indexKey(playerName, statColumn))
  if (market) return { propLine: market.line, lineSource: "novig", marketLine: market }
  return { propLine: averageLine, lineSource: "average", marketLine: null }
}

/**
 * Drops every cache that can hold a pre-ingest line for this slate: the lines
 * themselves, the engine's NBA blobs, the route's NBA blobs and the
 * precomputed-slate lookup.
 */
export async function invalidateNovigReadCaches(date: string): Promise<void> {
  await Promise.all([
    invalidateCache(novigLinesCacheKey(date)),
    invalidateCachePrefix("matchup-props:v4:NBA:"),
    invalidateCachePrefix("nba-props:v3:"),
    invalidateCache(`precomputed-slate:NBA:all:all:${date}`),
  ])
}
