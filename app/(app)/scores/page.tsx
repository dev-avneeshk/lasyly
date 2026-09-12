import { getTodayYYYYMMDD } from "@/lib/data/scores"
import { getScoresSnapshot } from "@/lib/data/isr-snapshots"
import ScoresClient from "./ScoresClient"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Live Sports Scores — Lasyly",
  description:
    "Real-time live scores across 10+ sports — NBA, NFL, Premier League, Champions League, NHL, MLB, ATP, WTA, UFC, Formula 1, and more. Updated every 10 seconds.",
  openGraph: {
    title: "Live Sports Scores — Lasyly",
    description: "Real-time scores across NFL, NBA, soccer, tennis, hockey, baseball, F1, MMA, golf, and cricket.",
  },
  alternates: {
    canonical: "https://lasyly.me/scores",
  },
}

// This server component only provides the initial server-rendered snapshot;
// live freshness is handled entirely by ScoresClient, which polls the
// CDN-cached /api/scores endpoint every ~15s on the client. A 10s ISR window
// forced the shell HTML to regenerate constantly for data the client already
// refreshes, so we relax it to 5 minutes. The initial paint is still recent
// and the client hydrates fresh scores immediately after mount.
export const revalidate = 300

// Pin the segment to static rendering.
//
// The data layer reaches ESPN via `fetch(..., { next: { revalidate: 0 } })`
// (lib/services/espn.ts) and Upstash Redis via `cache: "no-store"`. When one of
// those runs in the page's own render scope, Next's `patch-fetch` drops the
// segment's revalidate to 0 and marks the scope dynamic — so the prerendered
// route reports `revalidate: 0` at request time and the runtime throws
// "Page changed from static to dynamic at runtime /scores" (E132). The
// `unstable_cache` boundary in lib/data/isr-snapshots.ts shields the reads it
// wraps, but anything that escapes it (a background cache refresh resuming in
// this scope, a retry path) re-opens the hole.
//
// `force-static` closes it for good: Next skips the `revalidate = 0` downgrade
// and turns dynamic marking into a no-op (see markCurrentScopeAsDynamic in
// next/dist/server/app-render/dynamic-rendering.js). Safe here because this
// segment reads no cookies, headers, or searchParams — the live data path is
// ScoresClient polling /api/scores, which stays fully dynamic.
export const dynamic = "force-static"

/**
 * Server component shell for /scores.
 *
 * Fetches today's matches directly from the data layer (no /api/scores
 * round-trip) and ships them as HTML in the very first response, so the
 * browser paints real match cards immediately. The interactive bits
 * (sport tabs, date picker, voting, 15s polling) live in `ScoresClient`.
 */
export default async function ScoresPage() {
  const initialDate = getTodayYYYYMMDD()
  let initialScores: Awaited<ReturnType<typeof getScoresSnapshot>> = []

  try {
    // ISR-safe snapshot (see lib/data/isr-snapshots.ts): reads through an
    // unstable_cache boundary so the Redis-backed data layer's no-store fetch
    // doesn't force this page to render dynamically on every request.
    initialScores = await getScoresSnapshot()
  } catch {
    // If the data layer fails on the server, render with an empty list and
    // let the client component refetch on mount.
    initialScores = []
  }

  return <ScoresClient initialDate={initialDate} initialScores={initialScores} />
}
