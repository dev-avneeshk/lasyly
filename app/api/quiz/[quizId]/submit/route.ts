import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { getQuiz } from "@/lib/quiz/data"
import { gradeQuiz, type SubmittedAnswer } from "@/lib/quiz/grade"

const submitSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1).max(100),
        choice: z.number().int().min(0).max(20),
      })
    )
    .max(200),
})

/**
 * POST /api/quiz/[quizId]/submit — grade an attempt and record the score.
 *
 * Server-authoritative: the request carries only the chosen option indices; the
 * correct answers live in the code bank and never leave the server until this
 * response. The graded row is written with the service role so a client can't
 * fabricate a score (RLS denies client writes to quiz_attempts).
 */
export const POST = withSecurity(async (
  request: Request,
  context?: { params: Promise<{ quizId: string }> }
) => {
  const { quizId } = await context!.params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "You must be logged in to submit a quiz." }, { status: 401 })
  }

  const rate = await checkRateLimit(`quiz-submit:${user.id}`, RATE_LIMITS.arenaAction)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Slow down — too many submissions." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) } }
    )
  }

  const quiz = getQuiz(quizId)
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found." }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const [data, err] = validateRequestBody(body, submitSchema)
  if (err) return err

  const graded = gradeQuiz(quiz, data.answers as SubmittedAnswer[])

  // Best-effort persistence: a failed insert shouldn't deny the player their
  // result. Log-and-continue keeps grading available even if the DB is down.
  try {
    const admin = createAdminClient()
    const { error: insertError } = await admin.from("quiz_attempts").insert({
      user_id: user.id,
      quiz_id: quiz.id,
      sport: quiz.sport,
      score: graded.score,
      total: graded.total,
      accuracy: graded.accuracy,
      correct_question_ids: graded.correctQuestionIds,
    })
    if (insertError) {
      console.warn(`[quiz] failed to record attempt for ${user.id} on ${quiz.id}:`, insertError.message)
    }
  } catch (e) {
    console.warn("[quiz] attempt persistence threw:", e)
  }

  return NextResponse.json(graded, { status: 201 })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
