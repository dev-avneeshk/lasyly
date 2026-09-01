import { createClient } from "@supabase/supabase-js"

import { fetchWithRetry } from "./fetch-with-retry"

/**
 * Service-role Supabase client that bypasses RLS.
 * Only use in server-side contexts (webhooks, background jobs).
 * Never expose to the client.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for admin client."
    )
  }

  return createClient(url, serviceRoleKey, {
    global: {
      fetch: fetchWithRetry,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
