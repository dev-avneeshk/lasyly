import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"

// Persona handles (lib/arena/persona.ts). The admin client behind the default
// collision check (findTakenNames) is stubbed with fixed profile rows.
const h = vi.hoisted(() => ({
  rows: [] as Array<{ username: string | null; display_name: string | null }>,
  filters: [] as string[],
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const q: Record<string, unknown> = {}
    for (const name of ["from", "select", "limit", "abortSignal"]) q[name] = () => q
    q.or = (filter: string) => {
      h.filters.push(filter)
      return q
    }
    q.then = (ok: (v: unknown) => unknown, fail?: (e: unknown) => unknown) =>
      Promise.resolve({ data: h.rows, error: null }).then(ok, fail)
    return q
  },
}))

import {
  ATHLETE_TOKENS,
  DIGIT_RUN_TOKENS,
  HANDLE_RE,
  MACHINE_TOKENS,
  PERSONA_PREFIXES,
  PERSONA_SUFFIXES,
  PROFANITY_TOKENS,
  PersonaUnavailableError,
  TEAM_TOKENS,
  generateHandle,
  hasDeniedToken,
  isCleanHandle,
  personaCard,
  pickPersonaName,
} from "@/lib/arena/persona"
import { getSeasonPlayers } from "@/lib/arena/data"
import { mulberry32 } from "@/lib/arena/rng"

const DENYLISTS = [...PROFANITY_TOKENS, ...ATHLETE_TOKENS, ...TEAM_TOKENS, ...MACHINE_TOKENS, ...DIGIT_RUN_TOKENS]
// An independent sample, so a token silently dropped from the module's lists still fails here.
const SAMPLE = [
  "lebron", "curry", "jordan", "kobe", "shaq", "giannis", "jokic", "luka", "wemby", "goat", "kingjames",
  "lakers", "celtics", "warriors", "shit", "fuck", "ass", "bot", "cpu", "npc", "69", "420",
]
const lettersOnly = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "")

function draws(seed: number, n: number): string[] {
  const rng = mulberry32(seed)
  return Array.from({ length: n }, () => generateHandle(rng))
}

/** Records every round of candidates; `taken(round, candidates)` decides what the "DB" reports. */
function recorder(taken: (round: number, candidates: string[]) => Iterable<string> = () => []) {
  const rounds: string[][] = []
  const findTaken = vi.fn(async (candidates: string[]) => {
    rounds.push(candidates)
    return new Set(taken(rounds.length - 1, candidates))
  })
  return { rounds, findTaken }
}

beforeEach(() => {
  h.rows = []
  h.filters = []
})

describe("word lists", () => {
  it("hold the curated 40 prefixes and 34 suffixes, none containing a denylisted token", () => {
    expect(PERSONA_PREFIXES).toHaveLength(40)
    expect(PERSONA_SUFFIXES).toHaveLength(34)
    for (const list of [PERSONA_PREFIXES, PERSONA_SUFFIXES]) {
      expect(new Set(list).size).toBe(list.length)
      for (const word of list) {
        expect(word).toMatch(/^[a-z]+$/)
        expect(hasDeniedToken(word), word).toBe(false)
      }
    }
  })

  it("deny every NBA team nickname and the machine words", () => {
    expect(TEAM_TOKENS).toEqual(expect.arrayContaining(["lakers", "bucks", "sixers", "76ers", "blazers", "wolves", "heat", "magic", "jazz"]))
    expect(MACHINE_TOKENS).toEqual(["bot", "cpu", "npc", "robo", "auto"])
    expect(DIGIT_RUN_TOKENS).toEqual(["69", "88", "420", "666", "911", "1488"])
  })
})

