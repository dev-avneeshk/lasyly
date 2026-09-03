/**
 * User-facing date and time formatting.
 *
 * Everything here formats in the VIEWER'S local timezone (IST for a user in
 * India, ET for a user on the US east coast, etc). We never hardcode a zone,
 * so `Intl` picks up the browser's resolved timezone automatically.
 *
 * Format style is day-month ("30 Aug", "3 Oct"), not the US month/day, and
 * times are 12-hour with am/pm. These run on the client; on the server they
 * fall back to the runtime timezone, so prefer calling them from client
 * components (or components that hydrate) for match times.
 */

function toDate(input: string | number | Date): Date | null {
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input
  const d = new Date(input)
  return isNaN(d.getTime()) ? null : d
}

/** "3 Oct" — day and short month, viewer's timezone. */
export function formatDay(input: string | number | Date): string {
  const d = toDate(input)
  if (!d) return ""
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" })
}

/** "3 Oct 2026" — readable full date, viewer's timezone. */
export function formatDateReadable(input: string | number | Date): string {
  const d = toDate(input)
  if (!d) return ""
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

/** "30 August 2026" — long month, for profile/member-since style dates. */
export function formatDateLong(input: string | number | Date): string {
  const d = toDate(input)
  if (!d) return ""
  return d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
}

/** "12:30 am" — time only, viewer's timezone. */
export function formatTime(input: string | number | Date): string {
  const d = toDate(input)
  if (!d) return ""
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}

/**
 * Match kickoff shown on score cards. Collapses to just the time when the
 * game is today ("7:00 pm"), otherwise shows day + time ("3 Oct, 12:30 am").
 * All in the viewer's timezone, so a US night game reads correctly in IST.
 */
export function formatMatchTime(input: string | number | Date): string {
  const d = toDate(input)
  if (!d) return ""

  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()

  const time = formatTime(d)
  return sameDay ? time : `${formatDay(d)}, ${time}`
}

/**
 * Chat/message timestamp. "Today 7:04 pm" when today, else "3 Oct 7:04 pm".
 * Viewer's timezone.
 */
export function formatMessageTime(input: string | number | Date): string {
  const d = toDate(input)
  if (!d) return ""

  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()

  const time = formatTime(d)
  return sameDay ? `Today ${time}` : `${formatDay(d)} ${time}`
}

/**
 * Relative age with a readable-date fallback: "5m", "3h", "2d", then the full
 * date once it's more than a week old ("3 Oct 2026").
 */
export function formatRelative(input: string | number | Date): string {
  const d = toDate(input)
  if (!d) return ""

  const diffMs = Date.now() - d.getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return formatDateReadable(d)
}
