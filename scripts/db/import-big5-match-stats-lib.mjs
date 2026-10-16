/**
 * Pure helpers for scripts/db/import-big5-match-stats.mjs.
 *
 * Split out because the runner reads .env.local, streams a file and talks to
 * Supabase, so a test cannot import it. Everything here is side-effect free (no
 * env reads, no I/O, nothing at top level), which lets the import's invariants
 * be unit-tested: how a CSV row is validated and classified, how values and
 * team names are normalized, exactly which columns each upserted record
 * carries, and how failures are retried.
 *
 * LEAGUE_SLUG_TO_CODE and PERIOD_MAP must match lib/soccer/big5.ts
 * (BIG5_LEAGUES / PERIOD_LABELS); the test asserts parity.
 */

/** The CSV header, in order. */
export const EXPECTED_HEADER = [
  "league", "season", "match_no", "round", "date", "home_team", "away_team", "home_score", "away_score",
  "period", "stat_group", "stat_name", "home_value", "away_value", "source",
]

/** CSV league slug -> ESPN league code. */
export const LEAGUE_SLUG_TO_CODE = {
  premier_league: "eng.1",
  la_liga: "esp.1",
  bundesliga: "ger.1",
  serie_a: "ita.1",
  ligue_1: "fra.1",
}

/** CSV period -> stored period code. */
export const PERIOD_MAP = { "FULL TIME": "FT", "1ST HALF": "1H", "2ND HALF": "2H" }

/**
 * CSV team name -> `espn_teams.name`, per league code. Every target was checked
 * against live `espn_teams`; names not listed already match exactly.
 *
 * @type {Record<string, Record<string, string>>}
 */
export const TEAM_NAME_ALIASES = {
  "esp.1": {
    "Deportivo A Coruña": "Deportivo",
    "Deportivo Alavés": "Alavés",
  },
  "ger.1": {
    "1. FC Köln": "FC Cologne",
    "Augsburg": "FC Augsburg",
    "Bayern München": "Bayern Munich",
    "Elversberg": "SV Elversberg",
    "FC Heidenheim": "1. FC Heidenheim 1846",
    "Freiburg": "SC Freiburg",
    "Hamburger SV": "Hamburg SV",
    "Hoffenheim": "TSG Hoffenheim",
    "Mainz 05": "Mainz",
    "Paderborn": "SC Paderborn 07",
    "Union Berlin": "1. FC Union Berlin",
    "Wolfsburg": "VfL Wolfsburg",
  },
  "ita.1": {
    "Inter": "Internazionale",
    "Milan": "AC Milan",
    "Roma": "AS Roma",
  },
  "fra.1": {
    "Auxerre": "AJ Auxerre",
    "Le Havre": "Le Havre AC",
    "Monaco": "AS Monaco",
    "Rennes": "Stade Rennais",
  },
}

/**
 * Split one CSV line (RFC 4180: quoted fields, `""` escapes). Every field is
 * trimmed (which also drops a trailing CR) and NFC-normalized.
 *
 * @param {string} line
 * @returns {string[]}
 */
export function parseCsvLine(line) {
  const fields = []
  let cur = ""
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ",") {
      fields.push(cur)
      cur = ""
    } else {
      cur += ch
    }
  }
  fields.push(cur)
  return fields.map((f) => f.trim().normalize("NFC"))
}

/**
 * True when `line` (BOM and trailing CR tolerated) is exactly EXPECTED_HEADER.
 *
 * @param {string} line
 */
export function isExpectedHeader(line) {
  const fields = parseCsvLine(line.replace(/^\uFEFF/, ""))
  return fields.length === EXPECTED_HEADER.length && fields.every((f, i) => f === EXPECTED_HEADER[i])
}

/**
 * @typedef {{ value: number | null, pct: number | null, kind: "na" | "num" | "num_pct" | "unparsed" }} StatValue
 */

const NUM_RE = /^-?\d+(\.\d+)?$/
const NUM_PCT_RE = /^(-?\d+(?:\.\d+)?)\s*\((\d+(?:\.\d+)?)%\)$/

/**
 * Parse one stat value. Never throws; the raw text is stored as-is elsewhere.
 *
 * @param {string} raw
 * @returns {StatValue}
 */
export function parseStatValue(raw) {
  const s = (raw ?? "").trim()
  const lower = s.toLowerCase()
  if (s === "" || lower === "n/a" || s === "-") return { value: null, pct: null, kind: "na" }
  if (NUM_RE.test(s)) return { value: Number(s), pct: null, kind: "num" }
  const m = NUM_PCT_RE.exec(s)
  if (m) return { value: Number(m[1]), pct: Number(m[2]), kind: "num_pct" }
  return { value: null, pct: null, kind: "unparsed" }
}