describe("generateHandle (AC-25)", () => {
  let handles: string[] = []
  beforeAll(() => {
    handles = draws(20261013, 10_000)
  })

  it("every one of 10 000 seeded handles matches HANDLE_RE and is 3–30 chars", () => {
    expect(handles).toHaveLength(10_000)
    expect(handles.filter((x) => !HANDLE_RE.test(x) || x.length < 3 || x.length > 30)).toEqual([])
  })

  it("no handle contains a denylisted token, from the module's lists or an independent sample", () => {
    const tokens = [...DENYLISTS, ...SAMPLE]
    expect(handles.flatMap((x) => tokens.filter((t) => x.includes(t)).map((t) => `${x} ⊃ ${t}`))).toEqual([])
  })

  it("no handle contains a real player's full name", () => {
    const names = [...new Set(getSeasonPlayers("2025-26").map((p) => lettersOnly(p.name)))].filter(Boolean)
    expect(names.length).toBeGreaterThan(500)
    const hits = handles.flatMap((x) => {
      const letters = lettersOnly(x)
      return names.filter((n) => letters.includes(n)).map((n) => `${x} ⊃ ${n}`)
    })
    expect(hits).toEqual([])
  })

  it("draws the four templates at about 35/25/25/15", () => {
    const share = (re: RegExp) => handles.filter((x) => re.test(x)).length / handles.length
    const pnnn = share(/\d{3}$/)
    const psnn = share(/\D\d{2}$/)
    const psd = share(/\D\d$/)
    const ps = share(/\D$/)
    expect(pnnn + psnn + psd + ps).toBeCloseTo(1, 10)
    expect(Math.abs(psnn - 0.35)).toBeLessThan(0.03)
    expect(Math.abs(ps - 0.25)).toBeLessThan(0.03)
    expect(Math.abs(psd - 0.25)).toBeLessThan(0.03)
    expect(Math.abs(pnnn - 0.15)).toBeLessThan(0.03)
  })

  it("is stable per seed and never empty or unclean", () => {
    expect(draws(42, 200)).toEqual(draws(42, 200))
    expect(draws(42, 200)).not.toEqual(draws(43, 200))
    for (const handle of draws(7, 2_000)) {
      expect(handle.length).toBeGreaterThan(0)
      expect(isCleanHandle(handle)).toBe(true)
    }
  })

  it("gives up after 50 rejected tries instead of returning an unclean handle", () => {
    // Template prefix+nnn (0.9), prefix "hoops" (0), digits 420: rejected every time.
    const seq = [0.9, 0, 320.5 / 900]
    let calls = 0
    const rng = () => seq[calls++ % seq.length]
    expect(() => generateHandle(rng)).toThrow(PersonaUnavailableError)
    expect(calls).toBe(50 * seq.length)
  })
})

describe("isCleanHandle", () => {
  it("accepts the username format and rejects denylisted, uppercase, leading-digit, 2-char and 21-char candidates", () => {
    expect(isCleanHandle("hoopsjunkie23")).toBe(true)
    expect(isCleanHandle("lobhq")).toBe(true)
    expect(isCleanHandle("abc")).toBe(true)
    expect(isCleanHandle("a".repeat(20))).toBe(true)
    for (const bad of ["dunklebron", "hoopslakers", "swishbot", "rim69", "corner420", "hellfan", "Hoopsfan", "1hoops", "ab", "a".repeat(21), "hoops_fan", ""]) {
      expect(isCleanHandle(bad), bad).toBe(false)
    }
  })
})

