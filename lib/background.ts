import "server-only"

import { after } from "next/server"

/**
 * Runs `work` after the response has been flushed, keeping the invocation alive
 * until it settles.
 *
 * Why not plain fire-and-forget: `work().catch(() => {})` looks free but isn't.
 * On a serverless platform the instance freezes as soon as the response is
 * flushed, so an unattended promise stalls mid-flight and only resumes when the
 * next request thaws the instance. Sentry was reporting p95 ≈ 120s on
 * `POST /rest/v1/matches` and `POST /rest/v1/team_logos` — not slow SQL, just
 * writes suspended between invocations, burning ~3h of traced span time a week.
 *
 * `after` hands the promise to the platform's `waitUntil`, so the write
 * completes inside the invocation that started it and its span reflects real
 * database latency.
 *
 * Outside a request scope (scripts, tests, cron entrypoints) `after` throws
 * synchronously; we fall back to fire-and-forget there, which is correct because
 * those processes aren't frozen mid-task.
 */
export function afterResponse(work: () => Promise<unknown>, label: string): void {
  const run = async () => {
    try {
      await work()
    } catch (error) {
      console.warn(`[background] ${label} failed:`, error)
    }
  }

  try {
    after(run)
  } catch {
    void run()
  }
}