/**
 * Canonical (`espn_teams.name`) team name: alias if listed, otherwise the
 * NFC-normalized input.
 *
 * @param {string} leagueCode
 * @param {string} raw
 */
export function resolveTeamName(leagueCode, raw) {
  const name = String(raw).normalize("NFC")
  return TEAM_NAME_ALIASES[leagueCode]?.[name] ?? name
}

/**
 * @typedef {{
 *   league: string, league_slug: string, season: string, match_no: number, round: number | null,
 *   match_date: string, home_team_raw: string, away_team_raw: string,
 *   home_score: number, away_score: number, source: string,
 * }} RowMatch
 * @typedef {{
 *   kind: "stat", lineNo: number, match: RowMatch, period: "FT" | "1H" | "2H",
 *   stat_group: string, stat_name: string, home: StatValue, away: StatValue,
 *   home_raw: string, away_raw: string, source: string,
 * }} StatRow
 * @typedef {{ kind: "empty", lineNo: number, match: RowMatch }} EmptyRow
 * @typedef {{ kind: "reject", reason: string, lineNo: number }} RejectRow
 * @typedef {StatRow | EmptyRow | RejectRow} ParsedRow
 */

const SEASON_RE = /^(\d{4})-(\d{2})$/
const MATCH_NO_RE = /^[1-9]\d{0,3}$/
const ROUND_RE = /^[1-9]\d?$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const SCORE_RE = /^\d{1,2}$/
const MAX_TEAM_LEN = 80
const MAX_STAT_LEN = 64