describe("pickPersonaName", () => {
  it("returns the first untaken candidate after a single check", async () => {
    const { rounds, findTaken } = recorder()
    const name = await pickPersonaName({ rng: mulberry32(1), findTaken })
    expect(findTaken).toHaveBeenCalledTimes(1)
    expect(name).toBe(rounds[0][0])
  })

  it("checks candidates that are unique, clean and match ^[a-z0-9]+$, in both rounds", async () => {
    for (let seed = 1; seed <= 25; seed++) {
      const { rounds, findTaken } = recorder((round, c) => (round === 0 ? c : []))
      await pickPersonaName({ rng: mulberry32(seed), findTaken })
      expect(rounds).toHaveLength(2)
      for (const round of rounds) {
        expect(round).toHaveLength(6)
        expect(new Set(round).size).toBe(6)
        for (const c of round) {
          expect(c).toMatch(/^[a-z0-9]+$/)
          expect(isCleanHandle(c)).toBe(true)
        }
      }
    }
  })

  it("skips taken candidates within a round", async () => {
    const { rounds, findTaken } = recorder((_round, c) => c.slice(0, 2))
    const name = await pickPersonaName({ rng: mulberry32(2), findTaken })
    expect(name).toBe(rounds[0][2])
  })

  it("regenerates a second round when round 1 is fully taken", async () => {
    const { rounds, findTaken } = recorder((round, c) => (round === 0 ? c : []))
    const name = await pickPersonaName({ rng: mulberry32(3), findTaken })
    expect(findTaken).toHaveBeenCalledTimes(2)
    expect(rounds[1]).toHaveLength(6)
    expect(name).toBe(rounds[1][0])
    expect(rounds[0]).not.toContain(name)
  })

  it("throws PersonaUnavailableError when all 12 candidates are taken", async () => {
    const { findTaken } = recorder((_round, c) => c)
    await expect(pickPersonaName({ rng: mulberry32(4), findTaken })).rejects.toBeInstanceOf(PersonaUnavailableError)
    expect(findTaken).toHaveBeenCalledTimes(2)
  })

  it("propagates a findTaken rejection: never an unchecked name", async () => {
    const findTaken = vi.fn(async () => {
      throw new Error("profiles lookup timed out")
    })
    await expect(pickPersonaName({ rng: mulberry32(5), findTaken })).rejects.toThrow("profiles lookup timed out")
    expect(findTaken).toHaveBeenCalledTimes(1)
  })

  it("skips a candidate equal, case-insensitively, to an existing name such as the owner's (AC-26)", async () => {
    const { rounds, findTaken } = recorder()
    await pickPersonaName({ rng: mulberry32(6), findTaken })
    const [first, second] = rounds[0] // the same seed replays the same candidates below

    // Through the default check (findTakenNames): the owner's own profile row
    // holds the first candidate, in another case, as its display name...
    h.rows = [{ username: "realowner", display_name: ` ${first.toUpperCase()} ` }]
    expect(await pickPersonaName({ rng: mulberry32(6) })).toBe(second)
    expect(h.filters).toHaveLength(1)
    expect(h.filters[0]).toContain(`username.ilike.${first},display_name.ilike.${first}`)

    // ...or as its username.
    h.rows = [{ username: first.toUpperCase(), display_name: "Owner" }]
    expect(await pickPersonaName({ rng: mulberry32(6) })).toBe(second)
  })
})

describe("personaCard", () => {
  it("is stable per (gameId, name) and human-shaped", () => {
    const card = personaCard("game-1", "hoopsjunkie23")
    expect(personaCard("game-1", "hoopsjunkie23")).toEqual(card)
    expect(card).toMatchObject({
      seat: "P2",
      isAI: false,
      username: "hoopsjunkie23",
      display_name: "hoopsjunkie23",
      avatar_url: null,
      is_verified: false,
    })
    expect(Object.keys(card)).not.toContain("userId")
  })

  it("keeps level 2–9, played 6–48, wins 40–60% of played and losses = played − wins", () => {
    const levels = new Set<number>()
    for (let i = 0; i < 2_000; i++) {
      const { level, record } = personaCard(`game-${i}`, `dimeguru${i % 10}`)
      levels.add(level)
      expect(level).toBeGreaterThanOrEqual(2)
      expect(level).toBeLessThanOrEqual(9)
      expect(record.played).toBeGreaterThanOrEqual(6)
      expect(record.played).toBeLessThanOrEqual(48)
      expect(5 * record.wins).toBeGreaterThanOrEqual(2 * record.played)
      expect(5 * record.wins).toBeLessThanOrEqual(3 * record.played)
      expect(record.losses).toBe(record.played - record.wins)
    }
    expect(levels.size).toBe(8) // the whole 2–9 range is reachable
  })
})
