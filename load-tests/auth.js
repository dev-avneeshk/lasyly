/**
 * Authenticated session helper for k6.
 *
 * The existing load tests only exercised anonymous public reads, which meant
 * every endpoint that actually holds state — the auction, chat, the wallet,
 * profile writes — was untested under load. Those are also the endpoints where
 * the interesting failures live: per-game locks, per-user rate limits, and the
 * per-session rate-limit bucket in proxy.ts.
 *
 * ── Getting sessions ────────────────────────────────────────────────────────
 * Signup is Google OAuth only, so k6 cannot log in programmatically. Supply real
 * session cookies instead, one per virtual user, captured from a browser against
 * a STAGING project:
 *
 *   1. Sign in to staging in a normal browser.
 *   2. DevTools → Application → Cookies → copy every `sb-*-auth-token*` cookie.
 *   3. Write them as one `name=value; name=value` string per line:
 *
 *        load-tests/sessions.txt
 *        sb-abc-auth-token.0=eyJ...; sb-abc-auth-token.1=xyz...
 *        sb-abc-auth-token.0=eyJ...; sb-abc-auth-token.1=def...
 *
 *   4. k6 run -e SESSIONS=load-tests/sessions.txt load-tests/authenticated.js
 *
 * sessions.txt is gitignored — these are live credentials. Never point an
 * authenticated run at production: these scenarios place bids, send chat
 * messages and write profiles.
 *
 * With fewer session lines than VUs, sessions are reused round-robin. That is
 * realistic for the arena (several tabs per account) but note it also means VUs
 * sharing a session share a per-session rate-limit bucket — which is exactly the
 * behaviour worth testing.
 */

import { fail } from "k6";

/**
 * Load session cookie strings. Called from `setup()` so the file is read once
 * per test run rather than once per VU iteration.
 */
export function loadSessions() {
  const path = __ENV.SESSIONS;
  if (!path) {
    return [];
  }

  let raw;
  try {
    raw = open(path);
  } catch (err) {
    fail(`SESSIONS file not readable: ${path} (${err})`);
  }

  const sessions = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  if (sessions.length === 0) {
    fail(`SESSIONS file ${path} contained no cookie lines`);
  }

  return sessions;
}

/** Pick this VU's session deterministically so a VU keeps one identity. */
export function sessionFor(sessions, vuId) {
  if (!sessions || sessions.length === 0) return null;
  return sessions[(vuId - 1) % sessions.length];
}

/** Request params carrying the session cookie. */
export function authParams(cookie, extra = {}) {
  const headers = { "Content-Type": "application/json", ...(extra.headers || {}) };
  if (cookie) headers["Cookie"] = cookie;
  return { ...extra, headers };
}

/**
 * True when a response means "the server is applying backpressure correctly".
 *
 * These are SUCCESSES for a load test: a 429 with Retry-After, or a 503 from the
 * game store's fail-closed lock, is the system protecting itself. Counting them
 * as errors would make correct behaviour look like failure — and, worse, would
 * hide the case we actually care about, which is a 500 or a lost update.
 */
export function isBackpressure(res) {
  return res.status === 429 || res.status === 503;
}

/** True when the response indicates a genuine defect. */
export function isServerError(res) {
  return res.status >= 500 && res.status !== 503;
}
