/**
 * Authentication & Authorization integration tests.
 *
 * Requires a test Supabase project. Skipped if TEST_SUPABASE_URL is not set.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import {
  hasTestDB,
  skipWithoutTestDB,
  createTestAdminClient,
  createTestAnonClient,
  createTestUser,
  signInTestUser,
  cleanupTestData,
} from "./setup"
import type { SupabaseClient } from "@supabase/supabase-js"

describe.skipIf(!hasTestDB)("Integration: Authentication", () => {
  let admin: SupabaseClient
  let testUserA: Awaited<ReturnType<typeof createTestUser>>
  let testUserB: Awaited<ReturnType<typeof createTestUser>>

  beforeAll(async () => {
    admin = createTestAdminClient()
    testUserA = await createTestUser(admin)
    testUserB = await createTestUser(admin)
  })

  afterAll(async () => {
    await testUserA?.cleanup()
    await testUserB?.cleanup()
  })

  it("test user can sign in and get session", async () => {
    const client = await signInTestUser(testUserA.email, testUserA.password)
    const { data: { user } } = await client.auth.getUser()
    expect(user).not.toBeNull()
    expect(user!.id).toBe(testUserA.userId)
    expect(user!.email).toBe(testUserA.email)
  })

  it("incorrect password fails sign-in", async () => {
    const { createClient } = await import("@supabase/supabase-js")
    const client = createClient(
      process.env.TEST_SUPABASE_URL!,
      process.env.TEST_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { error } = await client.auth.signInWithPassword({
      email: testUserA.email,
      password: "WrongPassword123!",
    })
    expect(error).not.toBeNull()
    expect(error!.message).toContain("Invalid login credentials")
  })

  it("profile exists after user creation", async () => {
    const { data } = await admin
      .from("profiles")
      .select("id, username, display_name")
      .eq("id", testUserA.userId)
      .single()
    expect(data).not.toBeNull()
    expect(data!.username).toContain("testuser_")
    expect(data!.display_name).toBe("Test User")
  })
})

describe.skipIf(!hasTestDB)("Integration: Authorization (RLS)", () => {
  let admin: SupabaseClient
  let userA: Awaited<ReturnType<typeof createTestUser>>
  let userB: Awaited<ReturnType<typeof createTestUser>>
  let clientA: SupabaseClient
  let clientB: SupabaseClient

  beforeAll(async () => {
    admin = createTestAdminClient()
    userA = await createTestUser(admin)
    userB = await createTestUser(admin)
    clientA = await signInTestUser(userA.email, userA.password)
    clientB = await signInTestUser(userB.email, userB.password)

    // Create a bet for user A
    await admin.from("bet_tracker").insert({
      user_id: userA.userId,
      player_name: "Test Player",
      sport: "NBA",
      stat_category: "pts",
      prop_line: 25.5,
      direction: "over",
      confidence_score: 4,
      odds: -110,
      stake: 10,
    })
  })

  afterAll(async () => {
    await cleanupTestData(admin, "bet_tracker", userA.userId)
    await cleanupTestData(admin, "bet_tracker", userB.userId)
    await userA?.cleanup()
    await userB?.cleanup()
  })

  it("user A can read own bets", async () => {
    const { data, error } = await clientA
      .from("bet_tracker")
      .select("*")
      .eq("user_id", userA.userId)
    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThan(0)
    expect(data![0].player_name).toBe("Test Player")
  })

  it("user B cannot read user A's bets", async () => {
    const { data } = await clientB
      .from("bet_tracker")
      .select("*")
      .eq("user_id", userA.userId)
    // RLS should filter — returns empty, not error
    expect(data).toEqual([])
  })

  it("anon cannot read any bets", async () => {
    const anon = createTestAnonClient()
    const { data } = await anon
      .from("bet_tracker")
      .select("*")
      .limit(10)
    expect(data).toEqual([])
  })

  it("user cannot insert bet for another user", async () => {
    const { error } = await clientB.from("bet_tracker").insert({
      user_id: userA.userId, // trying to impersonate user A
      player_name: "Injected",
      sport: "NBA",
      stat_category: "pts",
      prop_line: 20,
      direction: "over",
      confidence_score: 3,
      odds: -110,
      stake: 5,
    })
    // RLS should reject — auth.uid() != user_id
    expect(error).not.toBeNull()
    expect(error!.code).toBe("42501")
  })

  it("anon cannot insert into transactions", async () => {
    const anon = createTestAnonClient()
    const { error } = await anon.from("transactions").insert({
      user_id: userA.userId,
      amount: 1000,
      type: "TOP_UP",
      status: "COMPLETED",
    })
    // Should be denied (table-level REVOKE or RLS)
    expect(error).not.toBeNull()
  })

  it("authenticated user cannot directly update wallet_balance", async () => {
    const { error } = await clientA
      .from("profiles")
      .update({ wallet_balance: 99999 })
      .eq("id", userA.userId)
    // Should be denied by column-level privilege or RLS policy
    // (if 20260522 migration is applied: column REVOKE; otherwise: may succeed but should be tested)
    // This test documents the expected behavior after RLS baseline is applied
    if (error) {
      expect(error.code).toMatch(/42501|42703/)
    }
    // If no error, verify the balance wasn't actually changed
    const { data } = await admin
      .from("profiles")
      .select("wallet_balance")
      .eq("id", userA.userId)
      .single()
    // After the RLS baseline migration, this should be 0 regardless
    expect(data!.wallet_balance).toBe(0)
  })
})

describe.skipIf(!hasTestDB)("Integration: Parlay Creation & RLS", () => {
  let admin: SupabaseClient
  let user: Awaited<ReturnType<typeof createTestUser>>
  let client: SupabaseClient

  beforeAll(async () => {
    admin = createTestAdminClient()
    user = await createTestUser(admin)
    client = await signInTestUser(user.email, user.password)
  })

  afterAll(async () => {
    await cleanupTestData(admin, "parlay_legs", user.userId)
    await admin.from("parlays").delete().eq("user_id", user.userId)
    await user?.cleanup()
  })

  it("authenticated user can create a parlay", async () => {
    const { data, error } = await client.from("parlays").insert({
      user_id: user.userId,
      status: "pending",
      odds: 3.5,
      visibility: "public",
    }).select().single()

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.user_id).toBe(user.userId)
    expect(data!.status).toBe("pending")
  })

  it("user can read own parlays", async () => {
    const { data } = await client
      .from("parlays")
      .select("*")
      .eq("user_id", user.userId)
    expect(data!.length).toBeGreaterThan(0)
  })

  it("anon cannot read user's parlays", async () => {
    const anon = createTestAnonClient()
    const { data } = await anon
      .from("parlays")
      .select("*")
      .eq("user_id", user.userId)
    expect(data).toEqual([])
  })
})
