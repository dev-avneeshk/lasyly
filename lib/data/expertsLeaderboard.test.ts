import { describe, it, expect } from "vitest"
import { rankExpertsLeaderboard, MIN_SETTLED } from "./expertsLeaderboard"

type Profile = {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  is_verified: boolean
  favourite_sports: string[] | null
}

type Betslip = { user_id: string; status: string }

function profile(id: string, overrides: Partial<Profile> = {}): Profile {
  return {
    id,
    username: id,
    display_name: id.toUpperCase(),
    avatar_url: null,
    is_verified: false,
    favourite_sports: null,
    ...overrides,
  }
}

function slips(user_id: string, statuses: string[]): Betslip[] {
  return statuses.map((status) => ({ user_id, status }))
}

describe("rankExpertsLeaderboard", () => {
  it("only counts title-cased statuses ('won'/'lost' lowercase are ignored)", () => {
    const profiles = [profile("u1")]
    const betslips = [
      ...slips("u1", ["Won", "Won", "Lost"]),
      // Lowercase + other statuses must NOT be graded.
      ...slips("u1", ["won", "lost", "Pending", "Void"]),
    ]

    const result = rankExpertsLeaderboard(profiles, betslips, "All")

    expect(result).toHaveLength(1)
    expect(result[0].wins).toBe(2)
    expect(result[0].settled).toBe(3)
    expect(result[0].net).toBe(1)
    expect(result[0].win_pct).toBe(67) // round(2/3 * 100)
  })

  it("computes win% and net correctly", () => {
    const profiles = [profile("u1")]
    const betslips = slips("u1", ["Won", "Won", "Won", "Lost"])

    const result = rankExpertsLeaderboard(profiles, betslips, "All")

    expect(result[0].win_pct).toBe(75)
    expect(result[0].wins).toBe(3)
    expect(result[0].settled).toBe(4)
    expect(result[0].net).toBe(2) // 3 wins - 1 loss
    expect(result[0].rank).toBe(1)
  })

  it("excludes predictors below MIN_SETTLED graded slips", () => {
    expect(MIN_SETTLED).toBe(1)
    const profiles = [profile("u1"), profile("u2")]
    const betslips = [
      ...slips("u1", ["Won"]), // settled = 1, qualifies
      ...slips("u2", ["Pending", "Void"]), // settled = 0, excluded
    ]

    const result = rankExpertsLeaderboard(profiles, betslips, "All")

    expect(result.map((e) => e.user_id)).toEqual(["u1"])
  })

  it("filters by favourite_sports case-insensitively; 'All' includes everyone", () => {
    const profiles = [
      profile("u1", { favourite_sports: ["Football", "Tennis"] }),
      profile("u2", { favourite_sports: ["basketball"] }),
      profile("u3", { favourite_sports: null }),
    ]
    const betslips = [
      ...slips("u1", ["Won"]),
      ...slips("u2", ["Won"]),
      ...slips("u3", ["Won"]),
    ]

    const football = rankExpertsLeaderboard(profiles, betslips, "Football")
    expect(football.map((e) => e.user_id)).toEqual(["u1"])

    // Case-insensitive match against lowercase declared sport.
    const basketball = rankExpertsLeaderboard(profiles, betslips, "Basketball")
    expect(basketball.map((e) => e.user_id)).toEqual(["u2"])

    const all = rankExpertsLeaderboard(profiles, betslips, "All")
    expect(all.map((e) => e.user_id).sort()).toEqual(["u1", "u2", "u3"])
  })

  it("tie-breaks win_pct -> settled -> wins -> display_name", () => {
    const profiles = [
      // Same win_pct (100), different settled.
      profile("low", { display_name: "LowSettled" }),
      profile("high", { display_name: "HighSettled" }),
      // Same win_pct + settled as a decider, tie-break by display_name.
      profile("zeta", { display_name: "Zeta" }),
      profile("alpha", { display_name: "Alpha" }),
    ]
    const betslips = [
      ...slips("high", ["Won", "Won", "Won"]), // 100%, settled 3
      ...slips("low", ["Won"]), // 100%, settled 1
      ...slips("zeta", ["Won", "Lost"]), // 50%, settled 2
      ...slips("alpha", ["Won", "Lost"]), // 50%, settled 2
    ]

    const result = rankExpertsLeaderboard(profiles, betslips, "All")

    expect(result.map((e) => e.user_id)).toEqual(["high", "low", "alpha", "zeta"])
    expect(result.map((e) => e.rank)).toEqual([1, 2, 3, 4])
  })

  it("caps the result at the top 50", () => {
    const profiles = Array.from({ length: 60 }, (_, i) =>
      profile(`u${String(i).padStart(2, "0")}`)
    )
    // Everyone wins exactly once -> identical win_pct/settled/wins; display_name
    // tie-break keeps the ordering deterministic.
    const betslips = profiles.flatMap((p) => slips(p.id, ["Won"]))

    const result = rankExpertsLeaderboard(profiles, betslips, "All")

    expect(result).toHaveLength(50)
    expect(result[0].rank).toBe(1)
    expect(result[49].rank).toBe(50)
  })

  it("returns [] for empty input", () => {
    expect(rankExpertsLeaderboard([], [], "All")).toEqual([])
    expect(rankExpertsLeaderboard([profile("u1")], [], "All")).toEqual([])
  })
})
