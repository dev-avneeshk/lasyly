import { NextResponse } from "next/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { cached } from "@/lib/cache"
import { QUIZ_CATEGORIES, QUIZZES } from "@/lib/quiz/data"
import { toQuizSummary, type QuizSport } from "@/lib/quiz/types"

/**
 * GET /api/quiz — the quiz catalog: categories and quiz summaries.
 *
 * Optional `?sport=nba|nfl` filter. The bank is static (lives in code), so this
 * is heavily cacheable; we still route through the shared Redis cache-aside
 * layer for consistency and so a future dynamic bank needs no call-site change.
 * Correct answers are never included here (summaries only).
 */
export const GET = withSecurity(async (request: Request) => {
  const url = new URL(request.url)
  const sportParam = url.searchParams.get("sport")
  const sport: QuizSport | null =
    sportParam === "nba" || sportParam === "nfl" ? sportParam : null

  const result = await cached(
    `quiz:catalog:${sport ?? "all"}`,
    async () => {
      const categories = sport
        ? QUIZ_CATEGORIES.filter((c) => c.sport === sport)
        : QUIZ_CATEGORIES
      const quizzes = (sport ? QUIZZES.filter((q) => q.sport === sport) : QUIZZES).map(
        toQuizSummary
      )
      return { categories, quizzes }
    },
    // The bank changes only on deploy; a long TTL is fine.
    5 * 60_000
  )

  return NextResponse.json(result)
}, { cacheControl: CACHE_CONTROL.PUBLIC_LONG })
