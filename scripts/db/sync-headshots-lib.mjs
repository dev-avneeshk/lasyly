/**
 * Pure helpers for scripts/db/sync-headshots.mjs.
 *
 * Split out because sync-headshots.mjs reads .env.local and exits at import
 * time, so a test cannot import it. Everything here is side-effect free (no env
 * reads, no network, nothing at top level), which lets the invariants that
 * protect the bucket be unit-tested: which variants a run may upload, in what
 * order, and which ids it touches.
 *
 * Object paths must match lib/data/headshot-paths.ts; the test asserts parity.
 */

/**
 * Variants `--variants` may backfill.
 *
 * Only xl. sm and lg already exist for every stored player and are served
 * `Cache-Control: immutable` for a year, so a backfill must never re-upload them.
 */
export const BACKFILL_VARIANTS = ["xl"]

/**
 * Upload order for a new player in the default pass.
 *
 * lg goes LAST. Its presence is both the resumability key and the app's stored
 * index, so writing it last means "lg present" implies xl and sm are present too.
 */
export const DEFAULT_UPLOAD_ORDER = ["xl", "sm", "lg"]

/**
 * Parse CLI flags.
 *
 * @param {string[]} argv  process.argv.slice(2)
 * @param {string[]} defaultLeagues  leagues used when --leagues is absent
 * @returns {{ leagues: string[], limit: number, force: boolean, dryRun: boolean, variants: string[] | null }}
 * @throws {Error} on an empty or unsupported --variants, or --force with --variants
 */
export function parseArgs(argv, defaultLeagues) {
  const args = { leagues: defaultLeagues, limit: Infinity, force: false, dryRun: false, variants: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--force") args.force = true
    else if (a === "--dry-run") args.dryRun = true
    else if (a === "--leagues") args.leagues = (argv[++i] ?? "").split(",").filter(Boolean)
    else if (a === "--limit") args.limit = Math.max(1, parseInt(argv[++i] ?? "0", 10) || Infinity)
    else if (a === "--variants") {
      const list = (argv[++i] ?? "").split(",").map((v) => v.trim()).filter(Boolean)
      if (list.length === 0) throw new Error("--variants needs a value, e.g. --variants xl")
      const bad = list.find((v) => !BACKFILL_VARIANTS.includes(v))
      if (bad) {
        throw new Error(
          `--variants: unsupported ${bad}. Only xl can be backfilled; ` +
            "sm/lg are written by the default pass and are never re-uploaded"
        )
      }
      args.variants = [...new Set(list)]
    }
  }
  if (args.force && args.variants) {
    throw new Error(
      "--force cannot be combined with --variants: the backfill only fills missing objects and never overwrites"
    )
  }
  return args
}

/**
 * Object path within the bucket. Mirrors `headshotObjectPath` in
 * lib/data/headshot-paths.ts: lg at the namespace root, sm and xl in folders.
 *
 * @param {string} ns  namespace, e.g. "nfl" or "nbacdn"
 * @param {string | number} id
 * @param {"sm" | "lg" | "xl"} [variant]
 */
export function objectPath(ns, id, variant = "lg") {
  const lg = ns.toLowerCase()
  if (variant === "sm") return `${lg}/sm/${id}.webp`
  if (variant === "xl") return `${lg}/xl/${id}.webp`
  return `${lg}/${id}.webp`
}

/**
 * Full object paths from one Storage list() page, files only.
 *
 * A listing of "{ns}/" also returns the "sm" and "xl" folder entries, which are
 * not stored headshots and must not count as lg objects.
 *
 * @param {string} prefix  the listed prefix, ending in "/"
 * @param {Array<{ name?: string }>} objs
 * @returns {string[]}
 */
export function storedPaths(prefix, objs) {
  const out = []
  for (const o of objs) if (o?.name?.endsWith(".webp")) out.push(`${prefix}${o.name}`)
  return out
}

/**
 * Variants to write for each selected row, in upload order.
 *
 * @param {string[] | null} variants  parsed --variants, or null for the default pass
 * @returns {string[]}
 */
export function uploadOrder(variants) {
  return variants ? [...variants] : [...DEFAULT_UPLOAD_ORDER]
}

/**
 * Rows a run should process.
 *
 * Default pass (`variants` null): players with no lg object, or every player
 * with `force`. Unchanged from before xl existed.
 *
 * Backfill (`variants` set): ids that HAVE an lg object but lack any requested
 * variant. The candidates come from the lg listing, not the player list, so
 * every stored lg ends up with an xl and players with no upstream photo never
 * enter the set. Each id maps to its player row when there is one (ESPN keeps
 * using the row's headshot_url), otherwise to a synthesized row.
 *
 * @param {{
 *   ns: string,
 *   players: Array<{ espn_id: string | number, name: string, headshot_url: string | null }>,
 *   stored: Set<string>,
 *   variants: string[] | null,
 *   force: boolean,
 *   limit: number,
 * }} opts  `stored` holds full object paths (lg and xl listings combined)
 */
export function selectTodo({ ns, players, stored, variants, force, limit }) {
  let todo
  if (!variants) {
    todo = players.filter((p) => force || !stored.has(objectPath(ns, p.espn_id, "lg")))
  } else {
    const byId = new Map(players.map((p) => [String(p.espn_id), p]))
    const lgPrefix = `${ns.toLowerCase()}/`
    todo = []
    for (const path of stored) {
      if (!path.startsWith(lgPrefix) || !path.endsWith(".webp")) continue
      const id = path.slice(lgPrefix.length, -".webp".length)
      // Exactly one segment after the namespace: "{ns}/sm/…" and "{ns}/xl/…"
      // are other variants, not lg objects.
      if (id.length === 0 || id.includes("/")) continue
      if (variants.every((v) => stored.has(objectPath(ns, id, v)))) continue
      todo.push(byId.get(id) ?? { espn_id: id, name: id, headshot_url: null })
    }
  }
  return limit === Infinity ? todo : todo.slice(0, limit)
}

/**
 * Source image URL for one row at a given width.
 *
 * nbacdn: the NBA's CDN has no combiner, so every variant downscales the one
 * 1040x760 PNG it publishes (`width` is ignored). ESPN: prefer the row's stored
 * URL and fall back to the conventional path built from espn_id, because espn_id
 * coverage is 100% where headshot_url coverage is not. espncdn headshots are
 * routed through the combiner so we download a resized source; any other URL is
 * taken as-is.
 *
 * @param {{ espn_id: string | number, headshot_url?: string | null }} row
 * @param {string} ns
 * @param {"espn" | "nbacdn"} kind
 * @param {number} width  combiner width to request
 */
export function sourceUrlFor(row, ns, kind, width) {
  if (kind === "nbacdn") {
    return `https://cdn.nba.com/headshots/nba/latest/1040x760/${row.espn_id}.png`
  }
  if (row.headshot_url) {
    try {
      const u = new URL(row.headshot_url)
      if (u.hostname.endsWith("espncdn.com") && u.pathname.startsWith("/i/headshots/")) {
        // Width only — the combiner preserves aspect, and forcing h with
        // scale=crop would risk cropping a source we want intact.
        return `https://a.espncdn.com/combiner/i?img=${u.pathname}&w=${width}`
      }
      return row.headshot_url
    } catch {
      /* fall through to the synthesised path */
    }
  }
  const path = `/i/headshots/${ns}/players/full/${row.espn_id}.png`
  return `https://a.espncdn.com/combiner/i?img=${path}&w=${width}`
}
