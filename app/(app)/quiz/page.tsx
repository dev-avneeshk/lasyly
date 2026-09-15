import type { Metadata } from "next"
import { QUIZ_CATEGORIES, QUIZZES } from "@/lib/quiz/data"
import { toQuizSummary } from "@/lib/quiz/types"
import QuizHome from "./QuizHome"

export const metadata: Metadata = {
  title: "NBA & NFL Quiz | Lasyly",
  description: "Test your basketball and football IQ. Pick a category, answer, and climb the ranks.",
}

export default function QuizPage() {
  // The bank is a static code import, so we render the catalog on the server
  // with zero data fetching. The submit flow (which needs auth) happens client
  // side against the API.
  const categories = QUIZ_CATEGORIES
  const quizzes = QUIZZES.map(toQuizSummary)
  return <QuizHome categories={categories} quizzes={quizzes} />
}
