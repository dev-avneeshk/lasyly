/**
 * Centralized error handler with sanitized responses, correlation IDs,
 * structured logging, and security event logging.
 *
 * All errors flow through `handleError` which:
 * 1. Generates a correlation ID (UUID v4) for tracing
 * 2. Classifies the error into a safe category
 * 3. Logs full details server-side in structured JSON format
 * 4. Returns a sanitized response with only `error`, `code`, and `correlationId`
 *
 * No stack traces, file paths, database errors, or environment variable names
 * are ever exposed to the client.
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7
 */

import * as crypto from "crypto"
import { NextResponse } from "next/server"
import type { SafeErrorResponse, SecurityEvent, LogEntry } from "./types"
import {
  ERROR_CODES,
  MAX_ERROR_MESSAGE_LENGTH,
  MAX_ERROR_CODE_LENGTH,
} from "./constants"
import type { ErrorCode } from "./constants"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RequestContext {
  method: string
  path: string
  userId?: string
  sourceIp?: string
}

/**
 * Custom error class that carries a known error code and HTTP status.
 * Throw this from route handlers to produce a specific client-facing error.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly statusCode: number
  ) {
    super(message)
    this.name = "AppError"
  }
}

// ─── Error Classification ────────────────────────────────────────────────────

interface ErrorClassification {
  code: ErrorCode
  statusCode: number
  clientMessage: string
}

/** Patterns that indicate sensitive information that must never leak to clients */
const SENSITIVE_PATTERNS = [
  /at\s+\S+\s+\(/i, // stack trace lines
  /\/[a-zA-Z][\w/\\.-]+\.\w+/i, // file paths (Unix/Windows)
  /[A-Z_]{2,}=\S+/i, // environment variable assignments
  /(?:password|secret|token|key|credential|connection_string)\s*[:=]/i, // secret references
  /(?:ECONNREFUSED|ETIMEDOUT|ENOTFOUND)/i, // network errors
  /(?:relation|column|table|constraint|duplicate key|violates)/i, // DB errors
  /(?:supabase|postgres|pg_|sqlite)/i, // DB identifiers
]

/**
 * Maps known error types/messages to safe client-facing classifications.
 */
function classifyError(error: unknown): ErrorClassification {
  // Handle AppError (intentionally thrown with known code)
  if (error instanceof AppError) {
    return {
      code: error.code,
      statusCode: error.statusCode,
      clientMessage: sanitizeMessage(error.message),
    }
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase()

    // Validation errors
    if (msg.includes("validation") || msg.includes("invalid input") || msg.includes("zod")) {
      return {
        code: ERROR_CODES.VALIDATION_ERROR,
        statusCode: 400,
        clientMessage: "The request contains invalid data.",
      }
    }

    // Injection detection
    if (msg.includes("injection") || msg.includes("disallowed") || msg.includes("nosql operator")) {
      return {
        code: ERROR_CODES.INJECTION_DETECTED,
        statusCode: 400,
        clientMessage: "The request was rejected due to invalid content.",
      }
    }

    // Authentication errors
    if (msg.includes("unauthorized") || msg.includes("unauthenticated") || msg.includes("not authenticated")) {
      return {
        code: ERROR_CODES.UNAUTHORIZED,
        statusCode: 401,
        clientMessage: "Authentication is required to access this resource.",
      }
    }

    // Permission errors
    if (msg.includes("forbidden") || msg.includes("permission denied") || msg.includes("not allowed")) {
      return {
        code: ERROR_CODES.FORBIDDEN,
        statusCode: 403,
        clientMessage: "You do not have permission to perform this action.",
      }
    }

    // Not found
    if (msg.includes("not found") || msg.includes("does not exist")) {
      return {
        code: ERROR_CODES.NOT_FOUND,
        statusCode: 404,
        clientMessage: "The requested resource was not found.",
      }
    }

    // Conflict (concurrent modification, duplicate)
    if (msg.includes("conflict") || msg.includes("duplicate") || msg.includes("already exists")) {
      return {
        code: ERROR_CODES.CONFLICT,
        statusCode: 409,
        clientMessage: "The request conflicts with the current state of the resource.",
      }
    }

    // Payload too large
    if (msg.includes("too large") || msg.includes("payload") || msg.includes("body size")) {
      return {
        code: ERROR_CODES.PAYLOAD_TOO_LARGE,
        statusCode: 413,
        clientMessage: "The request payload exceeds the maximum allowed size.",
      }
    }

    // Rate limited
    if (msg.includes("rate limit") || msg.includes("too many requests")) {
      return {
        code: ERROR_CODES.RATE_LIMITED,
        statusCode: 429,
        clientMessage: "Too many requests. Please try again later.",
      }
    }
  }

  // Default: internal error (catch-all for unknown errors)
  return {
    code: ERROR_CODES.INTERNAL_ERROR,
    statusCode: 500,
    clientMessage: "An unexpected error occurred. Please try again later.",
  }
}

// ─── Sanitization ────────────────────────────────────────────────────────────

/**
 * Sanitizes a message to ensure no sensitive information leaks.
 * If the message contains sensitive patterns, replaces it with a generic message.
 * Truncates to MAX_ERROR_MESSAGE_LENGTH.
 */
function sanitizeMessage(message: string): string {
  // Check for sensitive patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(message)) {
      return "An error occurred while processing your request."
    }
  }

  // Truncate to max length
  if (message.length > MAX_ERROR_MESSAGE_LENGTH) {
    return message.slice(0, MAX_ERROR_MESSAGE_LENGTH - 3) + "..."
  }

  return message
}

