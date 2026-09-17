/**
 * Deferred accessor for the Supabase browser client.
 *
 * WHY
 * ---
 * `@supabase/ssr`'s `createBrowserClient` drags in the whole `supabase-js`
 * surface — auth, postgrest, realtime, storage, functions. On this app that is a
 * 177 KB (uncompressed) client chunk. Two things in `app/(app)/layout.tsx`
 * imported it statically — `<AuthListener />` and `<Sidebar />` — which put it in
 * the eager graph of *every* route under that layout, including `/explore`.
 *
 * Neither needed it eagerly. AuthListener's whole job happens inside an effect
 * (it subscribes to token refreshes), and Sidebar only touched it inside a logout
 * click handler. Same story on `/onboarding`, where the client is used to prefill
 * a form and to check username availability — both of which happen after mount,
 * and the second of which can't happen until the user has reached step 2.
 *
 * SIDE BENEFIT
 * ------------
 * The promise is memoised at module scope, so every caller shares one browser
 * client. Previously each component built its own, which meant several GoTrue
 * instances competing to refresh the same session out of the same cookie store.
 *
 * Callers that genuinely need Supabase during render should keep importing
 * `./client` directly — this is for the after-mount and on-interaction cases.
 */
import type { createClient } from "./client"

type SupabaseBrowserClient = ReturnType<typeof createClient>

let clientPromise: Promise<SupabaseBrowserClient> | null = null

/** Loads the client chunk (once) and returns the shared browser client. */
export function getSupabaseClient(): Promise<SupabaseBrowserClient> {
  clientPromise ??= import("./client")
    .then((mod) => mod.createClient())
    .catch((err) => {
      // Don't cache a transient chunk-load failure forever — a later
      // interaction should be able to try again.
      clientPromise = null
      throw err
    })

  return clientPromise
}
