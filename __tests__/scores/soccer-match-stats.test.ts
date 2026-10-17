import { describe, expect, it } from "vitest"
import {
  STAT_GROUP_ORDER,
  STAT_ORDER,
  buildMatchKey,
  isValidSeason,
  parseMatchKey,
  validateMatchParams,
} from "@/lib/soccer/big5"
import {
  buildSoccerModalData,
  formatStatDisplay,
  shapeSoccerMatchStats,
  type SoccerMatchRow,
  type SoccerMatchStatRow,
  type SoccerTeamRow,
} from "@/lib/scores/soccerMatchStats"

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

// ─── Shaping (lib/scores/soccerMatchStats) ────────────────────────────────────

const HEADER: SoccerMatchRow = {
  league: "eng.1",
  season: "2025-26",
  match_no: 1,
  round: 1,
  match_date: "2025-08-15",
  home_team: "Liverpool",
  away_team: "AFC Bournemouth",
  home_score: 4,
  away_score: 2,
  source: "FotMob",
  has_stats: true,
}

const TEAMS: SoccerTeamRow[] = [
  { name: "Liverpool", logo_url: "https://logo/liv.png", color: "c8102e" },
  { name: "AFC Bournemouth", logo_url: null, color: null },
]

function stat(
  period: string,
  group: string,
  name: string,
  home: number | string | null,
  away: number | string | null,
  homeRaw: string | null = home === null ? "n/a" : String(home),
  awayRaw: string | null = away === null ? "n/a" : String(away),
): SoccerMatchStatRow {
  return {
    period,
    stat_group: group,
    stat_name: name,
    home_value: home,
    away_value: away,
    home_pct: null,
    away_pct: null,
    home_raw: homeRaw,
    away_raw: awayRaw,
  }
}

describe("formatStatDisplay", () => {
  it("null value → '–'", () => {
    expect(formatStatDisplay("Corners", null, "n/a")).toBe("–")
    expect(formatStatDisplay("Ball possession", null, "")).toBe("–")
  })

  it("a pct raw is shown as the raw text", () => {
    expect(formatStatDisplay("Accurate passes", 298, "298 (78%)")).toBe("298 (78%)")
  })

  it("Ball possession → '%'", () => {
    expect(formatStatDisplay("Ball possession", 46, "46")).toBe("46%")
  })

  it("distances in meters → km with one decimal", () => {
    expect(formatStatDisplay("Distance covered", 112974, "112974")).toBe("113.0 km")
    expect(formatStatDisplay("Running distance", 85432, "85432")).toBe("85.4 km")
    expect(formatStatDisplay("Sprinting distance", 9060, "9060")).toBe("9.1 km")
  })

  it("anything else → the raw text", () => {
    expect(formatStatDisplay("Expected goals (xG)", 0.79, "0.79")).toBe("0.79")
    expect(formatStatDisplay("Corners", 9, "9")).toBe("9")
  })
})

