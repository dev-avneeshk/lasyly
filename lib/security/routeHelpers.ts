/**
 * Route handler security helpers.
 * Provides a higher-order function `withSecurity` that wraps Next.js API route handlers
 * with body size enforcement, error handling, and Cache-Control headers.
 *
 * Also provides `checkQueryParams` for injection pattern detection on query/filter values.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.7, 6.1, 6.2, 6.5, 6.6, 2.6, 2.7, 11.1
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { handleError, type RequestContext } from "./errorHandler"
import { enforceBodySize, rejectInjectionPatterns, validateBody } from "./inputValidator"
import { BODY_LIMIT_STANDARD, BODY_LIMIT_UPLOAD } from "./constants"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SecurityOptions {
  /** Maximum body size in bytes. Defaults to BODY_LIMIT_STANDARD (1MB). */
  maxBodySize?: number
  /**
   * Cache-Control header value.
   * Use "private" for sensitive user data, "public" for cacheable data.
   * Defaults to "no-store, no-cache, must-revalidate, private" (sensitive).
   */
  cacheControl?: string
}

/** Cache-Control presets */
export const CACHE_CONTROL = {
  /** For sensitive/user-specific data: no caching */
  SENSITIVE: "no-store, no-cache, must-revalidate, private",
  /** For public data with short TTL (e.g., explore, props) */
  PUBLIC_SHORT: "public, max-age=10, s-maxage=30, stale-while-revalidate=60",
  /** For public data with medium TTL (e.g., games) */
  PUBLIC_MEDIUM: "public, max-age=30, s-maxage=60, stale-while-revalidate=120",
  /** For public data with long TTL (e.g., static explore data) */
  PUBLIC_LONG: "public, max-age=60, s-maxage=120, stale-while-revalidate=300",
  /** For static/immutable data (e.g., player headshots, team logos) */
  IMMUTABLE: "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
} as const

// ─── Route Handler Types ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteHandler = (request: Request, context?: any) => Promise<NextResponse>

// ─── withSecurity Higher-Order Function ──────────────────────────────────────

/**
 * Wraps a route handler with security protections:
 * 1. Body size enforcement (rejects oversized payloads with 413)
 * 2. Error handling (catches all errors, returns sanitized responses)
 * 3. Cache-Control headers on successful responses
 *
 * @param handler - The route handler function to wrap
 * @param options - Security configuration options
 * @returns A wrapped handler with security protections applied
 */
export function withSecurity(
  handler: RouteHandler,
  options: SecurityOptions = {}
): RouteHandler {
  const {
    maxBodySize = BODY_LIMIT_STANDARD,
    cacheControl = CACHE_CONTROL.SENSITIVE,
  } = options

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (request: Request, context?: any) => {
    const url = new URL(request.url)
    const requestContext: RequestContext = {
      method: request.method,
      path: url.pathname,
    }

    try {
      // 1. Enforce body size limit
      if (enforceBodySize(request, maxBodySize)) {
        return NextResponse.json(
          {
            error: "The request payload exceeds the maximum allowed size.",
            code: "PAYLOAD_TOO_LARGE",
            correlationId: crypto.randomUUID(),
          },
          { status: 413 }
        )
      }

      // 2. Execute the actual handler
      const response = await handler(request, context)

      // 3. Set Cache-Control header on the response
      response.headers.set("Cache-Control", cacheControl)

      return response
    } catch (error: unknown) {
      return handleError(error, requestContext)
    }
  }
}

// ─── Query Parameter Injection Check ─────────────────────────────────────────

/**
 * Checks multiple query/filter parameter values for injection patterns.
 * Returns a NextResponse with 400 status if any value contains injection patterns,
 * or null if all values are safe.
 *
 * @param params - Record of parameter name → value pairs to check
 * @returns NextResponse (400) if injection detected, null if safe
 */
export function checkQueryParams(
  params: Record<string, string | null | undefined>
): NextResponse | null {
  for (const [, value] of Object.entries(params)) {
    if (value && rejectInjectionPatterns(value)) {
      return NextResponse.json(
        {
          error: "The request was rejected due to invalid content.",
          code: "INJECTION_DETECTED",
          correlationId: crypto.randomUUID(),
        },
        { status: 400 }
      )
    }
  }
  return null
}

// ─── Body Validation Helper ──────────────────────────────────────────────────

/**
 * Validates a request body against a Zod schema and returns either the parsed data
 * or a NextResponse with validation errors.
 *
 * @param body - The parsed request body
 * @param schema - Zod schema to validate against
 * @returns Tuple of [data, null] on success or [null, NextResponse] on failure
 */
export function validateRequestBody<T>(
  body: unknown,
  schema: z.ZodSchema<T>
): [T, null] | [null, NextResponse] {
  const result = validateBody(body, schema)

  if (!result.success) {
    const response = NextResponse.json(
      {
        error: "The request contains invalid data.",
        code: "VALIDATION_ERROR",
        correlationId: crypto.randomUUID(),
        details: result.error,
      },
      { status: 400 }
    )
    return [null, response]
  }

  return [result.data, null]
}

// Re-export constants for convenience
export { BODY_LIMIT_STANDARD, BODY_LIMIT_UPLOAD }
