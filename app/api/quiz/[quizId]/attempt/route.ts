import { NextResponse } from "next/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { getQuiz, sampleAttempt, poolStats, QUIZ_ATTEMPT_COUNTS } from "@/lib/quiz/data"
import { issueAttemptToken } from "@/lib/quiz/attemptToken"
import { QUIZ_DIFFICULTIES, type ClientQuestion } from "@/lib/quiz/types"

/**
 * GET /api/quiz/[quizId]/attempt?difficulty=&count= — start a randomized attempt.
 *
 * Samples a random subset of the quiz's pool (optionally filtered to one
 * difficulty), strips the correct answers, and returns the questions plus an
 * HMAC-signed token binding this attempt to exactly those question ids. The
 * client plays the returned questions and submits with the token so grading is
 * server-authoritative and tamper-proof.
 *
 * Not cached — every call reshuffles.
 */
export const GET = withSecurity(async (
  request: Request,
  context?: { params: Promise<{ quizId: string }> }
) => {
  const { quizId } = await context!.params
  const quiz = getQuiz(quizId)
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found." }, { status: 404 })
  }

  const url = new URL(request.url)
  const rawDifficulty = url.searchParams.get("difficulty") ?? "any"
  const rawCount = Number(url.searchParams.get("count") ?? "10")

  const difficulty = QUIZ_DIFFICULTIES.includes(rawDifficulty as (typeof QUIZ_DIFFICULTIES)[number])
    ? (rawDifficulty as (typeof QUIZ_DIFFICULTIES)[number])
    : "any"
  const count = (QUIZ_ATTEMPT_COUNTS as readonly number[]).includes(rawCount) ? rawCount : 10

  const sampled = sampleAttempt(quizId, difficulty, count)
  if (!sampled || sampled.length === 0) {
    return NextResponse.json(
      { error: "No questions match that difficulty. Try 'Any' or a different level." },
      { status: 422 }
    )
  }

  const clientQuestions: ClientQuestion[] = sampled.map((q) => ({
    id: q.id,
    prompt: q.prompt,
    options: q.options,
  }))
  const token = issueAttemptToken(quizId, sampled.map((q) => q.id))

  return NextResponse.json({
    quizId: quiz.id,
    sport: quiz.sport,
    title: quiz.title,
    description: quiz.description,
    difficulty,
    questionCount: clientQuestions.length,
    questions: clientQuestions,
    token,
    pool: poolStats(quizId),
  })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
