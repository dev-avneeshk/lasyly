import { describe, expect, it } from "vitest"
import {
  BACKFILL_VARIANTS,
  DEFAULT_UPLOAD_ORDER,
  objectPath,
  parseArgs,
  selectTodo,
  sourceUrlFor,
  storedPaths,
  uploadOrder,
} from "@/scripts/db/sync-headshots-lib.mjs"
import { headshotObjectPath, nbaCdnHeadshotUrl, type HeadshotVariant } from "@/lib/data/headshot-paths"

const LEAGUES = ["nfl", "nhl", "nbacdn"]

type Row = { espn_id: string; name: string; headshot_url: string | null }
const row = (id: string, headshot_url: string | null = null): Row => ({ espn_id: id, name: `P${id}`, headshot_url })

describe("parseArgs", () => {
  it("defaults: all leagues, no limit, default pass", () => {
    expect(parseArgs([], LEAGUES)).toEqual({
      leagues: LEAGUES, limit: Infinity, force: false, dryRun: false, variants: null,
    })
  })

  it("keeps the existing flags", () => {
    expect(parseArgs(["--leagues", "nfl,nbacdn", "--limit", "5", "--dry-run", "--force"], LEAGUES)).toEqual({
      leagues: ["nfl", "nbacdn"], limit: 5, force: true, dryRun: true, variants: null,
    })
  })

  it("accepts --variants xl", () => {
    const args = parseArgs(["--leagues", "nfl", "--variants", "xl", "--dry-run"], LEAGUES)
    expect(args.variants).toEqual(["xl"])
    expect(args.force).toBe(false)
  })

  it("rejects an empty --variants, including at the end of argv", () => {
    expect(() => parseArgs(["--variants", ""], LEAGUES)).toThrow("--variants needs a value, e.g. --variants xl")
    expect(() => parseArgs(["--leagues", "nfl", "--variants"], LEAGUES)).toThrow("--variants needs a value")
  })

  it.each(["sm", "lg", "xl,sm", "huge"])("rejects --variants %s (only xl can be backfilled)", (v) => {
    expect(() => parseArgs(["--variants", v], LEAGUES)).toThrow(
      /--variants: unsupported (sm|lg|huge)\. Only xl can be backfilled; sm\/lg are written by the default pass and are never re-uploaded/
    )
  })

  it("rejects --force with --variants in either order", () => {
    const msg = "--force cannot be combined with --variants: the backfill only fills missing objects and never overwrites"
    expect(() => parseArgs(["--force", "--variants", "xl"], LEAGUES)).toThrow(msg)
    expect(() => parseArgs(["--variants", "xl", "--force"], LEAGUES)).toThrow(msg)
  })

  it("only xl is backfillable", () => {
    expect(BACKFILL_VARIANTS).toEqual(["xl"])
  })
})

describe("objectPath", () => {
  const cases = LEAGUES.flatMap((ns) =>
    (["sm", "lg", "xl"] as HeadshotVariant[]).map((v): [string, HeadshotVariant] => [ns, v])
  )
  it.each(cases)(
    "matches headshotObjectPath for %s/%s",
    (ns, v) => {
      expect(objectPath(ns, "123", v)).toBe(headshotObjectPath(ns, "123", v))
    }
  )
})

describe("storedPaths", () => {
  it("keeps .webp files and drops the sm/xl folder entries and anything else", () => {
    const objs = [{ name: "1.webp" }, { name: "sm" }, { name: "xl" }, { name: "notes.txt" }, { name: "2.webp" }, {}]
    expect(storedPaths("nfl/", objs)).toEqual(["nfl/1.webp", "nfl/2.webp"])
  })
})

describe("uploadOrder", () => {
  it("default pass writes xl, sm, then lg last", () => {
    const order = uploadOrder(null)
    expect(order).toEqual(["xl", "sm", "lg"])
    expect(order.at(-1)).toBe("lg")
    expect(DEFAULT_UPLOAD_ORDER).toEqual(["xl", "sm", "lg"])
  })

  it("backfill writes only the requested variant, never sm or lg", () => {
    const order = uploadOrder(["xl"])
    expect(order).toEqual(["xl"])
    expect(order).not.toContain("sm")
    expect(order).not.toContain("lg")
  })

  it("parsed backfill args can only ever produce an xl-only order", () => {
    expect(uploadOrder(parseArgs(["--variants", "xl"], LEAGUES).variants)).toEqual(["xl"])
  })
})

