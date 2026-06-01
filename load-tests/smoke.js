import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, CRITICAL_THRESHOLDS } from "./config.js";

/**
 * Smoke Test — Quick sanity check
 *
 * Verifies the app is alive and key endpoints respond correctly
 * under minimal load (1-2 VUs for 30 seconds).
 *
 * Run: k6 run load-tests/smoke.js
 * Run against prod: k6 run -e BASE_URL=https://your-app.vercel.app load-tests/smoke.js
 */

export const options = {
  vus: 2,
  duration: "30s",
  thresholds: CRITICAL_THRESHOLDS,
};

export default function () {
  // Health check
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    "health: status 200": (r) => r.status === 200,
    "health: status ok": (r) => {
      const body = r.json();
      return body && body.status === "ok";
    },
    "health: response < 500ms": (r) => r.timings.duration < 500,
  });

  sleep(0.5);

  // Scores endpoint (public, cached)
  const scoresRes = http.get(`${BASE_URL}/api/scores`);
  check(scoresRes, {
    "scores: status 200": (r) => r.status === 200,
    "scores: has data": (r) => {
      const body = r.json();
      return body && body.success === true;
    },
  });

  sleep(0.5);

  // Props endpoint (public, cached)
  const propsRes = http.get(`${BASE_URL}/api/props?sport=NBA&stat=pts&limit=10`);
  check(propsRes, {
    "props: status 200": (r) => r.status === 200,
    "props: has props array": (r) => {
      const body = r.json();
      return body && Array.isArray(body.props);
    },
  });

  sleep(0.5);

  // Leaderboard (public)
  const leaderboardRes = http.get(`${BASE_URL}/api/leaderboard`);
  check(leaderboardRes, {
    "leaderboard: status 2xx": (r) => r.status >= 200 && r.status < 300,
  });

  sleep(1);
}
