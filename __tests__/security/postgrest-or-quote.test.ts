import { describe, it, expect, vi } from "vitest"

// AUTHZ-16: raw query params were interpolated into `.or()` filter strings, so
// `?q=x%,id.gt.0` added its own condition. Values are now double-quoted.
const ors = vi.hoisted(() => [] as string[])
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const c: Record<string, unknown> = {
      or: (f: string) => (ors.push(f), c),
      then: (r: (v: unknown) => unknown) => r({ data: [], error: null }),
    }
    for (const op of ["from", "select", "order", "limit", "eq", "in", "gt"]) c[op] = () => c
    return c
  },
}))

import { GET as searchScores } from "@/app/api/scores/search/route"
import { GET as correlations } from "@/app/api/props/correlations/route"
import { quotePostgrestValue } from "@/lib/sanitize"

/** Split a PostgREST logic list at top-level commas, honouring "quoted" values and \ escapes. */
function conditions(filter: string): string[] {
  const out = [""]
  let quoted = false
  for (let i = 0; i < filter.length; i++) {
    const ch = filter[i]
    if (quoted && ch === "\\") { out[out.length - 1] += ch + filter[++i]; continue }
    if (ch === '"') quoted = !quoted
    if (ch === "," && !quoted) out.push("")
    else out[out.length - 1] += ch
  }
  return out
}

describe("PostgREST .or() values are quoted (AUTHZ-16)", () => {
  it("an injected comma/operator in ?q stays inside the value", async () => {
    await searchScores(new Request("http://localhost/api/scores/search?q=" + encodeURIComponent("x%,id.gt.0")))
    expect(conditions(ors.at(-1)!)).toEqual(['home_team.ilike."%x%,id.gt.0%"', 'away_team.ilike."%x%,id.gt.0%"'])
  })

  it("a legit team name with a dot still matches as typed", async () => {
    await searchScores(new Request("http://localhost/api/scores/search?q=St.%20Louis"))
    expect(conditions(ors.at(-1)!)).toEqual(['home_team.ilike."%St. Louis%"', 'away_team.ilike."%St. Louis%"'])
  })

  it("propId can't add conditions or close the quote", async () => {
    await correlations(new Request("http://localhost/api/props/correlations?propId=" + encodeURIComponent("a,prop_a.neq.0")))
    expect(conditions(ors.at(-1)!)).toEqual(['prop_a.eq."a,prop_a.neq.0"', 'prop_b.eq."a,prop_a.neq.0"'])
    expect(quotePostgrestValue('a"\\b')).toBe('"a\\"\\\\b"')
  })
})
