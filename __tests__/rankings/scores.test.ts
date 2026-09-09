import { computeOffenseScore } from "../../lib/rankings/scores/offense"
import { computeDefenseScore } from "../../lib/rankings/scores/defense"
import type { LeagueMetricContext } from "../../lib/rankings/types"

describe("Ranking Scores", () => {
  const mockLeagueContext: LeagueMetricContext = {
    pts_per_g: [10, 15, 20, 25, 30],
    pts_per_100: [10, 15, 20, 25, 30],
    ts_pct: [0.5, 0.55, 0.6, 0.65],
    trb_per_g_by_pos: { C: [10, 15, 20] } as any,
    ast_pct: [10, 20, 30, 40],
    obpm: [-2, -1, 0, 1, 2],
    dbpm: [-2, -1, 0, 1, 2],
    usg_pct: [15, 20, 25, 30],
    dws: [1, 2, 3, 4],
    stl_per_g: [0.5, 1, 1.5, 2],
    blk_per_g: [0.5, 1, 2, 3],
  } as any

  const basePlayer = {
    per_game: { pts: 20, ast: 5, trb: 5, stl: 1, blk: 0.5, fg3: 2, fg3a: 5, fga: 15, fg: 7, fta: 4, ft: 3, mp: 35 } as any,
    advanced: { obpm: 2, dbpm: 0, bpm: 2, vorp: 2, ws: 5, dws: 2, usg_pct: 0.25, ts_pct: 0.58, ast_pct: 0.25, trb_pct: 0.1 } as any,
    per_100: { pts: 25 } as any, minutes_played: 1500
  }

  describe("computeOffenseScore", () => {
    it("returns higher score for elite OBPM and usage", () => {
      const eliteOffense = {
        ...basePlayer,
        advanced: { ...basePlayer.advanced, obpm: 8, usg_pct: 0.35, ts_pct: 0.65 },
        per_game: { ...basePlayer.per_game, pts: 30 },
      }
      
      const scoreElite = computeOffenseScore(eliteOffense, mockLeagueContext).score
      const scoreBase = computeOffenseScore(basePlayer, mockLeagueContext).score
      
      expect(scoreElite).toBeGreaterThan(scoreBase)
      // Evidence shrinkage keeps even an elite 1,500-minute sample below its raw percentile.
      expect(scoreElite).toBeGreaterThan(70)
    })
    
    it("penalizes high usage with low efficiency", () => {
      const chucker = {
        ...basePlayer,
        advanced: { ...basePlayer.advanced, obpm: 0, usg_pct: 0.30, ts_pct: 0.45 },
        per_game: { ...basePlayer.per_game, pts: 20 },
      }
      
      const scoreChucker = computeOffenseScore(chucker, mockLeagueContext).score
      const scoreBase = computeOffenseScore(basePlayer, mockLeagueContext).score
      
      expect(scoreChucker).toBeLessThan(scoreBase)
    })
  })

  describe("computeDefenseScore", () => {
    it("returns higher score for elite DBPM and stocks", () => {
      const eliteDefense = {
        ...basePlayer,
        advanced: { ...basePlayer.advanced, dbpm: 4, dws: 5 },
        per_game: { ...basePlayer.per_game, stl: 2.5, blk: 2 },
        position: "PG" as any
      }
      
      const scoreElite = computeDefenseScore(eliteDefense, mockLeagueContext).score
      const scoreBase = computeDefenseScore({...basePlayer, position: "PG" as any}, mockLeagueContext).score
      
      expect(scoreElite).toBeGreaterThan(scoreBase)
      expect(scoreElite).toBeGreaterThan(80)
    })

    it("handles negative DBPM gracefully", () => {
      const poorDefense = {
        ...basePlayer,
        advanced: { ...basePlayer.advanced, dbpm: -3, dws: 0.5 },
        per_game: { ...basePlayer.per_game, stl: 0.2, blk: 0.1 },
        position: "PG" as any
      }
      
      const scorePoor = computeDefenseScore(poorDefense, mockLeagueContext).score
      expect(scorePoor).toBeLessThan(50)
    })
  })
})
