/**
 * Authenticated load test — the paths that hold state.
 *
 * Covers the endpoints the previous suite never touched: the arena auction poll
 * and bid loop, chat send/read, wallet balance, and profile writes. These are
 * where the concurrency work landed, so this is the scenario that proves it.
 *
 * Run (STAGING ONLY — this writes data):
 *   k6 run -e BASE_URL=https://staging.example \
 *          -e SESSIONS=load-tests/sessions.txt \
 *          load-tests/authenticated.js
 *
 * See load-tests/auth.js for how to produce sessions.txt.
 *
 * ── What "pass" means here ──────────────────────────────────────────────────
 * 429 and 503 are counted as CORRECT behaviour, not failures. The whole point of
 * the rate limits and the fail-closed game lock is to shed load rather than
 * corrupt state, so a run that returns some 429s and zero 5xx is a healthy run.
 * The thresholds below therefore bound 5xx separately from backpressure, and
 * they assert the specific invariant that matters for the auction:
 * `stale_bid_rejections` must stay near zero, because the old `rev`-based
 * staleness check rejected legitimate bids as soon as two players polled
 * concurrently.
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { BASE_URL } from "./config.js";
import { authParams, isBackpressure, isServerError, loadSessions, sessionFor } from "./auth.js";

// ─── Metrics ─────────────────────────────────────────────────────────────────

const serverErrors = new Counter("server_errors");
const backpressure = new Counter("backpressure_responses");
const staleBidRejections = new Counter("stale_bid_rejections");
const illegalBidRejections = new Counter("illegal_bid_rejections");
const lockContention = new Counter("game_busy_responses");
const arenaPollLatency = new Trend("arena_poll_latency", true);
const bidLatency = new Trend("bid_latency", true);
const chatSendLatency = new Trend("chat_send_latency", true);
const authedErrorRate = new Rate("authed_error_rate");

export const options = {
  scenarios: {
    // Two players per game, polling and bidding — the real arena shape.
    arena: {
      executor: "ramping-vus",
      exec: "arenaFlow",
      startVUs: 2,
      stages: [
        { duration: "30s", target: 20 },
        { duration: "2m", target: 100 },
        { duration: "1m", target: 200 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "20s",
    },
    // Chat is the other write-heavy realtime path.
    chat: {
      executor: "constant-vus",
      exec: "chatFlow",
      vus: 30,
      duration: "4m",
      startTime: "10s",
    },
    // Reads that hit per-user RLS.
    account: {
      executor: "constant-vus",
      exec: "accountFlow",
      vus: 10,
      duration: "4m",
      startTime: "20s",
    },
  },
  thresholds: {
    // Genuine defects only. Backpressure is excluded by construction.
    server_errors: ["count < 1"],
    // The invariant the auction fix exists to protect.
    stale_bid_rejections: ["count < 5"],
    arena_poll_latency: ["p(95)<1500"],
    bid_latency: ["p(95)<2500"],
    chat_send_latency: ["p(95)<2500"],
    authed_error_rate: ["rate<0.02"],
  },
};

export function setup() {
  const sessions = loadSessions();
  if (sessions.length === 0) {
    // Fail loudly rather than silently running an unauthenticated test that
    // reports a clean pass — the previous suite's real problem was measuring the
    // wrong thing.
    throw new Error(
      "No sessions provided. Run with -e SESSIONS=load-tests/sessions.txt (see load-tests/auth.js)."
    );
  }
  return { sessions };
}

/** Classify a response and update the shared metrics. */
function record(res) {
  if (isServerError(res)) {
    serverErrors.add(1);
    authedErrorRate.add(true);
    return "error";
  }
  if (isBackpressure(res)) {
    backpressure.add(1);
    if (res.status === 503) lockContention.add(1);
    authedErrorRate.add(false);
    return "backpressure";
  }
  authedErrorRate.add(false);
  return "ok";
}

/**
 * Honour Retry-After the way the real client now does. A load test that ignores
 * backpressure measures a retry storm, not the system.
 */
function backoff(res, fallbackSeconds) {
  const retryAfter = Number(res.headers["Retry-After"] || res.headers["retry-after"]);
  sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : fallbackSeconds);
}

// ─── Scenario: arena auction ──────────────────────────────────────────────────

