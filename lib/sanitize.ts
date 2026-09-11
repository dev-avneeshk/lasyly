/**
 * Input sanitization utilities for user-generated content.
 */

/**
 * Strip HTML tags from a string to prevent XSS at the data layer.
 */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "")
}

/**
 * Sanitize a text input: trim, strip HTML, collapse whitespace.
 */
export function sanitizeText(input: string, maxLength?: number): string {
  let clean = input.trim()
  clean = stripHtml(clean)
  // Collapse multiple spaces/newlines into single space
  clean = clean.replace(/\s+/g, " ")
  if (maxLength && clean.length > maxLength) {
    clean = clean.slice(0, maxLength)
  }
  return clean
}

/**
 * Sanitize a username: lowercase, only alphanumeric + underscore.
 */
export function sanitizeUsername(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20)
}

/**
 * Escape special characters for Supabase PostgREST .ilike/.or() filters.
 * Prevents filter injection via special chars like , ( ) .
 */
export function escapePostgrestFilter(input: string): string {
  // Escape characters that have special meaning in PostgREST filters
  return input
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/,/g, "")
    .replace(/\(/g, "")
    .replace(/\)/g, "")
    .replace(/\./g, "")
}

/**
 * Validate a URL is a safe image URL (https only, no data URIs).
 */
export function isValidImageUrl(url: string): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:"
  } catch {
    return false
  }
}

/**
 * Spam detection for chat messages.
 * Returns true if the message looks like spam.
 *
 * Tuned to avoid false positives on normal hype chat ("LFG WE WON", "let's go
 * let's go let's go") while still catching genuine flooding, ad dumps, and
 * keyboard mashing.
 */
export function isSpamMessage(content: string): boolean {
  const trimmed = content.trim()

  // Excessive character repetition — catches "aaaaaaaaaa" / "!!!!!!!!!!!!" but
  // requires a long run (12+) so "soooo close" and "gooooal" stay fine.
  if (/(.)\1{11,}/.test(trimmed)) return true

  // Long single-word mash with no spaces (e.g. "asdkfjaslkdfjaslkdfj").
  if (!/\s/.test(trimmed) && trimmed.length > 40) return true

  // Word-level flooding: only flag when a message is BOTH long and almost
  // entirely one repeated token. Requires 8+ words AND ≤2 distinct tokens that
  // each repeat 4+ times — "buy buy buy buy buy buy buy buy" trips it, but a
  // short "let's go let's go" does not.
  const words = trimmed.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length >= 8) {
    const counts = new Map<string, number>()
    for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1)
    const maxRepeat = Math.max(...counts.values())
    if (counts.size <= 2 && maxRepeat >= 4) return true
  }

  // URL spam (more than 2 links in one message).
  const urlCount = (content.match(/https?:\/\//g) || []).length
  if (urlCount > 2) return true

  return false
}

// ─── Profanity filter ─────────────────────────────────────────────────────────

/**
 * Base profanity roots. Kept intentionally small and focused on clear
 * vulgarity/slurs; matched with obfuscation-aware, word-boundary-anchored
 * regexes so we catch "f*ck", "sh1t", "b---tch" without false-flagging clean
 * words that merely contain these substrings ("class", "assist", "Scunthorpe").
 */
const PROFANITY_ROOTS = [
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "piss",
  "cunt",
  "slut",
  "whore",
  "faggot",
  "nigger",
  "nigga",
  "pussy",
]

/**
 * Map a profanity root into a regex fragment that tolerates common obfuscation:
 *  - leetspeak substitutions (a→@4, i→1!, o→0, e→3, s→$5, t→7, u→vµ, etc.)
 *  - a single censor symbol standing in for a letter ("f*ck", "f@ck", "sh#t")
 *  - a repeated letter ("fuuuck")
 *  - a single separator between letters ("f-u-c-k", "f.u.c.k", "f u c k")
 */
function rootToPattern(root: string): string {
  const SUBS: Record<string, string> = {
    a: "a@4",
    b: "b8",
    c: "c(",
    e: "e3",
    g: "g9",
    i: "i1!|",
    l: "l1",
    o: "o0",
    s: "s$5z",
    t: "t7+",
    u: "uv",
  }
  // Censor glyphs stand in for a letter, but ONLY at interior positions. This
  // matches how people actually censor ("f*ck", "sh*t") while ensuring a match
  // always contains real letters at its edges — so a bare "****" or "@#$%"
  // never matches a root.
  const CENSOR = "*@#$%&"
  const sep = "[\\s._\\-]*" // optional separator between letters
  const lastIndex = root.length - 1
  return root
    .split("")
    .map((ch, idx) => {
      const interior = idx > 0 && idx < lastIndex
      const subChars = (SUBS[ch] ?? ch) + (interior ? CENSOR : "")
      // Escape regex-special chars used as literal substitutes (e.g. "(", "+", "|", "$").
      const escaped = subChars.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      return `[${escaped}]+` // the letter, a sub, or (interior) a censor glyph — may repeat
    })
    .join(sep)
}

// Common inflection suffixes so "fucking", "bitches", "pissed" match without
// opening the door to unrelated words like "cockpit".
const PROFANITY_SUFFIX = "(?:ing|in|ed|er|ers|s|es|y|ies|hole|holes)?"

// Precompiled matchers. A leading lookbehind on letters prevents matching a
// root buried inside a larger clean word (e.g. "cunt" inside "Scunthorpe").
// The trailing boundary allows a known suffix, then requires a non-letter, so
// inflected forms are caught but clean compounds are not.
const PROFANITY_REGEXES = PROFANITY_ROOTS.map(
  (root) => new RegExp(`(?<![a-z])${rootToPattern(root)}${PROFANITY_SUFFIX}(?![a-z])`, "gi")
)

/**
 * True if the text contains at least one profanity token (obfuscation-aware).
 */
export function containsProfanity(input: string): boolean {
  if (!input) return false
  return PROFANITY_REGEXES.some((re) => {
    re.lastIndex = 0
    return re.test(input)
  })
}

/**
 * Replace profanity with asterisks of the same length, preserving surrounding
 * text. We mask rather than reject so a single slip doesn't block the whole
 * message — better UX and still keeps the room clean.
 */
export function maskProfanity(input: string): string {
  if (!input) return input
  let out = input
  for (const re of PROFANITY_REGEXES) {
    re.lastIndex = 0
    out = out.replace(re, (match) => "*".repeat(match.length))
  }
  return out
}
