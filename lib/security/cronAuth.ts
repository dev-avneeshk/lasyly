/**
 * Shared authorization for scheduled / operational endpoints.
 *
 * Every `app/api/cron/*` and `app/api/jobs/*` route re-implemented this check,
 * and they drifted:
 *
 *   - cron/correlations used a proper `timingSafeEqual` comparison.
 *   - cron/cleanup-chat, cron/resolve-parlays and cron/settle-parlays used a
 *     plain `authHeader !== \`Bearer ${cronSecret}\`` string compare, which
 *     short-circuits on the first differing byte and is therefore measurably
 *     timing-dependent. That is a slow oracle, but it is an oracle, and the
 *     secret it guards can drop chat history and mutate the ledger's inputs.
 *   - jobs/generate-rankings and jobs/player-of-week additionally accepted the
 *     secret as a QUERY PARAMETER (`?secret=…`). Query strings land in access
 *     logs, proxy logs, Sentry breadcrumbs and `Referer` headers, so that turned
 *     a long-lived shared secret into something routinely written to disk in
 *     several systems.
 *   - Both of those also fell back to `process.env.NODE_ENV === "development"`
 *     when no secret was configured. A preview deployment that happens to build
 *     with NODE_ENV=development would have been wide open.
 *
 * One implementation, header-only, constant-time, and fail-closed.
 */

import { timingSafeEqual } from "node:crypto"

/**
 * Constant-time string comparison.
 *
 * Length is not secret here (both sides are `Bearer ` + a fixed-length secret),
 * but we still run a dummy compare on mismatch so the early return doesn't
 * become a length oracle for the secret itself.
 */
function safeEqual(expected: string, actual: string): boolean {
  const expectedBuf = Buffer.from(expected, "utf8")
  const actualBuf = Buffer.from(actual, "utf8")
  if (expectedBuf.length !== actualBuf.length) {
    timingSafeEqual(expectedBuf, expectedBuf)
    return false
  }
  return timingSafeEqual(expectedBuf, actualBuf)
}

export interface CronAuthOptions {
  /**
   * Additional env var holding a job-specific secret, accepted via a custom
   * header. Used by the rankings pipeline, which has its own credential so it
   * can be rotated independently of CRON_SECRET.
   */
  altSecretEnv?: string
  /** Header carrying the alternate secret. Defaults to "x-rankings-secret". */
  altSecretHeader?: string
}

/**
 * Is this request an authorized scheduled invocation?
 *
 * Accepts either:
 *   Authorization: Bearer <CRON_SECRET>
 *   <altSecretHeader>: <process.env[altSecretEnv]>
 *
 * Returns false when no secret is configured — there is deliberately no
 * development bypass. If you need to run a job locally, set CRON_SECRET in
 * .env.local; that is one line and it keeps the production path honest.
 */
export function isAuthorizedCron(
  request: Request,
  options: CronAuthOptions = {}
): boolean {
  const cronSecret = process.env.CRON_SECRET
  const altSecret = options.altSecretEnv ? process.env[options.altSecretEnv] : undefined

  if (!cronSecret && !altSecret) {
    console.error(
      "[cronAuth] No CRON_SECRET" +
        (options.altSecretEnv ? ` or ${options.altSecretEnv}` : "") +
        " configured — refusing the request."
    )
    return false
  }

  if (cronSecret) {
    const authHeader = request.headers.get("authorization")
    if (authHeader && safeEqual(`Bearer ${cronSecret}`, authHeader)) return true
  }

  if (altSecret) {
    const headerName = options.altSecretHeader ?? "x-rankings-secret"
    const provided = request.headers.get(headerName)
    if (provided && safeEqual(altSecret, provided)) return true
  }

  return false
}

/**
 * Guard helper for route handlers.
 *
 * Returns a 401 Response to return immediately, or null when authorized.
 * The body is intentionally identical for "no secret configured" and "wrong
 * secret" so a caller can't probe the deployment's configuration.
 */
export function requireCron(
  request: Request,
  options?: CronAuthOptions
): Response | null {
  if (isAuthorizedCron(request, options)) return null
  return Response.json({ error: "Unauthorized" }, { status: 401 })
}
