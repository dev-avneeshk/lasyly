import { notFound } from "next/navigation"
import Link from "next/link"
import type { Metadata } from "next"
import { JsonLd } from "@/components/seo/JsonLd"
import { SPORT_SLUG_MAP } from "@/lib/seo/player-slug"
import { generateScoresTitle, generateScoresDescription } from "@/lib/seo/metadata"
import { createAdminClient } from "@/lib/supabase/admin"

// ─── Types ───────────────────────────────────────────────────────────────────

interface MatchRow {
  id: string
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  status: string
  start_time: string | null
  match_date: string
  venue: string | null
  league: string
  home_logo: string | null
  away_logo: string | null
}

// ─── League Mapping ──────────────────────────────────────────────────────────

/**
 * Maps sport slugs to the league identifiers used in the espn_games table.
 * Some sports map to multiple leagues (e.g., premier-league → eng.1).
 */
const SLUG_TO_LEAGUES: Record<string, string[]> = {
  nba: ["nba"],
  nfl: ["nfl"],
  nhl: ["nhl"],
  mlb: ["mlb"],
  "premier-league": ["eng.1"],
  "champions-league": ["uefa.champions"],
  mls: ["usa.1"],
  atp: ["atp"],
  wta: ["wta"],
  ufc: ["ufc"],
  f1: ["f1"],
  cricket: ["cricket"],
}

// ─── Data Fetching ───────────────────────────────────────────────────────────

async function getScoresForSport(sportSlug: string): Promise<MatchRow[]> {
  const leagues = SLUG_TO_LEAGUES[sportSlug]
  if (!leagues) return []

  const supabase = createAdminClient()
  const today = new Date().toISOString().split("T")[0] // UTC date YYYY-MM-DD

  const { data, error } = await supabase
    .from("espn_games")
    .select("id, home_team, away_team, home_score, away_score, status, start_time, match_date, venue, league, home_logo, away_logo")
    .in("league", leagues)
    .eq("match_date", today)
    .order("start_time", { ascending: true })

  if (error || !data) return []
  return data as MatchRow[]
}

// ─── Status Helpers ──────────────────────────────────────────────────────────

type NormalizedStatus = "live" | "upcoming" | "finished"

function normalizeStatus(status: string): NormalizedStatus {
  const lower = status.toLowerCase()
  if (
    lower === "in progress" ||
    lower === "halftime" ||
    lower === "first half" ||
    lower === "second half" ||
    lower === "q1" || lower === "q2" || lower === "q3" || lower === "q4" ||
    lower === "ot" ||
    lower === "live"
  ) {
    return "live"
  }
  if (lower === "finished" || lower === "completed" || lower === "final") {
    return "finished"
  }
  return "upcoming"
}

// ─── Metadata ────────────────────────────────────────────────────────────────

type PageProps = {
  params: Promise<{ sportSlug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sportSlug } = await params
  const sportConfig = SPORT_SLUG_MAP[sportSlug]

  if (!sportConfig) {
    return { title: "Sport Not Found | Lasyly" }
  }

  const matches = await getScoresForSport(sportSlug)
  const today = new Date()
  const liveCount = matches.filter((m) => normalizeStatus(m.status) === "live").length
  const upcomingCount = matches.filter((m) => normalizeStatus(m.status) === "upcoming").length

  const title = generateScoresTitle(sportConfig.name, today)
  const description = generateScoresDescription(sportConfig.name, matches.length, liveCount, upcomingCount)

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `https://lasyly.me/scores/${sportSlug}`,
    },
    alternates: {
      canonical: `https://lasyly.me/scores/${sportSlug}`,
    },
  }
}

// ─── JSON-LD Generation ──────────────────────────────────────────────────────

