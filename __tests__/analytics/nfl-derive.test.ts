import {
  safeDiv,
  safePct,
  round,
  display,
  EM_DASH,
  receivingEfficiency,
  usageShares,
  teamReceiverYbc,
  snapUsage,
  yacProfile,
  mean,
  median,
  percentile,
  rankOf,
  baseline,
  matchupStrength,
  driveEfficiency,
  reconcileTeamPassing,
} from "@/lib/analytics/nfl/derive"
import week1, { gameId } from "@/lib/analytics/nfl/week1-2026"
import type { NflAdvReceiving } from "@/lib/analytics/nfl/types"

// ─── Safe arithmetic: never NaN / Infinity ──────────────────────────────────

describe("safe arithmetic", () => {
  it("divides normally", () => {
    expect(safeDiv(10, 4)).toBe(2.5)
    expect(safePct(3, 6)).toBe(50)
  })

  it("returns null (never NaN/Infinity) for zero / null denominators", () => {
    expect(safeDiv(5, 0)).toBeNull()
    expect(safeDiv(0, 0)).toBeNull()
    expect(safeDiv(5, null)).toBeNull()
    expect(safeDiv(null, 5)).toBeNull()
    expect(safePct(5, 0)).toBeNull()
  })

  it("never propagates NaN or Infinity", () => {
    for (const [a, b] of [
      [1, 0],
      [0, 0],
      [Infinity, 2],
      [NaN, 2],
      [2, NaN],
    ] as const) {
      const r = safeDiv(a, b)
      expect(r === null || Number.isFinite(r)).toBe(true)
    }
  })

  it("rounds and displays with em-dash for null", () => {
    expect(round(2.34567, 2)).toBe(2.35)
    expect(round(null)).toBeNull()
    expect(display(null)).toBe(EM_DASH)
    expect(display(1.23, 1)).toBe("1.2")
  })
})

// ─── Statistics primitives ──────────────────────────────────────────────────

