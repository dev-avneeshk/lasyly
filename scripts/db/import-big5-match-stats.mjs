#!/usr/bin/env node
/**
 * Import the Big-5 detailed match-stats CSV into public.soccer_matches and
 * public.soccer_match_stats (supabase/migrations/20261016_soccer_match_stats.sql).
 *
 * Usage (cwd = repo root):
 *   node scripts/db/import-big5-match-stats.mjs --file <abs csv> [--dry-run]
 *     [--batch-size 1000] [--concurrency 4] [--allow-unmatched]
 *
 * Streams the file twice:
 *   pass 1  validate every row, collect one entry per match (canonical team
 *           names), count everything; then check every resolved team name
 *           against espn_teams (read-only, also in --dry-run when env exists)
 *   pass 2  (write mode only) upsert matches first (the FK needs them), then
 *           stream stat rows in batches with bounded concurrency
 *
 * Idempotent: both upserts target the natural keys, so re-running leaves row
 * counts unchanged. Nothing is pruned. Never prints env values; errors log
 * their message only. Pure logic lives in import-big5-match-stats-lib.mjs.
 *
 * Exit codes: 0 ok; 1 bad args / missing file / bad header / missing env in
 * write mode / any rejected row, meta conflict or unmatched team (dry run
 * included) / espn_teams read error in write mode / failed batch.
 */
import { createReadStream, existsSync } from "node:fs"
import path from "node:path"
import { createInterface } from "node:readline"
import { config } from "dotenv"
import { createClient } from "@supabase/supabase-js"
import {
  MatchCollector,
  formatReport,
  isExpectedHeader,
  matchId,
  parseArgs,
  parseCsvLine,
  parseRow,
  statRowKey,
  toMatchRecord,
  toStatRecord,
  withRetry,
} from "./import-big5-match-stats-lib.mjs"

const BIG5_CODES = ["eng.1", "esp.1", "ger.1", "ita.1", "fra.1"]
const MATCH_CONFLICT = "league,season,match_no"
const STAT_CONFLICT = "league,season,match_no,period,stat_group,stat_name"

/** @param {string} msg */
function fail(msg) {
  console.error(msg)
  process.exit(1)
}

/** @param {unknown} e */
const messageOf = (e) => (e instanceof Error ? e.message : String(e))

/**
 * Stream the CSV, checking the header, and call `onRow(parsed)` for every data
 * line. `onRow` may return a promise; the stream is paused while it's pending.
 *
 * @param {string} file
 * @param {(row: import("./import-big5-match-stats-lib.mjs").ParsedRow) => void | Promise<void>} onRow
 */
async function streamRows(file, onRow) {
  const rl = createInterface({ input: createReadStream(file, "utf8"), crlfDelay: Infinity })
  let lineNo = 0
  for await (const line of rl) {
    lineNo++
    if (lineNo === 1) {
      if (!isExpectedHeader(line)) {
        rl.close()
        fail("Unexpected CSV header")
      }
      continue
    }
    const pending = onRow(parseRow(parseCsvLine(line), lineNo))
    if (pending) {
      rl.pause()
      await pending
      rl.resume()
    }
  }
  return lineNo
}

