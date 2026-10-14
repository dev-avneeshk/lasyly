import "server-only"

/**
 * Handle-style public names for the global-match fallback opponent. Server only,
 * which keeps the word lists out of client bundles.
 *
 * Handles use the real username charset and length (`^[a-z][a-z0-9]{2,19}$`), so
 * the format itself never marks one as generated. Every candidate passes a
 * substring denylist (profanity, athletes and nicknames, team nicknames, machine
 * words, loaded digit runs) and is then checked against `profiles` before use.
 */

import { findTakenNames } from "./identity"
import { hashSeed, mulberry32, randInt, type RNG } from "./rng"

export const HANDLE_RE = /^[a-z][a-z0-9]{2,19}$/

/** Hoops vocabulary only: no person's name or famous nickname, and no word contains a denylisted token. */
export const PERSONA_PREFIXES = [
  "hoops", "buckets", "swish", "dunk", "court", "rim", "baseline", "fullcourt", "halfcourt", "blacktop",
  "pickup", "layup", "jumper", "floater", "crossover", "fastbreak", "rebound", "boxout", "tipoff", "buzzer",
  "clutch", "rookie", "bench", "hustle", "hangtime", "backboard", "deeprange", "midrange", "freethrow", "shotclock",
  "paint", "corner", "lob", "dime", "handles", "dribble", "triple", "stepback", "hardwood", "nylon",
] as const

export const PERSONA_SUFFIXES = [
  "junkie", "fan", "head", "nerd", "guru", "fiend", "addict", "lover", "mode", "life",
  "zone", "crew", "squad", "club", "chaser", "maker", "getter", "grinder", "hound", "rat",
  "boss", "pro", "champ", "theory", "talk", "tape", "vibes", "szn", "hq", "nation",
  "academy", "report", "scholar", "runner",
] as const

export const PROFANITY_TOKENS = [
  "ass", "shit", "fuck", "fuk", "cunt", "dick", "cock", "puss", "tit", "cum", "sex", "porn", "nude", "rape",
  "fag", "nig", "slut", "whore", "bitch", "damn", "hell", "piss", "crap", "nazi", "kkk", "hitler", "weed",
  "drug", "kill", "dead", "suck", "hoe", "jizz", "anal", "anus", "butt", "boob",
] as const

export const ATHLETE_TOKENS = [
  "lebron", "kingjames", "king", "chef", "curry", "jordan", "kobe", "mamba", "shaq", "diesel", "giannis",
  "freak", "jokic", "joker", "luka", "harden", "beard", "durant", "slimreaper", "embiid", "process", "dame",
  "lillard", "wemby", "goat", "airness", "magic", "bird", "kareem", "wilt", "westbrook", "brodie", "spida",
  "brow", "unicorn", "glove", "mailman", "admiral", "dream", "answer", "truth", "splash", "flash", "iceman",
  "worm", "pistol", "ticket", "drj", "barkley", "duncan", "kawhi", "klaw", "tatum", "zion", "morant",
  "booker", "trae", "edwards", "shai", "butler", "kd", "cp3", "pointgod",
] as const

/** All 30 NBA team nicknames, in their usual forms. */
export const TEAM_TOKENS = [
  "hawks", "celtics", "nets", "hornets", "bulls", "cavaliers", "cavs", "mavericks", "mavs", "nuggets",
  "pistons", "warriors", "rockets", "pacers", "clippers", "lakers", "grizzlies", "heat", "bucks",
  "timberwolves", "wolves", "pelicans", "knicks", "thunder", "magic", "sixers", "76ers", "suns", "blazers",
  "kings", "spurs", "raptors", "jazz", "wizards",
] as const

export const MACHINE_TOKENS = ["bot", "cpu", "npc", "robo", "auto"] as const

export const DIGIT_RUN_TOKENS = ["69", "88", "420", "666", "911", "1488"] as const

const DENYLIST: readonly string[] = [
  ...PROFANITY_TOKENS,
  ...ATHLETE_TOKENS,
  ...TEAM_TOKENS,
  ...MACHINE_TOKENS,
  ...DIGIT_RUN_TOKENS,
]

