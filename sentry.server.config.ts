// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://866d266038fcdf9fdd4e48fa809dd3dd@o4511434088710144.ingest.de.sentry.io/4511434113155152",

  // 100% tracing ran span capture + serialization + flush on every function
  // and proxy invocation, which is billed Fluid Active CPU. 5% is plenty for
  // performance trends; errors are still captured at 100% regardless.
  tracesSampleRate: 0.05,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
});
