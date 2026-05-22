/**
 * Input validation module.
 * Provides Zod-based schema validation, injection pattern detection,
 * path traversal rejection, HTML content filtering, body size enforcement,
 * HTML entity encoding, and filename validation.
 */

import { z } from "zod"
import type { ValidationResult } from "./types"
import {
  NOSQL_OPERATORS,
  PATH_TRAVERSAL_PATTERNS,
  ALLOWED_FILENAME_REGEX,
  MAX_FILENAME_LENGTH,
  HTML_ENCODE_MAP,
} from "./constants"

// ─── Zod Schema Validation ──────────────────────────────────────────────────

/**
 * Validates a request body against a Zod schema.
 * Returns a discriminated union with either the parsed data or field-level errors.
 */
export function validateBody<T>(
  body: unknown,
  schema: z.ZodSchema<T>
): ValidationResult<T> {
  const result = schema.safeParse(body)

  if (result.success) {
    return { success: true, data: result.data }
  }

  const errors = result.error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : "body",
    constraint: issue.message,
  }))

  return { success: false, error: errors }
}

// ─── Injection Pattern Detection ────────────────────────────────────────────

/**
 * Checks if a string value contains NoSQL operator patterns.
 * Returns true if an injection pattern is detected (value should be rejected).
 * Does not disclose which specific pattern was matched.
 */
export function rejectInjectionPatterns(value: string): boolean {
  const lowered = value.toLowerCase()
  return NOSQL_OPERATORS.some((op) => lowered.includes(op.toLowerCase()))
}

// ─── Path Traversal Detection ───────────────────────────────────────────────

/**
 * Checks if a path contains directory traversal sequences.
 * Detects: ../, ..\, %2e%2e (all case variants), null bytes,
 * and double-encoded variants (%252e%252e).
 * Returns true if a traversal pattern is detected (path should be rejected).
 */
export function rejectPathTraversal(path: string): boolean {
  // Check for null bytes
  if (path.includes("\0") || path.includes("%00")) {
    return true
  }

  // Check for double-encoded traversal patterns (%252e%252e)
  const doubleEncodedLower = path.toLowerCase()
  if (doubleEncodedLower.includes("%252e%252e")) {
    return true
  }

  // Check standard traversal patterns (case-insensitive for encoded variants)
  const lowerPath = path.toLowerCase()
  return PATH_TRAVERSAL_PATTERNS.some((pattern) =>
    lowerPath.includes(pattern.toLowerCase())
  )
}

// ─── HTML Content Rejection ─────────────────────────────────────────────────

/**
 * Checks if a string contains HTML tags or script elements.
 * Returns true if HTML content is detected (value should be rejected for text-only fields).
 */
export function rejectHTMLContent(value: string, _fieldName: string): boolean {
  // Match any HTML tag (opening, closing, or self-closing)
  const htmlTagPattern = /<\/?[a-z][a-z0-9]*[^>]*\/?>/i
  // Match script elements specifically (even malformed)
  const scriptPattern = /<script[\s>]/i

  return htmlTagPattern.test(value) || scriptPattern.test(value)
}

// ─── Body Size Enforcement ──────────────────────────────────────────────────

/**
 * Checks if the request body exceeds the maximum allowed size.
 * Uses the Content-Length header for enforcement.
 * Returns true if the body size exceeds the limit (request should be rejected).
 */
export function enforceBodySize(request: Request, maxBytes: number): boolean {
  const contentLength = request.headers.get("content-length")

  if (contentLength === null) {
    // No Content-Length header — cannot enforce, allow through
    return false
  }

  const size = parseInt(contentLength, 10)

  if (isNaN(size)) {
    // Invalid Content-Length — reject as potentially malicious
    return true
  }

  return size > maxBytes
}

// ─── HTML Entity Encoding ───────────────────────────────────────────────────

/**
 * Encodes HTML special characters to their entity equivalents.
 * Encodes: & → &amp;, < → &lt;, > → &gt;, " → &quot;, ' → &#x27;
 */
export function encodeHTML(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ENCODE_MAP[char] ?? char)
}

/**
 * Decodes HTML entities back to their original characters.
 * Reverses the encoding performed by encodeHTML.
 */
export function decodeHTML(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
}

// ─── Filename Validation ────────────────────────────────────────────────────

/**
 * Validates a filename against allowed characters and max length.
 * Allowed: alphanumeric, hyphens, underscores, periods, and spaces.
 * Max length: 255 characters.
 * Returns true if the filename is valid, false otherwise.
 */
export function validateFilename(filename: string): boolean {
  if (filename.length === 0 || filename.length > MAX_FILENAME_LENGTH) {
    return false
  }

  return ALLOWED_FILENAME_REGEX.test(filename)
}