describe("selectTodo: default pass", () => {
  const players = [row("1"), row("2"), row("3")]
  const stored = new Set(["nfl/1.webp", "nfl/sm/1.webp", "nfl/xl/2.webp"])

  it("picks players missing lg (an xl alone does not count as stored)", () => {
    const todo = selectTodo({ ns: "nfl", players, stored, variants: null, force: false, limit: Infinity })
    expect(todo.map((p) => p.espn_id)).toEqual(["2", "3"])
  })

  it("takes every player with force", () => {
    const todo = selectTodo({ ns: "nfl", players, stored, variants: null, force: true, limit: Infinity })
    expect(todo.map((p) => p.espn_id)).toEqual(["1", "2", "3"])
  })

  it("respects limit", () => {
    const todo = selectTodo({ ns: "nfl", players, stored, variants: null, force: false, limit: 1 })
    expect(todo.map((p) => p.espn_id)).toEqual(["2"])
  })
})

describe("selectTodo: --variants xl backfill", () => {
  const withUrl = row("10", "https://a.espncdn.com/i/headshots/nfl/players/full/10.png")
  const players = [withUrl, row("11"), row("12"), row("13")]
  const stored = new Set([
    // lg + xl: already done
    "nfl/11.webp", "nfl/xl/11.webp",
    // lg only: needs xl
    "nfl/10.webp", "nfl/12.webp",
    // lg for an id that is not in the player list
    "nfl/99.webp",
    // sm / xl without lg: never a backfill candidate
    "nfl/sm/13.webp", "nfl/xl/14.webp",
    // other namespaces are ignored
    "nhl/12.webp",
  ])
  const pick = (limit = Infinity) =>
    selectTodo({ ns: "nfl", players, stored, variants: ["xl"], force: false, limit })

  it("returns lg ids that lack xl, using the player row when there is one", () => {
    const todo = pick()
    expect(todo.map((p) => p.espn_id)).toEqual(["10", "12", "99"])
    expect(todo[0]).toBe(withUrl)
  })

  it("synthesizes a row for an lg id missing from players", () => {
    expect(pick().find((p) => p.espn_id === "99")).toEqual({ espn_id: "99", name: "99", headshot_url: null })
  })

  it("never returns an id without lg, and ignores sm/ and xl/ paths", () => {
    const ids = pick().map((p) => p.espn_id)
    expect(ids).not.toContain("13")
    expect(ids).not.toContain("14")
    expect(ids).not.toContain("11")
    expect(ids).not.toContain("sm/13")
  })

  it("respects limit", () => {
    expect(pick(2).map((p) => p.espn_id)).toEqual(["10", "12"])
  })
})

describe("sourceUrlFor", () => {
  it("nbacdn ignores the width and matches the app's origin URL", () => {
    expect(sourceUrlFor(row("203897"), "nbacdn", "nbacdn", 350)).toBe(nbaCdnHeadshotUrl("203897"))
    expect(sourceUrlFor(row("203897"), "nbacdn", "nbacdn", 480)).toBe(nbaCdnHeadshotUrl("203897"))
  })

  it("routes an espncdn headshot_url through the combiner at the requested width", () => {
    const r = row("3139477", "https://a.espncdn.com/i/headshots/nfl/players/full/3139477.png")
    expect(sourceUrlFor(r, "nfl", "espn", 350)).toBe(
      "https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/3139477.png&w=350"
    )
    expect(sourceUrlFor(r, "nfl", "espn", 480)).toBe(
      "https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/3139477.png&w=480"
    )
  })

  it("synthesizes the ESPN path from the id when there is no headshot_url", () => {
    expect(sourceUrlFor(row("3895074"), "nhl", "espn", 480)).toBe(
      "https://a.espncdn.com/combiner/i?img=/i/headshots/nhl/players/full/3895074.png&w=480"
    )
  })

  it("takes a non-espncdn headshot_url as-is", () => {
    const r = row("5", "https://example.com/photo.png")
    expect(sourceUrlFor(r, "nfl", "espn", 480)).toBe("https://example.com/photo.png")
  })
})
