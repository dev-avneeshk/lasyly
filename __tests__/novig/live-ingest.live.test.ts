import { describe, expect, it } from "vitest"
import { runNovigIngest } from "@/lib/novig/ingest"
import { createMemoryNovigStore } from "@/lib/novig/memoryStore"
import { createParlayApiClient, getParlayApiKey } from "@/lib/novig/parlayApi"
import { createSupabaseNovigStore } from "@/lib/novig/store"
import type { NovigStore } from "@/lib/novig/types"

// GATED LIVE HARNESS: SPENDS REAL PARLAYAPI CREDITS (3 per props call).
// Skipped unless explicitly invoked:
//   NOVIG_LIVE=1 NOVIG_LIVE_STORE_PATH=<scratch>/novig-live-store.json \
//     npx vitest run __tests__/novig/live-ingest.live.test.ts
// Needs PARLAY_API_KEY + Supabase env (.env.local is loaded by the caller).
// Reads (slate, player pools) go to Supabase read-only; ALL writes go to the
// JSON memory store, so production tables are never written.
describe.skipIf(process.env.NOVIG_LIVE !== "1")("Novig ingest (live, paid)", () => {
  it("captures today's lines once; the second run makes 0 paid calls", async () => {
    const apiKey = getParlayApiKey()
    expect(apiKey, "PARLAY_API_KEY must be set").toBeTruthy()
    const persistPath = process.env.NOVIG_LIVE_STORE_PATH
    expect(persistPath, "NOVIG_LIVE_STORE_PATH must be set").toBeTruthy()

    const reads = createSupabaseNovigStore()
    const writes = createMemoryNovigStore(undefined, { persistPath })
    const store: NovigStore = {
      ...writes,
      getSlateGames: (date) => reads.getSlateGames(date),
      getPlayerPools: (teams) => reads.getPlayerPools(teams),
    }
    const api = createParlayApiClient({ apiKey: apiKey as string })

    const first = await runNovigIngest({ api, store })
    console.log("[novig-live] run 1", JSON.stringify(first))
    const second = await runNovigIngest({ api, store })
    console.log("[novig-live] run 2", JSON.stringify(second))

    expect(first.paidCalls).toBeLessThanOrEqual(4)
    expect(second.paidCalls).toBe(0)
  }, 300_000)
})