function generateSportsEventJsonLd(matches: MatchRow[], sportName: string) {
  if (matches.length === 0) return null

  const events = matches.map((match) => {
    const status = normalizeStatus(match.status)
    let eventStatus: string
    switch (status) {
      case "live":
        eventStatus = "https://schema.org/EventScheduled"
        break
      case "finished":
        eventStatus = "https://schema.org/EventCompleted"
        break
      default:
        eventStatus = "https://schema.org/EventScheduled"
    }

    return {
      "@type": "SportsEvent",
      name: `${match.home_team} vs ${match.away_team}`,
      startDate: match.start_time || match.match_date,
      homeTeam: {
        "@type": "SportsTeam",
        name: match.home_team,
      },
      awayTeam: {
        "@type": "SportsTeam",
        name: match.away_team,
      },
      location: match.venue
        ? { "@type": "Place", name: match.venue }
        : undefined,
      eventStatus,
      sport: sportName,
    }
  })

  return {
    "@context": "https://schema.org",
    "@graph": events,
  }
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default async function ScoresPage({ params }: PageProps) {
  const { sportSlug } = await params
  const sportConfig = SPORT_SLUG_MAP[sportSlug]

  if (!sportConfig) {
    notFound()
  }

  const matches = await getScoresForSport(sportSlug)
  const hasLive = matches.some((m) => normalizeStatus(m.status) === "live")
  const liveCount = matches.filter((m) => normalizeStatus(m.status) === "live").length
  const upcomingCount = matches.filter((m) => normalizeStatus(m.status) === "upcoming").length
  const finishedCount = matches.filter((m) => normalizeStatus(m.status) === "finished").length

  const jsonLd = generateSportsEventJsonLd(matches, sportConfig.name)

  return (
    <div className="min-h-screen">
      {jsonLd && <JsonLd data={jsonLd} />}

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-10">
        {/* Header */}
        <div className="mb-8">
          <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--color-lime)] bg-[var(--color-lime)]/8 px-3 py-1.5 rounded-full border border-[var(--color-lime)]/15 mb-4">
            Live Scores
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold font-serif tracking-tight text-white mb-2">
            {sportConfig.name} Scores Today
          </h1>
          <p className="text-[var(--color-text-muted)] text-sm">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}
          </p>
        </div>

        {/* Status Summary */}
        {matches.length > 0 && (
          <div className="flex items-center gap-3 mb-8 flex-wrap">
            {liveCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#25d65f] bg-[#25d65f]/10 px-3 py-1.5 rounded-full border border-[#25d65f]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#25d65f] animate-pulse" />
                {liveCount} Live
              </span>
            )}
            {upcomingCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white/60 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                {upcomingCount} Upcoming
              </span>
            )}
            {finishedCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white/40 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                {finishedCount} Finished
              </span>
            )}
          </div>
        )}

        {/* Match Cards */}
        {matches.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white/70 mb-2">No matches scheduled</h2>
            <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto">
              There are no {sportConfig.name} matches scheduled for today. Check back later for upcoming games and live scores.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {matches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )}

        {/* CTA Section */}
        <div className="mt-12 rounded-2xl p-[1px] bg-gradient-to-br from-[var(--color-lime)]/20 via-transparent to-transparent">
          <div className="rounded-[calc(1rem-1px)] bg-[var(--color-surface)] p-8 text-center">
            <h2 className="text-xl font-bold text-white mb-2">Get real-time score updates</h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-5 max-w-md mx-auto">
              Sign up for free to get live score notifications, prop analytics, and join betting rooms with other fans.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-[var(--color-lime)] text-black font-bold text-sm px-6 py-3 rounded-full hover:opacity-90 transition-opacity"
            >
              Sign up free
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

// ─── ISR Configuration ───────────────────────────────────────────────────────

// Dynamic revalidation: we export a function that checks for live matches.
// Next.js App Router uses the `revalidate` export for ISR timing.
// We set a short revalidation when live matches might exist (30s),
// and a longer one otherwise (300s / 5 minutes).
// Since we can't dynamically set revalidate per-request in a static export,
// we use the shorter interval to ensure live matches are fresh.
// The page will still be fast due to ISR caching.

