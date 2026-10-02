import { describe, it, expect, vi } from "vitest"
import { spawnSync } from "node:child_process"
import path from "node:path"

// RT-02: arena routes fired `void broadcastArenaUpdate(...)`; on serverless the
// instance freezes once the response is flushed, so the push was often lost.
// They now go through afterResponse (next/server `after`).
const after = vi.hoisted(() => vi.fn())
vi.mock("next/server", async (orig) => ({ ...(await orig<object>()), after }))

import { afterResponse } from "@/lib/background"

describe("arena broadcasts outlive the response", () => {
  it("no route detaches a broadcast with `void`", () => {
    const root = path.resolve(__dirname, "../..")
    const res = spawnSync("grep", ["-rln", "void broadcastArenaUpdate", "app"], { cwd: root, encoding: "utf8" })
    expect(res.stdout).toBe("")
  })

  it("afterResponse hands the work to next/server after()", () => {
    afterResponse(async () => {}, "test")
    expect(after).toHaveBeenCalledTimes(1)
  })
})
