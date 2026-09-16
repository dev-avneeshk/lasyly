/**
 * Signed quiz-attempt tokens.
 *
 * A quiz attempt serves a RANDOM subset of a large pool, so the server must
 * remember exactly which questions it served in order to grade fairly. Rather
 * than persist that per attempt, we hand the client an opaque, HMAC-signed
 * token encoding {quizId, served question ids, expiry}. On submit the client
 * returns the token; we verify the signature and grade exactly those ids.
 *
 * This prevents a client from cherry-picking which questions get graded (e.g.
 * submitting only the ones it answered correctly): the served set is fixed and
 * tamper-evident. The token carries no correct answers.
 *
 * Token shape: `<payload-base64url>.<mac-base64url>` where payload is JSON
 * {"v":1,"q":"<quizId>","ids":[...],"exp":<unix-seconds>} and the MAC is
 * HMAC-SHA256 over the raw payload bytes.
 */

import { createHmac, timingSafeEqual } from "node:crypto"

const TOKEN_VERSION = 1

interface AttemptPayload {
  v: number
  q: string // quizId
  ids: string[] // served question ids, in served order
  exp: number // unix seconds
}

/**
 * HMAC key for attempt tokens. Reuses the service-role key (always present on
 * the server that grades) so no new secret is required. Throws if unset so a
 * misconfigured server fails loudly rather than issuing forgeable tokens.
 */
function getSecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret || secret.length < 16) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to sign quiz attempts.")
  }
  return secret
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64url(str: string): Buffer {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/")
  const padLen = (4 - (padded.length % 4)) % 4
  return Buffer.from(padded + "=".repeat(padLen), "base64")
}

/** Sign a token binding an attempt to its quiz and served question ids. */
export function issueAttemptToken(quizId: string, ids: string[], ttlSeconds = 60 * 60): string {
  const payload: AttemptPayload = {
    v: TOKEN_VERSION,
    q: quizId,
    ids,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  }
  const payloadBuf = Buffer.from(JSON.stringify(payload), "utf8")
  const mac = createHmac("sha256", getSecret()).update(payloadBuf).digest()
  return `${base64url(payloadBuf)}.${base64url(mac)}`
}

/**
 * Verify a token and return {quizId, ids} iff the MAC matches, the version is
 * current, and it has not expired. Returns null otherwise.
 */
export function verifyAttemptToken(
  token: string | undefined | null
): { quizId: string; ids: string[] } | null {
  if (!token || typeof token !== "string") return null
  const dot = token.indexOf(".")
  if (dot < 1) return null

  const payloadPart = token.slice(0, dot)
  const macPart = token.slice(dot + 1)

  let payloadBuf: Buffer
  let providedMac: Buffer
  try {
    payloadBuf = fromBase64url(payloadPart)
    providedMac = fromBase64url(macPart)
  } catch {
    return null
  }

  const expectedMac = createHmac("sha256", getSecret()).update(payloadBuf).digest()
  if (providedMac.length !== expectedMac.length) {
    timingSafeEqual(expectedMac, expectedMac)
    return null
  }
  if (!timingSafeEqual(providedMac, expectedMac)) return null

  let payload: AttemptPayload
  try {
    payload = JSON.parse(payloadBuf.toString("utf8"))
  } catch {
    return null
  }

  if (payload.v !== TOKEN_VERSION) return null
  if (typeof payload.q !== "string" || !Array.isArray(payload.ids)) return null
  if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null

  return { quizId: payload.q, ids: payload.ids }
}