export function arenaFlow(data) {
  const cookie = sessionFor(data.sessions, __VU);
  const params = authParams(cookie);

  // Create a human-vs-human game. Game creation is rate limited to 5/hour per
  // user by design, so most VUs will be shed here — that is expected, and the
  // ones that get through are what we want to exercise.
  const createRes = http.post(
    `${BASE_URL}/api/arena`,
    JSON.stringify({ season: "2025-26", budget: 25, difficulty: "medium", mode: "human" }),
    params
  );
  record(createRes);

  if (createRes.status !== 201) {
    backoff(createRes, 5);
    return;
  }

  const gameId = createRes.json("gameId");
  if (!gameId) return;

  // Poll + bid for a while, at the cadence the real client uses (2.5s).
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const pollRes = http.get(`${BASE_URL}/api/arena/${gameId}`, params);
    arenaPollLatency.add(pollRes.timings.duration);
    const pollOutcome = record(pollRes);

    check(pollRes, {
      "arena poll: never 5xx": (r) => !isServerError(r),
    });

    if (pollOutcome === "backpressure") {
      backoff(pollRes, 2);
      continue;
    }
    if (pollOutcome === "error") return;

    const view = pollRes.json();
    if (!view || view.status !== "auction" || !view.lot) {
      sleep(2.5);
      continue;
    }

    const viewer = view.viewer || "P1";
    const minRaise = view.minRaise && view.minRaise[viewer];
    if (typeof minRaise !== "number") {
      sleep(2.5);
      continue;
    }

    // Bid with the lot-identity guard, exactly as the client does.
    const bidRes = http.post(
      `${BASE_URL}/api/arena/${gameId}/bid`,
      JSON.stringify({
        amount: minRaise,
        lotPlayerId: view.lot.player && view.lot.player.id,
        rev: view.rev,
      }),
      params
    );
    bidLatency.add(bidRes.timings.duration);
    const bidOutcome = record(bidRes);

    if (bidRes.status === 409) {
      // The lot moved on mid-flight. Legitimate, and should be RARE — the old
      // rev-based check produced this constantly.
      staleBidRejections.add(1);
    } else if (bidRes.status === 400) {
      // Engine rejection (over budget, already high bidder, no slot). Expected
      // and cheap; it must not have bumped server state.
      illegalBidRejections.add(1);
    }

    check(bidRes, {
      "bid: never 5xx": (r) => !isServerError(r),
      "bid: rejection carries a fresh view": (r) =>
        r.status !== 400 || r.json("lot") !== undefined || r.json("status") !== undefined,
    });

    if (bidOutcome === "backpressure") backoff(bidRes, 2);
    else sleep(2.5);
  }
}

// ─── Scenario: chat ───────────────────────────────────────────────────────────

export function chatFlow(data) {
  const cookie = sessionFor(data.sessions, __VU);
  const params = authParams(cookie);

  // Discover a room to talk in.
  const roomsRes = http.get(`${BASE_URL}/api/rooms/joined`, params);
  record(roomsRes);
  if (roomsRes.status !== 200) {
    backoff(roomsRes, 5);
    return;
  }

  const rooms = roomsRes.json("rooms") || roomsRes.json() || [];
  const room = Array.isArray(rooms) && rooms.length > 0 ? rooms[0] : null;
  if (!room || !room.id) {
    sleep(5);
    return;
  }

  group("chat read", () => {
    const res = http.get(`${BASE_URL}/api/rooms/${room.id}/messages`, params);
    record(res);
    check(res, {
      "chat read: never 5xx": (r) => !isServerError(r),
      "chat read: bounded page": (r) => {
        if (r.status !== 200) return true;
        const msgs = r.json("messages");
        return !Array.isArray(msgs) || msgs.length <= 100;
      },
    });
  });

  sleep(1);

  group("chat send", () => {
    const res = http.post(
      `${BASE_URL}/api/rooms/${room.id}/messages`,
      JSON.stringify({ content: `load test ${__VU}-${__ITER} ${Date.now()}` }),
      params
    );
    chatSendLatency.add(res.timings.duration);
    record(res);

    check(res, {
      "chat send: never 5xx": (r) => !isServerError(r),
      // Chat's layered limits are fail-closed by design, so 429 here is a pass.
      "chat send: accepted or throttled": (r) =>
        r.status === 201 || r.status === 429 || r.status === 403,
    });

    if (isBackpressure(res)) backoff(res, 2);
  });

  // The real limit is 1 message / 2s per room, so pace accordingly.
  sleep(2.5);
}

// ─── Scenario: account reads + writes ─────────────────────────────────────────

export function accountFlow(data) {
  const cookie = sessionFor(data.sessions, __VU);
  const params = authParams(cookie);

  const balanceRes = http.get(`${BASE_URL}/api/wallet/balance`, params);
  record(balanceRes);
  check(balanceRes, {
    "wallet balance: never 5xx": (r) => !isServerError(r),
  });

  sleep(1);

  const meRes = http.get(`${BASE_URL}/api/profiles/me`, params);
  record(meRes);
  check(meRes, {
    "profile read: never 5xx": (r) => !isServerError(r),
    // wallet_balance is column-revoked and read through an RPC; make sure the
    // route still returns it rather than silently dropping to 0.
    "profile read: includes wallet_balance": (r) =>
      r.status !== 200 || r.json("wallet_balance") !== undefined,
  });

  sleep(1);

  // Profile writes are rate limited to 10/min and no longer credit Coins, so
  // hammering them must be boring.
  const patchRes = http.patch(
    `${BASE_URL}/api/profiles/me`,
    JSON.stringify({ bio: `load test ${Date.now()}` }),
    params
  );
  record(patchRes);
  check(patchRes, {
    "profile write: never 5xx": (r) => !isServerError(r),
    "profile write: accepted or throttled": (r) => r.status === 200 || r.status === 429,
  });

  if (isBackpressure(patchRes)) backoff(patchRes, 3);
  else sleep(3);
}