/** @param {string} s */
function isValidDate(s) {
  if (!DATE_RE.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/**
 * Validate and classify one data row (already split by parseCsvLine). Match
 * fields are validated on every row, including empty ones, because empty rows
 * still record their match.
 *
 * @param {string[]} fields
 * @param {number} lineNo  1-based line number in the file (for reports)
 * @returns {ParsedRow}
 */
export function parseRow(fields, lineNo) {
  /** @param {string} reason @returns {RejectRow} */
  const reject = (reason) => ({ kind: "reject", reason, lineNo })
  if (!Array.isArray(fields) || fields.length !== EXPECTED_HEADER.length) return reject("bad_column_count")
  const [
    slug, season, matchNo, round, date, homeTeam, awayTeam, homeScore, awayScore,
    period, statGroup, statName, homeValue, awayValue, source,
  ] = fields

  const league = Object.prototype.hasOwnProperty.call(LEAGUE_SLUG_TO_CODE, slug)
    ? LEAGUE_SLUG_TO_CODE[/** @type {keyof typeof LEAGUE_SLUG_TO_CODE} */ (slug)]
    : undefined
  if (!league) return reject("unknown_league")
  const sm = SEASON_RE.exec(season)
  if (!sm || Number(sm[2]) !== (Number(sm[1]) + 1) % 100) return reject("bad_season")
  if (!MATCH_NO_RE.test(matchNo)) return reject("bad_match_no")
  if (round !== "" && !ROUND_RE.test(round)) return reject("bad_round")
  if (!isValidDate(date)) return reject("bad_date")
  if (
    homeTeam === "" || awayTeam === "" ||
    homeTeam.length > MAX_TEAM_LEN || awayTeam.length > MAX_TEAM_LEN ||
    homeTeam === awayTeam
  ) return reject("bad_team")
  if (!SCORE_RE.test(homeScore) || !SCORE_RE.test(awayScore)) return reject("bad_score")
  if (source === "") return reject("bad_source")

  /** @type {RowMatch} */
  const match = {
    league,
    league_slug: slug,
    season,
    match_no: Number(matchNo),
    round: round === "" ? null : Number(round),
    match_date: date,
    home_team_raw: homeTeam,
    away_team_raw: awayTeam,
    home_score: Number(homeScore),
    away_score: Number(awayScore),
    source,
  }

  const isEmpty =
    period === "" && statGroup === "" && homeValue === "" && awayValue === "" &&
    (statName === "" || statName.toUpperCase() === "N/A")
  if (isEmpty) return { kind: "empty", lineNo, match }

  const code = Object.prototype.hasOwnProperty.call(PERIOD_MAP, period)
    ? PERIOD_MAP[/** @type {keyof typeof PERIOD_MAP} */ (period)]
    : undefined
  if (!code) return reject("bad_period")
  if (
    statGroup === "" || statName === "" ||
    statGroup.length > MAX_STAT_LEN || statName.length > MAX_STAT_LEN
  ) return reject("bad_stat")

  return {
    kind: "stat",
    lineNo,
    match,
    period: /** @type {"FT" | "1H" | "2H"} */ (code),
    stat_group: statGroup,
    stat_name: statName,
    home: parseStatValue(homeValue),
    away: parseStatValue(awayValue),
    home_raw: homeValue,
    away_raw: awayValue,
    source,
  }
}

/**
 * Match id stored in `soccer_matches.id`.
 *
 * @param {string} leagueCode
 * @param {string} season
 * @param {number | string} matchNo
 */
export function matchId(leagueCode, season, matchNo) {
  return `${leagueCode}:${season}:${matchNo}`
}

/**
 * Natural-key dedup key of a stat row (same columns as the DB UNIQUE).
 *
 * @param {StatRow} s
 */
export function statRowKey(s) {
  return [s.match.league, s.match.season, s.match.match_no, s.period, s.stat_group, s.stat_name].join("\u0001")
}

/**
 * @typedef {{
 *   league: string, league_slug: string, season: string, match_no: number, round: number | null,
 *   match_date: string, home_team: string, away_team: string,
 *   home_team_source: string, away_team_source: string,
 *   home_score: number, away_score: number, source: string, has_stats: boolean,
 * }} MatchEntry
 * @typedef {{ id: string, lineNo: number, field: string, first: unknown, got: unknown }} MetaConflict
 */

const META_FIELDS = /** @type {const} */ ([
  ["match_date", "match_date"],
  ["home_team_raw", "home_team_source"],
  ["away_team_raw", "away_team_source"],
  ["home_score", "home_score"],
  ["away_score", "away_score"],
  ["round", "round"],
  ["source", "source"],
])

/**
 * Pass-1 match metadata. The first row of a match sets it (team names resolved
 * to canonical there); a later row that disagrees is a fatal meta conflict.
 */
export class MatchCollector {
  constructor() {
    /** @type {Map<string, MatchEntry>} */
    this.matches = new Map()
    /** @type {MetaConflict[]} */
    this.conflicts = []
  }

  /**
   * Record the match of a stat or empty row.
   *
   * @param {StatRow | EmptyRow} row
   * @returns {MetaConflict | null}  the conflict, if this row disagrees with the first
   */
  add(row) {
    const r = row.match
    const id = matchId(r.league, r.season, r.match_no)
    let entry = this.matches.get(id)
    if (!entry) {
      entry = {
        league: r.league,
        league_slug: r.league_slug,
        season: r.season,
        match_no: r.match_no,
        round: r.round,
        match_date: r.match_date,
        home_team: resolveTeamName(r.league, r.home_team_raw),
        away_team: resolveTeamName(r.league, r.away_team_raw),
        home_team_source: r.home_team_raw,
        away_team_source: r.away_team_raw,
        home_score: r.home_score,
        away_score: r.away_score,
        source: r.source,
        has_stats: false,
      }
      this.matches.set(id, entry)
    } else {
      for (const [rowField, entryField] of META_FIELDS) {
        if (r[rowField] !== entry[entryField]) {
          const conflict = { id, lineNo: row.lineNo, field: entryField, first: entry[entryField], got: r[rowField] }
          this.conflicts.push(conflict)
          return conflict
        }
      }
    }
    if (row.kind === "stat") entry.has_stats = true
    return null
  }

  /** @param {string} id */
  get(id) {
    return this.matches.get(id)
  }

  get size() {
    return this.matches.size
  }

  /** @returns {MatchEntry[]} */
  values() {
    return [...this.matches.values()]
  }
}

/**
 * `soccer_matches` row. `id` is always set (TEXT PK, no default).
 *
 * @param {MatchEntry} m
 * @param {string} importedAt  one ISO timestamp per run
 */
export function toMatchRecord(m, importedAt) {
  return {
    id: matchId(m.league, m.season, m.match_no), league: m.league, league_slug: m.league_slug,
    season: m.season, match_no: m.match_no, round: m.round, match_date: m.match_date,
    home_team: m.home_team, away_team: m.away_team,
    home_team_source: m.home_team_source, away_team_source: m.away_team_source,
    home_score: m.home_score, away_score: m.away_score, source: m.source,
    has_stats: m.has_stats, imported_at: importedAt,
  }
}

/**
 * `soccer_match_stats` row. No `id` (identity column). Match-level fields come
 * from the collector entry `m` (canonical names), never from the raw CSV row.
 *
 * @param {StatRow} s
 * @param {MatchEntry} m
 * @param {string} importedAt
 */
export function toStatRecord(s, m, importedAt) {
  return {
    league: m.league, league_slug: m.league_slug, season: m.season, match_no: m.match_no,
    round: m.round, match_date: m.match_date, home_team: m.home_team, away_team: m.away_team,
    home_score: m.home_score, away_score: m.away_score, period: s.period,
    stat_group: s.stat_group, stat_name: s.stat_name,
    home_value: s.home.value, away_value: s.away.value, home_pct: s.home.pct, away_pct: s.away.pct,
    home_raw: s.home_raw, away_raw: s.away_raw, source: s.source, imported_at: importedAt,
  }
}

/** Sleeps between attempts: 1 s, 2 s, 4 s. */
export const RETRY_DELAYS_MS = [1000, 2000, 4000]

/** @param {number} ms */
const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Run `fn` up to 4 times (1 initial + 3 retries), sleeping 1 s / 2 s / 4 s
 * between attempts. Throws the last error.
 *
 * @template T
 * @param {(attempt: number) => Promise<T>} fn
 * @param {{ delays?: number[], sleep?: (ms: number) => Promise<unknown> }} [opts]
 * @returns {Promise<T>}
 */
export async function withRetry(fn, opts = {}) {
  const delays = opts.delays ?? RETRY_DELAYS_MS
  const sleep = opts.sleep ?? defaultSleep
  let lastError
  for (let attempt = 1; attempt <= delays.length + 1; attempt++) {
    try {
      return await fn(attempt)
    } catch (e) {
      lastError = e
      if (attempt <= delays.length) await sleep(delays[attempt - 1])
    }
  }
  throw lastError
}

export const DEFAULT_CSV = "lib/data/big5_detailed_stats_all.csv"

/**
 * @param {string} flag
 * @param {string | undefined} raw
 * @param {number} min
 * @param {number} max
 */
function intFlag(flag, raw, min, max) {
  if (raw === undefined || !/^\d+$/.test(raw)) throw new Error(`${flag} needs an integer between ${min} and ${max}`)
  const n = Number(raw)
  if (n < min || n > max) throw new Error(`${flag} must be between ${min} and ${max} (got ${raw})`)
  return n
}

/**
 * Parse CLI flags.
 *
 * @param {string[]} argv  process.argv.slice(2)
 * @returns {{ file: string, dryRun: boolean, batchSize: number, concurrency: number, allowUnmatched: boolean }}
 * @throws {Error} on an unknown flag, a missing value or an out-of-range number
 */
export function parseArgs(argv) {
  const args = { file: DEFAULT_CSV, dryRun: false, batchSize: 1000, concurrency: 4, allowUnmatched: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--dry-run") args.dryRun = true
    else if (a === "--allow-unmatched") args.allowUnmatched = true
    else if (a === "--file") {
      const v = argv[++i]
      if (!v || v.startsWith("--")) throw new Error("--file needs a path")
      args.file = v
    } else if (a === "--batch-size") args.batchSize = intFlag(a, argv[++i], 1, 1000)
    else if (a === "--concurrency") args.concurrency = intFlag(a, argv[++i], 1, 8)
    else throw new Error(`unknown flag: ${a}`)
  }
  return args
}

/**
 * Per league x season match counts with the source split, in BIG-5 code order
 * then season order.
 *
 * @param {MatchEntry[]} matches
 */
export function leagueSeasonTable(matches) {
  const order = Object.values(LEAGUE_SLUG_TO_CODE)
  /** @type {Map<string, { league: string, season: string, matches: number, withStats: number, FotMob: number, AiScore: number, NA: number, other: number }>} */
  const rows = new Map()
  for (const m of matches) {
    const key = `${m.league}\u0001${m.season}`
    let r = rows.get(key)
    if (!r) {
      r = { league: m.league, season: m.season, matches: 0, withStats: 0, FotMob: 0, AiScore: 0, NA: 0, other: 0 }
      rows.set(key, r)
    }
    r.matches++
    if (m.has_stats) r.withStats++
    if (m.source === "FotMob") r.FotMob++
    else if (m.source === "AiScore") r.AiScore++
    else if (m.source === "N/A") r.NA++
    else r.other++
  }
  return [...rows.values()].sort(
    (a, b) => order.indexOf(a.league) - order.indexOf(b.league) || a.season.localeCompare(b.season),
  )
}

/** @param {number} n */
const fmt = (n) => n.toLocaleString("en-US")

/**
 * @typedef {{
 *   dryRun: boolean,
 *   dataRows: number,
 *   skippedEmpty: number,
 *   statRows: { FT: number, "1H": number, "2H": number },
 *   rejected: { count: number, byReason: Record<string, number>, examples: RejectRow[] },
 *   duplicates: number,
 *   naValues: number,
 *   unparsed: { count: number, examples: Array<{ lineNo: number, raw: string }> },
 *   conflicts: MetaConflict[],
 *   teamValidation: "ok" | "skipped" | string,
 *   unmatched: Array<{ league: string, raw: string, resolved: string }>,
 *   matches: MatchEntry[],
 *   matchesUpserted: number,
 *   statRowsUpserted: number,
 *   elapsedMs: number,
 * }} ImportReport
 */

/**
 * Human-readable run report (stdout).
 *
 * @param {ImportReport} r
 * @returns {string}
 */
export function formatReport(r) {
  const totalStat = r.statRows.FT + r.statRows["1H"] + r.statRows["2H"]
  const withStats = r.matches.filter((m) => m.has_stats).length
  const lines = []
  lines.push(`Big-5 match stats import${r.dryRun ? " (dry run: nothing written)" : ""}`)
  lines.push(`  data rows        ${fmt(r.dataRows)}`)
  lines.push(`  skipped empty    ${fmt(r.skippedEmpty)}`)
  lines.push(
    `  stat rows        ${fmt(totalStat)} (FT ${fmt(r.statRows.FT)} / 1H ${fmt(r.statRows["1H"])} / 2H ${fmt(r.statRows["2H"])})`,
  )
  lines.push(`  rejected         ${fmt(r.rejected.count)}`)
  for (const [reason, n] of Object.entries(r.rejected.byReason)) lines.push(`    ${reason}: ${fmt(n)}`)
  for (const ex of r.rejected.examples.slice(0, 10)) lines.push(`    line ${ex.lineNo}: ${ex.reason}`)
  lines.push(`  duplicates       ${fmt(r.duplicates)}`)
  lines.push(`  n/a values       ${fmt(r.naValues)}`)
  lines.push(`  unparsed values  ${fmt(r.unparsed.count)}`)
  for (const ex of r.unparsed.examples.slice(0, 10)) lines.push(`    line ${ex.lineNo}: ${JSON.stringify(ex.raw)}`)
  lines.push(`  meta conflicts   ${fmt(r.conflicts.length)}`)
  for (const c of r.conflicts.slice(0, 10)) {
    lines.push(`    line ${c.lineNo}: ${c.id} ${c.field} ${JSON.stringify(c.first)} vs ${JSON.stringify(c.got)}`)
  }
  lines.push(`  matches          ${fmt(r.matches.length)} (${fmt(withStats)} with stats)`)
  if (r.teamValidation === "skipped") {
    lines.push("  unmatched teams  n/a (team validation skipped: no Supabase env)")
  } else if (r.teamValidation !== "ok") {
    lines.push(`  unmatched teams  n/a (team validation skipped: ${r.teamValidation})`)
  } else {
    lines.push(`  unmatched teams  ${fmt(r.unmatched.length)}`)
  }
  for (const u of r.unmatched) lines.push(`    ${u.league}: ${JSON.stringify(u.raw)} -> ${JSON.stringify(u.resolved)}`)

  const table = leagueSeasonTable(r.matches)
  const hasOther = table.some((t) => t.other > 0)
  lines.push("")
  lines.push(
    `  league  season   matches  with stats  FotMob  AiScore  N/A${hasOther ? "  other" : ""}`,
  )
  for (const t of table) {
    lines.push(
      `  ${t.league.padEnd(6)}  ${t.season.padEnd(7)}  ${String(t.matches).padStart(7)}  ${String(t.withStats).padStart(10)}  ` +
        `${String(t.FotMob).padStart(6)}  ${String(t.AiScore).padStart(7)}  ${String(t.NA).padStart(3)}` +
        (hasOther ? `  ${String(t.other).padStart(5)}` : ""),
    )
  }
  lines.push("")
  lines.push(`  matches upserted    ${fmt(r.matchesUpserted)}`)
  lines.push(`  stat rows upserted  ${fmt(r.statRowsUpserted)}`)
  lines.push(`  elapsed             ${(r.elapsedMs / 1000).toFixed(1)} s`)
  return lines.join("\n")
}
