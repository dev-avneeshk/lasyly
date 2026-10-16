import { afterEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"
import {
  DEFAULT_CSV,
  EXPECTED_HEADER,
  LEAGUE_SLUG_TO_CODE,
  MatchCollector,
  PERIOD_MAP,
  TEAM_NAME_ALIASES,
  formatReport,
  isExpectedHeader,
  leagueSeasonTable,
  matchId,
  parseArgs,
  parseCsvLine,
  parseRow,
  parseStatValue,
  resolveTeamName,
  statRowKey,
  toMatchRecord,
  toStatRecord,
  withRetry,
} from "@/scripts/db/import-big5-match-stats-lib.mjs"
import { BIG5_LEAGUES, BIG5_LEAGUE_CODES, PERIOD_LABELS } from "@/lib/soccer/big5"

type Fields = Record<(typeof EXPECTED_HEADER)[number], string>

const BASE: Fields = {
  league: "bundesliga",
  season: "2026-27",
  match_no: "1",
  round: "1",
  date: "2026-08-21",
  home_team: "Bayern München",
  away_team: "Freiburg",
  home_score: "3",
  away_score: "1",
  period: "FULL TIME",
  stat_group: "Top stats",
  stat_name: "Corners",
  home_value: "7",
  away_value: "2",
  source: "FotMob",
}
const fields = (over: Partial<Fields> = {}): string[] =>
  EXPECTED_HEADER.map((h) => ({ ...BASE, ...over } as Record<string, string>)[h])
const row = (over: Partial<Fields> = {}, lineNo = 2) => parseRow(fields(over), lineNo)
const EMPTY = { period: "", stat_group: "", stat_name: "N/A", home_value: "", away_value: "", source: "N/A" }

function statRow(over: Partial<Fields> = {}) {
  const r = row(over)
  if (r.kind !== "stat") throw new Error(`expected stat row, got ${r.kind}`)
  return r
}

describe("parseCsvLine", () => {
  it("splits a plain line and trims fields", () => {
    expect(parseCsvLine("a, b ,c")).toEqual(["a", "b", "c"])
  })
  it("handles a quoted comma and escaped quotes", () => {
    expect(parseCsvLine('x,"Brighton, Hove",z')).toEqual(["x", "Brighton, Hove", "z"])
    expect(parseCsvLine('"say ""hi""",2')).toEqual(['say "hi"', "2"])
    expect(parseCsvLine('"",a')).toEqual(["", "a"])
  })
  it("drops a trailing CR (CRLF files)", () => {
    expect(parseCsvLine("a,b\r")).toEqual(["a", "b"])
  })
  it("NFC-normalizes fields", () => {
    expect(parseCsvLine("Bayern Mu\u0308nchen,x")[0]).toBe("Bayern M\u00fcnchen")
  })
})

describe("header check", () => {
  const header = EXPECTED_HEADER.join(",")
  it("accepts the header with a trailing CR or a BOM", () => {
    expect(EXPECTED_HEADER).toHaveLength(15)
    expect(isExpectedHeader(header)).toBe(true)
    expect(isExpectedHeader(`${header}\r`)).toBe(true)
    expect(isExpectedHeader(`\uFEFF${header}\r`)).toBe(true)
  })
  it("rejects a reordered or short header", () => {
    expect(isExpectedHeader(header.replace("home_team,away_team", "away_team,home_team"))).toBe(false)
    expect(isExpectedHeader(EXPECTED_HEADER.slice(0, 14).join(","))).toBe(false)
  })
})

describe("parseStatValue", () => {
  it.each([
    ["9", { value: 9, pct: null, kind: "num" }],
    ["0.79", { value: 0.79, pct: null, kind: "num" }],
    ["112974", { value: 112974, pct: null, kind: "num" }],
    ["-1", { value: -1, pct: null, kind: "num" }],
    ["298 (78%)", { value: 298, pct: 78, kind: "num_pct" }],
    ["5(41.5%)", { value: 5, pct: 41.5, kind: "num_pct" }],
    ["n/a", { value: null, pct: null, kind: "na" }],
    ["N/A", { value: null, pct: null, kind: "na" }],
    ["", { value: null, pct: null, kind: "na" }],
    ["-", { value: null, pct: null, kind: "na" }],
    ["abc", { value: null, pct: null, kind: "unparsed" }],
    ["1e3", { value: null, pct: null, kind: "unparsed" }],
  ])("%j", (raw, expected) => {
    expect(parseStatValue(raw)).toEqual(expected)
  })
})

describe("parseRow", () => {
  it("parses a stat row and maps league and period", () => {
    const r = statRow()
    expect(r.match).toEqual({
      league: "ger.1", league_slug: "bundesliga", season: "2026-27", match_no: 1, round: 1, match_date: "2026-08-21",
      home_team_raw: "Bayern München", away_team_raw: "Freiburg", home_score: 3, away_score: 1, source: "FotMob",
    })
    expect(r).toMatchObject({ kind: "stat", period: "FT", stat_group: "Top stats", stat_name: "Corners", home_raw: "7", away_raw: "2" })
    expect(r.home).toEqual({ value: 7, pct: null, kind: "num" })
    expect(statRow({ period: "1ST HALF" }).period).toBe("1H")
    expect(statRow({ period: "2ND HALF" }).period).toBe("2H")
    expect(statRow({ round: "" }).match.round).toBeNull()
  })

  it.each<[string, Partial<Fields>]>([
    ["unknown_league", { league: "eredivisie" }],
    ["unknown_league", { league: "toString" }],
    ["bad_season", { season: "2026-28" }],
    ["bad_season", { season: "2026" }],
    ["bad_match_no", { match_no: "0" }],
    ["bad_match_no", { match_no: "045" }],
    ["bad_match_no", { match_no: "10000" }],
    ["bad_round", { round: "0" }],
    ["bad_round", { round: "100" }],
    ["bad_date", { date: "2026-02-30" }],
    ["bad_date", { date: "21/08/2026" }],
    ["bad_team", { home_team: "" }],
    ["bad_team", { away_team: "Bayern München" }],
    ["bad_team", { home_team: "x".repeat(81) }],
    ["bad_score", { home_score: "-1" }],
    ["bad_score", { away_score: "100" }],
    ["bad_period", { period: "EXTRA TIME" }],
    ["bad_period", { period: "full time" }],
    ["bad_stat", { stat_group: "" }],
    ["bad_stat", { stat_name: "y".repeat(65) }],
    ["bad_source", { source: "" }],
  ])("rejects %s (%j)", (reason, over) => {
    expect(row(over, 42)).toEqual({ kind: "reject", reason, lineNo: 42 })
  })

  it("rejects a wrong column count", () => {
    expect(parseRow(fields().slice(0, 14), 7)).toEqual({ kind: "reject", reason: "bad_column_count", lineNo: 7 })
    expect(parseRow([""], 8)).toEqual({ kind: "reject", reason: "bad_column_count", lineNo: 8 })
  })

  it("classifies the real 139-row empty shape as empty and keeps its match", () => {
    const r = row(EMPTY)
    expect(r.kind).toBe("empty")
    if (r.kind === "empty") expect(r.match).toMatchObject({ league: "ger.1", match_no: 1, source: "N/A" })
    expect(row({ ...EMPTY, stat_name: "" }).kind).toBe("empty")
    expect(row({ ...EMPTY, stat_name: "n/a" }).kind).toBe("empty")
  })

  it("rejects a blank period with values or a real stat name as bad_period", () => {
    expect(row({ ...EMPTY, home_value: "3" })).toMatchObject({ kind: "reject", reason: "bad_period" })
    expect(row({ ...EMPTY, stat_name: "Corners" })).toMatchObject({ kind: "reject", reason: "bad_period" })
    expect(row({ ...EMPTY, stat_group: "Top stats" })).toMatchObject({ kind: "reject", reason: "bad_period" })
  })

  it("still validates match fields on empty rows", () => {
    expect(row({ ...EMPTY, home_score: "x" })).toMatchObject({ kind: "reject", reason: "bad_score" })
  })
})

describe("resolveTeamName", () => {
  const expected: Array<[string, string, string]> = [
    ["esp.1", "Deportivo A Coruña", "Deportivo"],
    ["esp.1", "Deportivo Alavés", "Alavés"],
    ["ger.1", "1. FC Köln", "FC Cologne"],
    ["ger.1", "Augsburg", "FC Augsburg"],
    ["ger.1", "Bayern München", "Bayern Munich"],
    ["ger.1", "Elversberg", "SV Elversberg"],
    ["ger.1", "FC Heidenheim", "1. FC Heidenheim 1846"],
    ["ger.1", "Freiburg", "SC Freiburg"],
    ["ger.1", "Hamburger SV", "Hamburg SV"],
    ["ger.1", "Hoffenheim", "TSG Hoffenheim"],
    ["ger.1", "Mainz 05", "Mainz"],
    ["ger.1", "Paderborn", "SC Paderborn 07"],
    ["ger.1", "Union Berlin", "1. FC Union Berlin"],
    ["ger.1", "Wolfsburg", "VfL Wolfsburg"],
    ["ita.1", "Inter", "Internazionale"],
    ["ita.1", "Milan", "AC Milan"],
    ["ita.1", "Roma", "AS Roma"],
    ["fra.1", "Auxerre", "AJ Auxerre"],
    ["fra.1", "Le Havre", "Le Havre AC"],
    ["fra.1", "Monaco", "AS Monaco"],
    ["fra.1", "Rennes", "Stade Rennais"],
  ]

  it("maps all 21 aliases (and the table has exactly these)", () => {
    for (const [league, raw, name] of expected) expect(resolveTeamName(league, raw), raw).toBe(name)
    const all = Object.entries(TEAM_NAME_ALIASES).flatMap(([league, m]) => Object.entries(m).map(([raw, name]) => [league, raw, name]))
    expect(all).toHaveLength(21)
    expect(new Set(all.map((a) => a.join("|")))).toEqual(new Set(expected.map((a) => a.join("|"))))
  })

  it("passes unlisted names through, per league", () => {
    expect(resolveTeamName("eng.1", "Arsenal")).toBe("Arsenal")
    expect(resolveTeamName("eng.1", "Inter")).toBe("Inter")
  })

  it("NFC-normalizes before the lookup", () => {
    expect(resolveTeamName("ger.1", "Bayern Mu\u0308nchen")).toBe("Bayern Munich")
    expect(resolveTeamName("eng.1", "Atle\u0301tico")).toBe("Atl\u00e9tico")
  })
})

describe("MatchCollector", () => {
  it("records one entry per match with canonical names and has_stats", () => {
    const c = new MatchCollector()
    const empty = row({ ...EMPTY, match_no: "2" })
    if (empty.kind === "reject") throw new Error("unexpected reject")
    expect(c.add(empty)).toBeNull()
    expect(c.add(statRow())).toBeNull()
    expect(c.add(statRow({ period: "1ST HALF" }))).toBeNull()
    expect(c.size).toBe(2)
    const m = c.get(matchId("ger.1", "2026-27", 1))
    expect(m).toMatchObject({ home_team: "Bayern Munich", away_team: "SC Freiburg", home_team_source: "Bayern München", has_stats: true })
    expect(c.get(matchId("ger.1", "2026-27", 2))?.has_stats).toBe(false)
    expect(c.conflicts).toEqual([])
  })

  it("flags a later row with different metadata as a meta conflict", () => {
    const c = new MatchCollector()
    c.add(statRow())
    const conflict = c.add(statRow({ home_score: "4" }))
    expect(conflict).toMatchObject({ id: "ger.1:2026-27:1", field: "home_score", first: 3, got: 4 })
    expect(c.add(statRow({ date: "2026-08-22" }))).toMatchObject({ field: "match_date" })
    expect(c.add(statRow({ source: "AiScore" }))).toMatchObject({ field: "source" })
    expect(c.conflicts).toHaveLength(3)
  })
})

describe("statRowKey", () => {
  it("is the natural key, so only true duplicates collide", () => {
    const a = statRow()
    expect(statRowKey(a)).toBe(["ger.1", "2026-27", 1, "FT", "Top stats", "Corners"].join("\u0001"))
    expect(statRowKey(statRow({ home_value: "9" }))).toBe(statRowKey(a))
    expect(statRowKey(statRow({ period: "1ST HALF" }))).not.toBe(statRowKey(a))
    expect(statRowKey(statRow({ stat_group: "Passes", stat_name: "Accurate passes" }))).not.toBe(
      statRowKey(statRow({ stat_group: "Top stats", stat_name: "Accurate passes" })),
    )
  })
})

describe("record builders", () => {
  const importedAt = "2026-10-16T12:00:00.000Z"
  const collect = () => {
    const c = new MatchCollector()
    const s = statRow({ home_value: "298 (78%)", away_value: "n/a" })
    c.add(s)
    return { s, m: c.get(matchId("ger.1", "2026-27", 1))! }
  }
  const migration = readFileSync(path.resolve(__dirname, "../../supabase/migrations/20261016_soccer_match_stats.sql"), "utf8")
  const columnsOf = (table: string) => {
    const body = migration.match(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table} \\(([\\s\\S]*?)\\n\\);`))?.[1] ?? ""
    return body
      .split("\n")
      .map((l) => l.trim().match(/^([a-z_]+)\s+[A-Z]/)?.[1])
      .filter((c): c is string => !!c && c !== "CONSTRAINT")
  }

  it("toMatchRecord sets id and canonical names, with every soccer_matches column", () => {
    const { m } = collect()
    const rec = toMatchRecord(m, importedAt)
    expect(rec).toMatchObject({
      id: "ger.1:2026-27:1", home_team: "Bayern Munich", away_team: "SC Freiburg",
      home_team_source: "Bayern München", away_team_source: "Freiburg", has_stats: true, imported_at: importedAt,
    })
    expect(Object.keys(rec).sort()).toEqual(columnsOf("soccer_matches").sort())
  })

  it("toStatRecord has no id, canonical names from the collector, and exactly the soccer_match_stats columns minus id", () => {
    const { s, m } = collect()
    const rec = toStatRecord(s, m, importedAt)
    expect(rec).not.toHaveProperty("id")
    expect(rec).toMatchObject({
      home_team: "Bayern Munich", away_team: "SC Freiburg", period: "FT", stat_group: "Top stats", stat_name: "Corners",
      home_value: 298, home_pct: 78, away_value: null, away_pct: null, home_raw: "298 (78%)", away_raw: "n/a",
    })
    const cols = columnsOf("soccer_match_stats")
    expect(cols).toContain("id")
    expect(Object.keys(rec).sort()).toEqual(cols.filter((c) => c !== "id").sort())
  })
})

describe("withRetry", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("succeeds on attempt 4 after 3 failures, sleeping 1 s / 2 s / 4 s", async () => {
    vi.useFakeTimers()
    let calls = 0
    const fn = vi.fn(async () => {
      calls++
      if (calls < 4) throw new Error(`fail ${calls}`)
      return "ok"
    })
    const p = withRetry(fn)
    await vi.advanceTimersByTimeAsync(0)
    expect(fn).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(999)
    expect(fn).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fn).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1999)
    expect(fn).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(fn).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(3999)
    expect(fn).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(1)
    await expect(p).resolves.toBe("ok")
    expect(fn).toHaveBeenCalledTimes(4)
  })

  it("throws the last error after 4 failures", async () => {
    vi.useFakeTimers()
    let calls = 0
    const p = withRetry(async () => {
      calls++
      throw new Error(`fail ${calls}`)
    })
    const settled = expect(p).rejects.toThrow("fail 4")
    await vi.advanceTimersByTimeAsync(7000)
    await settled
    expect(calls).toBe(4)
  })
})

describe("parseArgs", () => {
  it("defaults", () => {
    expect(parseArgs([])).toEqual({ file: DEFAULT_CSV, dryRun: false, batchSize: 1000, concurrency: 4, allowUnmatched: false })
  })
  it("reads every flag", () => {
    expect(
      parseArgs(["--file", "/abs/x.csv", "--dry-run", "--batch-size", "500", "--concurrency", "8", "--allow-unmatched"]),
    ).toEqual({ file: "/abs/x.csv", dryRun: true, batchSize: 500, concurrency: 8, allowUnmatched: true })
  })
  it("enforces bounds", () => {
    expect(parseArgs(["--batch-size", "1"]).batchSize).toBe(1)
    expect(() => parseArgs(["--batch-size", "0"])).toThrow(/--batch-size/)
    expect(() => parseArgs(["--batch-size", "1001"])).toThrow(/--batch-size/)
    expect(() => parseArgs(["--batch-size", "1.5"])).toThrow(/--batch-size/)
    expect(() => parseArgs(["--concurrency", "0"])).toThrow(/--concurrency/)
    expect(() => parseArgs(["--concurrency", "9"])).toThrow(/--concurrency/)
    expect(() => parseArgs(["--concurrency"])).toThrow(/--concurrency/)
    expect(() => parseArgs(["--file"])).toThrow(/--file/)
  })
  it("throws on an unknown flag", () => {
    expect(() => parseArgs(["--bogus"])).toThrow("unknown flag: --bogus")
  })
})

describe("formatReport", () => {
  it("prints the counts and the per-league x season table with the source split", () => {
    const c = new MatchCollector()
    c.add(statRow())
    c.add(statRow({ match_no: "2", source: "AiScore" }))
    const empty = row({ ...EMPTY, match_no: "3" })
    if (empty.kind === "reject") throw new Error("unexpected reject")
    c.add(empty)
    c.add(statRow({ league: "premier_league", season: "2025-26", home_team: "Arsenal", away_team: "Chelsea" }))
    const matches = c.values()
    expect(leagueSeasonTable(matches)).toEqual([
      { league: "eng.1", season: "2025-26", matches: 1, withStats: 1, FotMob: 1, AiScore: 0, NA: 0, other: 0 },
      { league: "ger.1", season: "2026-27", matches: 3, withStats: 2, FotMob: 1, AiScore: 1, NA: 1, other: 0 },
    ])
    const out = formatReport({
      dryRun: true,
      dataRows: 214224,
      skippedEmpty: 139,
      statRows: { FT: 71740, "1H": 71280, "2H": 71065 },
      rejected: { count: 0, byReason: {}, examples: [] },
      duplicates: 0,
      naValues: 26,
      unparsed: { count: 0, examples: [] },
      conflicts: [],
      teamValidation: "ok",
      unmatched: [],
      matches,
      matchesUpserted: 0,
      statRowsUpserted: 0,
      elapsedMs: 1234,
    })
    expect(out).toContain("dry run")
    expect(out).toMatch(/data rows\s+214,224/)
    expect(out).toMatch(/skipped empty\s+139/)
    expect(out).toContain("214,085 (FT 71,740 / 1H 71,280 / 2H 71,065)")
    expect(out).toMatch(/n\/a values\s+26/)
    expect(out).toMatch(/matches\s+4 \(3 with stats\)/)
    expect(out).toMatch(/unmatched teams\s+0/)
    expect(out).toMatch(/league\s+season\s+matches\s+with stats\s+FotMob\s+AiScore\s+N\/A/)
    expect(out).toMatch(/ger\.1\s+2026-27\s+3\s+2\s+1\s+1\s+1/)
    expect(out).toMatch(/eng\.1\s+2025-26\s+1\s+1\s+1\s+0\s+0/)
  })

  it("lists unmatched teams and reject reasons", () => {
    const out = formatReport({
      dryRun: false,
      dataRows: 2,
      skippedEmpty: 0,
      statRows: { FT: 1, "1H": 0, "2H": 0 },
      rejected: { count: 1, byReason: { bad_period: 1 }, examples: [{ kind: "reject", reason: "bad_period", lineNo: 3 }] },
      duplicates: 0,
      naValues: 0,
      unparsed: { count: 0, examples: [] },
      conflicts: [],
      teamValidation: "ok",
      unmatched: [{ league: "ger.1", raw: "Bayern", resolved: "Bayern" }],
      matches: [],
      matchesUpserted: 0,
      statRowsUpserted: 0,
      elapsedMs: 0,
    })
    expect(out).toContain("bad_period: 1")
    expect(out).toContain("line 3: bad_period")
    expect(out).toContain('ger.1: "Bayern" -> "Bayern"')
  })
})

describe("parity with lib/soccer/big5", () => {
  it("league slugs and codes match the TS catalogue", () => {
    expect(Object.values(LEAGUE_SLUG_TO_CODE)).toEqual([...BIG5_LEAGUE_CODES])
    expect(Object.entries(LEAGUE_SLUG_TO_CODE)).toEqual(BIG5_LEAGUES.map((l) => [l.slug, l.code]))
    expect(Object.keys(TEAM_NAME_ALIASES).every((code) => (BIG5_LEAGUE_CODES as readonly string[]).includes(code))).toBe(true)
  })
  it("period codes match PERIOD_LABELS", () => {
    expect(Object.values(PERIOD_MAP)).toEqual(Object.keys(PERIOD_LABELS))
  })
})
