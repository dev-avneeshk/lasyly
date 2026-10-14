import "server-only"

/**
 * Public seat names for arena games. Server only.
 *
 * A seat's display name is recorded once, when the seat is taken, and then
 * rendered in every view, so it is cleaned here at the source. Both reads use
 * the service-role client and are bounded by an abort deadline.
 */

import { createAdminClient } from "@/lib/supabase/admin"

/** Longest recorded seat name, in code points. */
export const SEAT_NAME_MAX_CHARS = 30
/** Deadline for the best-effort seat-name read on create/join. */
export const SEAT_NAME_TIMEOUT_MS = 800
/** Deadline for the persona collision check. */
export const IDENTITY_LOOKUP_TIMEOUT_MS = 1_500

/** Candidates must be plain lowercase handles, so the `.or()` filter can't be malformed and `ilike` has no wildcards. */
const CANDIDATE_RE = /^[a-z0-9]+$/

/**
 * Make a profile string safe to show as a label: NFKC first (compatibility forms
 * fold before filtering), then strip, trim, cap at 30 code points and return
 * `null` if nothing is left.
 */
export function sanitizeSeatName(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const clean = raw
    .normalize("NFKC")
    // C0/C1 controls and DEL, Arabic letter mark, zero-width chars and LRM/RLM, bidi embeddings/overrides,
    // word joiner and invisible operators, bidi isolates, BOM. Extends cleanText() in lib/careers/validation.ts.
    .replace(/[\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/g, "")
    .trim()
  return Array.from(clean).slice(0, SEAT_NAME_MAX_CHARS).join("").trim() || null // code points, so a surrogate pair is never split
}

/**
 * The user's public seat name: `username`, falling back to `display_name`, both
 * sanitized. Best effort: any failure (no admin config, a query error, the 800 ms
 * deadline) logs at warn and returns `null`, which the UI shows as "Opponent".
 * Never throws.
 */
export async function lookupSeatName(userId: string): Promise<string | null> {
  try {
    const admin = createAdminClient() // throws when env is missing, so it stays inside the try
    const { data, error } = await admin
      .from("profiles")
      .select("username, display_name")
      .eq("id", userId)
      .abortSignal(AbortSignal.timeout(SEAT_NAME_TIMEOUT_MS)) // must precede maybeSingle()
      .maybeSingle()
    if (error) throw error
    return sanitizeSeatName(data?.username) ?? sanitizeSeatName(data?.display_name)
  } catch {
    console.warn("[arena/identity] seat name lookup failed", { userId }) // UUID only, never an email
    return null
  }
}

/**
 * Which of `candidates` already exist as a `username` or `display_name`,
 * case-insensitively. One bounded admin read; throws on an error or timeout so a
 * caller can never proceed with an unchecked name. Returns lowercased, trimmed values.
 */
export async function findTakenNames(candidates: string[]): Promise<Set<string>> {
  for (const c of candidates) {
    if (!CANDIDATE_RE.test(c)) throw new Error("findTakenNames: candidates must match ^[a-z0-9]+$")
  }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("profiles")
    .select("username, display_name")
    .or(candidates.flatMap((c) => [`username.ilike.${c}`, `display_name.ilike.${c}`]).join(","))
    .limit(100)
    .abortSignal(AbortSignal.timeout(IDENTITY_LOOKUP_TIMEOUT_MS))
  if (error) throw new Error(`findTakenNames: profiles lookup failed: ${error.message}`)
  const taken = new Set<string>()
  for (const row of data ?? []) {
    for (const value of [row.username, row.display_name]) {
      if (typeof value !== "string") continue
      const name = value.trim().toLowerCase()
      if (name) taken.add(name)
    }
  }
  return taken
}
