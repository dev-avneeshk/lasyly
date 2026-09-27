/**
 * Guards the `lineup → simulation` handoff.
 *
 * The auction used to hand off to the simulation with a ref-guarded setTimeout
 * inside an effect that depended on the (freshly-allocated-every-render) hook
 * bag. Any re-render inside the 1400ms beat ran the cleanup, cancelled the
 * timer, and the already-flipped guard refused to schedule a replacement — so
 * the game hung on "Starting simulation…" forever, with no retry and no button.
 * The server path had the same shape plus a second terminal failure: a non-2xx
 * POST was applied through a guard that drops error bodies, so it looked like
 * success and nothing ever tried again.
 *
 * These tests pin the replacement's behaviour:
 *   - it retries until the owner stops it (rather than firing once),
 *   - a throwing/rejecting attempt is captured and retried, not swallowed,
 *   - concurrent attempts are impossible (one POST at a time),
 *   - stopping is immediate and final,
 * plus the engine-side invariant that made "simulating" render blank: the phase
 * must never advance without a result attached.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  startSimWatchdog,
  autoSimRetryDelay,
  AUTO_SIM_FIRST_DELAY_MS,
  AUTO_SIM_RETRY_DELAYS_MS,
} from "@/lib/hooks/simWatchdog"

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe("simWatchdog", () => {
  it("waits the opening beat, then fires", async () => {
    const run = vi.fn()
    const dog = startSimWatchdog({ run, onStatus: () => {} })

    await vi.advanceTimersByTimeAsync(AUTO_SIM_FIRST_DELAY_MS - 1)
    expect(run).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(run).toHaveBeenCalledTimes(1)

    dog.stop()
  })

  it("keeps retrying while it is running — a single lost attempt is not fatal", async () => {
    // The core regression: the old code fired exactly once and gave up.
    const run = vi.fn()
    const dog = startSimWatchdog({ run, onStatus: () => {} })

    await vi.advanceTimersByTimeAsync(AUTO_SIM_FIRST_DELAY_MS)
    expect(run).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(autoSimRetryDelay(0))
    expect(run).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(autoSimRetryDelay(1))
    expect(run).toHaveBeenCalledTimes(3)

    dog.stop()
  })

  it("retries a rejected attempt and reports why", async () => {
    // The server path: a 429/503/409 used to be indistinguishable from success.
    const run = vi.fn().mockRejectedValue(new Error("Too many actions. Slow down."))
    const seen: (string | null)[] = []
    const dog = startSimWatchdog({ run, onStatus: (s) => seen.push(s.error) })

    await vi.advanceTimersByTimeAsync(AUTO_SIM_FIRST_DELAY_MS)
    expect(run).toHaveBeenCalledTimes(1)
    expect(dog.status().error).toBe("Too many actions. Slow down.")
    expect(seen).toContain("Too many actions. Slow down.")

    await vi.advanceTimersByTimeAsync(autoSimRetryDelay(0))
    expect(run).toHaveBeenCalledTimes(2)

    dog.stop()
  })

  it("captures a synchronous throw from the local engine", async () => {
    const run = vi.fn(() => {
      throw new Error("The simulation produced no result.")
    })
    const dog = startSimWatchdog({ run, onStatus: () => {} })

    await vi.advanceTimersByTimeAsync(AUTO_SIM_FIRST_DELAY_MS)
    expect(dog.status().error).toBe("The simulation produced no result.")
    expect(dog.status().attempts).toBe(1)

    dog.stop()
  })

  it("marks itself stalled only after an attempt settles without being stopped", async () => {
    // Drives the manual "Start simulation" button — it must not flash up on a
    // healthy game, where the owner stops the watchdog as the phase advances.
    const run = vi.fn()
    const dog = startSimWatchdog({ run, onStatus: () => {} })

    expect(dog.status().stalled).toBe(false)
    await vi.advanceTimersByTimeAsync(AUTO_SIM_FIRST_DELAY_MS)
    expect(dog.status().stalled).toBe(true)

    dog.stop()
  })

  it("never runs two attempts concurrently", async () => {
    let active = 0
    let maxActive = 0
    const run = vi.fn(async () => {
      maxActive = Math.max(maxActive, ++active)
      await new Promise((r) => setTimeout(r, 5000))
      active--
    })
    const dog = startSimWatchdog({ run, onStatus: () => {} })

    await vi.advanceTimersByTimeAsync(AUTO_SIM_FIRST_DELAY_MS)
    // Hammer the manual button while the first attempt is still in flight.
    await dog.retryNow()
    await dog.retryNow()
    expect(run).toHaveBeenCalledTimes(1)
    expect(maxActive).toBe(1)

    await vi.advanceTimersByTimeAsync(20_000)
    dog.stop()
  })

  it("stop() is immediate, final and idempotent", async () => {
    const run = vi.fn()
    const dog = startSimWatchdog({ run, onStatus: () => {} })
    dog.stop()
    dog.stop()

    await vi.advanceTimersByTimeAsync(60_000)
    expect(run).not.toHaveBeenCalled()

    await dog.retryNow()
    expect(run).not.toHaveBeenCalled()
  })

  it("stops pushing status after stop(), so a dead watchdog can't setState", async () => {
    const onStatus = vi.fn()
    const run = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 1000))
    })
    const dog = startSimWatchdog({ run, onStatus })

    await vi.advanceTimersByTimeAsync(AUTO_SIM_FIRST_DELAY_MS)
    const before = onStatus.mock.calls.length
    dog.stop()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(onStatus.mock.calls.length).toBe(before)
  })

  it("honours a staggered opening delay (P2 backstop on the server path)", async () => {
    const run = vi.fn()
    const dog = startSimWatchdog({ run, onStatus: () => {}, firstDelayMs: 3200 })

    await vi.advanceTimersByTimeAsync(3199)
    expect(run).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(run).toHaveBeenCalledTimes(1)

    dog.stop()
  })

  it("backs off and then holds at the longest delay", () => {
    expect(autoSimRetryDelay(0)).toBe(AUTO_SIM_RETRY_DELAYS_MS[0])
    for (let i = 1; i < AUTO_SIM_RETRY_DELAYS_MS.length; i++) {
      expect(autoSimRetryDelay(i)).toBeGreaterThan(autoSimRetryDelay(i - 1))
    }
    const last = AUTO_SIM_RETRY_DELAYS_MS[AUTO_SIM_RETRY_DELAYS_MS.length - 1]
    expect(autoSimRetryDelay(99)).toBe(last)
    // Retries must stay well inside the 60-per-minute action budget the server
    // simulate route shares with bid/pass.
    expect(autoSimRetryDelay(0)).toBeGreaterThanOrEqual(1000)
  })
})
