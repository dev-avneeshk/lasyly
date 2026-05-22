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
 * Basic spam detection for chat messages.
 * Returns true if the message looks like spam.
 */
export function isSpamMessage(content: string): boolean {
  // All caps (more than 80% uppercase and longer than 10 chars)
  if (content.length > 10) {
    const upperCount = (content.match(/[A-Z]/g) || []).length
    const letterCount = (content.match(/[a-zA-Z]/g) || []).length
    if (letterCount > 0 && upperCount / letterCount > 0.8) return true
  }

  // Repeated characters (e.g., "aaaaaaa" or "!!!!!!")
  if (/(.)\1{7,}/.test(content)) return true

  // Repeated words (e.g., "buy buy buy buy buy")
  const words = content.toLowerCase().split(/\s+/)
  if (words.length >= 5) {
    const uniqueWords = new Set(words)
    if (uniqueWords.size <= 2) return true
  }

  // URL spam (more than 2 URLs in a single message)
  const urlCount = (content.match(/https?:\/\//g) || []).length
  if (urlCount > 2) return true

  return false
}
