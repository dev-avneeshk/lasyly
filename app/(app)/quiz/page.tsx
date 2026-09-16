import type { Metadata } from "next"
import { QUIZ_CATEGORIES, QUIZZES } from "@/lib/quiz/data"
import { QUIZ_SPORTS, toQuizSummary, type QuizSport } from "@/lib/quiz/types"
import QuizHome from "./QuizHome"

export const metadata: Metadata = {
  title: "NBA & NFL Quiz | Lasyly",
  description: "Test your basketball and football IQ. Pick a category, answer, and climb the ranks.",
}

export default async function QuizPage({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string }>
}) {
  // The bank is a static code import, so we render the catalog on the server
  // with zero data fetching. The submit flow (which needs auth) happens client
  // side against the API.
  const categories = QUIZ_CATEGORIES
  const quizzes = QUIZZES.map(toQuizSummary)

  // Allow deep-linking to a sport (e.g. /quiz?sport=nfl from the Arena hub).
  const { sport } = await searchParams
  const initialSport: QuizSport = QUIZ_SPORTS.includes(sport as QuizSport)
    ? (sport as QuizSport)
    : "nba"

  return <QuizHome categories={categories} quizzes={quizzes} initialSport={initialSport} />
}
