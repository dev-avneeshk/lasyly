/**
 * Picks one "main" line per (event, bookmaker, player, stat) from the alt-line
 * ladder ParlayAPI returns, for every stored book (see BOOKMAKERS).
 *
 * Only FULL-game rows from a stored book with BOTH prices as valid American odds count. The
 * main line is the one whose no-vig over probability is closest to 50%, ties
 * broken by lower vig, then lower line. Rows with negative vig or vig above
 * MAX_VIG are dropped: without that guard the fixture picks stale quotes such as
 * Cade Cunningham rebounds 3.5 at -335/-292 (51% vig).
 */
import { isStoredBook, mapMarketKey, MARKET_ALIASES, type Bookmaker, type NovigStat } from "./markets"
import { normalizePersonName } from "./names"
import type { NovigRow } from "./types"

/** Max overround accepted for a main line (the brief's median is ~4.5%). */
export const MAX_VIG = 0.1

const EPS = 1e-9

/** Implied probability of American odds, or null when not valid odds (|o| < 100, NaN, null). */
export function americanToProb(odds: number | null | undefined): number | null {
  if (typeof odds !== "number" || !Number.isFinite(odds)) return null
  if (odds <= -100) return -odds / (-odds + 100)
  if (odds >= 100) return 100 / (odds + 100)
  return null
}

export interface MainLine {
  /** canonical_event_id when present, else event_id. */
  eventKey: string
  canonicalEventId: string | null
  /** Book that posted this line. */
  bookmaker: Bookmaker
  /** Raw (book's) player name of the chosen row. */
  player: string
  /** normalizePersonName(player) (alias NOT applied; that's matching's job). */
  playerKey: string
  stat: NovigStat
  /** Canonical market key (aliases resolved). */
  marketKey: string
  line: number
  overPrice: number
  underPrice: number
  vig: number
  fairOver: number
  lastUpdate: string | null
}

function eventKeyOf(row: NovigRow): string {
  return (
    row.canonical_event_id ||
    row.event_id ||
    `${row.home_team ?? ""}|${row.away_team ?? ""}|${row.game_date ?? ""}`
  )
}

function isBetter(a: MainLine, b: MainLine): boolean {
  const da = Math.abs(a.fairOver - 0.5)
  const db = Math.abs(b.fairOver - 0.5)
  if (Math.abs(da - db) > EPS) return da < db
  if (Math.abs(a.vig - b.vig) > EPS) return a.vig < b.vig
  return a.line < b.line
}

/** One main line per (event, book, normalized player, stat); groups with no usable row are omitted. */
export function selectMainLines(rows: NovigRow[]): MainLine[] {
  const best = new Map<string, MainLine>()
  for (const row of rows) {
    const bookmaker = row.bookmaker
    if (!isStoredBook(bookmaker) || row.period !== "FULL") continue
    const stat = mapMarketKey(row.market_key)
    if (!stat) continue
    if (typeof row.line !== "number" || !Number.isFinite(row.line) || row.line <= 0) continue
    const pOver = americanToProb(row.over_price)
    const pUnder = americanToProb(row.under_price)
    if (pOver == null || pUnder == null) continue
    const vig = pOver + pUnder - 1
    if (vig < -EPS || vig > MAX_VIG + EPS) continue
    const playerKey = normalizePersonName(row.player)
    if (!playerKey) continue
    const key = row.market_key.trim().toLowerCase()
    const candidate: MainLine = {
      eventKey: eventKeyOf(row),
      canonicalEventId: row.canonical_event_id ?? null,
      bookmaker,
      player: row.player,
      playerKey,
      stat,
      marketKey: MARKET_ALIASES[key] ?? key,
      line: row.line,
      overPrice: row.over_price as number,
      underPrice: row.under_price as number,
      vig,
      fairOver: pOver / (pOver + pUnder),
      lastUpdate: row.last_update ?? null,
    }
    const groupKey = `${candidate.eventKey}|${bookmaker}|${playerKey}|${stat}`
    const current = best.get(groupKey)
    if (!current || isBetter(candidate, current)) best.set(groupKey, candidate)
  }
  return [...best.values()]
}
