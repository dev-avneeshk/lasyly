import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getQuiz, poolStats } from "@/lib/quiz/data"
import QuizPlayer from "./QuizPlayer"

export async function generateMetadata(
  { params }: { params: Promise<{ quizId: string }> }
): Promise<Metadata> {
  const { quizId } = await params
  const quiz = getQuiz(quizId)
  if (!quiz) return { title: "Quiz | Lasyly" }
  return {
    title: `${quiz.title} Quiz | Lasyly`,
    description: quiz.description,
  }
}

export default async function QuizPlayPage(
  { params }: { params: Promise<{ quizId: string }> }
) {
  const { quizId } = await params
  const quiz = getQuiz(quizId)
  if (!quiz) notFound()

  // No questions are sent up front. The player picks difficulty + count on a
  // setup screen, then fetches a randomized, answer-stripped attempt from the
  // API. Answers never reach the client until grading.
  return (
    <QuizPlayer
      quizId={quiz.id}
      title={quiz.title}
      description={quiz.description}
      pool={poolStats(quiz.id)}
    />
  )
}
