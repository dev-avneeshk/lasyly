import { NextResponse } from "next/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { cached } from "@/lib/cache"
import { getQuiz } from "@/lib/quiz/data"
import { toClientQuiz } from "@/lib/quiz/types"

/**
 * GET /api/quiz/[quizId] — one playable quiz with correct answers STRIPPED.
 *
 * `toClientQuiz` is the single chokepoint that removes `answer`/`explanation`
 * before the payload leaves the server, so the client physically cannot know
 * the answers ahead of grading. Grading happens in the submit route against the
 * authoritative code bank.
 */
export const GET = withSecurity(async (
  _request: Request,
  context?: { params: Promise<{ quizId: string }> }
) => {
  const { quizId } = await context!.params

  const clientQuiz = await cached(
    `quiz:play:${quizId}`,
    async () => {
      const quiz = getQuiz(quizId)
      return quiz ? toClientQuiz(quiz) : null
    },
    5 * 60_000
  )

  if (!clientQuiz) {
    return NextResponse.json({ error: "Quiz not found." }, { status: 404 })
  }

  return NextResponse.json(clientQuiz)
}, { cacheControl: CACHE_CONTROL.PUBLIC_LONG })