/** Regenerate a candidate at most this many times before giving up. */
const HANDLE_MAX_TRIES = 50
/** Candidates checked against `profiles` per round, and rounds per pick. */
const PERSONA_CANDIDATES = 6
const PERSONA_ROUNDS = 2

/** No usable handle: the generator gave up, or every candidate was taken. The pair route answers 503. */
export class PersonaUnavailableError extends Error {
  constructor(message = "No opponent name is available right now.") {
    super(message)
    this.name = "PersonaUnavailableError"
  }
}

/** Does `s` contain any denylisted token (substring match, case-insensitive)? */
export function hasDeniedToken(s: string): boolean {
  const lower = s.toLowerCase()
  return DENYLIST.some((token) => lower.includes(token))
}

/** A handle in the username format that contains no denylisted token. */
export function isCleanHandle(s: string): boolean {
  return HANDLE_RE.test(s) && !hasDeniedToken(s)
}

function pick<T>(rng: RNG, list: readonly T[]): T {
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))]
}

/**
 * One clean handle. Templates: prefix+suffix+nn (35%), prefix+suffix (25%),
 * prefix+suffix+d (25%), prefix+nnn (15%). Throws PersonaUnavailableError after
 * 50 rejected tries, so it never returns an unclean handle.
 */
export function generateHandle(rng: RNG): string {
  for (let i = 0; i < HANDLE_MAX_TRIES; i++) {
    const template = rng()
    const prefix = pick(rng, PERSONA_PREFIXES)
    const candidate =
      template < 0.35 ? `${prefix}${pick(rng, PERSONA_SUFFIXES)}${randInt(rng, 10, 99)}`
      : template < 0.6 ? `${prefix}${pick(rng, PERSONA_SUFFIXES)}`
      : template < 0.85 ? `${prefix}${pick(rng, PERSONA_SUFFIXES)}${randInt(rng, 1, 9)}`
      : `${prefix}${randInt(rng, 100, 999)}`
    if (isCleanHandle(candidate)) return candidate
  }
  throw new PersonaUnavailableError()
}

/**
 * A handle no existing profile uses as `username` or `display_name` (the owner's
 * included). Up to 2 rounds of 6 unique clean candidates, each round checked with
 * one `findTaken` read, which must return the taken names lowercased and trimmed
 * (findTakenNames does; candidates are already lowercase). A `findTaken` rejection
 * propagates: an unchecked name is never returned.
 */
export async function pickPersonaName({
  rng = Math.random,
  findTaken = findTakenNames,
}: { rng?: RNG; findTaken?: (candidates: string[]) => Promise<Set<string>> } = {}): Promise<string> {
  for (let round = 0; round < PERSONA_ROUNDS; round++) {
    const unique = new Set<string>()
    // Bounded, so a degenerate rng can't spin forever; generateHandle itself throws after 50 rejects.
    for (let i = 0; unique.size < PERSONA_CANDIDATES && i < PERSONA_CANDIDATES * HANDLE_MAX_TRIES; i++) {
      unique.add(generateHandle(rng))
    }
    const candidates = [...unique]
    const taken = await findTaken(candidates)
    const free = candidates.find((c) => !taken.has(c))
    if (free) return free
  }
  throw new PersonaUnavailableError()
}

/**
 * The bot seat's `/players` card: human-shaped, with stable generated stats per
 * (gameId, name). Level 2–9, played 6–48, wins 40–60% of played.
 */
export function personaCard(gameId: string, name: string) {
  const rng = mulberry32(hashSeed(gameId + ":" + name))
  const level = randInt(rng, 2, 9)
  const played = randInt(rng, 6, 48)
  const wins = randInt(rng, Math.ceil((2 * played) / 5), Math.floor((3 * played) / 5))
  return {
    seat: "P2" as const,
    isAI: false,
    username: name,
    display_name: name,
    avatar_url: null,
    is_verified: false,
    level,
    record: { wins, losses: played - wins, played },
  }
}
