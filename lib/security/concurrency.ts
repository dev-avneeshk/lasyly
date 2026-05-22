/**
 * Concurrency Guards Module.
 *
 * Provides optimistic locking utilities for Supabase queries and
 * conflict response handling to protect against race conditions.
 *
 * - buildOptimisticUpdate: Constructs query parameters for Supabase .update()
 *   with version/timestamp conditions to detect concurrent modifications.
 * - handleConflict: Returns a 409 response when zero rows are affected,
 *   indicating a concurrent modification conflict.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.5, 3.6
 */

import { NextResponse } from "next/server"
import * as crypto from "crypto"
import type { SafeErrorResponse } from "./types"
import { ERROR_CODES } from "./constants"

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Describes the parameters for an optimistic update query.
 * Use these with the Supabase client:
 *   supabase.from(result.table).update(result.updates).match(result.conditions)
 */
export interface OptimisticUpdateQuery {
  /** The table to update */
  table: string
  /** The fields to update */
  updates: Record<string, unknown>
  /** All conditions including the version/timestamp check */
  conditions: Record<string, unknown>
}

// ─── Optimistic Locking Query Builder ────────────────────────────────────────

/**
 * Constructs an optimistic update query descriptor for use with Supabase.
 *
 * Merges the provided conditions with a version/timestamp field check
 * so that the update only succeeds if the row hasn't been modified since
 * the client last read it. If another request modified the row, the
 * version/timestamp won't match and zero rows will be affected.
 *
 * Usage with Supabase:
 * ```ts
 * const query = buildOptimisticUpdate("profiles", { display_name: "New" }, { id: userId }, "updated_at", lastReadTimestamp)
 * const { data, count } = await supabase
 *   .from(query.table)
 *   .update(query.updates)
 *   .match(query.conditions)
 *   .select()
 * ```
 *
 * @param table - The database table name
 * @param updates - The fields and values to update
 * @param conditions - Base conditions to identify the row (e.g., { id: "..." })
 * @param versionField - The field used for optimistic locking (e.g., "updated_at" or "version")
 * @param currentVersion - The current value of the version field as last read by the client
 * @returns An OptimisticUpdateQuery object describing the query parameters
 *
 * Validates: Requirements 3.2, 3.3
 */
export function buildOptimisticUpdate(
  table: string,
  updates: Record<string, unknown>,
  conditions: Record<string, unknown>,
  versionField: string,
  currentVersion: string | number
): OptimisticUpdateQuery {
  // Merge the version field condition with the existing conditions
  // This ensures the update only affects rows where the version matches
  const allConditions: Record<string, unknown> = {
    ...conditions,
    [versionField]: currentVersion,
  }

  return {
    table,
    updates,
    conditions: allConditions,
  }
}

// ─── Conflict Handler ────────────────────────────────────────────────────────

/**
 * Checks whether an update affected zero rows (indicating a concurrent modification)
 * and returns a 409 Conflict response if so.
 *
 * When affectedRows is 0, it means the version/timestamp condition didn't match,
 * which indicates another request modified the resource between the client's read
 * and write. The response includes the resource type in the error message so the
 * client knows what was conflicted.
 *
 * Returns null if affectedRows > 0 (no conflict).
 *
 * @param affectedRows - The number of rows affected by the update query
 * @param resourceType - A human-readable description of the resource (e.g., "profile", "betslip", "room membership")
 * @returns A NextResponse with 409 status if conflict detected, or null if no conflict
 *
 * Validates: Requirements 3.2, 3.3, 3.5, 3.6
 */
export function handleConflict(
  affectedRows: number,
  resourceType: string
): NextResponse<SafeErrorResponse> | null {
  if (affectedRows > 0) {
    return null
  }

  const correlationId = crypto.randomUUID()

  const body: SafeErrorResponse = {
    error: `The ${resourceType} was modified by another request. Please refresh and try again.`,
    code: ERROR_CODES.CONFLICT,
    correlationId,
  }

  return NextResponse.json(body, { status: 409 })
}
