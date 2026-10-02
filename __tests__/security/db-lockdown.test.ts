import { describe, it, expect } from "vitest"
import { execFileSync, spawnSync } from "node:child_process"
import path from "node:path"

// Runs the throwaway-Postgres SQL tests in scripts/db. Each script shows the
// attack succeeding before its migration and failing after, plus the legit
// calls the app makes still working. Skipped when Postgres binaries are absent.
const hasPg = spawnSync("sh", ["-c", "command -v initdb && command -v pg_ctl && command -v psql"]).status === 0
const run = (script: string) =>
  execFileSync(path.resolve(__dirname, "../../scripts/db", script), { encoding: "utf8" })

describe.skipIf(!hasPg)("DB privilege lockdown (local Postgres)", () => {
  it("L-01 / L-02 / AUTHZ-2 / AUTHZ-3: direct PostgREST writes and paid-pick reads are closed", () => {
    expect(run("test-direct-write-lockdown.sh")).toContain("all checks passed")
  })

  it("RT-03: only room viewers may join chat/membership channels; clients can't send", () => {
    expect(run("test-room-realtime-auth.sh")).toContain("all checks passed")
  })
  it("REV-17: arena refunds are refused once anyone was paid for the game; money paths still work", () => {
    expect(run("test-reference-id-text.sh")).toContain("all checks passed")
  })
})
