/**
 * Lazy bridge to the Sentry browser SDK.
 *
 * WHY THIS EXISTS
 * ---------------
 * `instrumentation-client.ts` runs *after* the HTML is loaded but *before* React
 * hydration begins (see
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation-client.md,
 * "Execution timing"). A static `import * as Sentry from "@sentry/nextjs"` there
 * therefore puts the entire browser SDK into webpack's root entry — it shows up
 * in `.next/build-manifest.json` under `rootMainFiles`, which is the blocking
 * script set for *every* route. Measured on this app that was a single 473 KB
 * (uncompressed) chunk that had to be downloaded, parsed and executed before a
 * single event handler could be bound. On `/` it was over half of all the JS on
 * the page, and it was the largest single contributor to the poor mobile Real
 * Experience Score.
 *
 * The two `error.tsx` boundaries had the same problem for the same reason:
 * error-boundary components are part of the route's eager client graph, so their
 * imports are not lazy either.
 *
 * WHAT WE DO INSTEAD
 * ------------------
 * 1. Install two native listeners synchronously (`error`, `unhandledrejection`).
 *    They cost effectively nothing and mean an exception thrown *during*
 *    hydration is still recorded.
 * 2. Buffer whatever they catch.
 * 3. Pull the real SDK in as an async chunk once the page has gone idle — or
 *    immediately if something actually threw, since at that point the user's
 *    experience is already degraded and the report matters more than the bytes.
 * 4. Replay the buffer into the SDK and drop our own listeners, so Sentry's
 *    `globalHandlers` integration doesn't double-report.
 *
 * WHAT WE GIVE UP
 * ---------------
 * The `pageload` performance transaction. `browserTracingIntegration` can only
 * time a page load it was present for, and by design we are no longer present
 * for it. Navigation transactions, all error reporting, session replay and
 * breadcrumbs are unaffected. Web Vitals for the initial load still come from
 * Vercel Speed Insights, which is the number this trade was made to improve.
 */

type SentryModule = typeof import("@sentry/nextjs")

/** Config is owned by `instrumentation-client.ts`; this module owns only timing. */
type Initializer = (sentry: SentryModule) => void

/**
 * Cap the pre-init buffer. A page stuck in a render loop can throw thousands of
 * times, and holding references to all of them would leak.
 */
const MAX_BUFFERED_ERRORS = 20

/** How long to wait for a genuinely idle moment before loading anyway. */
const IDLE_TIMEOUT_MS = 5_000

/** Fallback delay for browsers without `requestIdleCallback` (notably Safari). */
const FALLBACK_DELAY_MS = 2_000

let sdk: SentryModule | null = null
let loading: Promise<SentryModule | null> | null = null
let initializer: Initializer | null = null
let bufferedErrors: unknown[] = []
let listenersAttached = false

function onWindowError(event: ErrorEvent): void {
  // `event.error` is absent for cross-origin script errors; fall back to the
  // message so we at least record that something failed.
  captureBeforeInit(event.error ?? event.message)
}

function onUnhandledRejection(event: PromiseRejectionEvent): void {
  captureBeforeInit(event.reason)
}

function detachListeners(): void {
  if (!listenersAttached) return
  listenersAttached = false
  window.removeEventListener("error", onWindowError)
  window.removeEventListener("unhandledrejection", onUnhandledRejection)
}

function captureBeforeInit(error: unknown): void {
  if (bufferedErrors.length < MAX_BUFFERED_ERRORS) bufferedErrors.push(error)
  // Something is already broken for this user — stop waiting for idle.
  void loadSentry()
}

function flushBuffer(sentry: SentryModule): void {
  const pending = bufferedErrors
  bufferedErrors = []
  for (const error of pending) sentry.captureException(error)
}

/**
 * Registers the `Sentry.init` call to run as soon as the SDK lands. Keeping the
 * options in `instrumentation-client.ts` means there is still exactly one
 * `Sentry.init()` in the codebase — a second one crashes the Replay integration
 * and, with it, hydration.
 */
export function registerSentryInit(fn: Initializer): void {
  initializer = fn
}

/** Loads + initialises the SDK. Safe to call repeatedly; resolves to the same module. */
export function loadSentry(): Promise<SentryModule | null> {
  if (sdk) return Promise.resolve(sdk)
  if (loading) return loading

  loading = import("@sentry/nextjs")
    .then((mod) => {
      sdk = mod
      initializer?.(mod)
      // Hand over to Sentry's own global handlers before replaying, so nothing
      // caught in the gap between these two statements is reported twice.
      detachListeners()
      flushBuffer(mod)
      return mod
    })
    .catch(() => {
      // Blocked by an extension, offline, or a bad deploy. Error monitoring is
      // not worth breaking the page over — drop the buffer and move on.
      detachListeners()
      bufferedErrors = []
      return null
    })

  return loading
}

/**
 * Attaches the synchronous pre-init capture listeners. Call this from
 * `instrumentation-client.ts` — it runs before hydration, which is exactly the
 * window we are trying to cover.
 */
export function installPreInitErrorCapture(): void {
  if (listenersAttached || typeof window === "undefined") return
  listenersAttached = true
  window.addEventListener("error", onWindowError)
  window.addEventListener("unhandledrejection", onUnhandledRejection)
}

/** Schedules the SDK load for the first idle moment after `load`. */
export function loadSentryWhenIdle(): void {
  if (typeof window === "undefined") return

  const schedule = () => {
    const idle = (
      window as Window &
        typeof globalThis & {
          requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
        }
    ).requestIdleCallback

    if (typeof idle === "function") idle(() => void loadSentry(), { timeout: IDLE_TIMEOUT_MS })
    else window.setTimeout(() => void loadSentry(), FALLBACK_DELAY_MS)
  }

  if (document.readyState === "complete") schedule()
  else window.addEventListener("load", schedule, { once: true })
}

/**
 * Reports an exception. Use this instead of `Sentry.captureException` in client
 * components — importing the SDK directly from a component that is part of a
 * route's eager graph (an `error.tsx` boundary, say) undoes the whole point of
 * this module.
 */
export function reportError(error: unknown): void {
  if (sdk) {
    sdk.captureException(error)
    return
  }
  captureBeforeInit(error)
}

/**
 * Forwards App Router navigations to Sentry. Pre-init navigations are dropped
 * rather than buffered: a transition span replayed seconds later, detached from
 * the trace it belonged to, is misleading data rather than missing data.
 */
export function reportRouterTransitionStart(
  ...args: Parameters<SentryModule["captureRouterTransitionStart"]>
): void {
  sdk?.captureRouterTransitionStart(...args)
}
