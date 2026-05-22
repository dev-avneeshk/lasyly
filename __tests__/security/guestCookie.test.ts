import { afterEach, beforeEach, describe, expect, it } from "vitest"
import * as fc from "fast-check"

import {
  GUEST_COOKIE_NAME,
  issueGuestToken,
  verifyGuestToken,
} from "@/lib/security/guestCookie"

const TEST_SECRET = "0123456789abcdef0123456789abcdef-test-secret"

describe("guestCookie", () => {
  let originalSecret: string | undefined

  beforeEach(() => {
    originalSecret = process.env.GUEST_TOKEN_SECRET
    process.env.GUEST_TOKEN_SECRET = TEST_SECRET
  })

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.GUEST_TOKEN_SECRET
    } else {
      process.env.GUEST_TOKEN_SECRET = originalSecret
    }
  })

  it("exposes the canonical cookie name", () => {
    expect(GUEST_COOKIE_NAME).toBe("lasyly_guest")
  })

  it("issues a token that round-trips through verify", () => {
    const token = issueGuestToken(60)
    expect(verifyGuestToken(token)).toBe(true)
  })

  it("rejects undefined and empty input without throwing", () => {
    expect(verifyGuestToken(undefined)).toBe(false)
    expect(verifyGuestToken(null)).toBe(false)
    expect(verifyGuestToken("")).toBe(false)
  })

  it("rejects malformed tokens (no dot separator)", () => {
    expect(verifyGuestToken("not-a-token")).toBe(false)
  })

  it("rejects tokens with the wrong MAC", () => {
    const token = issueGuestToken(60)
    const [payload, mac] = token.split(".")
    // Flip a byte in the MAC.
    const tampered =
      payload + "." + (mac.charAt(0) === "A" ? "B" : "A") + mac.slice(1)
    expect(verifyGuestToken(tampered)).toBe(false)
  })

  it("rejects tokens whose payload was tampered with", () => {
    const token = issueGuestToken(60)
    const [, mac] = token.split(".")
    // Replace the payload with a forged "expires in 1 year" claim. The MAC
    // was computed over the original payload so it cannot match the forgery.
    const forgedPayload = Buffer.from(
      JSON.stringify({ v: 1, exp: Math.floor(Date.now() / 1000) + 31_536_000 }),
      "utf8"
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")
    expect(verifyGuestToken(`${forgedPayload}.${mac}`)).toBe(false)
  })

  it("rejects expired tokens", () => {
    // Issue a token that expires immediately.
    const token = issueGuestToken(-1)
    expect(verifyGuestToken(token)).toBe(false)
  })

  it("rejects when the server secret is not configured", () => {
    delete process.env.GUEST_TOKEN_SECRET
    // verifyGuestToken should never throw — it must deny.
    expect(verifyGuestToken("anything.atall")).toBe(false)
  })

  it("issuance throws when the server secret is too short", () => {
    process.env.GUEST_TOKEN_SECRET = "short"
    expect(() => issueGuestToken(60)).toThrow(/GUEST_TOKEN_SECRET/)
  })

  it("rejects tokens issued under a different secret", () => {
    const tokenA = issueGuestToken(60)
    process.env.GUEST_TOKEN_SECRET = TEST_SECRET + "-rotated"
    expect(verifyGuestToken(tokenA)).toBe(false)
  })

  it("property: arbitrary strings never verify as valid tokens", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 200 }), (input) => {
        // The legitimate-token grammar is base64url.base64url, and even then
        // the MAC must check out. fast-check picking a real one by chance is
        // negligible (256-bit MAC).
        return verifyGuestToken(input) === false
      }),
      { numRuns: 200 }
    )
  })
})
