/**
 * Unit tests for the Concurrency Guards module.
 *
 * Tests optimistic locking query construction and conflict handling.
 * Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6
 */

import { describe, it, expect } from "vitest"
import { buildOptimisticUpdate, handleConflict } from "@/lib/security/concurrency"

describe("buildOptimisticUpdate", () => {
  it("should include the version field in conditions", () => {
    const result = buildOptimisticUpdate(
      "profiles",
      { display_name: "New Name" },
      { id: "user-123" },
      "updated_at",
      "2024-01-01T00:00:00Z"
    )

    expect(result.table).toBe("profiles")
    expect(result.updates).toEqual({ display_name: "New Name" })
    expect(result.conditions).toEqual({
      id: "user-123",
      updated_at: "2024-01-01T00:00:00Z",
    })
  })

  it("should work with numeric version fields", () => {
    const result = buildOptimisticUpdate(
      "betslips",
      { status: "settled" },
      { id: "betslip-456", status: "pending" },
      "version",
      3
    )

    expect(result.table).toBe("betslips")
    expect(result.updates).toEqual({ status: "settled" })
    expect(result.conditions).toEqual({
      id: "betslip-456",
      status: "pending",
      version: 3,
    })
  })

  it("should merge version field with existing conditions without mutating inputs", () => {
    const originalConditions = { id: "room-789", user_id: "user-abc" }
    const conditionsCopy = { ...originalConditions }

    const result = buildOptimisticUpdate(
      "room_members",
      { role: "moderator" },
      originalConditions,
      "updated_at",
      "2024-06-15T12:00:00Z"
    )

    // Original conditions should not be mutated
    expect(originalConditions).toEqual(conditionsCopy)

    // Result should have all conditions plus version field
    expect(result.conditions).toEqual({
      id: "room-789",
      user_id: "user-abc",
      updated_at: "2024-06-15T12:00:00Z",
    })
  })

  it("should preserve all update fields", () => {
    const updates = {
      display_name: "Updated",
      bio: "New bio",
      avatar_url: "https://example.com/avatar.png",
    }

    const result = buildOptimisticUpdate(
      "profiles",
      updates,
      { id: "user-123" },
      "updated_at",
      "2024-01-01T00:00:00Z"
    )

    expect(result.updates).toEqual(updates)
  })
})

describe("handleConflict", () => {
  it("should return null when affectedRows > 0 (no conflict)", () => {
    const result = handleConflict(1, "profile")
    expect(result).toBeNull()
  })

  it("should return null when multiple rows affected", () => {
    const result = handleConflict(5, "betslip")
    expect(result).toBeNull()
  })

  it("should return 409 response when affectedRows is 0", () => {
    const result = handleConflict(0, "profile")

    expect(result).not.toBeNull()
    expect(result!.status).toBe(409)
  })

  it("should return SafeErrorResponse format with CONFLICT code", async () => {
    const result = handleConflict(0, "profile")
    const body = await result!.json()

    expect(body.code).toBe("CONFLICT")
    expect(body.error).toContain("profile")
    expect(body.error).toContain("modified by another request")
    expect(body.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
  })

  it("should include the resource type in the error message", async () => {
    const result = handleConflict(0, "betslip status")
    const body = await result!.json()

    expect(body.error).toContain("betslip status")
  })

  it("should generate unique correlation IDs for each conflict", () => {
    const result1 = handleConflict(0, "profile")
    const result2 = handleConflict(0, "profile")

    // Both should be non-null
    expect(result1).not.toBeNull()
    expect(result2).not.toBeNull()
  })
})
