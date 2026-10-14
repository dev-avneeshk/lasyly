/**
 * The jobs cron drains the arena refund queue (arena:refunds:pending) next to
 * the lobby sweep (design §5.1). A failing drain must not take the sweep or the
 * job queue down with it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const h = vi.hoisted(() => ({ authorized: true }))

vi.mock("@/lib/queue", () => ({
  processJobs: vi.fn(async () => ({ processed: 2, failed: 0, skipped: 1 })),
}))
vi.mock("@/lib/queue/handlers", () => ({ jobHandlers: {} }))
vi.mock("@/lib/security/cronAuth", () => ({ isAuthorizedCron: () => h.authorized }))
vi.mock("@/lib/arena/matchmaking", () => ({
  sweepAbandonedLobbies: vi.fn(async () => 2),
  drainPendingRefunds: vi.fn(async () => 3),
}))
// Never reach a real Redis or profiles table, whatever the shell exports (D-29).
vi.mock("@/lib/redis", () => ({ getRedisClient: () => null }))
vi.mock("@/lib/arena/identity", () => ({
  lookupSeatName: vi.fn(async () => null),
  findTakenNames: vi.fn(async () => new Set<string>()),
}))

import { POST } from "@/app/api/jobs/process/route"
import { processJobs } from "@/lib/queue"
import { drainPendingRefunds, sweepAbandonedLobbies } from "@/lib/arena/matchmaking"

const call = () => POST(new Request("http://localhost/api/jobs/process", { method: "POST" }))

beforeEach(() => {
  vi.clearAllMocks()
  h.authorized = true
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe("POST /api/jobs/process refund drain", () => {
  it("returns the drained count as pendingRefunds next to lobbiesRefunded", async () => {
    const res = await call()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(
      expect.objectContaining({ success: true, processed: 2, lobbiesRefunded: 2, pendingRefunds: 3 }),
    )
    expect(drainPendingRefunds).toHaveBeenCalledTimes(1)
    expect(sweepAbandonedLobbies).toHaveBeenCalledTimes(1)
  })

  it("a rejected drain is logged and counts 0, while the sweep and the jobs still run", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const failure = new Error("redis down")
    vi.mocked(drainPendingRefunds).mockRejectedValueOnce(failure)

    const res = await call()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(
      expect.objectContaining({ success: true, processed: 2, lobbiesRefunded: 2, pendingRefunds: 0 }),
    )
    expect(error).toHaveBeenCalledWith("[jobs/process] refund drain failed:", failure)
    expect(sweepAbandonedLobbies).toHaveBeenCalledTimes(1)
    expect(processJobs).toHaveBeenCalledTimes(1)
  })

  it("an unauthorized call gets 401 and drains nothing", async () => {
    h.authorized = false
    const res = await call()
    expect(res.status).toBe(401)
    expect(drainPendingRefunds).not.toHaveBeenCalled()
    expect(sweepAbandonedLobbies).not.toHaveBeenCalled()
  })
})
