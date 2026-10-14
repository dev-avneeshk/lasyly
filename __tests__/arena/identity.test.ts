import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Seat names (lib/arena/identity.ts). The admin client is a chainable builder
// that records every call; `h.hang` makes the read wait for its abort signal.
const h = vi.hoisted(() => ({
  calls: [] as Array<[string, unknown[]]>,
  result: { data: null, error: null } as { data: unknown; error: unknown },
  hang: false,
  createThrows: false,
  created: 0,
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    h.created++
    if (h.createThrows) throw new Error("Supabase admin client is not configured: missing SUPABASE_SERVICE_ROLE_KEY.")
    let signal: AbortSignal | undefined
    const settle = () =>
      h.hang
        ? new Promise((resolve) => {
            signal?.addEventListener("abort", () => resolve({ data: null, error: { message: "AbortError: This operation was aborted" } }))
          })
        : Promise.resolve(h.result)
    const q: Record<string, unknown> = {}
    for (const name of ["from", "select", "eq", "or", "limit"]) {
      q[name] = (...args: unknown[]) => {
        h.calls.push([name, args])
        return q
      }
    }
    q.abortSignal = (s: AbortSignal) => {
      h.calls.push(["abortSignal", [s]])
      signal = s
      return q
    }
    q.maybeSingle = () => {
      h.calls.push(["maybeSingle", []])
      return settle()
    }
    q.then = (ok: (v: unknown) => unknown, fail?: (e: unknown) => unknown) => settle().then(ok, fail)
    return q
  },
}))

import {
  IDENTITY_LOOKUP_TIMEOUT_MS,
  SEAT_NAME_MAX_CHARS,
  SEAT_NAME_TIMEOUT_MS,
  findTakenNames,
  lookupSeatName,
  sanitizeSeatName,
} from "@/lib/arena/identity"

const USER = "8b0c1d9e-1111-4222-8333-444455556666"

beforeEach(() => {
  h.calls = []
  h.result = { data: null, error: null }
  h.hang = false
  h.createThrows = false
  h.created = 0
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("sanitizeSeatName", () => {
  it("folds fullwidth input to ASCII (NFKC)", () => {
    expect(sanitizeSeatName("ｈｏｏｐｓ１２")).toBe("hoops12")
  })

  it("strips bidi overrides and isolates, zero-width chars, the BOM, C0/C1 controls and DEL", () => {
    expect(sanitizeSeatName("a\u202Eb\u200Bc\u2066d\uFEFFe\u0007f\u0085g\u007Fh\u061Ci\u2060j")).toBe("abcdefghij")
  })

  it("cuts 31+ code points to 30 without splitting an emoji at the boundary", () => {
    expect(SEAT_NAME_MAX_CHARS).toBe(30)
    expect(sanitizeSeatName("x".repeat(31))).toBe("x".repeat(30))
    const emoji = sanitizeSeatName("a".repeat(29) + "😀" + "zz")!
    expect(Array.from(emoji)).toHaveLength(30)
    expect(emoji.endsWith("😀")).toBe(true)
    // Trimmed again after the cut.
    expect(sanitizeSeatName("a".repeat(29) + " b")).toBe("a".repeat(29))
  })

  it("trims, and returns null for whitespace-only, control-only or non-string input", () => {
    expect(sanitizeSeatName("  Dime Guru  ")).toBe("Dime Guru")
    expect(sanitizeSeatName("   \t ")).toBeNull()
    expect(sanitizeSeatName("\u0000\u0001\u200B\u202E")).toBeNull()
    for (const raw of [null, undefined, 42, {}, ["name"]]) expect(sanitizeSeatName(raw)).toBeNull()
  })
})

describe("lookupSeatName", () => {
  it("reads profiles by id with a deadline set before maybeSingle(), and returns the sanitized username", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout")
    h.result = { data: { username: " ｈｏｏｐｓ ", display_name: "Display" }, error: null }

    expect(await lookupSeatName(USER)).toBe("hoops")

    expect(h.calls.map(([name]) => name)).toEqual(["from", "select", "eq", "abortSignal", "maybeSingle"])
    expect(h.calls[0][1]).toEqual(["profiles"])
    expect(h.calls[1][1]).toEqual(["username, display_name"])
    expect(h.calls[2][1]).toEqual(["id", USER])
    expect(h.calls[3][1][0]).toBeInstanceOf(AbortSignal)
    expect(timeout).toHaveBeenCalledWith(SEAT_NAME_TIMEOUT_MS)
    expect(SEAT_NAME_TIMEOUT_MS).toBe(800)
  })

  it("falls back to display_name when the username cleans to nothing", async () => {
    h.result = { data: { username: "\u200B\u202E ", display_name: " Display Name " }, error: null }
    expect(await lookupSeatName(USER)).toBe("Display Name")
  })

  it("returns null without a warning when there is no profile row", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    h.result = { data: null, error: null }
    expect(await lookupSeatName(USER)).toBeNull()
    expect(warn).not.toHaveBeenCalled()
  })

  it("a query error → null and a warn with the user id only", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    h.result = { data: null, error: { message: "db down" } }
    expect(await lookupSeatName(USER)).toBeNull()
    expect(warn).toHaveBeenCalledWith("[arena/identity] seat name lookup failed", { userId: USER })
  })

  it("a read still pending at 800 ms → null", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    h.hang = true
    const started = performance.now()
    expect(await lookupSeatName(USER)).toBeNull()
    const elapsed = performance.now() - started
    expect(elapsed).toBeGreaterThanOrEqual(SEAT_NAME_TIMEOUT_MS - 100)
    expect(elapsed).toBeLessThan(5_000)
    expect(warn).toHaveBeenCalledWith("[arena/identity] seat name lookup failed", { userId: USER })
  })

  it("createAdminClient throwing (no env) → null, never throws", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    h.createThrows = true
    await expect(lookupSeatName(USER)).resolves.toBeNull()
    expect(h.created).toBe(1)
  })
})

