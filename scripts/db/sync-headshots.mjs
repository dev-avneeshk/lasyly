#!/usr/bin/env node
/**
 * Download player headshots, optimize them, and store them in Supabase Storage.
 *
 * WHY
 * ---
 * Every player photo in the app was hot-linked to ESPN's CDN. ESPN serves the
 * full-resolution press original (~225KB PNG) and the props page renders it into
 * a 36px circle — measured, that was ~5.9MB of images to draw 25 small avatars,
 * fetched from a third party we do not control.
 *
 * This downloads each photo once, resizes to 320x320, re-encodes as WebP
 * (~13KB, roughly 17x smaller) and uploads it to the `player-headshots` bucket.
 *
 * 320x320 is sized off the largest consumer: PlayerHero renders at 116 CSS px,
 * which is ~348px on a 3x display. Prop cards (36-40px) and rankings (48px) are
 * downscaled from this one stored size by next/image.
 *
 * DESIGN NOTES
 * ------------
 * - The BUCKET is the source of truth for what is stored, not a DB column. The
 *   object path is deterministic ({league}/{espn_id}.webp), so "is this synced?"
 *   is answered by listing the bucket. That cannot drift the way a column can if
 *   an object is deleted, and it needs no schema change.
 * - Idempotent and resumable: existing objects are skipped unless --force, so an
 *   interrupted run can simply be re-run.
 * - The SOURCE is fetched through ESPN's image combiner at w=350 rather than the
 *   full original. That is ~88KB instead of ~225KB per player — a third of the
 *   bandwidth off ESPN for output we are about to downscale anyway.
 * - Concurrency is bounded and failures never abort the run; they are collected
 *   and summarised, because a handful of players legitimately have no photo.
 *
 * USAGE
 *   node scripts/db/sync-headshots.mjs                    # nfl + nhl + nbacdn
 *   node scripts/db/sync-headshots.mjs --leagues nfl
 *   node scripts/db/sync-headshots.mjs --leagues nbacdn    # arena + NBA cards
 *   node scripts/db/sync-headshots.mjs --limit 20         # smoke test
 *   node scripts/db/sync-headshots.mjs --force            # re-encode everything
 *   node scripts/db/sync-headshots.mjs --dry-run
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
 */
import sharp from "sharp"
import { loadEnv, BUCKET } from "./create-headshot-bucket.mjs"

// ─── Config ──────────────────────────────────────────────────────────────────

/**
 * Longest-edge bound for the stored image. See header for why 320.
 *
 * The ORIGINAL ASPECT RATIO IS PRESERVED (ESPN serves 600x436, so we store
 * 320x233). That is deliberate and load-bearing: PlayerPhoto renders with
 * `object-cover scale-[1.5]`, a zoom tuned to the padding in ESPN's framing.
 * Storing a square centre-crop instead looked fine on its own but, once that
 * 1.5x zoom was applied on top, cropped into faces. Keeping the aspect means the
 * component renders byte-identically to before and needs no CSS change.
 */
const SIZE = 320

/**
 * Card variant, stored alongside the 320px one at `{league}/sm/{espn_id}.webp`.
 *
 * Prop cards render 36-40 CSS px and there are up to 50 on a page, so they are
 * the case worth optimising: 4KB apiece instead of 9.6KB is ~280KB across a full
 * scroll. 160px still covers a 2x display comfortably. The 320px variant stays
 * for PlayerHero on the detail page, which is a single image at 116 CSS px.
 */
const SIZE_SM = 160

/** WebP quality. 82 is visually indistinguishable at these sizes. */
const QUALITY = 82

/** Width to request from ESPN's combiner — comfortably above SIZE, well below the original. */
const SOURCE_WIDTH = 350

/** Parallel ESPN fetches. Deliberately modest: this is someone else's CDN. */
const CONCURRENCY = 6

