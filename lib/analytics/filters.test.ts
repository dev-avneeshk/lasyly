import { describe, it, expect } from "vitest"
import { applyAdvancedFilters, getActiveFilterCount, DEFAULT_FILTERS } from "./filters"
import { EnhancedPropCardData, AdvancedFilterState } from "./types"

// ─── Test Helpers ───────────────────────────────────────────────────────────

function makeProp(overrides: Partial<EnhancedPropCardData> = {}): EnhancedPropCardData {
  return {
    id: "test-1",
    player: "LeBron James",
    team: "LAL",
    statCategory: "pts",
    propLine: 25.5,
    l5Avg: 28.0,
    l10Avg: 27.0,
    lastGames: [],
    hitRate: { over: 7, total: 10, label: "7/10" },
    trend: "up",
    trendPct: 5,
    matchup: "vs GSW",
    sport: "NBA",
    hitRateWindows: [
      { window: "L5", hitRate: 80, over: 4, total: 5, available: true },
      { window: "L10", hitRate: 70, over: 7, total: 10, available: true },
      { window: "L15", hitRate: 67, over: 10, total: 15, available: true },
      { window: "L20", hitRate: 65, over: 13, total: 20, available: true },
      { window: "Season", hitRate: 60, over: 30, total: 50, available: true },
      { window: "vsOpp", hitRate: 75, over: 3, total: 4, available: true },
    ],
    matchupGrade: "B",
    confidence: { l5HitRate: 0.8, l10HitRate: 0.7, matchupGrade: 0.75, sampleSize: 1.0, finalScore: 0.8, stars: 4 },
    correlations: [],
    lineMovement: null,
    sentiment: null,
    direction: "over",
    venue: "home",
    upcomingOpponent: "GSW",
    withoutPlayerApplied: false,
    ...overrides,
  }
}

// ─── applyAdvancedFilters Tests ─────────────────────────────────────────────

