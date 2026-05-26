import { notFound } from "next/navigation"
import Link from "next/link"
import type { Metadata } from "next"
import { getPublicPlayerBySlug } from "@/lib/data/public-players"
import { generatePlayerTitle, generatePlayerDescription } from "@/lib/seo/metadata"
import { JsonLd } from "@/components/seo/JsonLd"

// ISR: revalidate every 5 minutes
export const revalidate = 300

// ─── Metadata ───────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ playerSlug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { playerSlug } = await params
  const player = await getPublicPlayerBySlug(playerSlug)

  if (!player) {
    return { title: "Player Not Found | Lasyly" }
  }

  const title = generatePlayerTitle(player.name)
  const description =
    player.propLine !== null && player.hitRate && player.matchupGrade && player.statCategory
      ? generatePlayerDescription(
          player.name,
          player.statCategory,
          player.propLine,
          player.hitRate.l10,
          player.matchupGrade
        )
      : `${player.name} player prop analysis — hit rates, matchup grades, and trend data on Lasyly. Sign up for full access to daily picks and insights.`

  const canonicalUrl = `https://lasyly.me/players/${playerSlug}`

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      type: "article",
      url: canonicalUrl,
      siteName: "Lasyly",
    },
  }
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default async function PlayerPage({ params }: PageProps) {
  const { playerSlug } = await params
  const player = await getPublicPlayerBySlug(playerSlug)

  if (!player) {
    notFound()
  }

  const hasProps = player.propLine !== null && player.statCategory !== null

  // JSON-LD structured data
  const jsonLdData: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${player.name} Props Analysis`,
    author: { "@type": "Organization", name: "Lasyly" },
    publisher: { "@type": "Organization", name: "Lasyly" },
    datePublished: new Date().toISOString().split("T")[0],
    dateModified: new Date().toISOString().split("T")[0],
    description: hasProps
      ? `${player.name} ${player.statCategory} prop analysis with hit rates and matchup grade.`
      : `${player.name} player profile on Lasyly.`,
    about: {
      "@type": "Person",
      name: player.name,
      ...(player.team && { memberOf: { "@type": "SportsTeam", name: player.team } }),
    },
    ...(hasProps && {
      mainEntity: {
        "@type": "SportsEvent",
        name: `${player.name} ${player.statCategory} Prop`,
        sport: player.sport,
      },
    }),
  }

  return (
    <>
      <JsonLd data={jsonLdData} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        {/* Player Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] mb-2">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <span>/</span>
            <span>Players</span>
            <span>/</span>
            <span className="text-white">{player.name}</span>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">{player.name}</h1>
              <div className="flex items-center gap-3 text-sm text-[var(--color-text-muted)]">
                {player.team && <span className="font-medium">{player.team}</span>}
                {player.team && player.sport && <span>·</span>}
                {player.sport && <span>{player.sport}</span>}
                {player.position && <span>· {player.position}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* No Props State */}
        {!hasProps && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8 text-center mb-8">
            <div className="text-4xl mb-4">📊</div>
            <h2 className="text-lg font-semibold text-white mb-2">No active prop lines</h2>
            <p className="text-[var(--color-text-muted)] text-sm max-w-md mx-auto">
              There are currently no active prop lines available for {player.name}. Check back when games are scheduled.
            </p>
          </div>
        )}

        {/* Props Data */}
        {hasProps && (
          <div className="space-y-6">
            {/* Prop Line Card */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Current Prop Line
                </h2>
                {player.trend && (
                  <div className="flex items-center gap-1.5">
                    <TrendArrow direction={player.trend} />
                    {player.trendPct !== null && (
                      <span className={`text-xs font-medium ${
                        player.trend === "up" ? "text-[var(--color-lime)]" :
                        player.trend === "down" ? "text-red-400" :
                        "text-[var(--color-text-muted)]"
                      }`}>
                        {player.trendPct}%
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-baseline gap-3 mb-1">
                <span className="text-4xl font-bold text-white">{player.propLine}</span>
                <span className="text-lg text-[var(--color-text-muted)] uppercase font-medium">
                  {player.statCategory}
                </span>
              </div>
            </div>

            {/* Hit Rates */}
            {player.hitRate && (
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">
                  Hit Rates
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  <HitRateCard label="Last 5" value={player.hitRate.l5} />
                  <HitRateCard label="Last 10" value={player.hitRate.l10} />
                  <HitRateCard label="Season" value={player.hitRate.season} />
                </div>
              </div>
            )}

            {/* Matchup Grade + Streak */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Matchup Grade */}
              {player.matchupGrade && (
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">
                    Matchup Grade
                  </h2>
                  <div className="flex items-center justify-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold border-2 ${getGradeColor(player.matchupGrade)}`}>
                      {player.matchupGrade}
                    </div>
                  </div>
                </div>
              )}

              {/* Streak Dots */}
              {player.streak.length > 0 && (
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">
                    Last 10 Games
                  </h2>
                  <div className="flex items-center justify-center gap-2">
                    {player.streak.map((result, i) => (
                      <div
                        key={i}
                        className={`w-5 h-5 rounded-full ${
                          result === "over"
                            ? "bg-[var(--color-lime)]"
                            : "bg-red-500/80"
                        }`}
                        title={`Game ${i + 1}: ${result}`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mt-2 px-1">
                    <span>Most recent</span>
                    <span>Oldest</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/signup"
            className="w-full sm:w-auto text-center text-sm font-semibold bg-[var(--color-lime)] text-black px-6 py-3 rounded-full hover:opacity-90 transition-opacity"
          >
            Sign up for full analysis
          </Link>
          <Link
            href={`/analysis/${playerSlug}?sport=${player.sport}`}
            className="w-full sm:w-auto text-center text-sm font-medium text-[var(--color-text-muted)] border border-[var(--color-border)] px-6 py-3 rounded-full hover:text-white hover:border-white/30 transition-colors"
          >
            View detailed analysis →
          </Link>
        </div>
      </div>
    </>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function HitRateCard({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value)
  const color =
    pct >= 70 ? "text-[var(--color-lime)]" :
    pct >= 50 ? "text-yellow-400" :
    "text-red-400"

  return (
    <div className="text-center">
      <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{pct}%</div>
    </div>
  )
}

function TrendArrow({ direction }: { direction: "up" | "down" | "neutral" }) {
  if (direction === "up") {
    return (
      <svg className="w-4 h-4 text-[var(--color-lime)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    )
  }
  if (direction === "down") {
    return (
      <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    )
  }
  return (
    <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
    </svg>
  )
}

function getGradeColor(grade: string): string {
  switch (grade.toUpperCase()) {
    case "A": return "border-[var(--color-lime)] text-[var(--color-lime)]"
    case "B": return "border-green-400 text-green-400"
    case "C": return "border-yellow-400 text-yellow-400"
    case "D": return "border-orange-400 text-orange-400"
    case "F": return "border-red-400 text-red-400"
    default: return "border-[var(--color-border)] text-[var(--color-text-muted)]"
  }
}