async function main() {
  const started = Date.now()
  let args
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (e) {
    fail(messageOf(e))
  }
  const file = path.resolve(args.file)
  if (!existsSync(file)) fail(`CSV not found: ${file}`)

  config({ path: ".env.local", quiet: true })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!args.dryRun && (!url || !key)) {
    fail("missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)")
  }
  const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null

  // ── Pass 1: validate, collect matches, count ──────────────────────────────
  const collector = new MatchCollector()
  const seen = new Set()
  const report = {
    dryRun: args.dryRun,
    dataRows: 0,
    skippedEmpty: 0,
    statRows: { FT: 0, "1H": 0, "2H": 0 },
    rejected: { count: 0, byReason: /** @type {Record<string, number>} */ ({}), examples: /** @type {any[]} */ ([]) },
    duplicates: 0,
    naValues: 0,
    unparsed: { count: 0, examples: /** @type {Array<{ lineNo: number, raw: string }>} */ ([]) },
    conflicts: collector.conflicts,
    teamValidation: "ok",
    unmatched: /** @type {Array<{ league: string, raw: string, resolved: string }>} */ ([]),
    matches: /** @type {any[]} */ ([]),
    matchesUpserted: 0,
    statRowsUpserted: 0,
    elapsedMs: 0,
  }

  await streamRows(file, (row) => {
    report.dataRows++
    if (row.kind === "reject") {
      report.rejected.count++
      report.rejected.byReason[row.reason] = (report.rejected.byReason[row.reason] ?? 0) + 1
      if (report.rejected.examples.length < 10) report.rejected.examples.push(row)
      return
    }
    collector.add(row)
    if (row.kind === "empty") {
      report.skippedEmpty++
      return
    }
    report.statRows[row.period]++
    const k = statRowKey(row)
    if (seen.has(k)) {
      report.duplicates++
      if (report.duplicates <= 10) console.warn(`duplicate stat row at line ${row.lineNo}; first occurrence wins`)
    } else {
      seen.add(k)
    }
    for (const [side, raw] of [[row.home, row.home_raw], [row.away, row.away_raw]]) {
      const v = /** @type {import("./import-big5-match-stats-lib.mjs").StatValue} */ (side)
      if (v.kind === "na") report.naValues++
      else if (v.kind === "unparsed") {
        report.unparsed.count++
        if (report.unparsed.examples.length < 10) {
          report.unparsed.examples.push({ lineNo: row.lineNo, raw: /** @type {string} */ (raw) })
        }
      }
    }
  })
  seen.clear()
  report.matches = collector.values()

  // ── Team validation (read-only) ───────────────────────────────────────────
  let teamReadError = null
  if (!supabase) {
    report.teamValidation = "skipped"
    console.log("team validation skipped: no Supabase env")
  } else {
    const { data, error } = await supabase.from("espn_teams").select("name, league").in("league", BIG5_CODES).range(0, 9999)
    if (error) {
      teamReadError = error.message
      report.teamValidation = `espn_teams read failed: ${error.message}`
    } else {
      /** @type {Map<string, Set<string>>} */
      const byLeague = new Map()
      for (const t of data ?? []) {
        if (!byLeague.has(t.league)) byLeague.set(t.league, new Set())
        byLeague.get(t.league)?.add(String(t.name).normalize("NFC"))
      }
      const reported = new Set()
      for (const m of report.matches) {
        for (const [raw, resolved] of [[m.home_team_source, m.home_team], [m.away_team_source, m.away_team]]) {
          const id = `${m.league}\u0001${raw}`
          if (byLeague.get(m.league)?.has(resolved) || reported.has(id)) continue
          reported.add(id)
          report.unmatched.push({ league: m.league, raw, resolved })
        }
      }
    }
  }

  const blocking =
    report.rejected.count > 0 ||
    report.conflicts.length > 0 ||
    (report.unmatched.length > 0 && !args.allowUnmatched)

  if (args.dryRun) {
    report.elapsedMs = Date.now() - started
    console.log(formatReport(report))
    process.exit(blocking ? 1 : 0)
  }

  // ── Abort rules (all before any write) ────────────────────────────────────
  if (blocking || teamReadError) {
    report.elapsedMs = Date.now() - started
    console.log(formatReport(report))
    if (teamReadError) fail(`espn_teams read failed: ${teamReadError}`)
    fail("aborting before any write: fix the rejected rows / meta conflicts / unmatched teams above")
  }
  if (!supabase) fail("missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)")
  const db = supabase

  const importedAt = new Date().toISOString()
  let batchNo = 0
  /**
   * @param {string} table
   * @param {Record<string, unknown>[]} rows
   * @param {string} onConflict
   */
  const upsertBatch = async (table, rows, onConflict) => {
    const n = ++batchNo
    try {
      await withRetry(async () => {
        const { error } = await db.from(table).upsert(rows, { onConflict })
        if (error) throw new Error(error.message)
      })
    } catch (e) {
      throw new Error(`batch #${n} failed: ${messageOf(e)}`)
    }
    return rows.length
  }

  // ── Write 1: matches ──────────────────────────────────────────────────────
  const matchRecords = report.matches.map((m) => toMatchRecord(m, importedAt))
  try {
    for (let i = 0; i < matchRecords.length; i += args.batchSize) {
      report.matchesUpserted += await upsertBatch("soccer_matches", matchRecords.slice(i, i + args.batchSize), MATCH_CONFLICT)
    }
  } catch (e) {
    fail(messageOf(e))
  }

  // ── Write 2: stat rows (pass 2, streamed) ─────────────────────────────────
  /** @type {Set<Promise<void>>} */
  const inflight = new Set()
  /** @type {Error | null} */
  let firstError = null
  /** @type {Record<string, unknown>[]} */
  let buffer = []
  const launch = () => {
    const rows = buffer
    buffer = []
    const p = upsertBatch("soccer_match_stats", rows, STAT_CONFLICT).then(
      (n) => { report.statRowsUpserted += n },
      (e) => { firstError ??= e instanceof Error ? e : new Error(String(e)) },
    )
    inflight.add(p)
    p.finally(() => inflight.delete(p))
  }
  /** Wait until fewer than `limit` batches are in flight. */
  const drainTo = async (/** @type {number} */ limit) => {
    while (inflight.size >= limit && inflight.size > 0) await Promise.race(inflight)
  }

  const dedup = new Set()
  await streamRows(file, (row) => {
    if (firstError || row.kind !== "stat") return
    const m = collector.get(matchId(row.match.league, row.match.season, row.match.match_no))
    if (!m) fail(`internal: match not collected ${matchId(row.match.league, row.match.season, row.match.match_no)}`)
    const k = statRowKey(row)
    if (dedup.has(k)) return
    dedup.add(k)
    buffer.push(toStatRecord(row, /** @type {any} */ (m), importedAt))
    if (buffer.length >= args.batchSize) {
      launch()
      if (inflight.size >= args.concurrency) return drainTo(args.concurrency)
    }
  })
  if (!firstError && buffer.length > 0) launch()
  await drainTo(1)
  if (firstError) fail(messageOf(firstError))

  report.elapsedMs = Date.now() - started
  console.log(formatReport(report))
}

main().catch((e) => fail(messageOf(e)))
