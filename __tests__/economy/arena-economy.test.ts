import {
  SIGNUP_BONUS,
  CPU_ENTRY_COST,
  CPU_WIN_MULTIPLIER,
  cpuWinReward,
  MIN_STAKE,
  COMMISSION_RATE,
  isValidStake,
  stakePayout,
  stakeCommission,
  XP_REWARDS,
  xpToReachLevel,
  levelForXp,
  levelProgress,
  weeklyLevelBonus,
  isoWeekKey,
} from "@/lib/economy/arena"

describe("Economy — constants", () => {
  it("signup bonus is 200", () => {
    expect(SIGNUP_BONUS).toBe(200)
  })

  it("CPU entry cost is a flat 50", () => {
    expect(CPU_ENTRY_COST).toBe(50)
  })

  it("minimum 1v1 stake is 5", () => {
    expect(MIN_STAKE).toBe(5)
  })

  it("house commission is 10%", () => {
    expect(COMMISSION_RATE).toBe(0.1)
  })
})

describe("Economy — CPU rewards scale with difficulty", () => {
  it("harder CPU pays a strictly higher multiplier", () => {
    expect(CPU_WIN_MULTIPLIER.easy).toBeLessThan(CPU_WIN_MULTIPLIER.medium)
    expect(CPU_WIN_MULTIPLIER.medium).toBeLessThan(CPU_WIN_MULTIPLIER.hard)
  })

  it("computes the documented reward amounts", () => {
    expect(cpuWinReward("easy")).toBe(75) // 50 * 1.5
    expect(cpuWinReward("medium")).toBe(100) // 50 * 2
    expect(cpuWinReward("hard")).toBe(150) // 50 * 3
  })

  it("every reward is a whole number and beats the entry cost", () => {
    for (const d of ["easy", "medium", "hard"] as const) {
      const r = cpuWinReward(d)
      expect(Number.isInteger(r)).toBe(true)
      expect(r).toBeGreaterThan(CPU_ENTRY_COST)
    }
  })
})

describe("Economy — 1v1 staking with commission", () => {
  it("the canonical example: stake 100 → winner receives 190", () => {
    expect(stakePayout(100)).toBe(190)
    expect(stakeCommission(100)).toBe(10)
  })

  it("payout returns own stake plus opponent's stake less 10% commission", () => {
    for (const stake of [5, 25, 50, 100, 250, 1000]) {
      expect(stakePayout(stake)).toBe(Math.round(stake * (2 - 0.1)))
      // payout + commission always equals the full pot
      expect(stakePayout(stake) + stakeCommission(stake)).toBe(stake * 2)
    }
  })

  it("the winner never loses coins net of their own stake", () => {
    for (const stake of [5, 50, 500]) {
      expect(stakePayout(stake)).toBeGreaterThan(stake)
    }
  })

  it("validates stakes: whole number, >= MIN_STAKE, <= balance", () => {
    expect(isValidStake(5, 100)).toBe(true)
    expect(isValidStake(100, 100)).toBe(true)
    expect(isValidStake(4, 100)).toBe(false) // below minimum
    expect(isValidStake(101, 100)).toBe(false) // above balance
    expect(isValidStake(5.5, 100)).toBe(false) // not integer
    expect(isValidStake(50, 40)).toBe(false) // can't afford
  })
})

describe("Economy — XP + levels", () => {
  it("winning is worth more XP than just playing", () => {
    expect(XP_REWARDS.cpuWin).toBeGreaterThan(0)
    expect(XP_REWARDS.pvpWin).toBeGreaterThan(XP_REWARDS.cpuWin)
  })

  it("level 1 needs 0 XP; the curve rises each level", () => {
    expect(xpToReachLevel(1)).toBe(0)
    expect(xpToReachLevel(2)).toBe(100)
    expect(xpToReachLevel(3)).toBe(300)
    expect(xpToReachLevel(4)).toBe(600)
    // strictly increasing
    for (let n = 1; n < 20; n++) {
      expect(xpToReachLevel(n + 1)).toBeGreaterThan(xpToReachLevel(n))
    }
  })

  it("levelForXp is the inverse of the curve at the boundaries", () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(99)).toBe(1)
    expect(levelForXp(100)).toBe(2)
    expect(levelForXp(299)).toBe(2)
    expect(levelForXp(300)).toBe(3)
    expect(levelForXp(-50)).toBe(1) // clamps negatives
  })

  it("levelProgress reports how far into the current level a total is", () => {
    // 150 XP → level 2 (floor 100, ceil 300), 50 into a 200-wide level.
    const p = levelProgress(150)
    expect(p.level).toBe(2)
    expect(p.xpIntoLevel).toBe(50)
    expect(p.xpForNextLevel).toBe(200)
  })
})

describe("Economy — weekly level bonus", () => {
  it("follows 100 + level*50 and rises with level", () => {
    expect(weeklyLevelBonus(1)).toBe(150)
    expect(weeklyLevelBonus(2)).toBe(200)
    expect(weeklyLevelBonus(10)).toBe(600)
    expect(weeklyLevelBonus(2)).toBeGreaterThan(weeklyLevelBonus(1))
  })

  it("floors invalid levels to level 1", () => {
    expect(weeklyLevelBonus(0)).toBe(150)
    expect(weeklyLevelBonus(-5)).toBe(150)
  })
})

describe("Economy — ISO week key", () => {
  it("produces a stable YYYY-Www key for a known date", () => {
    // 2026-09-17 (Thursday) is in ISO week 38 of 2026.
    expect(isoWeekKey(new Date("2026-09-17T12:00:00Z"))).toBe("2026-W38")
  })

  it("gives the same key for every day within one ISO week", () => {
    // Mon 2026-09-14 .. Sun 2026-09-20 are all ISO week 38.
    const mon = isoWeekKey(new Date("2026-09-14T00:00:00Z"))
    const sun = isoWeekKey(new Date("2026-09-20T23:00:00Z"))
    expect(mon).toBe("2026-W38")
    expect(sun).toBe("2026-W38")
  })

  it("changes the key across a week boundary", () => {
    const w38 = isoWeekKey(new Date("2026-09-20T12:00:00Z")) // Sunday
    const w39 = isoWeekKey(new Date("2026-09-21T12:00:00Z")) // next Monday
    expect(w38).not.toBe(w39)
  })
})
