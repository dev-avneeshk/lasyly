/**
 * Seed-integrity tests for the Week-2 2026 dataset (lib/analytics/nfl/week2-2026.ts).
 *
 * The dataset is generated from docs/product/week2.md; these tests are the
 * guard against a parse/transcription error. The core invariant is the same one
 * the derive engine enforces: per-player receiving must sum to the team passing
 * line for every game. A bad number surfaces here as a failing test.
 *
 * Coverage note: the Week-2 source is the per-game box-score pages only, so it
 * carries no snap counts, no drive logs, and no league-wide Team Offense/Defense
 * tables (those live on a separate PFR page). Those arrays are intentionally
 * empty and are asserted as such rather than fabricated.
 */
import { reconcileTeamPassing } from "@/lib/analytics/nfl/derive"
import week2, { SEASON, WEEK, gameId } from "@/lib/analytics/nfl/week2-2026"

describe("week2 seed — shape + provenance", () => {
  it("declares Week 2 of 2026 from PFR", () => {
    expect(SEASON).toBe(2026)
    expect(WEEK).toBe(2)
    expect(week2.source).toMatch(/Pro-Football-Reference/)
  })

  it("has all 16 games with stable ids and valid integer scores", () => {
    expect(week2.games.length).toBe(16)
    const ids = new Set<string>()
    for (const g of week2.games) {
      expect(g.game_id).toMatch(/^2026-2-[a-z]{2,3}-[a-z]{2,3}$/)
      expect(g.game_id).toBe(gameId(g.away_team, g.home_team))
      expect(Number.isInteger(g.home_score)).toBe(true)
      expect(Number.isInteger(g.away_score)).toBe(true)
      ids.add(g.game_id)
    }
    expect(ids.size).toBe(16)
  })

  it("has two team lines per game (home + away)", () => {
    expect(week2.teamGameStats.length).toBe(32)
    for (const g of week2.games) {
      const teams = week2.teamGameStats.filter((t) => t.game_id === g.game_id)
      expect(teams.length).toBe(2)
      const isHome = teams.map((t) => t.is_home).sort()
      expect(isHome).toEqual([false, true])
    }
  })

  it("does not fabricate data absent from the source", () => {
    expect(week2.snapCounts).toEqual([])
    expect(week2.drives).toEqual([])
    expect(week2.teamOffense).toEqual([])
    expect(week2.teamDefense).toEqual([])
  })
})

describe("week2 seed — team passing reconciliation (all games)", () => {
  const gameIds = new Set(week2.playerGameStats.map((p) => p.game_id))

  it("has player rows for every game", () => {
    expect(gameIds.size).toBe(16)
  })

  for (const g of week2.games) {
    const teams = week2.teamGameStats.filter((t) => t.game_id === g.game_id)
    for (const team of teams) {
      it(`${g.game_id} / ${team.team}: player receiving reconciles to team passing line`, () => {
        expect(reconcileTeamPassing(team, week2.playerGameStats)).toEqual([])
      })
    }
  }
})

describe("week2 seed — advanced tables reference real players", () => {
  it("every advanced row belongs to a team that played that game", () => {
    const teamsByGame = new Map<string, Set<string>>()
    for (const t of week2.teamGameStats) {
      if (!teamsByGame.has(t.game_id)) teamsByGame.set(t.game_id, new Set())
      teamsByGame.get(t.game_id)!.add(t.team)
    }
    for (const row of [...week2.advPassing, ...week2.advRushing, ...week2.advReceiving]) {
      expect(teamsByGame.get(row.game_id)?.has(row.team)).toBe(true)
    }
  })

  it("advanced receiving yardage never exceeds standard box-score yardage per player", () => {
    // Sanity: adv receiving yds must match the standard line for the same player.
    for (const a of week2.advReceiving) {
      const std = week2.playerGameStats.find(
        (p) => p.game_id === a.game_id && p.player === a.player
      )
      if (std) expect(a.yds).toBe(std.rec_yds)
    }
  })
})
