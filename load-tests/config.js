/**
 * Load test configuration
 *
 * Set BASE_URL via environment variable:
 *   k6 run -e BASE_URL=https://your-app.vercel.app load-tests/smoke.js
 *
 * Defaults to localhost:3000 for local testing.
 */

export const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

// Thresholds shared across all test scenarios
export const SHARED_THRESHOLDS = {
  http_req_duration: ["p(95)<2000", "p(99)<5000"], // 95th < 2s, 99th < 5s
  http_req_failed: ["rate<0.05"], // <5% error rate
};

// Stricter thresholds for critical paths
export const CRITICAL_THRESHOLDS = {
  http_req_duration: ["p(95)<1000", "p(99)<3000"],
  http_req_failed: ["rate<0.01"], // <1% error rate
};
