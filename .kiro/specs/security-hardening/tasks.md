# Implementation Plan: Security Hardening

## Overview

This plan implements a layered defense architecture for the Betroom platform. Tasks are ordered so foundational modules (crypto, headers, rate limiter, input validator) are built first, then composed into middleware and route handlers. Property-based tests using fast-check validate the 21 correctness properties defined in the design. The implementation uses TypeScript throughout, with Zod for validation, Node.js crypto for CSPRNG, and Supabase-native auth.

## Tasks

- [x] 1. Install dependencies and set up project structure
  - [x] 1.1 Install required packages (zod, fast-check as devDependency) and create `lib/security/` directory structure
    - Run `npm install zod` and `npm install --save-dev fast-check @types/node`
    - Create directories: `lib/security/`, `lib/hotkeys/`, `__tests__/security/`
    - Create barrel export file `lib/security/index.ts`
    - _Requirements: 6.1, 4.2, 7.1_

  - [x] 1.2 Define shared TypeScript interfaces and types for all security modules
    - Create `lib/security/types.ts` with all interfaces from the design: `SecurityHeadersConfig`, `RateLimitConfig`, `RateLimitResult`, `IPBlockEntry`, `ValidationResult`, `CacheConfig`, `CacheKeyPattern`, `SafeErrorResponse`, `SecurityEvent`, `LogEntry`, `PlatformSecurityConfig`
    - Create `lib/security/constants.ts` with rate limit defaults, body size limits, allowed key sets, and max values
    - _Requirements: 10.1, 10.2, 10.3, 6.5, 1.1_

- [x] 2. Implement Crypto Module
  - [x] 2.1 Implement `lib/security/crypto.ts` with CSPRNG token generation and AES-256-GCM encryption/decryption
    - Implement `generateSecureToken(bits?: number): string` using Node.js `crypto.randomBytes` (default 256 bits)
    - Implement `secureRandom(bytes: number): Buffer` wrapper around `crypto.randomBytes`
    - Implement `encryptAES256GCM` and `decryptAES256GCM` using `crypto.createCipheriv`/`crypto.createDecipheriv`
    - Implement `hashArgon2id` and `verifyArgon2id` (delegate to Supabase Auth or use native Node.js `crypto.scrypt` as fallback with Argon2id parameters)
    - Ensure no use of MD5, SHA-1, DES, 3DES, or RC4
    - _Requirements: 7.1, 7.2, 7.5, 7.6, 7.7_

  - [ ]* 2.2 Write property test for token entropy minimum
    - **Property 21: Token entropy minimum**
    - **Validates: Requirements 7.7, 7.5**
    - Use fast-check to generate random bit lengths (≥256) and verify output byte length matches expected entropy

- [x] 3. Implement Security Headers Module
  - [x] 3.1 Implement `lib/security/headers.ts` with CSP construction, HSTS, and all security header application
    - Implement `applySecurityHeaders(response, config)` that sets CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy
    - CSP script-src must be `'self'` plus trusted domains, no `'unsafe-inline'` or `'unsafe-eval'`, object-src `'none'`
    - HSTS max-age ≥ 31536000 with includeSubDomains
    - Implement `validateOrigin(origin, config)` for CORS checking
    - Strip X-Powered-By and Server headers
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10_

  - [ ]* 3.2 Write property test for CSP header construction
    - **Property 18: CSP header construction**
    - **Validates: Requirements 9.1**
    - Use fast-check to generate arbitrary lists of trusted domains and verify script-src contains exactly 'self' plus listed domains, never 'unsafe-inline'/'unsafe-eval', and object-src is 'none'

  - [ ]* 3.3 Write property test for CORS origin validation
    - **Property 19: CORS origin validation**
    - **Validates: Requirements 9.7, 9.8**
    - Use fast-check to generate arbitrary origin strings and verify CORS headers are included iff origin is in allowed list or matches platform origin

  - [ ]* 3.4 Write property test for security headers universality
    - **Property 20: Security headers universality**
    - **Validates: Requirements 9.10**
    - Use fast-check to generate arbitrary HTTP status codes and verify all security headers are present regardless of status

