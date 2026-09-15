/**
 * Server-side quiz grading.
 *
 * Grading is a pure function of the quiz bank and the submitted answers, so it
 * is trivially testable and never trusts the client for anything but the chosen
 * option indices. The client never sees correct answers until grading returns.
 */

import type { Quiz } from "./types"

/** A single submitted answer: which option the player picked for a question. */
export interface SubmittedAnswer {
  questionId: string
  /** 0-based option index the player chose. */
  choice: number
}

/** Per-question grading detail returned to the client after submission. */
export interface GradedQuestion {
  questionId: string
  prompt: string
  options: string[]
  /** What the player picked, or null if they skipped it. */
  choice: number | null
  /** The correct option index. */
  answer: number
  correct: boolean
  explanation?: string
}

/** Full graded result for an attempt. */
export interface GradedResult {
  quizId: string
  sport: Quiz["sport"]
  total: number
  score: number
  /** Percentage 0-100, rounded to one decimal. */
  accuracy: number
  correctQuestionIds: string[]
  questions: GradedQuestion[]
}

/**
 * Grade a submission against the authoritative quiz.
 *
 * Duplicate submissions for the same question use the LAST one; unknown
 * question ids are ignored; unanswered questions count as incorrect.
 */
export function gradeQuiz(quiz: Quiz, answers: SubmittedAnswer[]): GradedResult {
  // Last-write-wins per question id.
  const chosen = new Map<string, number>()
  for (const a of answers) {
    chosen.set(a.questionId, a.choice)
  }

  const questions: GradedQuestion[] = quiz.questions.map((q) => {
    const raw = chosen.get(q.id)
    const choice = typeof raw === "number" && raw >= 0 && raw < q.options.length ? raw : null
    const correct = choice === q.answer
    return {
      questionId: q.id,
      prompt: q.prompt,
      options: q.options,
      choice,
      answer: q.answer,
      correct,
      explanation: q.explanation,
    }
  })

  const correctQuestionIds = questions.filter((q) => q.correct).map((q) => q.questionId)
  const total = quiz.questions.length
  const score = correctQuestionIds.length
  const accuracy = total > 0 ? Math.round((score / total) * 1000) / 10 : 0

  return {
    quizId: quiz.id,
    sport: quiz.sport,
    total,
    score,
    accuracy,
    correctQuestionIds,
    questions,
  }
}