/**
 * Leagues we actually render headshots for. Soccer is ~6k rows and unused here.
 *
 * `nbacdn` is not an ESPN league — it is the NBA's own CDN, keyed by NBA person
 * id rather than ESPN athlete id. It gets its own namespace precisely because the
 * two id spaces are unrelated: storing both under `nba/` would let an ESPN id
 * collide with an NBA person id and serve one player another's face.
 */
const DEFAULT_LEAGUES = ["nfl", "nhl", "nbacdn"]

/**
 * Where each namespace gets its id list and its source image.
 *
 *  - `espn`  — ids from espn_players.espn_id, images from a.espncdn.com.
 *  - `nbacdn` — ids from the arena's generated NBA person-id map, images from
 *    cdn.nba.com. Used by the auction arena and by NBA prop cards, neither of
 *    which has an ESPN id available.
 */
const SOURCES = {
  nfl: "espn",
  nhl: "espn",
  nbacdn: "nbacdn",
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { leagues: DEFAULT_LEAGUES, limit: Infinity, force: false, dryRun: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--force") args.force = true
    else if (a === "--dry-run") args.dryRun = true
    else if (a === "--leagues") args.leagues = (argv[++i] ?? "").split(",").filter(Boolean)
    else if (a === "--limit") args.limit = Math.max(1, parseInt(argv[++i] ?? "0", 10) || Infinity)
  }
  return args
}

// ─── Supabase helpers ────────────────────────────────────────────────────────

const env = loadEnv()
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}
const AUTH = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }

/** Page a REST select, honouring the 1000-row response cap. */
async function pageAll(path) {
  const out = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { ...AUTH, Range: `${from}-${from + pageSize - 1}` },
    })
    if (!res.ok) throw new Error(`fetch failed (${res.status}): ${await res.text()}`)
    const rows = await res.json()
    out.push(...rows)
    if (rows.length < pageSize) break
  }
  return out
}

/** Every player row for an ESPN league that has an espn_id. */
async function fetchEspnPlayers(league) {
  const rows = await pageAll(
    `espn_players?select=espn_id,name,headshot_url&league=eq.${encodeURIComponent(league)}` +
      `&espn_id=not.is.null&order=espn_id.asc`
  )

  // One row per espn_id — the table has duplicates across team changes.
  const seen = new Set()
  const out = rows.filter((r) => (seen.has(r.espn_id) ? false : (seen.add(r.espn_id), true)))

  // NFL ONLY: also take every athlete_id that appears in nfl_player_stats.
  //
  // The roster table is not a superset of the players we render. 584 of the 2,487
  // players in nfl_player_stats have no espn_players row, so syncing only from
  // espn_players left those ids unstored and the app hot-linking ESPN for them —
  // measured at 48 of 458 players on a live slate. The stats table's athlete_id
  // IS the ESPN id, so these need no roster row to resolve a photo.
  if (league === "nfl") {
    const statRows = await pageAll(
      `nfl_player_stats?select=athlete_id,player_name&athlete_id=not.is.null&order=id.asc`
    )
    let added = 0
    for (const r of statRows) {
      const id = String(r.athlete_id)
      if (seen.has(id)) continue
      seen.add(id)
      out.push({ espn_id: id, name: r.player_name ?? id, headshot_url: null })
      added++
    }
    console.log(`  nfl: +${added} ids from nfl_player_stats not present in espn_players`)
  }

  return out
}

/**
 * Arena NBA person ids, read from the generated map.
 *
 * Parsed rather than imported because this script is plain .mjs and the map is a
 * TypeScript module. The shape is a flat `"slug": id` record, so a tight regex is
 * sufficient and fails loudly (zero matches) if the generator ever changes it.
 */
async function fetchNbaCdnPlayers() {
  const { readFileSync } = await import("node:fs")
  const src = readFileSync(
    new URL("../../lib/arena/data/nba-ids.ts", import.meta.url),
    "utf8"
  )
  const out = []
  const seen = new Set()
  for (const m of src.matchAll(/"([a-z0-9.'-]+)":\s*(\d+)/g)) {
    const id = m[2]
    if (seen.has(id)) continue
    seen.add(id)
    out.push({ espn_id: id, name: m[1], headshot_url: null })
  }
  if (out.length === 0) {
    throw new Error(
      "no NBA person ids parsed from lib/arena/data/nba-ids.ts — has its shape changed?"
    )
  }
  return out
}