describe("shapeSoccerMatchStats", () => {
  it("orders groups by STAT_GROUP_ORDER and stats by STAT_ORDER, unknowns last alphabetically", () => {
    const rows = [
      stat("FT", "Physical performance", "Distance covered", 112974, 108367),
      stat("FT", "Zeta group", "Zed", 1, 2),
      stat("FT", "Alpha group", "Alpha", 1, 2),
      stat("FT", "Top stats", "Corners", 9, 3),
      stat("FT", "Top stats", "Zebra stat", 1, 1),
      stat("FT", "Top stats", "Aardvark stat", 1, 1),
      stat("FT", "Top stats", "Ball possession", 46, 54),
      stat("FT", "Top stats", "Total shots", 19, 10),
      stat("FT", "Shots", "Shots on target", 7, 3),
      stat("FT", "Shots", "Total shots", 19, 10),
    ]
    const out = shapeSoccerMatchStats(HEADER, rows, TEAMS)
    const groups = out.periods[0].groups.map((g) => g.group)
    expect(groups).toEqual(["Top stats", "Shots", "Physical performance", "Alpha group", "Zeta group"])
    // Known groups appear in STAT_GROUP_ORDER's relative order.
    const known = groups.filter((g) => (STAT_GROUP_ORDER as readonly string[]).includes(g))
    expect(known).toEqual([...STAT_GROUP_ORDER].filter((g) => known.includes(g)))

    const top = out.periods[0].groups[0].stats.map((s) => s.label)
    expect(top).toEqual(["Ball possession", "Total shots", "Corners", "Aardvark stat", "Zebra stat"])
    expect(top.slice(0, 3)).toEqual(STAT_ORDER["Top stats"].filter((s) => top.includes(s)))
    expect(out.periods[0].groups[1].stats.map((s) => s.label)).toEqual(["Total shots", "Shots on target"])
  })

  it("an AiScore match has no xG or Physical group", () => {
    const rows = [
      stat("FT", "Top stats", "Ball possession", 55, 45),
      stat("FT", "Top stats", "Corners", 4, 6),
      stat("FT", "Shots", "Total shots", 12, 8),
      stat("FT", "Discipline", "Yellow cards", 2, 1),
    ]
    const out = shapeSoccerMatchStats({ ...HEADER, source: "AiScore" }, rows, TEAMS)
    const groups = out.periods[0].groups.map((g) => g.group)
    expect(groups).toEqual(["Top stats", "Shots", "Discipline"])
    expect(groups).not.toContain("Expected goals (xG)")
    expect(groups).not.toContain("Physical performance")
    expect(out.source).toBe("AiScore")
  })

  it("drops a both-null stat with empty raws, and a group left empty", () => {
    const rows = [
      stat("FT", "Top stats", "Corners", 9, 3),
      stat("FT", "Top stats", "Big chances", null, null, "n/a", "-"),
      stat("FT", "Expected goals (xG)", "Expected goals (xG)", null, null, "", null),
      // One side present: kept, the missing side shows "–".
      stat("FT", "Top stats", "Yellow cards", 2, null, "2", "N/A"),
    ]
    const out = shapeSoccerMatchStats(HEADER, rows, TEAMS)
    expect(out.periods[0].groups.map((g) => g.group)).toEqual(["Top stats"])
    const labels = out.periods[0].groups[0].stats.map((s) => s.label)
    expect(labels).toEqual(["Yellow cards", "Corners"])
    const yellow = out.periods[0].groups[0].stats[0]
    expect(yellow).toEqual({ label: "Yellow cards", home: "2", away: "–", homeValue: 2, awayValue: null })
  })

  it("orders periods FT/1H/2H and leaves out a missing 2H", () => {
    const rows = [
      stat("1H", "Top stats", "Corners", 5, 1),
      stat("FT", "Top stats", "Corners", 9, 3),
    ]
    const out = shapeSoccerMatchStats(HEADER, rows, TEAMS)
    expect(out.periods.map((p) => [p.period, p.label])).toEqual([
      ["FT", "Full time"],
      ["1H", "1st half"],
    ])
  })

  it("coerces PostgREST string numerics to numbers, and non-finite to null", () => {
    const rows = [
      stat("FT", "Expected goals (xG)", "Expected goals (xG)", "2.31", "0.79", "2.31", "0.79"),
      stat("FT", "Top stats", "Corners", "abc", "3", "abc", "3"),
    ]
    const out = shapeSoccerMatchStats({ ...HEADER, match_no: "1", home_score: "4", away_score: "2", round: "1" }, rows, TEAMS)
    const xg = out.periods[0].groups.find((g) => g.group === "Expected goals (xG)")!.stats[0]
    expect(xg.homeValue).toBe(2.31)
    expect(xg.awayValue).toBe(0.79)
    const corners = out.periods[0].groups.find((g) => g.group === "Top stats")!.stats[0]
    expect(corners.homeValue).toBeNull()
    expect(corners.home).toBe("–")
    expect(corners.awayValue).toBe(3)
    expect(out.matchNo).toBe(1)
    expect(out.homeScore).toBe(4)
    expect(out.awayScore).toBe(2)
    expect(out.round).toBe(1)
  })

  it("fills display text server side (%, km, pct raw)", () => {
    const rows = [
      stat("FT", "Top stats", "Ball possession", 46, 54),
      stat("FT", "Passes", "Accurate passes", 298, 386, "298 (78%)", "386 (82%)"),
      stat("FT", "Physical performance", "Distance covered", "112974", "108367", "112974", "108367"),
    ]
    const out = shapeSoccerMatchStats(HEADER, rows, TEAMS)
    const flat = out.periods[0].groups.flatMap((g) => g.stats)
    expect(flat.find((s) => s.label === "Ball possession")).toMatchObject({ home: "46%", away: "54%" })
    expect(flat.find((s) => s.label === "Accurate passes")).toMatchObject({ home: "298 (78%)", away: "386 (82%)" })
    expect(flat.find((s) => s.label === "Distance covered")).toMatchObject({ home: "113.0 km", away: "108.4 km" })
  })

  it("header fields, logos and colors (null when espn_teams has none)", () => {
    const out = shapeSoccerMatchStats(HEADER, [stat("FT", "Top stats", "Corners", 9, 3)], TEAMS)
    expect(out).toMatchObject({
      matchKey: "eng.1/2025-26/1",
      league: "eng.1",
      leagueName: "Premier League",
      season: "2025-26",
      matchNo: 1,
      round: 1,
      matchDate: "2025-08-15",
      homeTeam: "Liverpool",
      awayTeam: "AFC Bournemouth",
      homeLogo: "https://logo/liv.png",
      awayLogo: null,
      homeColor: "c8102e",
      awayColor: null,
      hasStats: true,
    })
  })

  it("hasStats:false gives periods: []", () => {
    const out = shapeSoccerMatchStats({ ...HEADER, has_stats: false }, [stat("FT", "Top stats", "Corners", 9, 3)], [])
    expect(out.hasStats).toBe(false)
    expect(out.periods).toEqual([])
    expect(out.homeLogo).toBeNull()
  })
})

describe("buildSoccerModalData", () => {
  it("builds the modal header and the presupplied summary", () => {
    const data = shapeSoccerMatchStats(HEADER, [stat("FT", "Top stats", "Corners", 9, 3)], TEAMS)
    const { match, summary } = buildSoccerModalData(data)
    expect(match).toEqual({
      id: "soccer-eng.1/2025-26/1",
      league: "Premier League",
      sport: "Soccer",
      status: "Finished",
      homeTeam: "Liverpool",
      awayTeam: "AFC Bournemouth",
      homeScore: 4,
      awayScore: 2,
      homeLogo: "https://logo/liv.png",
      awayLogo: undefined,
      homeColor: "c8102e",
      awayColor: undefined,
    })
    expect(summary).toEqual({
      eventId: "soccer-eng.1/2025-26/1",
      boxscore: { teams: [], players: [] },
      periodStats: data.periods,
    })
  })

  it("a no-stats match still gets periodStats: [] (Match Stats tab with the empty state)", () => {
    const data = shapeSoccerMatchStats({ ...HEADER, has_stats: false }, [], [])
    expect(buildSoccerModalData(data).summary.periodStats).toEqual([])
  })
})
