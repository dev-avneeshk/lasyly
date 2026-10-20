import "server-only"

/**
 * Supabase-backed NovigStore (service role). Reads that gate paid calls
 * (captured markers, paid calls today, last known credits) THROW on error so the
 * ingest fails closed instead of spending credits blind. Writes are insert-only
 * (ON CONFLICT DO NOTHING): Novig lines are stored once and never updated.
 */
import { fetchTodayGames } from "@/lib/analytics/engine-v2"
import { createAdminClient } from "@/lib/supabase/admin"
import type { LeaguePlayer, PlayerPools } from "./names"
import type { NovigEventRecord, NovigIngestRunRecord, NovigLineRecord, NovigStore } from "./types"

export type { NovigStore } from "./types"

/** Rows per insert statement. */
const INSERT_CHUNK = 500
/** Newest nba_player_stats rows scanned for the team pool. */
const TEAM_POOL_ROWS = 1000

export function createSupabaseNovigStore(): NovigStore {
  const db = () => createAdminClient()
  let leaguePool: Promise<LeaguePlayer[]> | null = null

  async function loadLeaguePool(): Promise<LeaguePlayer[]> {
    const players: LeaguePlayer[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db()
        .from("nba_players")
        .select("id, player_name")
        .eq("active", true)
        .order("id", { ascending: true })
        .range(from, from + 999)
      if (error) {
        console.error("[novig-store] nba_players read failed:", error.message)
        return players
      }
      for (const row of data ?? []) players.push({ id: row.id as string, name: row.player_name as string })
      if (!data || data.length < 1000) return players
    }
  }

  return {
    async getSlateGames(date) {
      const games = await fetchTodayGames(date)
      return games.map((g) => ({ homeTeam: g.homeTeam, awayTeam: g.awayTeam }))
    },

    async getCapturedEventIds(ids) {
      if (ids.length === 0) return new Set()
      const { data, error } = await db()
        .from("novig_prop_events")
        .select("canonical_event_id")
        .in("canonical_event_id", ids)
      if (error) throw new Error(`novig_prop_events read failed: ${error.message}`)
      return new Set((data ?? []).map((r) => r.canonical_event_id as string))
    },

    async getPaidCallsForDate(date) {
      const { data, error } = await db().from("novig_ingest_runs").select("paid_calls").eq("slate_date", date)
      if (error) throw new Error(`novig_ingest_runs read failed: ${error.message}`)
      return (data ?? []).reduce((n, r) => n + (Number(r.paid_calls) || 0), 0)
    },

    async getLastKnownRemaining() {
      const { data, error } = await db()
        .from("novig_ingest_runs")
        .select("credits_remaining")
        .not("credits_remaining", "is", null)
        .order("run_at", { ascending: false })
        .limit(1)
      if (error) throw new Error(`novig_ingest_runs read failed: ${error.message}`)
      const value = data?.[0]?.credits_remaining
      return value == null ? null : Number(value)
    },

    async getPlayerPools(teams): Promise<PlayerPools> {
      leaguePool ??= loadLeaguePool()
      const teamPool = new Set<string>()
      if (teams.length > 0) {
        const { data, error } = await db()
          .from("nba_player_stats")
          .select("player_name, nba_games!inner(game_date)")
          .in("team", teams)
          .order("nba_games(game_date)", { ascending: false })
          .limit(TEAM_POOL_ROWS)
        if (error) console.error("[novig-store] nba_player_stats read failed:", error.message)
        for (const row of data ?? []) if (row.player_name) teamPool.add(row.player_name as string)
      }
      return { teamPool: [...teamPool], leaguePool: await leaguePool }
    },

    async insertLines(rows: NovigLineRecord[]) {
      let inserted = 0
      for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
        const { data, error } = await db()
          .from("novig_prop_lines")
          .upsert(rows.slice(i, i + INSERT_CHUNK), {
            onConflict: "canonical_event_id,bookmaker,player_key,market_key",
            ignoreDuplicates: true,
          })
          .select("player_key")
        if (error) throw new Error(`novig_prop_lines insert failed: ${error.message}`)
        inserted += data?.length ?? 0
      }
      return inserted
    },

    async markEventsCaptured(events: NovigEventRecord[]) {
      if (events.length === 0) return
      const { error } = await db()
        .from("novig_prop_events")
        .upsert(events, { onConflict: "canonical_event_id", ignoreDuplicates: true })
      if (error) throw new Error(`novig_prop_events insert failed: ${error.message}`)
    },

    async logRun(run: NovigIngestRunRecord) {
      const { error } = await db().from("novig_ingest_runs").insert(run)
      if (error) throw new Error(`novig_ingest_runs insert failed: ${error.message}`)
    },
  }
}
