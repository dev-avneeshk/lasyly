/**
 * A `fetch` wrapper that retries only on transient network failures.
 *
 * Supabase (and the underlying Node fetch) throws `TypeError: fetch failed`
 * with a low-level cause such as `ENOTFOUND` when DNS resolution briefly
 * fails — e.g. a Wi-Fi/VPN blip, a resolver hiccup, or a process starting
 * before the network is ready. These are almost always recoverable within a
 * few hundred milliseconds, so we retry with exponential backoff instead of
 * surfacing the error to the caller.
 *
 * We deliberately do NOT retry on HTTP-level errors (4xx/5xx). Those are real
 * responses from Supabase and retrying them blindly could duplicate writes or
 * mask genuine bugs. Only thrown network errors are retried.
 */

// Low-level error codes that indicate a transient connectivity problem.
const RETRYABLE_CODES = new Set([
  "ENOTFOUND", // DNS lookup returned nothing
  "EAI_AGAIN", // temporary DNS resolution failure
  "ECONNRESET", // connection dropped
  "ECONNREFUSED", // nothing listening (yet) — often a startup race
  "ETIMEDOUT", // connection timed out
  "EPIPE", // broken pipe
])

interface RetryOptions {
  /** Maximum number of attempts, including the first. Defaults to 3. */
  maxAttempts?: number
  /** Base delay in ms for exponential backoff. Defaults to 200. */
  baseDelayMs?: number
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  // Node wraps the real error in `cause` (e.g. TypeError: fetch failed).
  const cause = (error as { cause?: unknown }).cause
  const code =
    (cause as { code?: string } | undefined)?.code ??
    (error as { code?: string }).code

  if (code && RETRYABLE_CODES.has(code)) return true

  // Fallback: match the generic message Node uses when the cause is stripped.
  const message = `${error.message} ${
    cause instanceof Error ? cause.message : ""
  }`.toLowerCase()

  return (
    message.includes("fetch failed") ||
    message.includes("getaddrinfo") ||
    message.includes("network")
  )
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Creates a `fetch`-compatible function with retry-on-transient-failure.
 * Pass the result to the Supabase client's `global.fetch` option.
 */
export function createFetchWithRetry(
  options: RetryOptions = {}
): typeof fetch {
  const maxAttempts = options.maxAttempts ?? 3
  const baseDelayMs = options.baseDelayMs ?? 200

  return async function fetchWithRetry(input, init) {
    let lastError: unknown

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fetch(input, init)
      } catch (error) {
        lastError = error

        // Don't retry non-transient errors or the final attempt.
        if (attempt === maxAttempts || !isRetryableError(error)) {
          throw error
        }

        // Exponential backoff with jitter: 200ms, 400ms, ...
        const delay =
          baseDelayMs * 2 ** (attempt - 1) + Math.random() * baseDelayMs
        await sleep(delay)
      }
    }

    // Unreachable, but keeps the type checker happy.
    throw lastError
  }
}

/** Shared instance with default settings. */
export const fetchWithRetry = createFetchWithRetry()
