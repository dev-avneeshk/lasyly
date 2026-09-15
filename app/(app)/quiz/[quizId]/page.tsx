import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getQuiz } from "@/lib/quiz/data"
import { toClientQuiz } from "@/lib/quiz/types"
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

  // Answers are stripped here on the server; the client never receives them
  // until it submits and the API grades the attempt.
  return <QuizPlayer quiz={toClientQuiz(quiz)} />
}
