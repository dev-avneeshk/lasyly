/**
 * SEO metadata generation utilities for public pages.
 *
 * Pure, deterministic functions that produce title and description strings
 * conforming to SEO length constraints.
 */

const SITE_NAME = "Lasyly"

// ─── Player Page Metadata ───────────────────────────────────────────────────

const PLAYER_TITLE_SUFFIX = " Props Today — Hit Rates & Matchup Grade"
const PLAYER_TITLE_MAX = 60

/**
 * Generate player page title (max 60 chars).
 * Pattern: `{Name} Props Today — Hit Rates & Matchup Grade | Lasyly`
 * Truncates player name with ellipsis if the full title exceeds 60 chars.
 */
export function generatePlayerTitle(playerName: string): string {
  const name = playerName.trim()
  const full = `${name}${PLAYER_TITLE_SUFFIX}`

  if (full.length <= PLAYER_TITLE_MAX) {
    return full
  }

  // Truncate name to fit within max length, leaving room for "…" + suffix
  const maxNameLength = PLAYER_TITLE_MAX - PLAYER_TITLE_SUFFIX.length - 1 // -1 for "…"
  const truncatedName = name.slice(0, maxNameLength).trimEnd()
  return `${truncatedName}…${PLAYER_TITLE_SUFFIX}`
}

/**
 * Generate player page meta description (120-160 chars).
 * Summarizes the player's current prop line, hit rate, and matchup grade.
 */
export function generatePlayerDescription(
  playerName: string,
  statCategory: string,
  propLine: number,
  hitRate: number,
  matchupGrade: string
): string {
  const name = playerName.trim()
  const stat = statCategory.trim()
  const grade = matchupGrade.trim().toUpperCase()
  const rate = Math.round(hitRate)

  // Primary description attempt
  const primary = `${name} ${stat} prop set at ${propLine} — hitting ${rate}% over the last 10 games with a ${grade} matchup grade. View full analysis on ${SITE_NAME}.`

  if (primary.length >= 120 && primary.length <= 160) {
    return primary
  }

  if (primary.length > 160) {
    // Shorter variant without "View full analysis" suffix
    const shorter = `${name} ${stat} prop set at ${propLine} — hitting ${rate}% over the last 10 games with a ${grade} matchup grade.`
    if (shorter.length >= 120 && shorter.length <= 160) {
      return shorter
    }

    // Even shorter: trim further
    const minimal = `${name} ${stat} at ${propLine} — ${rate}% hit rate, grade ${grade}. Get today's prop analysis and matchup insights on ${SITE_NAME}.`
    if (minimal.length >= 120 && minimal.length <= 160) {
      return minimal
    }

    // Fallback: pad or trim to exactly 160
    const fallback = `${name} ${stat} prop at ${propLine}. Hitting ${rate}% with ${grade} matchup grade. Full prop analysis and picks on ${SITE_NAME}.`
    if (fallback.length >= 120 && fallback.length <= 160) {
      return fallback
    }

    // Last resort: truncate to 160
    return fallback.slice(0, 160)
  }

  // primary.length < 120 — pad with additional context
  const padded = `${name} ${stat} prop set at ${propLine} — hitting ${rate}% over the last 10 games with a ${grade} matchup grade. View full analysis and picks on ${SITE_NAME}.`
  if (padded.length >= 120 && padded.length <= 160) {
    return padded
  }

  if (padded.length > 160) {
    return padded.slice(0, 160)
  }

  // Still too short — add more padding
  const extraPadded = padded + " Free daily prop insights."
  if (extraPadded.length > 160) {
    return extraPadded.slice(0, 160)
  }
  // Pad with spaces if still under 120 (extremely unlikely edge case)
  return extraPadded.padEnd(120)
}

// ─── Props Page Metadata ────────────────────────────────────────────────────

/**
 * Generate today's props page title with date.
 * Pattern: `Today's Player Props — {Month D, YYYY} | Hit Rates & Picks | Lasyly`
 */
export function generatePropsTitle(date: Date): string {
  const formatted = formatDateLong(date)
  return `Today's Player Props — ${formatted} | Hit Rates & Picks`
}

/**
 * Generate today's props description (max 160 chars).
 * Lists the number of props available and the sports covered.
 */
export function generatePropsDescription(propCount: number, sports: string[]): string {
  const count = Math.max(0, Math.round(propCount))
  const sportsList = sports.length > 0 ? sports.join(", ") : "all sports"

  const primary = `Browse ${count} player props for today's games across ${sportsList}. Hit rates, matchup grades, and picks updated daily on ${SITE_NAME}.`

  if (primary.length <= 160) {
    return primary
  }

  // Shorter: limit sports list
  const shortSports = sports.length > 3
    ? sports.slice(0, 3).join(", ") + ` +${sports.length - 3} more`
    : sportsList

  const shorter = `Browse ${count} player props across ${shortSports}. Hit rates, matchup grades, and picks updated daily on ${SITE_NAME}.`

  if (shorter.length <= 160) {
    return shorter
  }

  // Minimal
  const minimal = `${count} player props today across ${shortSports}. Hit rates and matchup grades on ${SITE_NAME}.`

  if (minimal.length <= 160) {
    return minimal
  }

  return minimal.slice(0, 160)
}

// ─── Scores Page Metadata ───────────────────────────────────────────────────

/**
 * Generate scores page title.
 * Pattern: `{Sport} Live Scores Today — {MMM D, YYYY} | Lasyly`
 */
export function generateScoresTitle(sportName: string, date: Date): string {
  const formatted = formatDateShort(date)
  return `${sportName.trim()} Live Scores Today — ${formatted}`
}

/**
 * Generate scores page description (max 160 chars).
 * Lists the number of matches and their statuses for the specified sport.
 */
export function generateScoresDescription(
  sportName: string,
  matchCount: number,
  liveCount: number,
  upcomingCount: number
): string {
  const sport = sportName.trim()
  const total = Math.max(0, Math.round(matchCount))
  const live = Math.max(0, Math.round(liveCount))
  const upcoming = Math.max(0, Math.round(upcomingCount))

  if (total === 0) {
    const empty = `No ${sport} matches scheduled for today. Check back later for live scores and results on ${SITE_NAME}.`
    return empty.length <= 160 ? empty : empty.slice(0, 160)
  }

  const primary = `${total} ${sport} matches today — ${live} live, ${upcoming} upcoming. Real-time scores, results, and schedules on ${SITE_NAME}.`

  if (primary.length <= 160) {
    return primary
  }

  const shorter = `${total} ${sport} matches today — ${live} live, ${upcoming} upcoming. Live scores on ${SITE_NAME}.`

  if (shorter.length <= 160) {
    return shorter
  }

  return shorter.slice(0, 160)
}

// ─── Date Formatting Helpers ────────────────────────────────────────────────

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

/** Format date as "Month D, YYYY" (e.g., "January 5, 2025") */
function formatDateLong(date: Date): string {
  const month = MONTHS_LONG[date.getMonth()]
  const day = date.getDate()
  const year = date.getFullYear()
  return `${month} ${day}, ${year}`
}

/** Format date as "MMM D, YYYY" (e.g., "Jan 5, 2025") */
function formatDateShort(date: Date): string {
  const month = MONTHS_SHORT[date.getMonth()]
  const day = date.getDate()
  const year = date.getFullYear()
  return `${month} ${day}, ${year}`
}
