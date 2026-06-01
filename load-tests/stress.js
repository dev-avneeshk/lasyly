import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";
import { BASE_URL, SHARED_THRESHOLDS } from "./config.js";

/**
 * Stress Test — Find breaking points
 *
 * Pushes the system beyond normal load to identify:
 * - At what point the system starts degrading
 * - What the maximum capacity is before errors spike
 * - How the system recovers after load drops
 *
 * Run: k6 run load-tests/stress.js
 */

const degradedResponses = new Counter("degraded_responses");
const errorRate = new Rate("custom_error_rate");
const propsP95 = new Trend("props_p95", true);

export const options = {
  stages: [
    { duration: "30s", target: 20 }, // Warm up
    { duration: "1m", target: 50 }, // Normal load
    { duration: "1m", target: 100 }, // Above normal
    { duration: "2m", target: 200 }, // Stress zone
    { duration: "1m", target: 300 }, // Breaking point?
    { duration: "2m", target: 100 }, // Recovery phase
    { duration: "30s", target: 0 }, // Cool down
  ],
  thresholds: {
    http_req_duration: ["p(95)<5000", "p(99)<10000"], // Relaxed for stress
    http_req_failed: ["rate<0.15"], // Allow up to 15% errors under extreme load
    custom_error_rate: ["rate<0.20"],
  },
};

const NBA_MATCHUPS = ["LAL-GSW", "BOS-MIA", "DEN-PHX", "NYK-PHI", "MIL-CLE"];

export default function () {
  // Heavy endpoint: Props with various params
  group("Props - Heavy Queries", () => {
    const matchup = NBA_MATCHUPS[Math.floor(Math.random() * NBA_MATCHUPS.length)];
    const stats = ["pts", "reb", "ast", "3pm", "stl", "blk", "all"];
    const stat = stats[Math.floor(Math.random() * stats.length)];
    const directions = ["over", "under", "all"];
    const direction = directions[Math.floor(Math.random() * directions.length)];

    const url = `${BASE_URL}/api/props?sport=NBA&stat=${stat}&matchup=${matchup}&direction=${direction}&limit=50`;
    const res = http.get(url);
    propsP95.add(res.timings.duration);

    if (res.timings.duration > 3000) {
      degradedResponses.add(1);
    }

    const passed = check(res, {
      "props stress: not 5xx": (r) => r.status < 500,
      "props stress: responds": (r) => r.timings.duration < 10000,
    });
    errorRate.add(!passed);
    sleep(0.2 + Math.random() * 0.5);
  });

  // Scores with date params
  group("Scores - Various Dates", () => {
    const today = new Date();
    const offset = Math.floor(Math.random() * 7);
    const date = new Date(today.getTime() - offset * 86400000);
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");

    const sports = ["Football", "Basketball", "Baseball", "Hockey", "Soccer"];
    const sport = sports[Math.floor(Math.random() * sports.length)];

    const res = http.get(`${BASE_URL}/api/scores?date=${dateStr}&sport=${sport}`);
    const passed = check(res, {
      "scores stress: not 5xx": (r) => r.status < 500,
    });
    errorRate.add(!passed);
    sleep(0.1 + Math.random() * 0.3);
  });

  // Concurrent reads on multiple endpoints
  group("Parallel Reads", () => {
    const responses = http.batch([
      ["GET", `${BASE_URL}/api/health`],
      ["GET", `${BASE_URL}/api/leaderboard`],
      ["GET", `${BASE_URL}/api/scores`],
      ["GET", `${BASE_URL}/api/tipsters`],
    ]);

    for (const res of responses) {
      const passed = check(res, {
        "batch: not 5xx": (r) => r.status < 500,
      });
      errorRate.add(!passed);
    }
    sleep(0.5 + Math.random());
  });
}
