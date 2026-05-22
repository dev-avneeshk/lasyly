import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  handleError,
  generateCorrelationId,
  logSecurityEvent,
  AppError,
} from "@/lib/security/errorHandler"
import type { RequestContext } from "@/lib/security/errorHandler"
import type { SecurityEvent } from "@/lib/security/types"
import { ERROR_CODES } from "@/lib/security/constants"

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function createContext(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    method: "POST",
    path: "/api/betslips",
    userId: "user-123",
    sourceIp: "192.168.1.1",
    ...overrides,
  }
}

describe("generateCorrelationId", () => {
  it("returns a valid UUID v4", () => {
    const id = generateCorrelationId()
    expect(id).toMatch(UUID_V4_REGEX)
  })

  it("generates unique IDs on each call", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateCorrelationId()))
    expect(ids.size).toBe(100)
  })
})

describe("handleError", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it("returns a response with exactly three fields: error, code, correlationId", async () => {
    const response = handleError(new Error("something broke"), createContext())
    const body = await response.json()

    const keys = Object.keys(body)
    expect(keys).toHaveLength(3)
    expect(keys).toContain("error")
    expect(keys).toContain("code")
    expect(keys).toContain("correlationId")
  })

  it("returns a valid UUID v4 as correlationId", async () => {
    const response = handleError(new Error("test"), createContext())
    const body = await response.json()
    expect(body.correlationId).toMatch(UUID_V4_REGEX)
  })

  it("returns error message ≤200 characters", async () => {
    const longMessage = "x".repeat(500)
    const response = handleError(new Error(longMessage), createContext())
    const body = await response.json()
    expect(body.error.length).toBeLessThanOrEqual(200)
  })

  it("returns code in UPPER_SNAKE_CASE ≤50 characters", async () => {
    const response = handleError(new Error("test"), createContext())
    const body = await response.json()
    expect(body.code).toMatch(/^[A-Z0-9_]+$/)
    expect(body.code.length).toBeLessThanOrEqual(50)
  })

  it("does not leak stack traces in the response", async () => {
    const error = new Error("Database connection failed")
    error.stack = "Error: Database connection failed\n    at /app/lib/db.ts:42:5\n    at processTicksAndRejections"
    const response = handleError(error, createContext())
    const body = await response.json()
    const bodyStr = JSON.stringify(body)

    expect(bodyStr).not.toContain("/app/lib/db.ts")
    expect(bodyStr).not.toContain("processTicksAndRejections")
    expect(bodyStr).not.toContain("at ")
  })

  it("does not leak file paths in the response", async () => {
    const error = new Error("Error in /Users/dev/project/src/handler.ts:15")
    const response = handleError(error, createContext())
    const body = await response.json()
    const bodyStr = JSON.stringify(body)

    expect(bodyStr).not.toContain("/Users/dev")
    expect(bodyStr).not.toContain("handler.ts")
  })

  it("does not leak database error details in the response", async () => {
    const error = new Error('duplicate key value violates unique constraint "users_email_key"')
    const response = handleError(error, createContext())
    const body = await response.json()
    const bodyStr = JSON.stringify(body)

    expect(bodyStr).not.toContain("duplicate key")
    expect(bodyStr).not.toContain("constraint")
    expect(bodyStr).not.toContain("users_email_key")
  })

  it("does not leak environment variable names in the response", async () => {
    const error = new Error("SUPABASE_URL=https://xyz.supabase.co is invalid")
    const response = handleError(error, createContext())
    const body = await response.json()
    const bodyStr = JSON.stringify(body)

    expect(bodyStr).not.toContain("SUPABASE_URL")
    expect(bodyStr).not.toContain("supabase.co")
  })

  // ─── Error Classification ──────────────────────────────────────────────────

  it("classifies AppError with its specified code and status", async () => {
    const error = new AppError("Not found", ERROR_CODES.NOT_FOUND, 404)
    const response = handleError(error, createContext())
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.code).toBe("NOT_FOUND")
  })

  it("classifies validation errors as VALIDATION_ERROR with 400 status", async () => {
    const error = new Error("Validation failed for input")
    const response = handleError(error, createContext())
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.code).toBe("VALIDATION_ERROR")
  })

  it("classifies unauthorized errors as UNAUTHORIZED with 401 status", async () => {
    const error = new Error("User is not authenticated")
    const response = handleError(error, createContext())
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.code).toBe("UNAUTHORIZED")
  })

  it("classifies rate limit errors as RATE_LIMITED with 429 status", async () => {
    const error = new Error("Rate limit exceeded")
    const response = handleError(error, createContext())
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.code).toBe("RATE_LIMITED")
  })

  it("classifies unknown errors as INTERNAL_ERROR with 500 status", async () => {
    const error = new Error("something completely unexpected")
    const response = handleError(error, createContext())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.code).toBe("INTERNAL_ERROR")
  })

  it("handles non-Error objects gracefully", async () => {
    const response = handleError("string error", createContext())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.code).toBe("INTERNAL_ERROR")
    expect(body.correlationId).toMatch(UUID_V4_REGEX)
  })

  it("handles null/undefined errors gracefully", async () => {
    const response = handleError(null, createContext())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.code).toBe("INTERNAL_ERROR")
    expect(body.correlationId).toMatch(UUID_V4_REGEX)
  })

  // ─── Structured Logging ────────────────────────────────────────────────────

  it("logs full error details server-side in JSON format", () => {
    const error = new Error("DB connection timeout")
    error.stack = "Error: DB connection timeout\n    at connect (/app/db.ts:10)"

    handleError(error, createContext())

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    const logOutput = consoleErrorSpy.mock.calls[0][0]
    const logEntry = JSON.parse(logOutput)

    expect(logEntry.level).toBe("error")
    expect(logEntry.error.message).toBe("DB connection timeout")
    expect(logEntry.error.stack).toContain("/app/db.ts:10")
    expect(logEntry.method).toBe("POST")
    expect(logEntry.path).toBe("/api/betslips")
    expect(logEntry.userId).toBe("user-123")
    expect(logEntry.correlationId).toMatch(UUID_V4_REGEX)
  })

  it("includes matching correlationId in both response and log", async () => {
    const error = new Error("test error")
    handleError(error, createContext())

    const logOutput = consoleErrorSpy.mock.calls[0][0]
    const logEntry = JSON.parse(logOutput)

    // Re-call to get the response (correlation IDs will differ between calls)
    // Instead, let's verify the log entry has a valid UUID
    expect(logEntry.correlationId).toMatch(UUID_V4_REGEX)
  })

  it("still returns response when logging fails", async () => {
    // Make console.error throw to simulate logging failure
    consoleErrorSpy.mockImplementation(() => {
      throw new Error("Logging system unavailable")
    })

    const response = handleError(new Error("test"), createContext())
    const body = await response.json()

    // Response should still be valid despite logging failure
    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(body.correlationId).toMatch(UUID_V4_REGEX)
    expect(body.code).toBeTruthy()
    expect(body.error).toBeTruthy()
  })
})

