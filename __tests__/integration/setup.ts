/**
 * Integration test setup and utilities.
 *
 * These tests require a dedicated test Supabase project (NOT production).
 * Set the following environment variables to enable:
 *
 *   TEST_SUPABASE_URL          - Test project URL
 *   TEST_SUPABASE_ANON_KEY     - Test project anon key
 *   TEST_SUPABASE_SERVICE_KEY  - Test project service role key
 *   TEST_UPSTASH_REDIS_URL     - Test Redis instance (optional)
 *   TEST_UPSTASH_REDIS_TOKEN   - Test Redis token (optional)
 *
 * If these are not set, integration tests that require a database
 * connection will be skipped automatically.
 *
 * SETUP INSTRUCTIONS:
 * 1. Create a new Supabase project (free tier is fine)
 * 2. Apply all migrations: run each .sql file from supabase/migrations/
 *    in order via the SQL Editor
 * 3. Copy the project URL and keys to a .env.test file
 * 4. Run: TEST_SUPABASE_URL=... npm run test -- __tests__/integration/
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js"

export const TEST_SUPABASE_URL = process.env.TEST_SUPABASE_URL
export const TEST_SUPABASE_ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY
export const TEST_SUPABASE_SERVICE_KEY = process.env.TEST_SUPABASE_SERVICE_KEY

export const hasTestDB = Boolean(
  TEST_SUPABASE_URL && TEST_SUPABASE_ANON_KEY && TEST_SUPABASE_SERVICE_KEY
)

/**
 * Skip a test if the test database is not configured.
 */
export function skipWithoutTestDB() {
  if (!hasTestDB) {
    return "TEST_SUPABASE_URL not configured — skipping DB integration test"
  }
  return null
}

/**
 * Create a Supabase admin client for the test project.
 * Service role bypasses RLS — use for test setup/teardown.
 */
export function createTestAdminClient(): SupabaseClient {
  if (!hasTestDB) {
    throw new Error("Test Supabase not configured")
  }
  return createClient(TEST_SUPABASE_URL!, TEST_SUPABASE_SERVICE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Create a Supabase anon client for the test project.
 * Simulates unauthenticated PostgREST access.
 */
export function createTestAnonClient(): SupabaseClient {
  if (!hasTestDB) {
    throw new Error("Test Supabase not configured")
  }
  return createClient(TEST_SUPABASE_URL!, TEST_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Create a test user in Supabase Auth and return the session.
 * Cleans up after itself if cleanup() is called.
 */
export async function createTestUser(
  admin: SupabaseClient,
  email?: string,
  password?: string
): Promise<{ userId: string; email: string; password: string; cleanup: () => Promise<void> }> {
  const testEmail = email ?? `test-${Date.now()}-${Math.random().toString(36).slice(2)}@test.lasyly.me`
  const testPassword = password ?? `TestPass!${Date.now()}`

  const { data, error } = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  })

  if (error || !data.user) {
    throw new Error(`Failed to create test user: ${error?.message}`)
  }

  const userId = data.user.id

  // Create profile
  await admin.from("profiles").upsert({
    id: userId,
    username: `testuser_${userId.slice(0, 8)}`,
    display_name: "Test User",
  }, { onConflict: "id" })

  return {
    userId,
    email: testEmail,
    password: testPassword,
    cleanup: async () => {
      await admin.from("profiles").delete().eq("id", userId)
      await admin.auth.admin.deleteUser(userId)
    },
  }
}

/**
 * Sign in as a test user and return an authenticated client.
 */
export async function signInTestUser(
  email: string,
  password: string
): Promise<SupabaseClient> {
  const client = createClient(TEST_SUPABASE_URL!, TEST_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) {
    throw new Error(`Failed to sign in test user: ${error.message}`)
  }

  return client
}

/**
 * Clean up test data from a table by user_id.
 */
export async function cleanupTestData(
  admin: SupabaseClient,
  table: string,
  userId: string
): Promise<void> {
  await admin.from(table).delete().eq("user_id", userId)
}