/**
 * Validates that an error code is UPPER_SNAKE_CASE and within length limits.
 */
function sanitizeCode(code: string): string {
  // Ensure UPPER_SNAKE_CASE format
  const sanitized = code.replace(/[^A-Z0-9_]/g, "")
  if (sanitized.length === 0) {
    return ERROR_CODES.INTERNAL_ERROR
  }
  if (sanitized.length > MAX_ERROR_CODE_LENGTH) {
    return sanitized.slice(0, MAX_ERROR_CODE_LENGTH)
  }
  return sanitized
}

// ─── Correlation ID ──────────────────────────────────────────────────────────

/**
 * Generates a correlation ID using crypto.randomUUID() (UUID v4).
 * Used to link client error responses with server-side log entries.
 *
 * Validates: Requirement 11.3
 */
export function generateCorrelationId(): string {
  return crypto.randomUUID()
}

// ─── Structured Logging ──────────────────────────────────────────────────────

/**
 * Writes a structured log entry to stdout in JSON format.
 * Handles logging failures gracefully — never throws.
 *
 * Validates: Requirement 11.2, 11.7
 */
function writeLog(entry: LogEntry): void {
  if (process.env.NODE_ENV === 'development') return
  try {
    const output = JSON.stringify(entry)
    console.error(output)
  } catch {
    // Requirement 11.7: If logging fails, we still return the response to the client.
    // Swallow the error silently — do not expose logging failures.
  }
}

// ─── Security Event Logging ──────────────────────────────────────────────────

/**
 * Logs a security-relevant event in structured JSON format with severity "security".
 *
 * Security events include: failed login, rate limit exceeded, invalid token,
 * permission denied, injection attempts, etc.
 *
 * Validates: Requirement 11.4
 *
 * @param event - The security event to log
 */
export function logSecurityEvent(event: SecurityEvent): void {
  const logEntry: LogEntry = {
    timestamp: event.timestamp,
    level: "security",
    correlationId: event.correlationId,
    method: "", // Security events may not have a method context
    path: "", // Security events may not have a path context
    userId: event.userId,
    sourceIp: event.sourceIp,
    eventType: event.eventType,
    metadata: {
      severity: event.severity,
    },
  }

  writeLog(logEntry)
}

// ─── Error Handler ───────────────────────────────────────────────────────────

/**
 * Central error handler that classifies errors, logs full details server-side,
 * and returns a sanitized response to the client.
 *
 * The client response contains ONLY:
 * - `error`: Human-readable message (≤200 chars, no internal details)
 * - `code`: UPPER_SNAKE_CASE error type (≤50 chars)
 * - `correlationId`: UUID v4 for tracing
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.5, 11.6, 11.7
 *
 * @param error - The caught error (can be any type)
 * @param context - Request context for logging
 * @returns NextResponse with sanitized error body
 */
export function handleError(
  error: unknown,
  context: RequestContext
): NextResponse<SafeErrorResponse> {
  const correlationId = generateCorrelationId()
  const classification = classifyError(error)

  // ─── Server-side structured logging (full details) ───────────────────────
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: "error",
    correlationId,
    method: context.method,
    path: context.path,
    userId: context.userId,
    sourceIp: context.sourceIp,
    error: {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? (error.stack ?? "") : "",
      name: error instanceof Error ? error.name : "UnknownError",
    },
    metadata: {
      classifiedCode: classification.code,
      statusCode: classification.statusCode,
    },
  }

  // Write log — failures are handled gracefully inside writeLog
  writeLog(logEntry)

  // ─── Sanitized client response ───────────────────────────────────────────
  const safeResponse: SafeErrorResponse = {
    error: classification.clientMessage,
    code: sanitizeCode(classification.code),
    correlationId,
  }

  return NextResponse.json(safeResponse, {
    status: classification.statusCode,
  })
}