describe("applyAdvancedFilters", () => {
  it("returns all props when using default filters with direction=over", () => {
    const props = [
      makeProp({ id: "1", direction: "over" }),
      makeProp({ id: "2", direction: "over" }),
    ]
    const result = applyAdvancedFilters(props, DEFAULT_FILTERS)
    expect(result).toHaveLength(2)
  })

  it("filters by direction", () => {
    const props = [
      makeProp({ id: "1", direction: "over" }),
      makeProp({ id: "2", direction: "under" }),
    ]
    const result = applyAdvancedFilters(props, { ...DEFAULT_FILTERS, direction: "under" })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("2")
  })

  it("filters by homeAway", () => {
    const props = [
      makeProp({ id: "1", venue: "home", direction: "over" }),
      makeProp({ id: "2", venue: "away", direction: "over" }),
      makeProp({ id: "3", venue: null, direction: "over" }),
    ]
    const result = applyAdvancedFilters(props, { ...DEFAULT_FILTERS, homeAway: "home" })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("1")
  })

  it("filters by opposingTeam (case-insensitive)", () => {
    const props = [
      makeProp({ id: "1", upcomingOpponent: "GSW", direction: "over" }),
      makeProp({ id: "2", upcomingOpponent: "LAC", direction: "over" }),
      makeProp({ id: "3", upcomingOpponent: null, direction: "over" }),
    ]
    const result = applyAdvancedFilters(props, { ...DEFAULT_FILTERS, opposingTeam: "gsw" })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("1")
  })

  it("filters by minConfidence", () => {
    const props = [
      makeProp({ id: "1", confidence: { l5HitRate: 0.8, l10HitRate: 0.7, matchupGrade: 0.75, sampleSize: 1.0, finalScore: 0.8, stars: 4 }, direction: "over" }),
      makeProp({ id: "2", confidence: { l5HitRate: 0.4, l10HitRate: 0.3, matchupGrade: 0.5, sampleSize: 0.5, finalScore: 0.4, stars: 2 }, direction: "over" }),
      makeProp({ id: "3", confidence: null, direction: "over" }),
    ]
    const result = applyAdvancedFilters(props, { ...DEFAULT_FILTERS, minConfidence: 3 })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("1")
  })

  it("filters by hitRateMin and hitRateMax (L10 window)", () => {
    const props = [
      makeProp({
        id: "1",
        direction: "over",
        hitRateWindows: [
          { window: "L5", hitRate: 80, over: 4, total: 5, available: true },
          { window: "L10", hitRate: 70, over: 7, total: 10, available: true },
          { window: "L15", hitRate: 67, over: 10, total: 15, available: true },
          { window: "L20", hitRate: 65, over: 13, total: 20, available: true },
          { window: "Season", hitRate: 60, over: 30, total: 50, available: true },
          { window: "vsOpp", hitRate: 75, over: 3, total: 4, available: true },
        ],
      }),
      makeProp({
        id: "2",
        direction: "over",
        hitRateWindows: [
          { window: "L5", hitRate: 40, over: 2, total: 5, available: true },
          { window: "L10", hitRate: 30, over: 3, total: 10, available: true },
          { window: "L15", hitRate: 33, over: 5, total: 15, available: true },
          { window: "L20", hitRate: 35, over: 7, total: 20, available: true },
          { window: "Season", hitRate: 40, over: 20, total: 50, available: true },
          { window: "vsOpp", hitRate: 50, over: 2, total: 4, available: true },
        ],
      }),
    ]
    const result = applyAdvancedFilters(props, { ...DEFAULT_FILTERS, hitRateMin: 50, hitRateMax: 80 })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("1")
  })

  it("filters by withoutPlayer (checks withoutPlayerApplied flag)", () => {
    const props = [
      makeProp({ id: "1", withoutPlayerApplied: true, direction: "over" }),
      makeProp({ id: "2", withoutPlayerApplied: false, direction: "over" }),
    ]
    const result = applyAdvancedFilters(props, { ...DEFAULT_FILTERS, withoutPlayer: "Anthony Davis" })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("1")
  })

  it("applies all filters as logical AND", () => {
    const props = [
      makeProp({
        id: "1",
        direction: "over",
        venue: "home",
        upcomingOpponent: "GSW",
        confidence: { l5HitRate: 0.8, l10HitRate: 0.7, matchupGrade: 0.75, sampleSize: 1.0, finalScore: 0.8, stars: 4 },
        hitRateWindows: [
          { window: "L5", hitRate: 80, over: 4, total: 5, available: true },
          { window: "L10", hitRate: 70, over: 7, total: 10, available: true },
          { window: "L15", hitRate: 67, over: 10, total: 15, available: true },
          { window: "L20", hitRate: 65, over: 13, total: 20, available: true },
          { window: "Season", hitRate: 60, over: 30, total: 50, available: true },
          { window: "vsOpp", hitRate: 75, over: 3, total: 4, available: true },
        ],
      }),
      makeProp({
        id: "2",
        direction: "over",
        venue: "away", // fails homeAway filter
        upcomingOpponent: "GSW",
        confidence: { l5HitRate: 0.8, l10HitRate: 0.7, matchupGrade: 0.75, sampleSize: 1.0, finalScore: 0.8, stars: 4 },
      }),
      makeProp({
        id: "3",
        direction: "over",
        venue: "home",
        upcomingOpponent: "LAC", // fails opposingTeam filter
        confidence: { l5HitRate: 0.8, l10HitRate: 0.7, matchupGrade: 0.75, sampleSize: 1.0, finalScore: 0.8, stars: 4 },
      }),
    ]

    const filters: AdvancedFilterState = {
      ...DEFAULT_FILTERS,
      homeAway: "home",
      opposingTeam: "GSW",
      minConfidence: 4,
    }

    const result = applyAdvancedFilters(props, filters)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("1")
  })

  it("returns empty array when no props match", () => {
    const props = [
      makeProp({ id: "1", direction: "over", venue: "away" }),
    ]
    const result = applyAdvancedFilters(props, { ...DEFAULT_FILTERS, homeAway: "home" })
    expect(result).toHaveLength(0)
  })

  it("excludes props with unavailable L10 when hitRateMin > 0", () => {
    const props = [
      makeProp({
        id: "1",
        direction: "over",
        hitRateWindows: [
          { window: "L5", hitRate: 0, over: 0, total: 2, available: false },
          { window: "L10", hitRate: 0, over: 0, total: 2, available: false },
          { window: "L15", hitRate: 0, over: 0, total: 2, available: false },
          { window: "L20", hitRate: 0, over: 0, total: 2, available: false },
          { window: "Season", hitRate: 0, over: 0, total: 2, available: false },
          { window: "vsOpp", hitRate: 0, over: 0, total: 0, available: false },
        ],
      }),
    ]
    const result = applyAdvancedFilters(props, { ...DEFAULT_FILTERS, hitRateMin: 50 })
    expect(result).toHaveLength(0)
  })

  it("includes props with unavailable L10 when hitRateMin is 0", () => {
    const props = [
      makeProp({
        id: "1",
        direction: "over",
        hitRateWindows: [
          { window: "L5", hitRate: 0, over: 0, total: 2, available: false },
          { window: "L10", hitRate: 0, over: 0, total: 2, available: false },
          { window: "L15", hitRate: 0, over: 0, total: 2, available: false },
          { window: "L20", hitRate: 0, over: 0, total: 2, available: false },
          { window: "Season", hitRate: 0, over: 0, total: 2, available: false },
          { window: "vsOpp", hitRate: 0, over: 0, total: 0, available: false },
        ],
      }),
    ]
    const result = applyAdvancedFilters(props, DEFAULT_FILTERS)
    expect(result).toHaveLength(1)
  })
})

