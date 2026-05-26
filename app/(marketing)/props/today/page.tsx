import type { Metadata } from "next"
import Link from "next/link"
import { JsonLd } from "@/components/seo/JsonLd"
import { getTodaysPublicProps, type PublicPropEntry } from "@/lib/data/public-props"
import { generatePropsTitle, generatePropsDescription } from "@/lib/seo/metadata"
import { LoadMoreProps } from "./LoadMoreProps"

export const revalidate = 3600

/**
 * Get the current date in US Eastern Time.
 */
function getEasternDate(): Date {
  const now = new Date()
  const eastern = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  )
  return eastern
}

/**
 * Format a date as "Month D, YYYY" for display.
 */
function formatDisplayDate(date: Date): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ]
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

export async function generateMetadata(): Promise<Metadata> {
  const easternDate = getEasternDate()

  let propCount = 0
  let sports: string[] = []

  try {
    const data = await getTodaysPublicProps()
    propCount = data.totalCount
    sports = data.sports
  } catch {
    // Fallback metadata if data fetch fails
  }

  const title = generatePropsTitle(easternDate)
  const description = generatePropsDescription(propCount, sports)

  return {
    title,
    description,
    alternates: {
      canonical: "https://lasyly.me/props/today",
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: "https://lasyly.me/props/today",
    },
  }
}

const INITIAL_DISPLAY_COUNT = 200

