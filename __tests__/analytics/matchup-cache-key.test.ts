import { describe, it, expect, vi } from "vitest"

// DB-01: the inner props cache key omitted `matchup`, so `/api/props?matchup=LAL-BOS`
// populated the same key the default (all-teams) slate reads.
vi.mock("@/lib/cache", () => ({ cached: vi.fn(async (key: string) => key) }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))

import { computeMatchupScopedProps } from "@/lib/analytics/engine-v2"

const keyFor = (matchup?: string) =>
  computeMatchupScopedProps("NBA", "pts", { direction: "over", matchup, todayDate: "2026-10-02" }) as unknown as Promise<string>

describe("computeMatchupScopedProps cache key", () => {
  it("separates a matchup-scoped slate from the full slate", async () => {
    const full = await keyFor()
    const scoped = await keyFor("lal-bos")
    expect(scoped).not.toBe(full)
    expect(await keyFor("LAL-BOS")).toBe(scoped)
    expect(await keyFor("LAL-GSW")).not.toBe(scoped)
  })
})