// ─── getActiveFilterCount Tests ─────────────────────────────────────────────

describe("getActiveFilterCount", () => {
  it("returns 0 for default filters", () => {
    expect(getActiveFilterCount(DEFAULT_FILTERS)).toBe(0)
  })

  it("counts withoutPlayer as active when non-empty", () => {
    expect(getActiveFilterCount({ ...DEFAULT_FILTERS, withoutPlayer: "AD" })).toBe(1)
  })

  it("counts homeAway as active when not 'all'", () => {
    expect(getActiveFilterCount({ ...DEFAULT_FILTERS, homeAway: "home" })).toBe(1)
  })

  it("counts opposingTeam as active when not null", () => {
    expect(getActiveFilterCount({ ...DEFAULT_FILTERS, opposingTeam: "GSW" })).toBe(1)
  })

  it("counts minConfidence as active when > 1", () => {
    expect(getActiveFilterCount({ ...DEFAULT_FILTERS, minConfidence: 3 })).toBe(1)
  })

  it("counts direction as active when 'under'", () => {
    expect(getActiveFilterCount({ ...DEFAULT_FILTERS, direction: "under" })).toBe(1)
  })

  it("counts hitRateMin as active when > 0", () => {
    expect(getActiveFilterCount({ ...DEFAULT_FILTERS, hitRateMin: 20 })).toBe(1)
  })

  it("counts hitRateMax as active when < 100", () => {
    expect(getActiveFilterCount({ ...DEFAULT_FILTERS, hitRateMax: 80 })).toBe(1)
  })

  it("counts multiple active filters correctly", () => {
    const filters: AdvancedFilterState = {
      withoutPlayer: "AD",
      homeAway: "home",
      opposingTeam: "GSW",
      opposingPlayer: null,
      minConfidence: 4,
      direction: "under",
      hitRateMin: 30,
      hitRateMax: 90,
    }
    expect(getActiveFilterCount(filters)).toBe(7)
  })
})
