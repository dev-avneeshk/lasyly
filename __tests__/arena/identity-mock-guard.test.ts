/**
 * D-29 / PD-2: the routes that record seat names (create, matchmake, join) and
 * the pair route (persona collision check) read `profiles` with the
 * service-role client. Every test that imports one of them must mock
 * @/lib/arena/identity, so no suite can reach the real table.
 */
import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

const TESTS_DIR = path.resolve(__dirname, "..")
const SELF = path.resolve(__dirname, "identity-mock-guard.test.ts")
/** An import of one of the four routes, by alias or by relative path. */
const ROUTE_IMPORT =
  /["'](?:@\/|(?:\.\.?\/)+)app\/api\/arena\/(?:route|matchmake\/route|\[gameId\]\/join\/route|\[gameId\]\/pair\/route)["']/
const IDENTITY_MOCK = /vi\.mock\(\s*["']@\/lib\/arena\/identity["']/

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.[cm]?[jt]sx?$/.test(entry.name) ? [full] : []
  })
}

describe("identity mock guard", () => {
  const importers = sourceFiles(TESTS_DIR).filter((f) => f !== SELF && ROUTE_IMPORT.test(readFileSync(f, "utf8")))
  const rel = (f: string) => path.relative(TESTS_DIR, f)

  it("finds the route suites it guards", () => {
    expect(importers.map(rel)).toEqual(
      expect.arrayContaining([
        path.join("arena", "matchmake-route.test.ts"),
        path.join("arena", "join-refund.test.ts"),
        path.join("arena", "join-channel-seat.test.ts"),
        path.join("arena", "join-converted.test.ts"),
        path.join("arena", "stake-schema.test.ts"),
        path.join("economy", "arena-settlement.test.ts"),
      ]),
    )
  })

  it('every test importing the create, matchmake, join or pair route has vi.mock("@/lib/arena/identity")', () => {
    const missing = importers.filter((f) => !IDENTITY_MOCK.test(readFileSync(f, "utf8"))).map(rel)
    expect(missing).toEqual([])
  })
})