/** Id list for a namespace. */
async function fetchPlayers(league) {
  return SOURCES[league] === "nbacdn"
    ? fetchNbaCdnPlayers()
    : fetchEspnPlayers(league)
}

/**
 * Every object path already in the bucket under `prefix`.
 *
 * This is what makes the run resumable, so it has to be exhaustive — the list
 * endpoint caps at 100 by default, which would silently make everything look
 * unsynced and re-upload the whole set on every run.
 */
async function listStored(prefix) {
  const found = new Set()
  const pageSize = 1000
  for (let offset = 0; ; offset += pageSize) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
      method: "POST",
      headers: { ...AUTH, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, limit: pageSize, offset }),
    })
    if (!res.ok) throw new Error(`storage list failed (${res.status}): ${await res.text()}`)
    const objs = await res.json()
    if (!Array.isArray(objs) || objs.length === 0) break
    // Files only. A listing of "{league}/" also returns the "sm" folder entry,
    // which is not a stored headshot and must not count as one.
    for (const o of objs) if (o.name?.endsWith(".webp")) found.add(`${prefix}${o.name}`)
    if (objs.length < pageSize) break
  }
  return found
}

async function upload(path, buffer) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      ...AUTH,
      "Content-Type": "image/webp",
      // Long max-age: the object is immutable for a given espn_id, and a re-sync
      // overwrites in place via upsert. Public bucket + this header means
      // Supabase's CDN serves it without hitting the origin.
      "Cache-Control": "public, max-age=31536000, immutable",
      "x-upsert": "true",
    },
    body: buffer,
  })
  if (!res.ok) throw new Error(`upload ${res.status}: ${(await res.text()).slice(0, 160)}`)
}

// ─── Image pipeline ──────────────────────────────────────────────────────────

/**
 * Resolve the ESPN image path for a player, preferring the stored URL and
 * falling back to the conventional path built from espn_id. espn_id coverage is
 * 100% where headshot_url coverage is not, so the fallback matters.
 */
function sourceUrlFor(row, league) {
  // The NBA's CDN has no combiner; take the one size it publishes and downscale
  // locally. It is ~200KB per player, which is why storing these matters at all.
  if (SOURCES[league] === "nbacdn") {
    return `https://cdn.nba.com/headshots/nba/latest/1040x760/${row.espn_id}.png`
  }
  if (row.headshot_url) {
    try {
      const u = new URL(row.headshot_url)
      // Route espncdn images through the combiner so we download a resized
      // source; anything else we take as-is.
      if (u.hostname.endsWith("espncdn.com") && u.pathname.startsWith("/i/headshots/")) {
        // Width only — the combiner preserves aspect, and forcing h with
        // scale=crop would risk cropping a source we want intact.
        return `https://a.espncdn.com/combiner/i?img=${u.pathname}&w=${SOURCE_WIDTH}`
      }
      return row.headshot_url
    } catch {
      /* fall through to the synthesised path */
    }
  }
  const path = `/i/headshots/${league}/players/full/${row.espn_id}.png`
  return `https://a.espncdn.com/combiner/i?img=${path}&w=${SOURCE_WIDTH}`
}

