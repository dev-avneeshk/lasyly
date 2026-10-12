import { describe, it, expect, vi, beforeEach } from "vitest"

// POST /api/careers/applications after the CV upload was replaced with a
// portfolio link + "why are you a fit" answer: the new fields are validated
// server-side and persisted, and nothing is written to the legacy CV column.

const inserted: Record<string, unknown>[] = []

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1", is_anonymous: false } } }) },
  }),
}))
vi.mock("@/lib/rateLimit", async (orig) => ({
  ...(await orig<typeof import("@/lib/rateLimit")>()),
  checkRateLimit: async () => ({ allowed: true, retryAfterMs: 0 }),
}))
vi.mock("@/lib/careers/server", () => ({
  getActiveJobById: async () => null,
}))
// Mutable per-test lookup results, keyed by the first filtered column so the
// submission_key idempotency lookup (select().eq("submission_key").maybeSingle())
// and the already-applied scope lookup (select().eq("user_id")...maybeSingle())
// can be controlled independently.
let keyLookup: { data: Record<string, unknown> | null; error: unknown } = { data: null, error: null }
let userLookup: { data: Record<string, unknown> | null; error: unknown } = { data: null, error: null }
let insertError: { code: string; message: string } | null = null

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      // Chainable select builder: records the first .eq() column, allows any
      // further .eq()/.is() links, then .maybeSingle() resolves based on it.
      select: () => {
        let firstColumn: string | null = null
        const chain: Record<string, unknown> = {}
        chain.eq = (col: string) => {
          if (firstColumn === null) firstColumn = col
          return chain
        }
        chain.is = () => chain
        chain.maybeSingle = async () =>
          firstColumn === "user_id" ? userLookup : keyLookup
        return chain
      },
      insert: (row: Record<string, unknown>) => {
        inserted.push(row)
        return {
          select: () => ({
            single: async () =>
              insertError
                ? { data: null, error: insertError }
                : { data: { reference: "ABCD1234" }, error: null },
          }),
        }
      },
    }),
  }),
}))

import { POST } from "@/app/api/careers/applications/route"

const FIT = "I have shipped two realtime sports dashboards and enjoy owning features end to end."

const fields = {
  fullName: "Test Applicant",
  email: "applicant@example.com",
  phone: "+91 98765 43210",
  location: "Bengaluru, India",
  currentJobTitle: "",
  currentCompany: "",
  experience: "2-4",
  linkedin: "",
  portfolioUrl: "https://github.com/test-applicant",
  fitAnswer: FIT,
  referralSource: "",
  referralOther: "",
  consent: true,
}

const req = (overrides: Record<string, unknown> = {}) =>
  new Request("http://localhost/api/careers/applications", {
    method: "POST",
    headers: { origin: "http://localhost:3000", "content-type": "application/json" },
    body: JSON.stringify({
      fields: { ...fields, ...overrides },
      jobId: null,
      submissionKey: crypto.randomUUID(),
      website: "",
      startedAt: Date.now() - 60_000,
    }),
  })

beforeEach(() => {
  inserted.length = 0
  keyLookup = { data: null, error: null }
  userLookup = { data: null, error: null }
  insertError = null
})

describe("POST /api/careers/applications", () => {
  it("stores the portfolio link and fit answer, and no CV link", async () => {
    const res = await POST(req({ cvFileUrl: "https://example.com/cv.pdf" }))
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ reference: "ABCD1234" })
    expect(inserted).toHaveLength(1)
    expect(inserted[0]).toMatchObject({
      application_type: "general",
      portfolio_url: "https://github.com/test-applicant",
      fit_answer: FIT,
      user_id: "u1",
    })
    expect(inserted[0]).not.toHaveProperty("cv_file_url")
  })

  it("records the signed-in user_id on a first application", async () => {
    const res = await POST(req())
    expect(res.status).toBe(201)
    expect(inserted).toHaveLength(1)
    expect(inserted[0].user_id).toBe("u1")
  })

  it("returns 409 ALREADY_APPLIED and does not insert when this account already applied", async () => {
    userLookup = { data: { reference: "PRIOR999" }, error: null }
    const res = await POST(req())
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe("ALREADY_APPLIED")
    expect(body.reference).toBe("PRIOR999")
    expect(inserted).toHaveLength(0)
  })

  it("rejects a javascript: portfolio link with a field error", async () => {
    const res = await POST(req({ portfolioUrl: "javascript:alert(1)" }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.fields.portfolioUrl).toMatch(/valid http\(s\) link/)
    expect(inserted).toHaveLength(0)
  })

  it("rejects a too-short fit answer with a field error", async () => {
    const res = await POST(req({ fitAnswer: "I am great." }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.fields.fitAnswer).toMatch(/at least 50 characters/)
    expect(inserted).toHaveLength(0)
  })
})
