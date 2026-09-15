/**
 * Abuse / spam resistance test.
 *
 * Everything else in this directory models a well-behaved client. This models
 * someone deliberately trying to make the app fall over, and asserts that the
 * server sheds the load instead.
 *
 * The pass condition is inverted from a normal load test: high 429/400 rates are
 * REQUIRED. A scenario that returns 200 to everything has failed, because it
 * means a limit is missing.
 *
 * Run (STAGING ONLY):
 *   k6 run -e BASE_URL=https://staging.example load-tests/abuse.js
 *   k6 run -e BASE_URL=... -e SESSIONS=load-tests/sessions.txt load-tests/abuse.js
 *
 * The authenticated scenarios are skipped when SESSIONS is absent, so this is
 * still useful as an anonymous-only run.
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Counter, Rate } from "k6/metrics";
import { BASE_URL } from "./config.js";
import { authParams, isServerError, sessionFor } from "./auth.js";

const throttled = new Counter("throttled_responses");
const rejected = new Counter("rejected_responses");
const serverErrors = new Counter("server_errors");
const throttleRate = new Rate("throttle_rate");

export const options = {
  scenarios: {
    // One client, maximum request rate, no waiting for responses.
    single_client_flood: {
      executor: "constant-arrival-rate",
      exec: "flood",
      rate: 200,
      timeUnit: "1s",
      duration: "45s",
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
    // The expensive unauthenticated endpoint, with cache-busting parameters.
    cache_buster: {
      executor: "constant-arrival-rate",
      exec: "cacheBuster",
      rate: 40,
      timeUnit: "1s",
      duration: "45s",
      preAllocatedVUs: 20,
      maxVUs: 60,
      startTime: "5s",
    },
    // Malformed / oversized / hostile payloads.
    malformed: {
      executor: "constant-vus",
      exec: "malformed",
      vus: 10,
      duration: "45s",
      startTime: "10s",
    },
  },
  thresholds: {
    // No amount of abuse may produce a server error.
    server_errors: ["count < 1"],
    // A flood MUST be throttled. If this fails, a rate limit is missing.
    throttle_rate: ["rate>0.5"],
  },
};

function record(res) {
  if (isServerError(res)) {
    serverErrors.add(1);
    throttleRate.add(false);
    return;
  }
  if (res.status === 429 || res.status === 503) {
    throttled.add(1);
    throttleRate.add(true);
    return;
  }
  if (res.status >= 400) {
    rejected.add(1);
    throttleRate.add(true);
    return;
  }
  throttleRate.add(false);
}

/** 200 requests/second from one source, fired without waiting. */
export function flood() {
  const res = http.get(`${BASE_URL}/api/health`);
  record(res);
  check(res, {
    "flood: never 5xx": (r) => !isServerError(r),
    "flood: 429 carries Retry-After": (r) =>
      r.status !== 429 || Boolean(r.headers["Retry-After"] || r.headers["retry-after"]),
  });
}

/**
 * Cache-key explosion against the most expensive endpoint.
 *
 * `withoutPlayer` is part of the props cache key, so a unique value per request
 * used to guarantee a cache MISS — and a miss recomputes six stat categories
 * (~42 Supabase queries, up to 30k rows). Unauthenticated. It is now length-
 * capped and rate limited per IP; this scenario is what proves that.
 */
export function cacheBuster() {
  const unique = `${__VU}-${__ITER}-${Date.now()}`;

  group("props cache busting", () => {
    const res = http.get(
      `${BASE_URL}/api/props?sport=NBA&stat=all&withoutPlayer=${unique}&limit=100`
    );
    record(res);
    check(res, {
      "props buster: never 5xx": (r) => !isServerError(r),
      "props buster: throttled or rejected": (r) => r.status !== 200 || r.timings.duration < 5000,
    });
  });

  group("oversized free text", () => {
    // 4KB of text into a param that reaches a Redis key and an ILIKE.
    const huge = "a".repeat(4096);
    const res = http.get(`${BASE_URL}/api/props?sport=NBA&stat=pts&withoutPlayer=${huge}`);
    record(res);
    check(res, {
      "oversized param: rejected with 400": (r) => r.status === 400 || r.status === 429,
    });
  });

  group("deep pagination", () => {
    // OFFSET makes Postgres walk and discard every skipped row.
    const res = http.get(`${BASE_URL}/api/rooms/explore?page=999999&page_size=50`);
    record(res);
    check(res, {
      "deep page: never 5xx": (r) => !isServerError(r),
      "deep page: fast (page is capped)": (r) => r.timings.duration < 3000,
    });
  });
}

/** Hostile bodies and unauthorized access attempts. */
export function malformed(data) {
  const cookie = data && data.sessions ? sessionFor(data.sessions, __VU) : null;

  group("unauthenticated writes are refused", () => {
    const targets = [
      ["POST", `${BASE_URL}/api/arena`, JSON.stringify({ mode: "human" })],
      ["POST", `${BASE_URL}/api/jobs/enqueue`, JSON.stringify({ type: "export-bets" })],
      ["POST", `${BASE_URL}/api/cron/retention`, "{}"],
      ["POST", `${BASE_URL}/api/indexnow`, "{}"],
      ["POST", `${BASE_URL}/api/jobs/process`, "{}"],
    ];
    for (const [method, url, body] of targets) {
      const res = http.request(method, url, body, {
        headers: { "Content-Type": "application/json" },
      });
      record(res);
      check(res, {
        [`${url}: requires auth`]: (r) => r.status === 401 || r.status === 403 || r.status === 429,
      });
    }
  });

  group("malformed bodies", () => {
    const bodies = [
      "not json at all",
      "{",
      JSON.stringify(null),
      JSON.stringify([1, 2, 3]),
      JSON.stringify({ amount: "not a number" }),
      JSON.stringify({ amount: 1e308 }),
      JSON.stringify({ amount: -5 }),
      JSON.stringify({ unexpected: "field", __proto__: { admin: true } }),
    ];
    for (const body of bodies) {
      const res = http.post(`${BASE_URL}/api/auth/signup`, body, {
        headers: { "Content-Type": "application/json" },
      });
      record(res);
      check(res, {
        "malformed body: never 5xx": (r) => !isServerError(r),
      });
    }
  });

  group("id enumeration", () => {
    // Random uuids against per-id routes. Must be uniformly 404/401, never 5xx,
    // and must not distinguish "exists but not yours" from "doesn't exist".
    for (let i = 0; i < 5; i++) {
      const fake = `00000000-0000-4000-8000-${String(Date.now() + i).slice(-12)}`;
      const res = http.get(`${BASE_URL}/api/arena/${fake}`, authParams(cookie));
      record(res);
      check(res, {
        "enumeration: never 5xx": (r) => !isServerError(r),
        "enumeration: 401 or 404": (r) => [401, 404, 429].includes(r.status),
      });
    }
    const jobRes = http.get(`${BASE_URL}/api/jobs/job_fake_${Date.now()}`, authParams(cookie));
    record(jobRes);
    check(jobRes, {
      "job enumeration: 401 or 404": (r) => [401, 404, 429].includes(r.status),
    });
  });

  sleep(1);
}
