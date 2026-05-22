/**
 * Security constants and default configurations.
 * Centralizes all magic numbers and configuration defaults for security modules.
 */

import type { RateLimitConfig, CacheKeyPattern } from "./types"

// ─── Rate Limit Defaults ─────────────────────────────────────────────────────

/** Authentication endpoints: 10 requests per minute */
export const RATE_LIMIT_AUTH: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60_000,
}

/** Standard API endpoints (authenticated): 60 requests per minute */
export const RATE_LIMIT_STANDARD: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60_000,
}

/** Unauthenticated requests: 30 requests per minute */
export const RATE_LIMIT_UNAUTHENTICATED: RateLimitConfig = {
  maxRequests: 30,
  windowMs: 60_000,
}

/** Multiplier for IP auto-block threshold (5× standard limit) */
export const IP_BLOCK_THRESHOLD_MULTIPLIER = 5

/** Duration of IP block in milliseconds (15 minutes) */
export const IP_BLOCK_DURATION_MS = 15 * 60 * 1000

/** IP block detection window in milliseconds (1 minute) */
export const IP_BLOCK_WINDOW_MS = 60_000

// ─── Body Size Limits ────────────────────────────────────────────────────────

/** Standard API request body limit: 1MB */
export const BODY_LIMIT_STANDARD = 1 * 1024 * 1024

/** File upload request body limit: 10MB */
export const BODY_LIMIT_UPLOAD = 10 * 1024 * 1024

// ─── Input Validation ────────────────────────────────────────────────────────

/** Maximum string field length (default) */
export const MAX_STRING_LENGTH = 255

/** Maximum filename length */
export const MAX_FILENAME_LENGTH = 255

/** Maximum error message length in client responses */
export const MAX_ERROR_MESSAGE_LENGTH = 200

/** Maximum error code length in client responses */
export const MAX_ERROR_CODE_LENGTH = 50

/** NoSQL operator patterns to reject in user input */
export const NOSQL_OPERATORS = [
  "$gt",
  "$lt",
  "$ne",
  "$regex",
  "$where",
  "$in",
  "$nin",
  "$exists",
  "$or",
  "$and",
  "$not",
] as const

/** Path traversal sequences to reject */
export const PATH_TRAVERSAL_PATTERNS = [
  "../",
  "..\\",
  "%2e%2e",
  "%2e%2E",
  "%2E%2e",
  "%2E%2E",
] as const

/** Allowed filename characters regex */
export const ALLOWED_FILENAME_REGEX = /^[a-zA-Z0-9\-_. ]+$/

/** HTML special characters that must be entity-encoded */
export const HTML_ENCODE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
}

// ─── Hotkey Registry ─────────────────────────────────────────────────────────

/** Maximum number of registered hotkey bindings */
export const MAX_HOTKEY_BINDINGS = 500

/** Maximum number of keys per hotkey combination */
export const MAX_KEYS_PER_COMBO = 4

/** Allowed keys for hotkey combinations */
export const ALLOWED_KEYS: Set<string> = new Set([
  // Modifiers
  "Ctrl",
  "Shift",
  "Alt",
  "Meta",
  // Function keys
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "F8",
  "F9",
  "F10",
  "F11",
  "F12",
  // Arrow keys
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  // Special keys
  "Escape",
  "Tab",
  "Space",
  // Alphanumeric (a-z, 0-9)
  ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)), // A-Z
  ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i)), // a-z
  ...Array.from({ length: 10 }, (_, i) => String(i)), // 0-9
])

// ─── Cache Defaults ──────────────────────────────────────────────────────────

/** Default TTL jitter percentage */
export const DEFAULT_CACHE_JITTER_PERCENT = 20

/** Default stale-while-revalidate window in milliseconds */
export const DEFAULT_STALE_WINDOW_MS = 60_000

/** Default thundering herd timeout in milliseconds */
export const DEFAULT_THUNDERING_HERD_TIMEOUT_MS = 5_000

/** Sensitive data markers that should never be cached with user identifiers */
export const SENSITIVE_DATA_MARKERS = [
  "token",
  "password",
  "secret",
  "session",
] as const

/** Default allowed cache key patterns */
export const DEFAULT_CACHE_KEY_PATTERNS: CacheKeyPattern[] = [
  { pattern: /^explore:/, description: "Explore page data" },
  { pattern: /^scores:/, description: "Live scores" },
  { pattern: /^room:\w+$/, description: "Room details" },
  { pattern: /^profile:\w+$/, description: "User profiles" },
  { pattern: /^dashboard:\w+$/, description: "Dashboard stats" },
  { pattern: /^feed:\w+$/, description: "User feed" },
  { pattern: /^props:/, description: "Props data" },
  { pattern: /^games:/, description: "Games data" },
]

// ─── Security Headers ────────────────────────────────────────────────────────

/** Minimum HSTS max-age in seconds (1 year) */
export const HSTS_MIN_MAX_AGE = 31_536_000

/** Maximum number of allowed CORS origins */
export const MAX_ALLOWED_ORIGINS = 20

// ─── Crypto ──────────────────────────────────────────────────────────────────

/** Minimum token entropy in bits */
export const MIN_TOKEN_ENTROPY_BITS = 256

/** Default token entropy in bits */
export const DEFAULT_TOKEN_BITS = 256

// ─── Error Codes ─────────────────────────────────────────────────────────────

export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INJECTION_DETECTED: "INJECTION_DETECTED",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]
