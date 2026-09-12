import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { fetchWithRetry } from "./fetch-with-retry"

let cachedClient: SupabaseClient | null = null

/**
 * Resolves the project URL. `NEXT_PUBLIC_SUPABASE_URL` is the primary name, but
 * server-only contexts (GitHub Actions, one-off scripts, some Vercel
 * integrations) often only set the unprefixed `SUPABASE_URL`. Accepting both
 * avoids throwing when the database is perfectly reachable under another name.
 */
function resolveUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
}

/**
 * Service-role Supabase client that bypasses RLS.
 * Only use in server-side contexts (webhooks, background jobs).
 * Never expose to the client.
 *
 * The instance is memoized: it holds no per-request state
 * (`persistSession: false`, `autoRefreshToken: false`), and this is called from
 * dozens of data-layer functions per request.
 */
export function createAdminClient(): SupabaseClient {
  if (cachedClient) return cachedClient

  const url = resolveUrl()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    // Name the variables that are actually missing. The previous message listed
    // both unconditionally, which meant the Sentry report couldn't tell us
    // which environment was misconfigured or how.
    const missing = [
      !url && "NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)",
      !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
    ].filter(Boolean)

    throw new Error(
      `Supabase admin client is not configured: missing ${missing.join(" and ")}. ` +
        `Set it for this environment (NODE_ENV=${process.env.NODE_ENV ?? "unknown"}, ` +
        `VERCEL_ENV=${process.env.VERCEL_ENV ?? "none"}).`
    )
  }

  cachedClient = createClient(url, serviceRoleKey, {
    global: {
      fetch: fetchWithRetry,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return cachedClient
}
