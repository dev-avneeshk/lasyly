import { describe, expect, it } from "vitest"
import { buildMatchKey, isValidSeason, parseMatchKey, validateMatchParams } from "@/lib/soccer/big5"

describe("match keys", () => {
  it("round-trips buildMatchKey / parseMatchKey", () => {
    const key = buildMatchKey("eng.1", "2026-27", 45)
    expect(key).toBe("eng.1/2026-27/45")
    expect(parseMatchKey(key)).toEqual({ league: "eng.1", season: "2026-27", matchNo: 45 })
    expect(parseMatchKey("fra.1/2025-26/9999")).toEqual({ league: "fra.1", season: "2025-26", matchNo: 9999 })
    expect(parseMatchKey("ger.1/2099-00/1")).toEqual({ league: "ger.1", season: "2099-00", matchNo: 1 })
  })

  it("rejects a league outside the five codes", () => {
    for (const league of ["usa.1", "uefa.champions", "eng.2", "ENG.1", "eng.1 ", ""]) {
      expect(parseMatchKey(`${league}/2025-26/1`), league).toBeNull()
    }
  })

  it("rejects malformed or non-consecutive seasons", () => {
    for (const season of ["2026-28", "2025-25", "2025", "2025-2026", "25-26", "abcd-ef", ""]) {
      expect(parseMatchKey(`eng.1/${season}/1`), season).toBeNull()
      expect(isValidSeason(season), season).toBe(false)
    }
  })

  it("rejects bad match numbers before Number()", () => {
    for (const n of ["0", "045", "4.5", "1e3", "abc", "10000", "%", "-1", " 1", ""]) {
      expect(parseMatchKey(`eng.1/2025-26/${n}`), n).toBeNull()
    }
  })

  it("requires exactly three parts", () => {
    expect(parseMatchKey("eng.1/2025-26")).toBeNull()
    expect(parseMatchKey("eng.1/2025-26/1/2")).toBeNull()
    expect(parseMatchKey("")).toBeNull()
  })

  it("validateMatchParams: valid params and undefined params", () => {
    expect(validateMatchParams("ita.1", "2025-26", "380")).toEqual({ league: "ita.1", season: "2025-26", matchNo: 380 })
    expect(validateMatchParams(undefined, "2025-26", "1")).toBeNull()
    expect(validateMatchParams("eng.1", undefined, "1")).toBeNull()
    expect(validateMatchParams("eng.1", "2025-26", undefined)).toBeNull()
    expect(validateMatchParams()).toBeNull()
  })
})
