/**
 * In-memory NovigStore for tests and the gated live harness. Same insert-only
 * semantics as the Supabase store: an existing (event, player, market) line or
 * event marker is never overwritten. With `persistPath`, state is loaded from
 * and written back to a JSON file after every write.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import type { LeaguePlayer, PlayerPools } from "./names"
import type {
  NovigEventRecord,
  NovigIngestRunRecord,
  NovigLineRecord,
  NovigStore,
  SlateGame,
} from "./types"

export interface MemoryNovigStoreSeed {
  /** Returned for any date. */
  slateGames?: SlateGame[]
  teamPool?: string[]
  leaguePool?: LeaguePlayer[]
  events?: NovigEventRecord[]
  lines?: NovigLineRecord[]
  runs?: NovigIngestRunRecord[]
}

export interface MemoryNovigState {
  events: Map<string, NovigEventRecord>
  lines: Map<string, NovigLineRecord>
  runs: NovigIngestRunRecord[]
}

export interface MemoryNovigStore extends NovigStore {
  readonly state: MemoryNovigState
}

const lineKey = (l: Pick<NovigLineRecord, "canonical_event_id" | "bookmaker" | "player_key" | "market_key">) =>
  `${l.canonical_event_id}|${l.bookmaker}|${l.player_key}|${l.market_key}`

export function createMemoryNovigStore(
  seed: MemoryNovigStoreSeed = {},
  options: { persistPath?: string } = {},
): MemoryNovigStore {
  const state: MemoryNovigState = {
    events: new Map((seed.events ?? []).map((e) => [e.canonical_event_id, e])),
    lines: new Map((seed.lines ?? []).map((l) => [lineKey(l), l])),
    runs: [...(seed.runs ?? [])],
  }
  const { persistPath } = options
  if (persistPath && existsSync(persistPath)) {
    const saved = JSON.parse(readFileSync(persistPath, "utf8")) as {
      events?: NovigEventRecord[]
      lines?: NovigLineRecord[]
      runs?: NovigIngestRunRecord[]
    }
    for (const e of saved.events ?? []) if (!state.events.has(e.canonical_event_id)) state.events.set(e.canonical_event_id, e)
    for (const l of saved.lines ?? []) if (!state.lines.has(lineKey(l))) state.lines.set(lineKey(l), l)
    state.runs.push(...(saved.runs ?? []))
  }
  const persist = () => {
    if (!persistPath) return
    const out = { events: [...state.events.values()], lines: [...state.lines.values()], runs: state.runs }
    writeFileSync(persistPath, JSON.stringify(out, null, 2) + "\n")
  }

  return {
    state,
    async getSlateGames() {
      return [...(seed.slateGames ?? [])]
    },
    async getCapturedEventIds(ids) {
      return new Set(ids.filter((id) => state.events.has(id)))
    },
    async getPaidCallsForDate(date) {
      return state.runs.filter((r) => r.slate_date === date).reduce((n, r) => n + r.paid_calls, 0)
    },
    async getLastKnownRemaining() {
      for (let i = state.runs.length - 1; i >= 0; i--) {
        const remaining = state.runs[i].credits_remaining
        if (remaining != null) return remaining
      }
      return null
    },
    async getPlayerPools(): Promise<PlayerPools> {
      return { teamPool: [...(seed.teamPool ?? [])], leaguePool: [...(seed.leaguePool ?? [])] }
    },
    async insertLines(rows) {
      let inserted = 0
      for (const row of rows) {
        const key = lineKey(row)
        if (state.lines.has(key)) continue
        state.lines.set(key, { ...row })
        inserted++
      }
      persist()
      return inserted
    },
    async markEventsCaptured(events) {
      for (const e of events) if (!state.events.has(e.canonical_event_id)) state.events.set(e.canonical_event_id, { ...e })
      persist()
    },
    async logRun(run) {
      state.runs.push({ ...run })
      persist()
    },
  }
}
