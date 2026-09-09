/**
 * LPI v2 regression tests.
 *
 * Guards the reported bug: efficient low-minute reserves (Mamukelashvili,
 * Alexander-Walker) outranking a high-volume primary initiator (Brunson)
 * because LPI v1 averaged only rate percentiles with no volume term.
 */
import { buildLeagueContext, computePlayerBreakdown } from "../../lib/rankings/engine/historical"
import { computeImpactScore } from "../../lib/rankings/scores/impact"
import { computeRoleVolumeScore } from "../../lib/rankings/scores/roleVolume"
import { OVERALL_WEIGHTS, PLAYMAKING_SCORE_WEIGHTS, resolveQualification, isQualified } from "../../lib/rankings/config"
import type { PlayerRankingInput } from "../../lib/rankings/types"

/** Builds a plausible input row; overrides patch the interesting fields. */
function player(
  name: string,
  opts: {
    games: number
    mpg: number
    obpm: number
    dbpm: number
    bpm: number
    vorp: number
    ws48: number
    ts: number
    usg: number
    astPct: number
    pts: number
    ptsPer100: number
    position?: PlayerRankingInput["position"]
    drbPct?: number
    blkPct?: number
  }
): PlayerRankingInput {
  return {
    player_name: name,
    player_id: name,
    position: opts.position ?? "PG",
    age: 27,
    birth_date: null,
    historical_team: "XXX",
    projected_team: "XXX",
    current_season: "2025-26",
    games_played: opts.games,
    games_started: opts.games,
    minutes_per_game: opts.mpg,
    per_game: {
      pts: opts.pts, trb: 4, ast: 5, stl: 1, blk: 0.4, tov: 2,
      fg: 8, fga: 17, fg_pct: 0.47, fg3: 2.5, fg3a: 7, fg3_pct: 0.37,
      ft: 4, fta: 5, ft_pct: 0.85, orb: 1, drb: 3, mp: opts.mpg,
      efg_pct: 0.53, pf: 2,
    },
    advanced: {
      per: 20, ts_pct: opts.ts, usg_pct: opts.usg, obpm: opts.obpm, dbpm: opts.dbpm,
      bpm: opts.bpm, vorp: opts.vorp, ws: 6, ws_per_48: opts.ws48, ows: 4, dws: 2,
      orb_pct: 2, drb_pct: opts.drbPct ?? 9, trb_pct: 6, ast_pct: opts.astPct,
      stl_pct: 1.3, blk_pct: opts.blkPct ?? 0.5, tov_pct: 11,
      off_rtg: 118, def_rtg: 114, fg3a_per_fga_pct: 0.4, ast_tov: 2.2,
    },
    shooting_profile: null,
    per_100: { pts: opts.ptsPer100, trb: 6, ast: 7, stl: 1.4, blk: 0.6, ast_tov: 2.2, off_rtg: 118, def_rtg: 114 },
    prior_seasons: [],
    game_log_pts: [], game_log_trb: [], game_log_ast: [],
    projected_team_stats: null,
  }
}

/** Filler league so percentile populations are realistic. */
function fillerLeague(): PlayerRankingInput[] {
  return Array.from({ length: 40 }, (_, i) =>
    player(`Filler ${i}`, {
      games: 40 + (i % 40), mpg: 12 + (i % 24),
      obpm: -3 + i * 0.15, dbpm: -2 + (i % 10) * 0.3, bpm: -4 + i * 0.2,
      vorp: -0.5 + i * 0.1, ws48: 0.03 + i * 0.003,
      ts: 0.50 + (i % 15) * 0.008, usg: 12 + (i % 20),
      astPct: 8 + (i % 25), pts: 5 + (i % 20), ptsPer100: 15 + (i % 22),
    })
  )
}

