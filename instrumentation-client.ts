// This file configures the initialization of Sentry on the client.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
//
// NOTE: the `Sentry.init` below is the ONE and ONLY client-side init. Do not add
// a second one (e.g. in the older `sentry.client.config.ts` convention) — the
// browser Replay integration throws "Multiple Sentry Session Replay instances
// are not supported" when init runs twice, and that uncaught error crashes React
// hydration, leaving every button's onClick unbound (login/guest appear to do
// nothing). `@sentry/nextjs` loads this file, not sentry.client.config.ts.
//
// PERFORMANCE NOTE: this module deliberately does NOT `import * as Sentry from
// "@sentry/nextjs"` at the top level. Next.js runs instrumentation-client before
// React hydration, so a static import lands the whole ~473 KB browser SDK in the
// blocking script set of every route. See lib/observability/sentry-lazy.ts for
// the full reasoning and the trade-off. The options object below is unchanged;
// only *when* it is applied has moved.

import {
  installPreInitErrorCapture,
  loadSentryWhenIdle,
  registerSentryInit,
  reportRouterTransitionStart,
} from "@/lib/observability/sentry-lazy";

// Previously expressed as `enabled: process.env.NODE_ENV === "production"` inside
// the init options. Hoisting it means dev doesn't even fetch the SDK chunk.
const SENTRY_ENABLED =
  process.env.NODE_ENV === "production" && !!process.env.NEXT_PUBLIC_SENTRY_DSN;

registerSentryInit((Sentry) => {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Performance monitoring — sample 10% of transactions in production.
    tracesSampleRate: 0.1,

    // Enable logs to be sent to Sentry.
    enableLogs: true,

    // Session replay — 1% of sessions, 100% of sessions where an error occurs.
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      Sentry.replayIntegration(),
      // Still worth keeping: this instruments client-side *navigations* and
      // fetch/XHR spans, which all happen well after this module has loaded. The
      // one thing it can no longer time is the initial page load.
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
});

if (SENTRY_ENABLED) {
  // Synchronous and effectively free: covers the window between now and the SDK
  // arriving, which includes hydration itself.
  installPreInitErrorCapture();
  loadSentryWhenIdle();
}

export const onRouterTransitionStart = reportRouterTransitionStart;
