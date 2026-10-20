/**
 * Request planning for the Novig ingest: which /events games are "needed"
 * (today's ET slate, not about to tip, present in nba_games) and which props
 * rows belong to which needed game.
 */
import { toNbaAbbr } from "./teams"
import type { NeededEvent, NovigRow, ParlayEvent, SlateGame } from "./types"

/** Minimum time before tip for a game to still be worth fetching. */
export const DEFAULT_MIN_LEAD_MS = 10 * 60_000

/** Date.parse of a ParlayAPI commence_time ("Z", "+00:00", "-04:00", 7-digit fractions); null when unparseable. */
export function parseCommenceTime(value: string | null | undefined): Date | null {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : new Date(ms)
}

/** ET calendar date (YYYY-MM-DD) of an instant. Matches getTodayET in /api/props. */
export function etDateOf(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/New_York" })
}

/**
 * Events that (a) have a parseable commence_time, (b) tip on today's ET date,
 * (c) tip more than `minLeadMs` from now, and (d) match an nba_games slate game
 * by (home, away). Deduped by canonical id.
 */
export function selectNeededEvents(
  events: ParlayEvent[],
  slateGames: SlateGame[],
  now: Date,
  minLeadMs: number = DEFAULT_MIN_LEAD_MS,
): NeededEvent[] {
  const today = etDateOf(now)
  const slate = new Set(slateGames.map((g) => `${g.homeTeam}|${g.awayTeam}`))
  const out = new Map<string, NeededEvent>()
  for (const event of events) {
    const tip = parseCommenceTime(event.commence_time)
    if (!tip) continue
    if (etDateOf(tip) !== today) continue
    if (tip.getTime() - now.getTime() <= minLeadMs) continue
    const home = toNbaAbbr(event.home_team)
    const away = toNbaAbbr(event.away_team)
    if (!home || !away || !slate.has(`${home}|${away}`)) continue
    const canonicalEventId = event.canonical_event_id || event.id
    if (!canonicalEventId || out.has(canonicalEventId)) continue
    out.set(canonicalEventId, {
      canonicalEventId,
      eventId: event.id,
      homeTeam: home,
      awayTeam: away,
      commenceTime: tip.toISOString(),
      gameDate: today,
    })
  }
  return [...out.values()]
}

/**
 * Groups props rows by needed event: by canonical_event_id, else by
 * (home abbr, away abbr, ET date of the row's tip). Unassignable rows are dropped.
 */
export function assignRowsToEvents(rows: NovigRow[], events: NeededEvent[]): Map<string, NovigRow[]> {
  const byId = new Map(events.map((e) => [e.canonicalEventId, e]))
  const byTeams = new Map(events.map((e) => [`${e.homeTeam}|${e.awayTeam}|${e.gameDate}`, e]))
  const out = new Map<string, NovigRow[]>()
  for (const row of rows) {
    let event = row.canonical_event_id ? byId.get(row.canonical_event_id) : undefined
    if (!event) {
      const home = toNbaAbbr(row.home_team)
      const away = toNbaAbbr(row.away_team)
      const tip = parseCommenceTime(row.commence_time)
      const date = tip ? etDateOf(tip) : row.game_date
      if (home && away && date) event = byTeams.get(`${home}|${away}|${date}`)
    }
    if (!event) continue
    const list = out.get(event.canonicalEventId)
    if (list) list.push(row)
    else out.set(event.canonicalEventId, [row])
  }
  return out
}
