// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a user loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
//
// NOTE: this is the ONE and ONLY client-side Sentry init. Do not add a second
// `Sentry.init()` in a `sentry.client.config.ts` (the older convention) — the
// browser Replay integration throws "Multiple Sentry Session Replay instances
// are not supported" when init runs twice, and that uncaught error crashes
// React hydration, leaving every button's onClick unbound (login/guest appear
// to do nothing). `@sentry/nextjs` loads this file, not sentry.client.config.ts.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only run in production so local dev isn't sending events / loading Replay.
  enabled: process.env.NODE_ENV === "production",

  // Performance monitoring — sample 10% of transactions in production.
  tracesSampleRate: 0.1,

  // Enable logs to be sent to Sentry.
  enableLogs: true,

  // Session replay — 1% of sessions, 100% of sessions where an error occurs.
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration(),
    Sentry.browserTracingIntegration(),
  ],

  // Filter out noisy, non-actionable errors.
  ignoreErrors: [
    "ResizeObserver loop",
    "Non-Error promise rejection",
    "AbortError",
    "Network request failed",
  ],

  // Enable sending user PII (Personally Identifiable Information).
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
