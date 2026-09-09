import { blendMultiSeasonStats } from "../../lib/rankings/engine/projection"
import { computeTeamPower, TeamPlayerInput } from "../../lib/rankings/engine/team"
import type { PlayerRankingInput } from "../../lib/rankings/types"

describe("Ranking Engine", () => {
  describe("Projection Blending", () => {
    it("weights current season more heavily than prior seasons", () => {
      const input: PlayerRankingInput = {
        player_id: "1",
        player_name: "Test Player",
        current_season: "2025-26",
        historical_team: "LAL",
        projected_team: "LAL",
        position: "PG",
        age: 25,
        birth_date: null,
        games_played: 80,
        games_started: 80,
        minutes_per_game: 35,
        per_game: { pts: 25, ast: 5, trb: 5, mp: 35 } as any,
        advanced: { obpm: 4, dbpm: 1, bpm: 5, vorp: 4 } as any,
        shooting_profile: null,
        per_100: null,
        game_log_pts: [],
        game_log_trb: [],
        game_log_ast: [],
        prior_seasons: [
          {
            season: "2024-25",
            games_played: 70,
            per_100: { pts: 10 } as any,
            per_game: { pts: 10, ast: 2, trb: 2, mp: 20 } as any,
            advanced: { obpm: 0, dbpm: 0, bpm: 0, vorp: 0 } as any,
          }
        ],
        projected_team_stats: null
      }

      const blended = blendMultiSeasonStats(input)
      
      // With weight 3 for current, 1 for previous:
      // (25 * 3 + 10 * 1) / 4 = 85 / 4 = 21.25 pts
      expect(blended.blended_per_game?.pts).toBeCloseTo(21.25, 1)
      expect(blended.blended_advanced?.obpm).toBeCloseTo(3, 1) // (4*3 + 0*1) / 4 = 3
    })

    it("returns current season if no historical data", () => {
      const input: PlayerRankingInput = {
        player_id: "1",
        player_name: "Rookie Player",
        current_season: "2025-26",
        historical_team: "LAL",
        projected_team: "LAL",
        position: "PG",
        age: 20,
        birth_date: null,
        games_played: 80,
        games_started: 80,
        minutes_per_game: 30,
        per_game: { pts: 15 } as any,
        advanced: { obpm: 1 } as any,
        shooting_profile: null,
        per_100: null,
        game_log_pts: [],
        game_log_trb: [],
        game_log_ast: [],
        prior_seasons: [],
        projected_team_stats: null
      }

      const blended = blendMultiSeasonStats(input)
      expect(blended.blended_per_game?.pts).toBe(15)
      expect(blended.blended_advanced?.obpm).toBe(1)
    })
  })

  describe("Team Power Score", () => {
    it("weights top players correctly via P1-P8 coefficients", () => {
      const players: TeamPlayerInput[] = [
        { player_name: "Star 1", projected_score: 95, availability_score: 90, is_returning: true },
        { player_name: "Star 2", projected_score: 90, availability_score: 85, is_returning: true },
        { player_name: "Starter 3", projected_score: 80, availability_score: 80, is_returning: true },
        { player_name: "Starter 4", projected_score: 75, availability_score: 75, is_returning: true },
        { player_name: "Starter 5", projected_score: 70, availability_score: 70, is_returning: true },
        { player_name: "Bench 1", projected_score: 65, availability_score: 60, is_returning: true },
        { player_name: "Bench 2", projected_score: 60, availability_score: 60, is_returning: true },
        { player_name: "Bench 3", projected_score: 55, availability_score: 50, is_returning: true },
      ]

      const score = computeTeamPower("LAL", players)
      
      expect(score.team_power_score).toBeGreaterThan(70)
      expect(score.star_score).toBeGreaterThan(70) // star logic applied
      expect(score.continuity_score).toBe(100) // 8/8 returning
    })

    it("handles empty rosters gracefully", () => {
      const score = computeTeamPower("UNK", [])
      expect(score.team_power_score).toBe(0)
      expect(score.star_score).toBe(0)
      expect(score.depth_score).toBe(0)
    })
  })
})