export default async function TodaysPropsPage() {
  const easternDate = getEasternDate()
  const displayDate = formatDisplayDate(easternDate)

  let props: PublicPropEntry[] = []
  let totalCount = 0
  let sports: string[] = []
  let fetchError = false

  try {
    const data = await getTodaysPublicProps()
    props = data.props
    totalCount = data.totalCount
    sports = data.sports
  } catch {
    fetchError = true
  }

  // Build JSON-LD ItemList
  const jsonLdData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `Today's Player Props — ${displayDate}`,
    "numberOfItems": totalCount,
    "itemListElement": props.slice(0, INITIAL_DISPLAY_COUNT).map((prop, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": `${prop.playerName} ${prop.statCategory} ${prop.propLine}`,
      "url": `https://lasyly.me/players/${prop.playerSlug}`,
    })),
  }

  // Group props by sport, then by game
  const grouped = groupPropsBySportAndGame(props)

  // Split for load-more
  const initialProps = props.slice(0, INITIAL_DISPLAY_COUNT)
  const remainingProps = props.slice(INITIAL_DISPLAY_COUNT)
  const initialGrouped = groupPropsBySportAndGame(initialProps)

  return (
    <>
      <JsonLd data={jsonLdData} />

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-16 sm:pb-24">
        {/* Page header */}
        <div className="mb-10">
          <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--color-lime)] bg-[var(--color-lime)]/8 px-3 py-1.5 rounded-full border border-[var(--color-lime)]/15 mb-4">
            Updated hourly
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold font-serif tracking-tight text-white leading-tight mb-3">
            Today&apos;s Player Props
          </h1>
          <p className="text-base sm:text-lg text-[var(--color-text-muted)] leading-relaxed">
            {displayDate} &middot; {totalCount} props across {sports.length > 0 ? sports.join(", ") : "all sports"}
          </p>
        </div>

        {/* Error state */}
        {fetchError && (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
            <p className="text-[var(--color-text-muted)]">
              Data is temporarily unavailable. Please check back shortly.
            </p>
          </div>
        )}

        {/* Empty state */}
        {!fetchError && totalCount === 0 && (
          <EmptyState />
        )}

        {/* Props listing */}
        {!fetchError && totalCount > 0 && (
          <>
            {/* Render grouped props */}
            {Object.entries(initialGrouped).map(([sport, games]) => (
              <div key={sport} className="mb-10">
                {/* Sport header */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-2 h-2 rounded-full bg-[var(--color-lime)]" />
                  <h2 className="text-xl font-bold text-white">{sport}</h2>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {Object.values(games).reduce((sum, g) => sum + g.length, 0)} props
                  </span>
                </div>

                {/* Games within sport */}
                {Object.entries(games).map(([gameKey, gameProps]) => (
                  <div key={gameKey} className="mb-6">
                    {/* Game header */}
                    <div className="flex items-center gap-2 mb-3 pl-5">
                      <span className="text-sm font-semibold text-white/80">
                        {gameProps[0].game.awayTeam} @ {gameProps[0].game.homeTeam}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        &middot; {formatGameTime(gameProps[0].game.startTime)}
                      </span>
                    </div>

                    {/* Props table */}
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
                      {/* Table header */}
                      <div className="hidden sm:grid grid-cols-[1fr_120px_80px_90px_70px] gap-2 px-4 py-2.5 border-b border-[var(--color-border)] bg-white/[0.02]">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Player</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Stat</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] text-right">Line</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] text-right">L10 Hit</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] text-center">Grade</span>
                      </div>

                      {/* Prop rows */}
                      {gameProps.map((prop) => (
                        <PropRow key={`${prop.playerSlug}-${prop.statCategory}`} prop={prop} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {/* Load more for >200 props */}
            {remainingProps.length > 0 && (
              <LoadMoreProps props={remainingProps} />
            )}

            {/* CTA */}
            <div className="mt-12 rounded-2xl p-[1px] bg-gradient-to-r from-[var(--color-lime)]/20 via-transparent to-[#6C63FF]/15">
              <div className="rounded-[calc(1rem-1px)] bg-[var(--color-surface)] p-8 sm:p-10 text-center">
                <h3 className="text-xl sm:text-2xl font-bold font-serif text-white mb-3">
                  Get deeper analysis on every prop
                </h3>
                <p className="text-sm text-[var(--color-text-muted)] mb-6 max-w-md mx-auto">
                  Sign up free for full matchup breakdowns, trend charts, confidence scores, and real-time alerts.
                </p>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 bg-[var(--color-lime)] text-black font-bold px-7 py-3.5 rounded-full text-sm hover:scale-[0.98] active:scale-[0.96] transition-transform duration-300"
                >
                  Sign up free
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </Link>
              </div>
            </div>
          </>
        )}
      </section>
    </>
  )
}

/**
 * Individual prop row component.
 */
function PropRow({ prop }: { prop: PublicPropEntry }) {
  const gradeColor = getGradeColor(prop.matchupGrade)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_80px_90px_70px] gap-1 sm:gap-2 px-4 py-3 border-b border-[var(--color-border)] last:border-b-0 hover:bg-white/[0.02] transition-colors">
      {/* Player name (linked) */}
      <div className="flex items-center gap-2">
        <Link
          href={`/players/${prop.playerSlug}`}
          className="text-sm font-semibold text-white hover:text-[var(--color-lime)] transition-colors"
        >
          {prop.playerName}
        </Link>
        <span className="text-[11px] text-[var(--color-text-muted)] hidden sm:inline">{prop.team}</span>
      </div>

      {/* Mobile layout: stat + line + hit + grade in a row */}
      <div className="flex items-center gap-3 sm:hidden text-xs text-[var(--color-text-muted)]">
        <span>{prop.statCategory}</span>
        <span className="font-semibold text-white">{prop.propLine}</span>
        <span className={prop.l10HitRate >= 60 ? "text-green-400" : prop.l10HitRate >= 40 ? "text-yellow-400" : "text-red-400"}>
          {prop.l10HitRate}%
        </span>
        <span className={`text-xs font-bold ${gradeColor}`}>{prop.matchupGrade}</span>
      </div>

      {/* Desktop columns */}
      <span className="hidden sm:flex items-center text-sm text-[var(--color-text-muted)]">
        {prop.statCategory}
      </span>
      <span className="hidden sm:flex items-center justify-end text-sm font-semibold text-white">
        {prop.propLine}
      </span>
      <span className={`hidden sm:flex items-center justify-end text-sm font-medium ${prop.l10HitRate >= 60 ? "text-green-400" : prop.l10HitRate >= 40 ? "text-yellow-400" : "text-red-400"}`}>
        {prop.l10HitRate}%
      </span>
      <span className={`hidden sm:flex items-center justify-center text-sm font-bold ${gradeColor}`}>
        {prop.matchupGrade}
      </span>
    </div>
  )
}

/**
 * Empty state when no props are available today.
 */
function EmptyState() {
  // Generate next 3 dates (tomorrow, day after, etc.)
  const nextDates: Date[] = []
  const today = new Date()
  for (let i = 1; i <= 3; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    nextDates.push(d)
  }

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-10 sm:p-14 text-center">
      <div className="w-12 h-12 rounded-full bg-[var(--color-lime)]/10 flex items-center justify-center mx-auto mb-5">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[var(--color-lime)]">
          <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-white mb-2">No props available today</h2>
      <p className="text-sm text-[var(--color-text-muted)] mb-6 max-w-sm mx-auto">
        There are no scheduled games for today. Check back on one of these upcoming dates:
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {nextDates.map((date) => (
          <Link
            key={date.toISOString()}
            href="/props/today"
            className="text-sm font-medium text-[var(--color-lime)] border border-[var(--color-lime)]/20 rounded-full px-4 py-2 hover:bg-[var(--color-lime)]/5 transition-colors"
          >
            {formatDisplayDate(date)}
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Group props by sport, then by game key (away @ home).
 */
function groupPropsBySportAndGame(
  props: PublicPropEntry[]
): Record<string, Record<string, PublicPropEntry[]>> {
  const grouped: Record<string, Record<string, PublicPropEntry[]>> = {}

  for (const prop of props) {
    if (!grouped[prop.sport]) {
      grouped[prop.sport] = {}
    }
    const gameKey = `${prop.game.awayTeam}@${prop.game.homeTeam}`
    if (!grouped[prop.sport][gameKey]) {
      grouped[prop.sport][gameKey] = []
    }
    grouped[prop.sport][gameKey].push(prop)
  }

  return grouped
}

/**
 * Format a game start time for display.
 */
function formatGameTime(startTime: string): string {
  try {
    const date = new Date(startTime)
    if (isNaN(date.getTime())) return startTime
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
    }) + " ET"
  } catch {
    return startTime
  }
}

/**
 * Get Tailwind color class for matchup grade.
 */
function getGradeColor(grade: string): string {
  switch (grade) {
    case "A": return "text-green-400"
    case "B": return "text-emerald-400"
    case "C": return "text-yellow-400"
    case "D": return "text-orange-400"
    case "F": return "text-red-400"
    default: return "text-[var(--color-text-muted)]"
  }
}
