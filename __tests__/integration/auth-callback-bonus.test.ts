/**
 * The OAuth callback grants starter Coins on every sign-in.
 *
 * It used to grant them only when the callback itself created the profile. On
 * the live database that never took effect: all 23 accounts had 0 Coins and
 * there were no SIGNUP_BONUS rows. Every arena game costs Coins, so no one
 * could play. grant_signup_bonus is idempotent (advisory lock + one-row-per-user
 * unique index), so calling it on each sign-in is safe.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const h = vi.hoisted(() => ({
  exchangeError: null as null | { message: string },
  user: { id: "user-1", email: "a@example.com", user_metadata: {} } as null | Record<string, unknown>,
  profile: null as null | { username: string },
  rpc: vi.fn(),
  upsert: vi.fn(async () => ({ error: null })),
}))

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      exchangeCodeForSession: async () => ({ error: h.exchangeError }),
      getUser: async () => ({ data: { user: h.user } }),
    },
  }),
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: h.profile }) }) }),
      upsert: h.upsert,
    }),
    rpc: h.rpc,
  }),
}))

import { GET } from "@/app/auth/callback/route"

const callback = (next?: string) =>
  GET(new NextRequest(`http://localhost/auth/callback?code=abc${next ? `&next=${next}` : ""}`))

beforeEach(() => {
  h.exchangeError = null
  h.user = { id: "user-1", email: "a@example.com", user_metadata: {} }
  h.profile = null
  h.rpc.mockReset()
  h.rpc.mockResolvedValue({ data: "completed", error: null })
  h.upsert.mockClear()
})

describe("auth callback starter Coins", () => {
  it("grants them when the profile ALREADY exists (the case that was broken)", async () => {
    h.profile = { username: "real_name" }

    const res = await callback()

    expect(h.rpc).toHaveBeenCalledWith("grant_signup_bonus", { p_user_id: "user-1" })
    expect(h.upsert).not.toHaveBeenCalled()
    expect(res.headers.get("location")).toBe("http://localhost/explore")
  })

  it("grants them when the callback creates the profile", async () => {
    const res = await callback()

    expect(h.upsert).toHaveBeenCalledTimes(1)
    expect(h.rpc).toHaveBeenCalledWith("grant_signup_bonus", { p_user_id: "user-1" })
    expect(res.headers.get("location")).toBe("http://localhost/onboarding")
  })

  it("still signs the user in when the grant fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    h.profile = { username: "real_name" }
    h.rpc.mockResolvedValue({ data: null, error: { message: "db down" } })

    const res = await callback()

    expect(res.headers.get("location")).toBe("http://localhost/explore")
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })

  it("logs an unexpected result instead of treating it as success", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    h.profile = { username: "real_name" }
    h.rpc.mockResolvedValue({ data: "no_profile", error: null })

    await callback()

    expect(log).toHaveBeenCalledWith("Signup bonus grant error:", "no_profile")
    log.mockRestore()
  })

  it("grants nothing when the code exchange fails", async () => {
    h.exchangeError = { message: "bad code" }

    const res = await callback()

    expect(h.rpc).not.toHaveBeenCalled()
    expect(res.headers.get("location")).toBe("http://localhost/login")
  })
})
