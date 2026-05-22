/**
 * Signed guest-session cookie.
 *
 * Replaces the previous unsigned `lasyly_guest=true` cookie with an
 * HMAC-SHA256 token so a forged Cookie header can no longer bypass the
 * proxy auth gate.
 *
 * Token shape: `<payload-base64url>.<mac-base64url>` where the payload is
 * the JSON {"v":1,"exp":<unix-seconds>} and the MAC is HMAC-SHA256 over the
 * raw payload bytes using GUEST_TOKEN_SECRET.
 *
 * Verification:
 *   1. Constant-time compare the MAC.
 *   2. Reject if version != 1 or exp <= now.
 *
 * The token contains no user-identifying data and grants nothing beyond the
 * "is a guest" bit. It is intentionally not a JWT — we don't need claims, we
 * need a tamper-evident yes/no.
 */

import { createHmac, timingSafeEqual } from "node:crypto"

export const GUEST_COOKIE_NAME = "lasyly_guest"

const TOKEN_VERSION = 1

interface GuestPayload {
  v: number
  exp: number // unix seconds
}

/**
 * Look up the guest-token secret. Throws if missing — callers should treat
 * the absence as "no guests allowed" rather than silently degrading to an
 * unsigned cookie.
 */
function getSecret(): string {
  const secret = process.env.GUEST_TOKEN_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      "GUEST_TOKEN_SECRET is missing or shorter than 32 characters."
    )
  }
  return secret
}

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

function fromBase64url(str: string): Buffer {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/")
  const padLen = (4 - (padded.length % 4)) % 4
  return Buffer.from(padded + "=".repeat(padLen), "base64")
}

/**
 * Sign and encode a guest token that expires `ttlSeconds` from now.
 */
export function issueGuestToken(ttlSeconds: number): string {
  const payload: GuestPayload = {
    v: TOKEN_VERSION,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  }

  const payloadBuf = Buffer.from(JSON.stringify(payload), "utf8")
  const mac = createHmac("sha256", getSecret()).update(payloadBuf).digest()

  return `${base64url(payloadBuf)}.${base64url(mac)}`
}

/**
 * Verify a guest token. Returns true iff the MAC matches and the token has
 * not expired.
 */
export function verifyGuestToken(token: string | undefined | null): boolean {
  if (!token) return false

  const dot = token.indexOf(".")
  if (dot === -1) return false

  const payloadPart = token.slice(0, dot)
  const macPart = token.slice(dot + 1)

  let payloadBuf: Buffer
  let providedMac: Buffer
  try {
    payloadBuf = fromBase64url(payloadPart)
    providedMac = fromBase64url(macPart)
  } catch {
    return false
  }

  let secret: string
  try {
    secret = getSecret()
  } catch {
    // Configured to deny guests when the secret is missing.
    return false
  }

  const expectedMac = createHmac("sha256", secret).update(payloadBuf).digest()

  // Constant-time compare; reject mismatched lengths without leaking timing.
  if (providedMac.length !== expectedMac.length) {
    timingSafeEqual(expectedMac, expectedMac)
    return false
  }
  if (!timingSafeEqual(providedMac, expectedMac)) {
    return false
  }

  // MAC verified — payload is trustworthy. Check version and expiry.
  let parsed: unknown
  try {
    parsed = JSON.parse(payloadBuf.toString("utf8"))
  } catch {
    return false
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as GuestPayload).v !== TOKEN_VERSION ||
    typeof (parsed as GuestPayload).exp !== "number"
  ) {
    return false
  }

  const now = Math.floor(Date.now() / 1000)
  return (parsed as GuestPayload).exp > now
}
