/**
 * One-off: write curated strengths/weaknesses into the generated arena pool.
 *
 * Reads scripts/data/player-strengths-weaknesses.tsv (name<TAB>strengths<TAB>
 * weaknesses, comma-separated) and rewrites the `strengths:`/`weaknesses:` arrays
 * for each matching player in lib/arena/data/players-2025-26.ts, matching on a
 * normalized name (accents/punctuation/case-insensitive).
 *
 * Idempotent: re-running with the same TSV produces the same file. Prints a
 * report of matched / unmatched entries so nothing silently drifts.
 *
 * Usage: node scripts/apply-strengths-weaknesses.mjs
 */

import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const TSV = path.join(ROOT, "scripts/data/player-strengths-weaknesses.tsv")
const POOL = path.join(ROOT, "lib/arena/data/players-2025-26.ts")

/** Normalize a name for matching: strip accents, punctuation, lowercase. */
function norm(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // combining diacritics
    .toLowerCase()
    .replace(/[.'’`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function parseList(s) {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
}

// ── Load curated data ────────────────────────────────────────────────────────
const rows = fs
  .readFileSync(TSV, "utf8")
  .split("\n")
  .map((l) => l.replace(/\r$/, ""))
  .filter((l) => l.trim().length > 0)

const curated = new Map() // normName -> { name, strengths, weaknesses }
for (const row of rows) {
  const [name, strengths = "", weaknesses = ""] = row.split("\t")
  if (!name) continue
  curated.set(norm(name), {
    name: name.trim(),
    strengths: parseList(strengths),
    weaknesses: parseList(weaknesses),
  })
}

// ── Rewrite the pool file ─────────────────────────────────────────────────────
let src = fs.readFileSync(POOL, "utf8")

// Serialize a string[] the way the file already formats it: ["a","b","c"].
const ser = (arr) => "[" + arr.map((x) => JSON.stringify(x)).join(",") + "]"

const matched = new Set()
let replacedStrengths = 0
let replacedWeaknesses = 0
const poolNames = new Set()
let unmatchedPool = []

/**
 * The generated file lays out each player as a block. We locate each block by
 * its `name: "..."` line, then rewrite the `strengths:`/`weaknesses:` lines that
 * belong to that block (the next occurrences before the next `name:`).
 *
 * Rather than a brittle single mega-regex, we split on the top-level entry
 * boundary `  {` and operate per block.
 */
const blocks = src.split(/\n(?=  \{\n)/)
const out = blocks.map((block) => {
  const nameMatch = block.match(/name:\s*"([^"]+)"/)
  if (!nameMatch) return block
  const rawName = nameMatch[1]
  const key = norm(rawName)
  poolNames.add(rawName)

  const entry = curated.get(key)
  if (!entry) {
    unmatchedPool.push(rawName)
    return block
  }
  matched.add(key)

  let b = block
  if (/strengths:\s*\[[^\]]*\]/.test(b)) {
    b = b.replace(/strengths:\s*\[[^\]]*\]/, `strengths: ${ser(entry.strengths)}`)
    replacedStrengths++
  }
  if (/weaknesses:\s*\[[^\]]*\]/.test(b)) {
    b = b.replace(/weaknesses:\s*\[[^\]]*\]/, `weaknesses: ${ser(entry.weaknesses)}`)
    replacedWeaknesses++
  }
  return b
})

src = out.join("\n")
fs.writeFileSync(POOL, src)

// ── Report ────────────────────────────────────────────────────────────────────
const unmatchedCurated = [...curated.entries()]
  .filter(([k]) => !matched.has(k))
  .map(([, v]) => v.name)

console.log(`Curated entries:        ${curated.size}`)
console.log(`Players in pool:        ${poolNames.size}`)
console.log(`Matched & updated:      ${matched.size}`)
console.log(`  strengths rewritten:  ${replacedStrengths}`)
console.log(`  weaknesses rewritten: ${replacedWeaknesses}`)
console.log(`\nCurated names with NO pool match (${unmatchedCurated.length}):`)
console.log(unmatchedCurated.length ? "  " + unmatchedCurated.join("\n  ") : "  (none)")
console.log(`\nPool players NOT in curated list (${unmatchedPool.length}) — left unchanged:`)
console.log(unmatchedPool.length ? "  " + unmatchedPool.slice(0, 60).join("\n  ") + (unmatchedPool.length > 60 ? `\n  ...and ${unmatchedPool.length - 60} more` : "") : "  (none)")
