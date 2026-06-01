import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend } from "k6/metrics";
import { BASE_URL, SHARED_THRESHOLDS } from "./config.js";

/**
 * Soak Test — Extended duration stability
 *
 * Runs moderate load for an extended period to detect:
 * - Memory leaks
 * - Connection pool exhaustion
 * - Cache degradation over time
 * - Gradual performance degradation
 *
 * Run: k6 run load-tests/soak.js
 * (Takes ~15 minutes)
 */

const latencyTrend = new Trend("response_latency_over_time", true);
const errorRate = new Rate("custom_error_rate");

export const options = {
  stages: [
    { duration: "1m", target: 30 }, // Ramp up
    { duration: "12m", target: 30 }, // Sustained load
    { duration: "1m", target: 0 }, // Ramp down
  ],
  thresholds: {
    ...SHARED_THRESHOLDS,
    response_latency_over_time: ["p(95)<3000"],
    custom_error_rate: ["rate<0.03"], // Stricter: <3% over long period
  },
};

const ENDPOINTS = [
  "/api/health",
  "/api/scores",
  "/api/props?sport=NBA&stat=pts&limit=20",
  "/api/props?sport=Tennis&stat=aces&limit=20",
  "/api/props?sport=Soccer&stat=all&limit=20",
  "/api/leaderboard",
  "/api/tipsters",
  "/api/rooms/explore",
  "/api/highlights",
  "/api/injuries",
];

export default function () {
  // Rotate through endpoints to simulate varied traffic
  const endpoint = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];

  group(`Soak: ${endpoint.split("?")[0]}`, () => {
    const res = http.get(`${BASE_URL}${endpoint}`);
    latencyTrend.add(res.timings.duration);

    const passed = check(res, {
      "soak: status 2xx": (r) => r.status >= 200 && r.status < 300,
      "soak: response < 5s": (r) => r.timings.duration < 5000,
    });
    errorRate.add(!passed);
  });

  // Realistic think time between requests
  sleep(2 + Math.random() * 3);
}
