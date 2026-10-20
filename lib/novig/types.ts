/**
 * Shared shapes for the Novig ingest: ParlayAPI payloads, the DB records the
 * ingest writes, and the store interface (implemented by the Supabase store in
 * store.ts and the in-memory store in memoryStore.ts).
 */
import type { Bookmaker, NovigStat } from "./markets"
import type { MatchMethod, PlayerPools } from "./names"

/** One entry of GET /v1/sports/basketball_nba/events (free). */
export interface ParlayEvent {
  id: string
  canonical_event_id?: string | null
  commence_time: string
  home_team: string
  away_team: string
}

/** One row of GET /v1/sports/basketball_nba/props (fields the ingest reads). */
export interface NovigRow {
  event_id?: string | null
  canonical_event_id?: string | null
  game_date?: string | null
  home_team?: string | null
  away_team?: string | null
  commence_time?: string | null
  bookmaker?: string | null
  player: string
  market_key: string
  period?: string | null
  market?: string | null
  line: number
  over_price?: number | null
  under_price?: number | null
  last_update?: string | null
}

/** A today-slate game the ingest wants Novig lines for. */
export interface NeededEvent {
  canonicalEventId: string
  eventId: string
  homeTeam: string
  awayTeam: string
  /** ISO 8601 tip time from /events. */
  commenceTime: string
  /** ET date of tip (YYYY-MM-DD). */
  gameDate: string
}

/** Today's slate game from nba_games (abbreviations). */
export interface SlateGame {
  homeTeam: string
  awayTeam: string
}

/** public.novig_prop_lines row. */
export interface NovigLineRecord {
  canonical_event_id: string
  /** Book that posted the line (one main line per book per player/market). */
  bookmaker: Bookmaker
  player_key: string
  market_key: string
  stat: NovigStat
  game_date: string
  commence_time: string
  home_team: string
  away_team: string
  novig_player: string
  betroom_player_id: string | null
  betroom_player_name: string | null
  match_method: MatchMethod
  line: number
  over_price: number
  under_price: number
  vig: number
  novig_last_update: string | null
}

/** public.novig_prop_events row (capture marker). */
export interface NovigEventRecord {
  canonical_event_id: string
  game_date: string
  commence_time: string
  home_team: string
  away_team: string
  line_count: number
}

export type NovigIngestStatus =
  | "ok"
  | "nothing_missing"
  | "no_slate"
  | "no_events"
  | "credit_floor"
  | "daily_cap"
  | "auth_error"
  | "credits_exhausted"
  | "api_error"
  | "locked"

/** public.novig_ingest_runs row (id/run_at are DB defaults). */
export interface NovigIngestRunRecord {
  slate_date: string
  status: NovigIngestStatus
  needed_events: number
  missing_events: number
  captured_events: number
  rows_inserted: number
  paid_calls: number
  credits_used: number
  credits_remaining: number | null
  truncated: boolean
  detail: Record<string, unknown> | null
}

export interface NovigStore {
  /** Today's nba_games slate for an ET date (abbreviations). */
  getSlateGames(date: string): Promise<SlateGame[]>
  /** Subset of `ids` that already have a novig_prop_events marker. */
  getCapturedEventIds(ids: string[]): Promise<Set<string>>
  /** Sum of novig_ingest_runs.paid_calls for a slate date. */
  getPaidCallsForDate(date: string): Promise<number>
  /** Newest non-null novig_ingest_runs.credits_remaining. */
  getLastKnownRemaining(): Promise<number | null>
  /** Candidate names for matching Novig players on these teams. */
  getPlayerPools(teams: string[]): Promise<PlayerPools>
  /** Insert-only (ON CONFLICT DO NOTHING); resolves to the rows actually inserted. */
  insertLines(rows: NovigLineRecord[]): Promise<number>
  /** Insert-only capture markers. */
  markEventsCaptured(events: NovigEventRecord[]): Promise<void>
  logRun(run: NovigIngestRunRecord): Promise<void>
}