describe("statistics", () => {
  it("mean and median handle empty populations", () => {
    expect(mean([])).toBe(0)
    expect(median([])).toBe(0)
    expect(mean([2, 4, 6])).toBe(4)
    expect(median([3, 1, 2])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })

  it("percentile returns 50 for empty and orders correctly", () => {
    expect(percentile(5, [])).toBe(50)
    expect(percentile(10, [0, 5, 10])).toBeGreaterThan(percentile(0, [0, 5, 10]))
  })

  it("rankOf orients by direction and shares ties", () => {
    const pop = [30, 20, 20, 10]
    expect(rankOf(30, pop, "desc")).toBe(1)
    expect(rankOf(10, pop, "desc")).toBe(4)
    expect(rankOf(10, pop, "asc")).toBe(1)
    // ties: both 20s are rank 2 (one value strictly greater)
    expect(rankOf(20, pop, "desc")).toBe(2)
  })
})

// ─── Receiving efficiency on a known real line (JSN vs NWE) ──────────────────

describe("receivingEfficiency (Jaxon Smith-Njigba, Wk1)", () => {
  const jsn = week1.advReceiving.find(
    (r) => r.player === "Jaxon Smith-Njigba"
  ) as NflAdvReceiving

  it("exists in the seed", () => {
    expect(jsn).toBeDefined()
    expect(jsn.targets).toBe(11)
    expect(jsn.rec).toBe(8)
    expect(jsn.yds).toBe(122)
  })

  it("computes DERIVED ratios correctly", () => {
    const eff = receivingEfficiency(jsn)
    // 8/11 = 72.7%
    expect(eff.catch_rate.value).toBe(72.7)
    expect(eff.catch_rate.label).toBe("DERIVED")
    // 122/11 = 11.09 -> 11.1
    expect(eff.yards_per_target.value).toBe(11.1)
    // 122/8 = 15.25 -> 15.3
    expect(eff.yards_per_reception.value).toBe(15.3)
    // 0 drops / 11 targets = 0%
    expect(eff.drop_rate.value).toBe(0)
  })

  it("returns null (not NaN) for a zero-target receiver", () => {
    const zero: NflAdvReceiving = { ...jsn, targets: 0, rec: 0, yds: 0 }
    const eff = receivingEfficiency(zero)
    expect(eff.catch_rate.value).toBeNull()
    expect(eff.yards_per_target.value).toBeNull()
  })
})

// ─── YAC profile splits sum to 100% ──────────────────────────────────────────

describe("yacProfile", () => {
  it("air-yard % and yac % sum to ~100 when ybc+yac == yds", () => {
    const jsn = week1.advReceiving.find((r) => r.player === "Jaxon Smith-Njigba")!
    // JSN: ybc 60 + yac 62 = 122 == yds 122
    const p = yacProfile(jsn)
    const sum = (p.air_yard_pct.value ?? 0) + (p.yac_pct.value ?? 0)
    expect(Math.round(sum)).toBe(100)
  })
})

// ─── Usage shares against real team totals ───────────────────────────────────

describe("usageShares (JSN target share vs SEA)", () => {
  it("target share = player targets / team pass attempts", () => {
    const g = gameId("NWE", "SEA")
    const seaTeam = week1.teamGameStats.find((t) => t.game_id === g && t.team === "SEA")!
    const jsn = week1.playerGameStats.find(
      (p) => p.game_id === g && p.player === "Jaxon Smith-Njigba"
    )!
    const shares = usageShares({
      playerTargets: jsn.targets,
      playerReceptions: jsn.rec,
      playerRecYds: jsn.rec_yds,
      playerYbc: 60,
      teamPassAtt: seaTeam.pass_att, // 24
      teamCompletions: seaTeam.pass_cmp, // 17
      teamPassYds: seaTeam.pass_yds, // 200
      teamReceiverYbc: teamReceiverYbc(week1.advReceiving, "SEA"),
    })
    // 11 targets / 24 att = 45.8%
    expect(shares.target_share.value).toBe(45.8)
    // 8 rec / 17 cmp = 47.1%
    expect(shares.reception_share.value).toBe(47.1)
    // 122 / 200 = 61%
    expect(shares.receiving_yard_share.value).toBe(61)
    expect(shares.air_yard_share.value).not.toBeNull()
  })
})

// ─── Snap usage ──────────────────────────────────────────────────────────────

describe("snapUsage", () => {
  it("computes per-snap rates and surfaces RAW snap share", () => {
    const g = gameId("NWE", "SEA")
    const snap = week1.snapCounts.find(
      (s) => s.game_id === g && s.player === "Jaxon Smith-Njigba"
    )!
    const stat = week1.playerGameStats.find(
      (p) => p.game_id === g && p.player === "Jaxon Smith-Njigba"
    )!
    const u = snapUsage(snap, stat)
    expect(u.offensive_snap_share.value).toBe(90) // RAW off_pct
    expect(u.offensive_snap_share.label).toBe("RAW")
    // 11 targets / 45 snaps
    expect(u.targets_per_snap.value).toBeCloseTo(0.244, 2)
    expect(u.targets_per_snap.label).toBe("DERIVED")
  })
})

// ─── League baselines / matchup context on real 32-team populations ──────────

describe("baseline + matchupStrength", () => {
  it("baseline carries rank, percentile, and sample size", () => {
    const passYds = week1.teamDefense.map((u) => u.pass_yds)
    // NWE defense allowed 188 pass yds
    const b = baseline(188, passYds, false)
    expect(b.sample_size).toBe(32)
    expect(b.rank.label).toBe("RANKED")
    expect(b.value.value).toBe(188)
    // rank must be within [1, 32]
    expect(b.rank.value).toBeGreaterThanOrEqual(1)
    expect(b.rank.value).toBeLessThanOrEqual(32)
  })

  it("matchupStrength resolves a known opponent defense", () => {
    const m = matchupStrength("SEA", week1.teamDefense)
    expect(m).not.toBeNull()
    expect(m!.pass_defense.sample_size).toBe(32)
    // SEA allowed 168 pass yds — a strong (low) figure → good defensive rank.
    expect(m!.pass_defense.value.value).toBe(168)
    expect(m!.pass_defense.rank.value).toBeLessThanOrEqual(8)
  })

  it("returns null for an unknown opponent (never fabricates)", () => {
    expect(matchupStrength("ZZZ", week1.teamDefense)).toBeNull()
  })
})

// ─── Drive efficiency on real SEA drives ─────────────────────────────────────

describe("driveEfficiency (SEA, Wk1)", () => {
  it("aggregates the 10 Seattle drives", () => {
    const g = gameId("NWE", "SEA")
    const seaDrives = week1.drives.filter((d) => d.game_id === g && d.team === "SEA")
    expect(seaDrives.length).toBe(10)
    const eff = driveEfficiency(seaDrives, 13) // SEA scored 13
    expect(eff.drives).toBe(10)
    // 3 scoring drives (Field Goal, Touchdown, Field Goal) out of 10 = 30%
    expect(eff.scoring_drive_rate.value).toBe(30)
    expect(eff.points_per_drive.value).toBe(1.3)
  })
})

// ─── SEED INTEGRITY: reconcile every transcribed game against team totals ────
// This is the guard against transcription error. Player receiving must sum to
// the team passing line for every game whose player table is transcribed.

describe("seed integrity — team passing reconciliation", () => {
  // Only games that actually have player rows transcribed (skip meta-only).
  const transcribedGameIds = new Set(week1.playerGameStats.map((p) => p.game_id))

  it("has at least one fully transcribed game", () => {
    expect(transcribedGameIds.size).toBeGreaterThanOrEqual(1)
  })

  for (const gid of transcribedGameIds) {
    const teams = week1.teamGameStats.filter((t) => t.game_id === gid)
    for (const team of teams) {
      it(`${gid} / ${team.team}: player receiving reconciles to team passing line`, () => {
        const issues = reconcileTeamPassing(team, week1.playerGameStats)
        expect(issues).toEqual([])
      })
    }
  }
})

// ─── SEED INTEGRITY: league tables are complete + no fabricated NaN ──────────

describe("seed integrity — league tables", () => {
  it("has all 32 teams in offense and defense", () => {
    expect(new Set(week1.teamOffense.map((u) => u.team)).size).toBe(32)
    expect(new Set(week1.teamDefense.map((u) => u.team)).size).toBe(32)
  })

  it("every game meta has a stable id and valid scores", () => {
    expect(week1.games.length).toBe(16)
    for (const g of week1.games) {
      expect(g.game_id).toMatch(/^2026-1-[a-z]{2,3}-[a-z]{2,3}$/)
      expect(Number.isInteger(g.home_score)).toBe(true)
      expect(Number.isInteger(g.away_score)).toBe(true)
    }
  })

  it("cross-checks a known league value: BUF leads scoring with 77 points", () => {
    const buf = week1.teamOffense.find((u) => u.team === "BUF")!
    expect(buf.points).toBe(77)
    const maxPoints = Math.max(...week1.teamOffense.map((u) => u.points))
    expect(buf.points).toBe(maxPoints)
  })
})
