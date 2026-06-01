import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend } from "k6/metrics";
import { BASE_URL, SHARED_THRESHOLDS } from "./config.js";

/**
 * Load Test — Sustained traffic simulation
 *
 * Simulates realistic user traffic patterns with ramp-up/ramp-down.
 * Tests the app under expected peak load (50 concurrent users).
 *
 * Run: k6 run load-tests/load.js
 * Run against prod: k6 run -e BASE_URL=https://your-app.vercel.app load-tests/load.js
 */

// Custom metrics
const propsLatency = new Trend("props_latency", true);
const scoresLatency = new Trend("scores_latency", true);
const errorRate = new Rate("custom_error_rate");

export const options = {
  stages: [
    { duration: "30s", target: 10 }, // Ramp up to 10 users
    { duration: "1m", target: 25 }, // Ramp up to 25 users
    { duration: "2m", target: 50 }, // Hold at 50 users (peak)
    { duration: "1m", target: 25 }, // Ramp down
    { duration: "30s", target: 0 }, // Cool down
  ],
  thresholds: {
    ...SHARED_THRESHOLDS,
    props_latency: ["p(95)<3000"],
    scores_latency: ["p(95)<2000"],
    custom_error_rate: ["rate<0.05"],
  },
};

const SPORTS = ["NBA", "Tennis", "Soccer", "NFL", "NHL"];
const NBA_STATS = ["pts", "reb", "ast", "3pm", "stl", "blk"];
const TENNIS_STATS = ["aces", "double_faults", "win_pct"];

export default function () {
  // Simulate a user browsing the app

  group("Browse Props", () => {
    const sport = SPORTS[Math.floor(Math.random() * SPORTS.length)];
    let stat = "pts";
    if (sport === "Tennis") {
      stat = TENNIS_STATS[Math.floor(Math.random() * TENNIS_STATS.length)];
    } else if (sport === "NBA") {
      stat = NBA_STATS[Math.floor(Math.random() * NBA_STATS.length)];
    }

    const res = http.get(
      `${BASE_URL}/api/props?sport=${sport}&stat=${stat}&limit=25`
    );
    propsLatency.add(res.timings.duration);
    const passed = check(res, {
      "props: status 200": (r) => r.status === 200,
      "props: valid response": (r) => {
        const body = r.json();
        return body && Array.isArray(body.props);
      },
    });
    errorRate.add(!passed);
    sleep(1 + Math.random() * 2); // Think time: 1-3s
  });

  group("Check Scores", () => {
    const res = http.get(`${BASE_URL}/api/scores`);
    scoresLatency.add(res.timings.duration);
    const passed = check(res, {
      "scores: status 200": (r) => r.status === 200,
      "scores: success": (r) => {
        const body = r.json();
        return body && body.success === true;
      },
    });
    errorRate.add(!passed);
    sleep(0.5 + Math.random());
  });

  group("View Leaderboard", () => {
    const res = http.get(`${BASE_URL}/api/leaderboard`);
    check(res, {
      "leaderboard: status 2xx": (r) => r.status >= 200 && r.status < 300,
    });
    sleep(0.5 + Math.random());
  });

  group("Browse News", () => {
    const res = http.get(`${BASE_URL}/api/news/rss`);
    check(res, {
      "news: status 2xx": (r) => r.status >= 200 && r.status < 300,
    });
    sleep(1 + Math.random() * 2);
  });

  group("Explore Rooms", () => {
    const res = http.get(`${BASE_URL}/api/rooms/explore`);
    check(res, {
      "rooms: status 2xx": (r) => r.status >= 200 && r.status < 300,
    });
    sleep(1 + Math.random());
  });

  group("Tipsters Marketplace", () => {
    const res = http.get(`${BASE_URL}/api/tipsters`);
    check(res, {
      "tipsters: status 2xx": (r) => r.status >= 200 && r.status < 300,
    });
    sleep(1 + Math.random());
  });
}
