/**
 * Local-date helpers for the Props page date navigator and game strip.
 *
 * Everything is expressed as a local `YYYY-MM-DD` string rather than a Date so
 * the value can live in component state / the URL without timezone drift. The
 * API's `date` param expects the same format.
 */

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const

export interface DayOption {
  /** Local `YYYY-MM-DD` */
  iso: string
  /** e.g. "Wed" */
  dayName: string
  /** e.g. "Sep 17" */
  monthDay: string
  /** "Today" / "Yesterday" / "Tomorrow", otherwise null */
  relativeLabel: string | null
  isToday: boolean
}

/** Converts a Date to a local `YYYY-MM-DD` string. */
export function toLocalIso(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** Parses a local `YYYY-MM-DD` string into a Date at local midnight. */
export function parseLocalIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

/** Returns the local `YYYY-MM-DD` for today. */
export function todayIso(): string {
  return toLocalIso(new Date())
}

/** Shifts a local `YYYY-MM-DD` by a number of days. */
export function shiftIso(iso: string, days: number): string {
  const date = parseLocalIso(iso)
  date.setDate(date.getDate() + days)
  return toLocalIso(date)
}

/**
 * Builds a symmetric window of days around `centerIso`.
 * `radius = 1` yields the previous day, the centre day, and the next day.
 */
export function buildDayWindow(centerIso: string, todayIsoValue: string, radius = 1): DayOption[] {
  const out: DayOption[] = []
  for (let offset = -radius; offset <= radius; offset++) {
    const iso = shiftIso(centerIso, offset)
    const date = parseLocalIso(iso)
    const dayDelta = Math.round(
      (parseLocalIso(iso).getTime() - parseLocalIso(todayIsoValue).getTime()) / 86_400_000
    )
    out.push({
      iso,
      dayName: DAY_NAMES[date.getDay()],
      monthDay: `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`,
      relativeLabel:
        dayDelta === 0 ? "Today" : dayDelta === -1 ? "Yesterday" : dayDelta === 1 ? "Tomorrow" : null,
      isToday: dayDelta === 0,
    })
  }
  return out
}

// ─── Game time formatting ────────────────────────────────────────────────────

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Some feeds (the NFL engine) only give a game *date*, with no kickoff time.
 * Passing those through a time formatter produces a real-looking but meaningless
 * clock value, so date-only inputs are formatted as a date instead.
 */
export function formatGameTime(value?: string | null): string | null {
  if (!value) return null
  if (DATE_ONLY.test(value)) {
    const date = parseLocalIso(value)
    return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`
  }
  const date = new Date(value)
  if (isNaN(date.getTime())) return null
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true })
}

/** Same as {@link formatGameTime} but prefixed with the weekday. */
export function formatGameDayTime(value?: string | null): string | null {
  if (!value) return null
  if (DATE_ONLY.test(value)) {
    const date = parseLocalIso(value)
    return `${DAY_NAMES[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`
  }
  const date = new Date(value)
  if (isNaN(date.getTime())) return null
  const day = DAY_NAMES[date.getDay()]
  return `${day}, ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true })}`
}

// ─── Season labelling ────────────────────────────────────────────────────────

export interface SeasonInfo {
  /** e.g. "NFL 2026" */
  label: string
  /** e.g. "Regular Season" */
  phase: string
  /** ESPN league logo, or null for sports without a single league crest. */
  logoUrl: string | null
}

function espnLeagueLogo(slug: string): string {
  return `https://a.espncdn.com/i/teamlogos/leagues/500/${slug}.png`
}

/**
 * Derives a display-only season label for the header chip.
 *
 * These are calendar heuristics for a label, not a data filter — the props feed
 * is always the current season. Boundary weeks may read one phase early/late.
 */
export function getSeasonInfo(sport: string, reference: Date = new Date()): SeasonInfo {
  const year = reference.getFullYear()
  const month = reference.getMonth() // 0 = Jan

  switch (sport) {
    case "NFL": {
      // Season is named for the year it starts in (Sep → Feb).
      const season = month >= 7 ? year : year - 1
      const phase = month === 0 || month === 1 ? "Postseason" : month >= 7 ? "Regular Season" : "Offseason"
      return { label: `NFL ${season}`, phase, logoUrl: espnLeagueLogo("nfl") }
    }
    case "NBA": {
      const season = month >= 9 ? year : year - 1
      const phase = month >= 3 && month <= 5 ? "Playoffs" : "Regular Season"
      return {
        label: `NBA ${season}-${String(season + 1).slice(2)}`,
        phase,
        logoUrl: espnLeagueLogo("nba"),
      }
    }
    case "NHL": {
      const season = month >= 9 ? year : year - 1
      const phase = month >= 3 && month <= 5 ? "Playoffs" : "Regular Season"
      return {
        label: `NHL ${season}-${String(season + 1).slice(2)}`,
        phase,
        logoUrl: espnLeagueLogo("nhl"),
      }
    }
    case "Soccer": {
      const season = month >= 6 ? year : year - 1
      return {
        label: `Soccer ${season}/${String(season + 1).slice(2)}`,
        phase: "Club Season",
        logoUrl: null,
      }
    }
    default:
      return { label: `Tennis ${year}`, phase: "ATP / WTA Tour", logoUrl: null }
  }
}
