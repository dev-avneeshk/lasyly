import RankingsClient, { DEFAULT_VIEW } from "./RankingsClient"
import { getNbaRankings } from "@/lib/rankings/nba/read"
import { cached } from "@/lib/cache"
import type { RankingListResponse, RankingType } from "@/lib/rankings/types"

// The rankings data changes only when a recalculation run publishes a new
// version, so the shell can be served as ISR and revalidated periodically.
// The default-view data below is additionally cache-aside'd in Redis, so this
// revalidate window just bounds how stale the prefetched HTML can get.
export const revalidate = 300

const DEFAULT_LIMIT = 100

/**
 * Server-prefetch the default view (NBA · overall · projected) so the ranking
 * list is present in the first HTML response instead of arriving after a
 * post-hydration client fetch. The client still refetches on any sport /
 * category / season change; this only seeds the initial paint.
 *
 * Reuses the exact same `cached()` + `getNbaRankings()` path as /api/rankings,
 * so a warm Redis entry is shared between this render and the API — no double
 * work, and the cache key matches the one the route uses.
 */
async function getInitialRankings(): Promise<RankingListResponse | null> {
  try {
    const { season, mode, category } = DEFAULT_VIEW
    const cacheKey = `rankings:${season}:${mode}:${category}:${DEFAULT_LIMIT}:0:true`
    return await cached<RankingListResponse>(
      cacheKey,
      () =>
        getNbaRankings({
          season,
          mode: mode as "historical" | "projected",
          type: category as RankingType,
          limit: DEFAULT_LIMIT,
          offset: 0,
          publishedOnly: true,
        }),
      300_000
    )
  } catch (error) {
    // Prefetch is a progressive enhancement — if it fails, fall back to the
    // client fetching on mount exactly as before. Never block the page on it.
    console.error("[rankings] server prefetch failed:", error)
    return null
  }
}

export default async function RankingsPage() {
  const initial = await getInitialRankings()

  return (
    <RankingsClient
      initialData={
        initial
          ? { rankings: initial.rankings, ranking_version: initial.ranking_version }
          : null
      }
    />
  )
}
