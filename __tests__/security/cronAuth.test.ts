/**
 * Regression tests for scheduled-endpoint authorization.
 *
 * These endpoints drop chat history, rewrite the rankings table and drive the
 * job queue, so the guard in front of them matters. Each case below corresponds
 * to a behaviour that was present in at least one of the seven routes that used
 * to implement this check themselves.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { isAuthorizedCron, requireCron } from "@/lib/security/cronAuth"

const ORIGINAL_ENV = { ...process.env }

function req(headers: Record<string, string> = {}, url = "https://example.test/api/cron/thing"): Request {
  return new Request(url, { method: "POST", headers })
}

beforeEach(() => {
  delete process.env.CRON_SECRET
  delete process.env.RANKINGS_JOB_SECRET
  delete process.env.NODE_ENV_OVERRIDE
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe("isAuthorizedCron — the happy path", () => {
  it("accepts the correct bearer token", () => {
    process.env.CRON_SECRET = "s3cret-value"
    expect(isAuthorizedCron(req({ authorization: "Bearer s3cret-value" }))).toBe(true)
  })

  it("accepts an alternate job secret via its own header", () => {
    process.env.RANKINGS_JOB_SECRET = "rankings-key"
    const authorized = isAuthorizedCron(req({ "x-rankings-secret": "rankings-key" }), {
      altSecretEnv: "RANKINGS_JOB_SECRET",
    })
    expect(authorized).toBe(true)
  })

  it("accepts CRON_SECRET on a route that also allows an alternate secret", () => {
    process.env.CRON_SECRET = "shared-cron"
    process.env.RANKINGS_JOB_SECRET = "rankings-key"
    const authorized = isAuthorizedCron(req({ authorization: "Bearer shared-cron" }), {
      altSecretEnv: "RANKINGS_JOB_SECRET",
    })
    expect(authorized).toBe(true)
  })
})

describe("isAuthorizedCron — rejections", () => {
  it("rejects a wrong token", () => {
    process.env.CRON_SECRET = "s3cret-value"
    expect(isAuthorizedCron(req({ authorization: "Bearer wrong" }))).toBe(false)
  })

  it("rejects a token with the right value but no Bearer prefix", () => {
    process.env.CRON_SECRET = "s3cret-value"
    expect(isAuthorizedCron(req({ authorization: "s3cret-value" }))).toBe(false)
  })

  it("rejects a missing header", () => {
    process.env.CRON_SECRET = "s3cret-value"
    expect(isAuthorizedCron(req())).toBe(false)
  })

  it("rejects a token that is a prefix of the real one", () => {
    process.env.CRON_SECRET = "s3cret-value"
    expect(isAuthorizedCron(req({ authorization: "Bearer s3cret" }))).toBe(false)
  })

  it("rejects a token that merely starts with the real one", () => {
    process.env.CRON_SECRET = "s3cret-value"
    expect(isAuthorizedCron(req({ authorization: "Bearer s3cret-value-extra" }))).toBe(false)
  })

  it("does not accept the alternate secret on the default header", () => {
    process.env.RANKINGS_JOB_SECRET = "rankings-key"
    // No altSecretEnv passed → the route doesn't opt into this credential.
    expect(isAuthorizedCron(req({ "x-rankings-secret": "rankings-key" }))).toBe(false)
  })

  it("does not accept CRON_SECRET in the x-rankings-secret header", () => {
    process.env.CRON_SECRET = "shared-cron"
    process.env.RANKINGS_JOB_SECRET = "rankings-key"
    const authorized = isAuthorizedCron(req({ "x-rankings-secret": "shared-cron" }), {
      altSecretEnv: "RANKINGS_JOB_SECRET",
    })
    expect(authorized).toBe(false)
  })
})

describe("isAuthorizedCron — the two bypasses that were removed", () => {
  it("does NOT accept the secret as a query parameter", () => {
    // jobs/generate-rankings and jobs/player-of-week accepted `?secret=…`.
    // Query strings land in access logs, proxy logs, Sentry breadcrumbs and
    // Referer headers, which turned a long-lived shared secret into something
    // routinely written to disk in several systems.
    process.env.RANKINGS_JOB_SECRET = "rankings-key"
    const authorized = isAuthorizedCron(
      req({}, "https://example.test/api/jobs/generate-rankings?secret=rankings-key"),
      { altSecretEnv: "RANKINGS_JOB_SECRET" }
    )
    expect(authorized).toBe(false)
  })

  it("fails CLOSED when no secret is configured", () => {
    // The old helpers returned `process.env.NODE_ENV === "development"` here, so
    // a preview deployment that happened to build with NODE_ENV=development was
    // wide open on endpoints that rewrite tables.
    expect(isAuthorizedCron(req({ authorization: "Bearer anything" }))).toBe(false)
    expect(isAuthorizedCron(req())).toBe(false)
  })

  it("fails closed with no secret even when an alternate env is declared", () => {
    const authorized = isAuthorizedCron(req({ "x-rankings-secret": "anything" }), {
      altSecretEnv: "RANKINGS_JOB_SECRET",
    })
    expect(authorized).toBe(false)
  })
})

describe("requireCron", () => {
  it("returns null when authorized", () => {
    process.env.CRON_SECRET = "s3cret-value"
    expect(requireCron(req({ authorization: "Bearer s3cret-value" }))).toBeNull()
  })

  it("returns a 401 when not authorized", async () => {
    process.env.CRON_SECRET = "s3cret-value"
    const res = requireCron(req({ authorization: "Bearer nope" }))
    expect(res).not.toBeNull()
    expect(res!.status).toBe(401)
  })

  it("returns an identical body for wrong-secret and no-secret-configured", async () => {
    // A distinguishable response would let a caller probe the deployment's
    // configuration.
    process.env.CRON_SECRET = "s3cret-value"
    const wrongSecret = await requireCron(req({ authorization: "Bearer nope" }))!.json()

    delete process.env.CRON_SECRET
    const notConfigured = await requireCron(req({ authorization: "Bearer nope" }))!.json()

    expect(wrongSecret).toEqual(notConfigured)
  })
})