// Note: We use a dynamic approach — if the page detects live matches during render,
// it uses 30s revalidation. Otherwise 300s.
// In Next.js App Router, we achieve this via `revalidate` in the route segment config.
// Since we need conditional revalidation, we'll use the minimum (30s) as default
// and rely on ISR to serve cached pages quickly.

export const revalidate = 30

// ─── Match Card Component ────────────────────────────────────────────────────

function MatchCard({ match }: { match: MatchRow }) {
  const status = normalizeStatus(match.status)
  const isLive = status === "live"
  const isFinished = status === "finished"

  const startTime = match.start_time
    ? new Date(match.start_time).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "UTC",
      })
    : null

  return (
    <div
      className={`rounded-2xl p-4 border transition-all ${
        isLive
          ? "bg-gradient-to-r from-[#25d65f]/[0.04] to-transparent border-[#25d65f]/20"
          : isFinished
          ? "bg-[var(--color-surface)] border-white/[0.06]"
          : "bg-[var(--color-surface)] border-white/[0.06]"
      }`}
    >
      {/* League + Status Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold text-white/50 uppercase truncate">
          {match.league}
        </span>
        <div className="flex items-center gap-1.5">
          {isLive && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-[#25d65f] animate-pulse" />
              <span className="text-[10px] font-bold text-[#25d65f]">LIVE</span>
            </>
          )}
          {isFinished && (
            <span className="text-[10px] font-bold text-white/30 bg-white/5 rounded-full px-2 py-0.5">
              FT
            </span>
          )}
          {status === "upcoming" && startTime && (
            <span className="text-[10px] font-medium text-white/40">
              {startTime}
            </span>
          )}
        </div>
      </div>

      {/* Teams + Scores */}
      <div className="space-y-2">
        {/* Home Team */}
        <div className="flex items-center gap-2.5">
          {match.home_logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={match.home_logo}
              alt=""
              className="w-6 h-6 object-contain shrink-0"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-[8px] font-bold text-white/50 shrink-0">
              {match.home_team.slice(0, 3)}
            </div>
          )}
          <span
            className={`flex-1 text-sm font-semibold truncate ${
              isFinished && (match.home_score ?? 0) > (match.away_score ?? 0)
                ? "text-white"
                : "text-white/80"
            }`}
          >
            {match.home_team}
          </span>
          <span
            className={`text-lg font-black tabular-nums min-w-[24px] text-right ${
              isLive
                ? "text-white"
                : isFinished
                ? (match.home_score ?? 0) > (match.away_score ?? 0)
                  ? "text-white"
                  : "text-white/50"
                : "text-white/30"
            }`}
          >
            {status === "upcoming" ? "-" : (match.home_score ?? 0)}
          </span>
        </div>

        {/* Away Team */}
        <div className="flex items-center gap-2.5">
          {match.away_logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={match.away_logo}
              alt=""
              className="w-6 h-6 object-contain shrink-0"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-[8px] font-bold text-white/50 shrink-0">
              {match.away_team.slice(0, 3)}
            </div>
          )}
          <span
            className={`flex-1 text-sm font-semibold truncate ${
              isFinished && (match.away_score ?? 0) > (match.home_score ?? 0)
                ? "text-white"
                : "text-white/80"
            }`}
          >
            {match.away_team}
          </span>
          <span
            className={`text-lg font-black tabular-nums min-w-[24px] text-right ${
              isLive
                ? "text-white"
                : isFinished
                ? (match.away_score ?? 0) > (match.home_score ?? 0)
                  ? "text-white"
                  : "text-white/50"
                : "text-white/30"
            }`}
          >
            {status === "upcoming" ? "-" : (match.away_score ?? 0)}
          </span>
        </div>
      </div>

      {/* Venue */}
      {match.venue && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <span className="text-[10px] text-white/30 truncate block">
            📍 {match.venue}
          </span>
        </div>
      )}
    </div>
  )
}