- [x] 4. Implement Rate Limiter
  - [x] 4.1 Implement `lib/security/rateLimiter.ts` with sliding window algorithm, IP blocking, and rate limit headers
    - Implement in-memory `Map<string, { timestamps: number[] }>` for sliding window tracking
    - Implement `checkRateLimit(key, config): RateLimitResult` with sliding window that prunes expired timestamps
    - Implement `checkIPBlock(ip)` and `blockIP(ip, durationMs, reason)` with `Map<string, IPBlockEntry>`
    - Implement `applyRateLimitHeaders(response, result)` setting X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
    - Auto-block IPs exceeding 5× standard limit (300 req/min) for 15 minutes
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [ ]* 4.2 Write property test for sliding window rate limit enforcement
    - **Property 13: Sliding window rate limit enforcement**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.5**
    - Use fast-check to generate arbitrary sequences of timestamped requests and verify at most `maxRequests` are allowed within any sliding window

  - [ ]* 4.3 Write property test for IP blocking threshold
    - **Property 14: IP blocking threshold**
    - **Validates: Requirements 10.6**
    - Use fast-check to generate request counts and verify blocking triggers at 5× threshold

- [x] 5. Implement Input Validator
  - [x] 5.1 Implement `lib/security/inputValidator.ts` with Zod-based validation, injection detection, and path traversal rejection
    - Implement `validateBody<T>(body, schema): ValidationResult<T>` using Zod `.safeParse()`
    - Implement `rejectInjectionPatterns(value)` checking for NoSQL operators ($gt, $lt, $ne, $regex, $where, $in, $nin, $exists, $or, $and, $not)
    - Implement `rejectPathTraversal(path)` checking for `../`, `..\`, `%2e%2e`, null bytes, and double-encoded variants
    - Implement `rejectHTMLContent(value, fieldName)` checking for HTML tags and script elements
    - Implement `enforceBodySize(request, maxBytes)` checking Content-Length header
    - Implement HTML entity encoding for &, <, >, ", '
    - _Requirements: 4.1, 4.2, 4.5, 4.6, 4.7, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [ ]* 5.2 Write property test for NoSQL injection pattern rejection
    - **Property 8: NoSQL injection pattern rejection**
    - **Validates: Requirements 4.2, 4.7**
    - Use fast-check to generate strings with/without NoSQL operators and verify correct rejection without disclosing matched pattern

  - [ ]* 5.3 Write property test for HTML entity encoding completeness
    - **Property 9: HTML entity encoding completeness**
    - **Validates: Requirements 4.5, 4.6, 6.3**
    - Use fast-check to generate arbitrary strings and verify round-trip encoding/decoding and no unencoded special chars in output

  - [ ]* 5.4 Write property test for path traversal rejection
    - **Property 10: Path traversal rejection**
    - **Validates: Requirements 6.4**
    - Use fast-check to generate path strings with/without traversal sequences and verify correct acceptance/rejection

  - [ ]* 5.5 Write property test for filename character validation
    - **Property 11: Filename character validation**
    - **Validates: Requirements 6.8**
    - Use fast-check to generate filenames and verify acceptance iff only alphanumeric, hyphens, underscores, periods, spaces, and ≤255 chars

  - [ ]* 5.6 Write property test for HTML content rejection in text fields
    - **Property 12: HTML content rejection in text fields**
    - **Validates: Requirements 6.7**
    - Use fast-check to generate strings with HTML tags/script elements and verify rejection in text-only fields

- [x] 6. Checkpoint - Core modules complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement Cache Layer Hardening
  - [x] 7.1 Implement `lib/security/cache.ts` with key validation, thundering herd protection, stale-while-revalidate, and TTL jitter
    - Implement `validateCacheKey(key, allowedPatterns)` checking against regex allowlist
    - Implement `containsSensitiveData(key)` checking for user ID + sensitive marker combinations
    - Implement `cachedSecure<T>(key, fetcher, config)` with single-flight thundering herd (shared Promise), stale-while-revalidate (60s staleness window), and TTL jitter (0–20%)
    - Implement `invalidateCache(key)` and `invalidateCachePrefix(prefix)`
    - Use `CacheEntry<T>` data model with `refreshing` flag and `refreshPromise`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.8, 2.9_

  - [ ]* 7.2 Write property test for cache key allowlist validation
    - **Property 4: Cache key allowlist validation**
    - **Validates: Requirements 2.1**
    - Use fast-check to generate arbitrary cache key strings and verify acceptance iff matching at least one allowlist pattern

  - [ ]* 7.3 Write property test for thundering herd single-flight execution
    - **Property 5: Thundering herd single-flight execution**
    - **Validates: Requirements 2.2, 2.8**
    - Use fast-check to generate N concurrent callers (N≥2) and verify fetcher is called exactly once, all callers get same result

  - [ ]* 7.4 Write property test for TTL jitter bounds
    - **Property 6: TTL jitter bounds**
    - **Validates: Requirements 2.3**
    - Use fast-check to generate TTL values and verify actual expiration falls within [T, T × 1.2]

  - [ ]* 7.5 Write property test for sensitive cache key rejection
    - **Property 7: Sensitive cache key rejection**
    - **Validates: Requirements 2.5**
    - Use fast-check to generate cache keys with user ID + sensitive markers and verify rejection

- [x] 8. Implement Error Handler
  - [x] 8.1 Implement `lib/security/errorHandler.ts` with sanitized responses, correlation IDs, structured logging, and security event logging
    - Implement `generateCorrelationId()` using `crypto.randomUUID()`
    - Implement `handleError(error, context): NextResponse<SafeErrorResponse>` that classifies errors, logs full details, returns sanitized response
    - Implement `logSecurityEvent(event: SecurityEvent)` for security-relevant events
    - Ensure error responses contain only `error` (≤200 chars), `code` (UPPER_SNAKE_CASE, ≤50 chars), `correlationId` (UUID v4)
    - Ensure no stack traces, file paths, DB errors, or env vars leak to client
    - Handle logging failures gracefully (still return response to client)
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [ ]* 8.2 Write property test for error response sanitization
    - **Property 15: Error response sanitization**
    - **Validates: Requirements 11.1, 11.6**
    - Use fast-check to generate errors with stack traces, file paths, DB messages, env vars and verify none appear in client response

  - [ ]* 8.3 Write property test for structured log completeness
    - **Property 16: Structured log completeness**
    - **Validates: Requirements 11.2, 11.3**
    - Use fast-check to generate error scenarios and verify log entries contain all required fields with matching correlation ID

  - [ ]* 8.4 Write property test for security event logging
    - **Property 17: Security event logging**
    - **Validates: Requirements 11.4**
    - Use fast-check to generate security events and verify log entries have severity "security", ISO 8601 timestamp, source IP, event type, correlation ID

- [x] 9. Implement Concurrency Guards
  - [x] 9.1 Implement `lib/security/concurrency.ts` with optimistic locking query builder and conflict handler
    - Implement `buildOptimisticUpdate(table, updates, conditions, versionField, currentVersion)` that constructs Supabase queries with version/timestamp conditions
    - Implement `handleConflict(affectedRows, resourceType)` that returns 409 response when zero rows affected
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6_

- [x] 10. Implement Hotkey Registry
  - [x] 10.1 Implement `lib/hotkeys/registry.ts` with context-scoped shortcut management, capacity limits, and key validation
    - Implement `HotkeyRegistry` class with `register`, `unregister`, `setActiveContext`, `getActiveContext`, `handleKeyEvent`, `getBindingsForContext`, `size` methods
    - Enforce max 500 bindings, max 4 keys per combination
    - Validate keys against `ALLOWED_KEYS` set (alphanumeric, modifiers, F1-F12, arrows, Escape, Tab, Space)
    - Reject duplicate bindings for same context with error indication
    - Suppress shortcuts from non-active contexts when modal/overlay is active
    - Allow unmatched events to propagate
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ]* 10.2 Write property test for hotkey registry capacity and uniqueness
    - **Property 1: Hotkey registry capacity and uniqueness**
    - **Validates: Requirements 1.1, 1.5**
    - Use fast-check to generate sequences of register operations and verify size ≤ 500 and unique mapping per context

  - [ ]* 10.3 Write property test for context-scoped shortcut execution
    - **Property 2: Context-scoped shortcut execution**
    - **Validates: Requirements 1.2, 1.4, 1.6**
    - Use fast-check to generate keyboard events and registered shortcuts across contexts, verify handler fires iff context matches

  - [ ]* 10.4 Write property test for hotkey key combination validation
    - **Property 3: Hotkey key combination validation**
    - **Validates: Requirements 1.3**
    - Use fast-check to generate key combinations and verify acceptance iff all keys in allowed set and ≤4 keys

- [x] 11. Checkpoint - All modules implemented
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Integrate middleware and harden routes
  - [x] 12.1 Update `middleware.ts` to compose security headers, rate limiting, CORS validation, and session refresh
    - Import and wire `applySecurityHeaders`, `checkRateLimit`, `checkIPBlock`, `validateOrigin` into the middleware pipeline
    - Apply security headers to every non-static response
    - Check rate limit per IP (unauthenticated) or per user ID (authenticated) with appropriate configs (auth: 10/min, standard: 60/min, unauth: 30/min)
    - Validate CORS origin and omit headers for disallowed origins
    - Refresh Supabase session and handle token rotation
    - Strip X-Powered-By and Server headers
    - Block IPs that exceed 5× threshold
    - _Requirements: 9.1–9.10, 10.1–10.7, 5.1, 5.7_

  - [x] 12.2 Harden API route handlers under `app/api/` with input validation, body size enforcement, and error handling
    - Add Zod schema validation to all route handlers (betslips, rooms, profiles, dashboard, follows, picks, explore, props)
    - Enforce body size limits (1MB standard, 10MB uploads)
    - Wrap all handlers with `handleError` for consistent error responses
    - Add injection pattern checks on user-supplied filter/query values
    - Set Cache-Control headers: `no-store, no-cache, must-revalidate, private` for sensitive data, appropriate max-age for public data
    - _Requirements: 4.1, 4.2, 4.3, 4.7, 6.1, 6.2, 6.5, 6.6, 2.6, 2.7, 11.1_

  - [x] 12.3 Apply concurrency guards to room join, betslip status update, and profile update routes
    - Add unique constraint enforcement on room join (room_id, user_id)
    - Add optimistic locking with `updated_at` condition on profile updates
    - Add status condition on betslip status transitions
    - Return 409 conflict with conflict type description when zero rows affected
    - Ensure no mutable module-level shared state in route handlers
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 13. Implement Dependency Auditing CI Workflow
  - [x] 13.1 Create `.github/workflows/security-audit.yml` with vulnerability scanning, lockfile validation, and SRI checks
    - Run `npm audit --audit-level=high` and fail on CVSS ≥ 7.0
    - Validate lockfile has no range operators (^, ~, >=, *)
    - Check for SRI hashes on externally-loaded scripts/stylesheets
    - Flag unmaintained packages (no release in 12 months + known vulns)
    - Fail build if vulnerability scanning service is unavailable
    - Check for unused production dependencies via static analysis
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [x] 14. Implement Authentication Hardening
  - [x] 14.1 Configure Supabase auth settings and update auth-related code for token rotation, PKCE, and cookie security
    - Configure short-lived access tokens (15 min) and refresh tokens (7 days) in Supabase project settings
    - Ensure all auth cookies set httpOnly, Secure, SameSite=Strict
    - Implement token rotation on successful authentication (new token, invalidate previous)
    - Implement session invalidation on logout (invalidate both access and refresh tokens)
    - Enable PKCE for all OAuth flows
    - Handle invalid/expired session tokens with 401 + cookie clearing
    - Handle refresh token rotation (new refresh token, invalidate previous)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

- [x] 15. Final checkpoint - Full integration complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate the 21 universal correctness properties from the design using fast-check
- Unit tests validate specific examples and edge cases
- The project uses Next.js 16, React 19, Supabase, and TypeScript
- Zod must be installed as a new dependency; fast-check is dev-only
- All security modules are in `lib/security/` except hotkeys which are in `lib/hotkeys/`
- The existing `lib/cache.ts` and `lib/rateLimit.ts` will be superseded by the new hardened implementations

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "3.1", "10.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "3.3", "3.4", "4.1", "5.1", "10.2", "10.3", "10.4"] },
    { "id": 3, "tasks": ["4.2", "4.3", "5.2", "5.3", "5.4", "5.5", "5.6", "7.1", "8.1", "9.1"] },
    { "id": 4, "tasks": ["7.2", "7.3", "7.4", "7.5", "8.2", "8.3", "8.4"] },
    { "id": 5, "tasks": ["12.1", "13.1", "14.1"] },
    { "id": 6, "tasks": ["12.2", "12.3"] }
  ]
}
```
