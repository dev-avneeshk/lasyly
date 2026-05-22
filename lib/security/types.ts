/**
 * Shared TypeScript interfaces and types for all security modules.
 * These types define the contracts between security subsystems.
 */

// ─── Security Headers ────────────────────────────────────────────────────────

export interface SecurityHeadersConfig {
  /** CSP script-src allowlist of trusted domains */
  trustedDomains: string[]
  /** CORS allowed origins (max 20) */
  allowedOrigins: string[]
  /** HSTS max-age in seconds. Default: 31536000 (1 year) */
  hstsMaxAge: number
  /** Optional CSP violation reporting URI */
  cspReportUri?: string
}

// ─── Rate Limiting ───────────────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number
  /** Window size in milliseconds */
  windowMs: number
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean
  /** Number of requests remaining in the current window */
  remaining: number
  /** Rate limit ceiling (max requests allowed) */
  limit: number
  /** Seconds until the client can retry (0 if allowed) */
  retryAfterSeconds: number
  /** Seconds until the current window resets */
  resetAtSeconds: number
}

export interface IPBlockEntry {
  /** Timestamp (ms since epoch) when the block expires */
  blockedUntil: number
  /** Reason for the block */
  reason: string
}

// ─── Input Validation ────────────────────────────────────────────────────────

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: { field: string; constraint: string }[] }

// ─── Cache Layer ─────────────────────────────────────────────────────────────

export interface CacheConfig {
  /** Time-to-live in milliseconds */
  ttlMs: number
  /** Jitter percentage (0–20). Default: 20 */
  jitterPercent: number
  /** Stale-while-revalidate window in milliseconds. Default: 60000 */
  staleWindowMs: number
  /** Thundering herd timeout in milliseconds. Default: 5000 */
  thunderingHerdTimeoutMs: number
}

export interface CacheKeyPattern {
  /** Regex pattern to match valid cache keys */
  pattern: RegExp
  /** Human-readable description of what this pattern matches */
  description: string
}

// ─── Error Handling ──────────────────────────────────────────────────────────

export interface SafeErrorResponse {
  /** Human-readable error message. Max 200 chars, no internal details. */
  error: string
  /** Error type code. UPPER_SNAKE_CASE, max 50 chars. */
  code: string
  /** Correlation ID for tracing. UUID v4 format. */
  correlationId: string
}

export interface SecurityEvent {
  /** ISO 8601 timestamp */
  timestamp: string
  /** Source IP address of the request */
  sourceIp: string
  /** User ID if authenticated */
  userId?: string
  /** Type of security event (e.g., "failed_login", "rate_limit_exceeded") */
  eventType: string
  /** Correlation ID for tracing */
  correlationId: string
  /** Severity level — always "security" for security events */
  severity: "security"
}

// ─── Structured Logging ──────────────────────────────────────────────────────

export interface LogEntry {
  /** ISO 8601 timestamp */
  timestamp: string
  /** Log severity level */
  level: "info" | "warn" | "error" | "security"
  /** Correlation ID for tracing */
  correlationId: string
  /** HTTP method */
  method: string
  /** Request path */
  path: string
  /** User ID if authenticated */
  userId?: string
  /** Source IP address */
  sourceIp?: string
  /** Security event type */
  eventType?: string
  /** Error details (server-side only, never sent to client) */
  error?: {
    message: string
    stack: string
    name: string
  }
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

// ─── Platform Configuration ──────────────────────────────────────────────────

export interface PlatformSecurityConfig {
  /** Trusted domains for CSP script-src */
  trustedDomains: string[]
  /** Allowed origins for CORS (max 20) */
  allowedOrigins: string[]
  /** Rate limit configurations by endpoint type */
  rateLimits: {
    auth: RateLimitConfig
    standard: RateLimitConfig
    unauthenticated: RateLimitConfig
  }
  /** Allowed cache key patterns */
  cacheKeyPatterns: CacheKeyPattern[]
  /** Request body size limits in bytes */
  bodyLimits: {
    /** Standard API endpoints: 1MB */
    standard: number
    /** File upload endpoints: 10MB */
    upload: number
  }
}