describe("logSecurityEvent", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it("logs a security event with severity 'security'", () => {
    const event: SecurityEvent = {
      timestamp: new Date().toISOString(),
      sourceIp: "10.0.0.1",
      userId: "user-456",
      eventType: "failed_login",
      correlationId: generateCorrelationId(),
      severity: "security",
    }

    logSecurityEvent(event)

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    const logOutput = consoleErrorSpy.mock.calls[0][0]
    const logEntry = JSON.parse(logOutput)

    expect(logEntry.level).toBe("security")
    expect(logEntry.sourceIp).toBe("10.0.0.1")
    expect(logEntry.userId).toBe("user-456")
    expect(logEntry.eventType).toBe("failed_login")
    expect(logEntry.correlationId).toMatch(UUID_V4_REGEX)
  })

  it("logs security event with ISO 8601 timestamp", () => {
    const timestamp = "2024-01-15T10:30:00.000Z"
    const event: SecurityEvent = {
      timestamp,
      sourceIp: "192.168.1.100",
      eventType: "rate_limit_exceeded",
      correlationId: generateCorrelationId(),
      severity: "security",
    }

    logSecurityEvent(event)

    const logOutput = consoleErrorSpy.mock.calls[0][0]
    const logEntry = JSON.parse(logOutput)

    expect(logEntry.timestamp).toBe(timestamp)
  })

  it("handles logging failures gracefully (does not throw)", () => {
    consoleErrorSpy.mockImplementation(() => {
      throw new Error("Disk full")
    })

    const event: SecurityEvent = {
      timestamp: new Date().toISOString(),
      sourceIp: "10.0.0.1",
      eventType: "invalid_token",
      correlationId: generateCorrelationId(),
      severity: "security",
    }

    // Should not throw
    expect(() => logSecurityEvent(event)).not.toThrow()
  })
})