describe("findTakenNames", () => {
  it("makes one .or() of exact ilike clauses, with .limit(100) and an abort deadline", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout")
    h.result = { data: [], error: null }

    await findTakenNames(["hoopsfan", "dime7"])

    expect(h.created).toBe(1)
    expect(h.calls.map(([name]) => name)).toEqual(["from", "select", "or", "limit", "abortSignal"])
    expect(h.calls[0][1]).toEqual(["profiles"])
    expect(h.calls[1][1]).toEqual(["username, display_name"])
    expect(h.calls[2][1]).toEqual([
      "username.ilike.hoopsfan,display_name.ilike.hoopsfan,username.ilike.dime7,display_name.ilike.dime7",
    ])
    expect(h.calls[3][1]).toEqual([100])
    expect(h.calls[4][1][0]).toBeInstanceOf(AbortSignal)
    expect(timeout).toHaveBeenCalledWith(IDENTITY_LOOKUP_TIMEOUT_MS)
    expect(IDENTITY_LOOKUP_TIMEOUT_MS).toBe(1_500)
  })

  it("returns the lowercased, trimmed usernames and display names", async () => {
    h.result = {
      data: [
        { username: "HoopsFan", display_name: "  Dime Guru " },
        { username: null, display_name: "DIME7" },
        { username: "   ", display_name: null },
      ],
      error: null,
    }
    expect(await findTakenNames(["hoopsfan", "dime7"])).toEqual(new Set(["hoopsfan", "dime guru", "dime7"]))
  })

  it("throws on a query error, so a caller never proceeds with an unchecked name", async () => {
    h.result = { data: null, error: { message: "statement timeout" } }
    await expect(findTakenNames(["hoopsfan"])).rejects.toThrow(/statement timeout/)
  })

  it.each(["a,b", "x%", "Ab", "", "hoops fan", "lob_hq"])("throws before any query for %j", async (bad) => {
    await expect(findTakenNames(["hoopsfan", bad])).rejects.toThrow(/\^\[a-z0-9\]\+\$/)
    expect(h.created).toBe(0)
    expect(h.calls).toEqual([])
  })
})