/** Fetch + re-encode. Returns null when ESPN has no usable image for this id. */
async function buildWebp(row, league) {
  const res = await fetch(sourceUrlFor(row, league), {
    headers: { "User-Agent": "lasyly-headshot-sync/1.0" },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) return { skip: `http ${res.status}` }

  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 512) return { skip: `source too small (${buf.length}B)` }

  // `fit: inside` + no enlargement: scale down to fit the box, never change the
  // aspect ratio, never upscale a source that is already smaller. See the SIZE
  // comment for why preserving aspect matters to the component's zoom.
  const encode = (edge) =>
    sharp(buf)
      .resize(edge, edge, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toBuffer()

  const [webp, webpSm] = await Promise.all([encode(SIZE), encode(SIZE_SM)])
  return { webp, webpSm }
}

// ─── Bounded parallel map ────────────────────────────────────────────────────

async function mapLimit(items, limit, fn) {
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++
      if (i >= items.length) return
      await fn(items[i], i)
    }
  })
  await Promise.all(workers)
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const unknown = args.leagues.filter((l) => !SOURCES[l])
  if (unknown.length > 0) {
    console.error(
      `Unknown league(s): ${unknown.join(", ")}. Known: ${Object.keys(SOURCES).join(", ")}`
    )
    process.exit(1)
  }

  console.log(
    `Headshot sync -> ${SIZE}x${SIZE} webp q${QUALITY} | leagues=${args.leagues.join(",")}` +
      `${args.force ? " | FORCE" : ""}${args.dryRun ? " | DRY RUN" : ""}\n`
  )

  const grand = { synced: 0, skipped: 0, failed: 0, bytesIn: 0, bytesOut: 0 }

  for (const league of args.leagues) {
    const prefix = `${league}/`
    const [players, stored] = await Promise.all([fetchPlayers(league), listStored(prefix)])

    const todo = players
      .filter((p) => args.force || !stored.has(`${prefix}${p.espn_id}.webp`))
      .slice(0, args.limit === Infinity ? undefined : args.limit)

    console.log(
      `${league}: ${players.length} players, ${stored.size} already stored, ${todo.length} to process`
    )
    if (todo.length === 0) {
      console.log("")
      continue
    }
    if (args.dryRun) {
      console.log(`  (dry run — would upload ${todo.length} objects)\n`)
      continue
    }

    const stats = { synced: 0, skipped: 0, failed: 0, bytesOut: 0 }
    const problems = []
    let done = 0

    await mapLimit(todo, CONCURRENCY, async (row) => {
      const path = `${prefix}${row.espn_id}.webp`
      const pathSm = `${prefix}sm/${row.espn_id}.webp`
      try {
        const { webp, webpSm, skip } = await buildWebp(row, league)
        if (skip) {
          stats.skipped++
          problems.push(`${row.name} (${row.espn_id}): ${skip}`)
        } else {
          // ORDER MATTERS: small first, large second. The resumability check and
          // the app's stored index are both keyed on the large object, so writing
          // it last means its presence implies the small one is already there. The
          // reverse order would let a crash between the two uploads leave every
          // prop card pointing at a 404.
          await upload(pathSm, webpSm)
          await upload(path, webp)
          stats.synced++
          stats.bytesOut += webp.length + webpSm.length
        }
      } catch (e) {
        stats.failed++
        problems.push(`${row.name} (${row.espn_id}): ${e.message}`)
      }
      if (++done % 100 === 0 || done === todo.length) {
        process.stdout.write(`\r  ${done}/${todo.length} processed…`)
      }
    })

    const avg = stats.synced ? Math.round(stats.bytesOut / stats.synced) : 0
    console.log(
      `\r  synced ${stats.synced}, no-image ${stats.skipped}, failed ${stats.failed}` +
        `  (avg ${(avg / 1024).toFixed(1)}KB, total ${(stats.bytesOut / 1048576).toFixed(1)}MB)`
    )
    if (problems.length) {
      console.log(`  first few problems:`)
      for (const p of problems.slice(0, 5)) console.log(`    - ${p}`)
      if (problems.length > 5) console.log(`    …and ${problems.length - 5} more`)
    }
    console.log("")

    grand.synced += stats.synced
    grand.skipped += stats.skipped
    grand.failed += stats.failed
    grand.bytesOut += stats.bytesOut
  }

  console.log(
    `Done. synced=${grand.synced} no-image=${grand.skipped} failed=${grand.failed} ` +
      `stored=${(grand.bytesOut / 1048576).toFixed(1)}MB`
  )
  if (grand.synced > 0) {
    console.log(`\nPublic URL shape:`)
    console.log(`  ${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/nfl/<espn_id>.webp`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
