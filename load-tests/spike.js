import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate } from "k6/metrics";
import { BASE_URL } from "./config.js";

/**
 * Spike Test — Sudden traffic bursts
 *
 * Simulates scenarios like:
 * - A popular bet going viral on social media
 * - Game day traffic spike when NBA/NFL games start
 * - Marketing campaign driving sudden traffic
 *
 * Tests how the system handles sudden load spikes and recovers.
 *
 * Run: k6 run load-tests/spike.js
 */

const errorRate = new Rate("custom_error_rate");

export const options = {
  stages: [
    { duration: "10s", target: 5 }, // Baseline
    { duration: "5s", target: 200 }, // SPIKE! Instant jump
    { duration: "30s", target: 200 }, // Hold spike
    { duration: "5s", target: 5 }, // Drop back
    { duration: "30s", target: 5 }, // Recovery observation
    { duration: "5s", target: 300 }, // Second spike (bigger)
    { duration: "30s", target: 300 }, // Hold
    { duration: "10s", target: 0 }, // Cool down
  ],
  thresholds: {
    http_req_duration: ["p(95)<8000"], // Generous during spikes
    http_req_failed: ["rate<0.20"], // Allow some failures during spike
    custom_error_rate: ["rate<0.25"],
  },
};

export default function () {
  // Simulate game-day traffic: everyone checking scores + props
  group("Game Day Burst", () => {
    const res = http.get(`${BASE_URL}/api/scores`);
    const passed = check(res, {
      "spike scores: responds": (r) => r.status > 0,
      "spike scores: not 5xx": (r) => r.status < 500,
    });
    errorRate.add(!passed);
  });

  sleep(0.1);

  group("Props Burst", () => {
    const res = http.get(`${BASE_URL}/api/props?sport=NBA&stat=pts&limit=25`);
    const passed = check(res, {
      "spike props: responds": (r) => r.status > 0,
      "spike props: not 5xx": (r) => r.status < 500,
    });
    errorRate.add(!passed);
  });

  sleep(0.1 + Math.random() * 0.3);
}