describe("LPI v2", () => {
  describe("early-season qualification ramp", () => {
    it("uses the full 20/400 bar for a completed/mature season", () => {
      expect(resolveQualification(0)).toEqual({ games: 20, minutes: 400 })
      expect(resolveQualification(82)).toEqual({ games: 20, minutes: 400 })
      expect(resolveQualification(40)).toEqual({ games: 20, minutes: 400 })
    })

    it("ramps the bar down early in the season", () => {
      // Half the league leader's games, minutes derived at 20/game.
      expect(resolveQualification(10)).toEqual({ games: 5, minutes: 100 })
      expect(resolveQualification(20)).toEqual({ games: 10, minutes: 200 })
    })

    it("never drops below the games floor in the first week", () => {
      expect(resolveQualification(2).games).toBe(3)
      expect(resolveQualification(4).games).toBe(3)
    })

    it("isQualified honors a ramped threshold", () => {
      const early = resolveQualification(10) // {games:5, minutes:100}
      expect(isQualified(6, 150, early)).toBe(true)
      expect(isQualified(4, 150, early)).toBe(false) // fails games
      expect(isQualified(6, 80, early)).toBe(false)  // fails minutes
      // Same player fails the full-season default bar.
      expect(isQualified(6, 150)).toBe(false)
    })
  })

  describe("component weights", () => {
    it("sums to 1.0", () => {
      const total = Object.values(OVERALL_WEIGHTS).reduce((s, w) => s + w, 0)
      expect(total).toBeCloseTo(1.0, 10)
    })

    it("playmaking weights sum to 1.0 after pga removal", () => {
      const total = Object.values(PLAYMAKING_SCORE_WEIGHTS).reduce((s, w) => s + w, 0)
      expect(total).toBeCloseTo(1.0, 10)
    })

    it("no longer lets defense dominate the score", () => {
      // v1 had defense at 0.37, the largest single swing factor.
      expect(OVERALL_WEIGHTS.defense).toBeLessThan(OVERALL_WEIGHTS.offense)
      expect(OVERALL_WEIGHTS.defense).toBeLessThan(OVERALL_WEIGHTS.impact)
    })

    it("gives volume-aware components meaningful combined weight", () => {
      expect(OVERALL_WEIGHTS.impact + OVERALL_WEIGHTS.roleVolume).toBeGreaterThanOrEqual(0.4)
    })
  })

  describe("computeRoleVolumeScore", () => {
    const league = {
      minutes_played: [400, 800, 1200, 1600, 2000, 2400, 2800],
      minutes_per_game: [10, 15, 20, 25, 30, 33, 36],
    }

    it("rates a full-workload starter far above a reserve", () => {
      const starter = computeRoleVolumeScore({ minutes_played: 2590, minutes_per_game: 35 }, league)
      const reserve = computeRoleVolumeScore({ minutes_played: 1751, minutes_per_game: 21.9 }, league)
      expect(starter.score).toBeGreaterThan(reserve.score)
    })

    it("is not evidence-shrunk (workload IS the signal)", () => {
      // A tiny sample must score LOW here, not get pulled toward a neutral 50.
      const scrub = computeRoleVolumeScore({ minutes_played: 400, minutes_per_game: 10 }, league)
      expect(scrub.score).toBeLessThan(20)
    })
  })

  describe("computeImpactScore", () => {
    const league = {
      bpm: [-4, -2, 0, 1, 2, 3, 5, 7],
      vorp: [-0.4, 0, 0.5, 1, 2, 3, 4, 5],
      ws_per_48: [0.02, 0.05, 0.08, 0.11, 0.14, 0.17, 0.20],
    }

    it("separates equal-rate players by accumulated value (VORP)", () => {
      const base = { bpm: 3, ws_per_48: 0.165 }
      const highVolume = computeImpactScore(
        { advanced: { ...base, vorp: 3.3 } as never, minutes_played: 2590 }, league
      )
      const lowVolume = computeImpactScore(
        { advanced: { ...base, vorp: 2.1 } as never, minutes_played: 1751 }, league
      )
      expect(highVolume.score).toBeGreaterThan(lowVolume.score)
    })

    it("redistributes weight instead of inventing a 50 for missing metrics", () => {
      const partial = computeImpactScore(
        { advanced: { bpm: 7, vorp: null, ws_per_48: null } as never, minutes_played: 2500 },
        league
      )
      expect(partial.factors_used).toEqual(["bpm"])
      expect(partial.score).toBeGreaterThan(60)
    })
  })

  describe("regression: high-usage star vs efficient low-minute reserve", () => {
    // Real 2025-26 values from the bug report.
    const brunson = player("Jalen Brunson", {
      games: 74, mpg: 35, obpm: 4.0, dbpm: -0.9, bpm: 3.1, vorp: 3.3, ws48: 0.163,
      ts: 0.580, usg: 30.4, astPct: 31.3, pts: 26.0, ptsPer100: 36.9,
      position: "PG", drbPct: 9.4, blkPct: 0.3,
    })
    const mamu = player("Sandro Mamukelashvili", {
      games: 80, mpg: 21.9, obpm: 2.1, dbpm: 0.7, bpm: 2.8, vorp: 2.1, ws48: 0.169,
      ts: 0.637, usg: 18.8, astPct: 12.4, pts: 11.2, ptsPer100: 24.9,
      position: "C", drbPct: 18.8, blkPct: 2.3,
    })
    const naw = player("Nickeil Alexander-Walker", {
      games: 78, mpg: 33.4, obpm: 1.6, dbpm: -0.4, bpm: 1.2, vorp: 2.1, ws48: 0.116,
      ts: 0.610, usg: 23.9, astPct: 15.8, pts: 20.8, ptsPer100: 29.5,
      position: "SG", drbPct: 9.1, blkPct: 1.5,
    })

    const inputs = [brunson, mamu, naw, ...fillerLeague()]
    const league = buildLeagueContext(inputs)
    const score = (p: PlayerRankingInput) =>
      computePlayerBreakdown(p, league, false).historical_overall_score

    it("ranks the high-volume initiator above the efficient reserve", () => {
      expect(score(brunson)).toBeGreaterThan(score(mamu))
    })

    it("ranks the high-volume initiator above the mid-usage wing", () => {
      expect(score(brunson)).toBeGreaterThan(score(naw))
    })

    it("still rewards the reserve's genuine per-minute efficiency on defense", () => {
      const m = computePlayerBreakdown(mamu, league, false)
      const b = computePlayerBreakdown(brunson, league, false)
      expect(m.defense_score).toBeGreaterThan(b.defense_score)
    })
  })

  describe("missing component handling", () => {
    it("redistributes weight and flags low confidence when a component has no data", () => {
      // Mirrors the real Jokić row: ast_pct / bpm / vorp absent from the scrape.
      const gapped = player("Data Gap", {
        games: 65, mpg: 34.8, obpm: 5, dbpm: 1.5, bpm: 4, vorp: 3, ws48: 0.20,
        ts: 0.62, usg: 28, astPct: 30, pts: 25, ptsPer100: 34,
      })
      gapped.advanced = { ...gapped.advanced!, ast_pct: null, ast_tov: null }
      gapped.shooting_profile = null

      const league = buildLeagueContext([gapped, ...fillerLeague()])
      const b = computePlayerBreakdown(gapped, league, false)

      expect(b.missing_components).toContain("playmaking")
      expect(b.low_confidence).toBe(true)
      // Playmaking's overall weight must be redistributed, not blended as a fake 50.
      expect(b.historical_overall_score).toBeGreaterThan(50)
    })

    it("flags a component sourced from a minority of its inputs as degraded", () => {
      // Mirrors the real Wembanyama row: 4 of 5 defensive metrics absent,
      // leaving only stl_pct. The score still looks plausible, so the thin
      // sourcing has to be surfaced explicitly.
      const thin = player("Thin Defense", {
        games: 64, mpg: 33, obpm: 4, dbpm: 2, bpm: 5, vorp: 3, ws48: 0.19,
        ts: 0.60, usg: 27, astPct: 20, pts: 24, ptsPer100: 33, position: "C",
      })
      thin.advanced = {
        ...thin.advanced!,
        dbpm: null, dws: null, blk_pct: null, drb_pct: null, // stl_pct survives
      }

      const league = buildLeagueContext([thin, ...fillerLeague()])
      const b = computePlayerBreakdown(thin, league, false)

      expect(b.degraded_components).toContain("defense")
      expect(b.missing_components).not.toContain("defense")
      expect(b.low_confidence).toBe(true)
    })

    it("does not flag a fully-sourced player", () => {
      // With PGA removed, playmaking has exactly two inputs (ast_pct, ast_tov).
      // A player with complete data must have no missing or degraded components.
      const normal = player("Normal", {
        games: 70, mpg: 32, obpm: 2, dbpm: 0, bpm: 2, vorp: 2, ws48: 0.13,
        ts: 0.57, usg: 24, astPct: 18, pts: 18, ptsPer100: 28,
      })
      const league = buildLeagueContext([normal, ...fillerLeague()])
      const b = computePlayerBreakdown(normal, league, false)

      expect(b.degraded_components).not.toContain("playmaking")
      expect(b.missing_components).toEqual([])
    })
  })
})
