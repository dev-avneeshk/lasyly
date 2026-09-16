/**
 * Trivia quiz — core type system (NBA + NFL).
 *
 * The data layer is intentionally decoupled from delivery and grading. A quiz is
 * a static bank of multiple-choice questions grouped by sport and category. To
 * add questions, edit `data.ts` — no engine, API, or UI changes needed.
 *
 * IMPORTANT: `Question.answer` (the correct option index) never leaves the
 * server. The API strips it before sending a quiz to the client (see
 * `toClientQuiz`), and grading happens server-side against the full bank.
 */

/** The two sports the quiz supports today. Add more here to extend. */
export type QuizSport = "nba" | "nfl"

export const QUIZ_SPORTS: QuizSport[] = ["nba", "nfl"]

/** Coarse difficulty label surfaced in the UI. */
export type QuizDifficulty = "easy" | "medium" | "hard"

export const QUIZ_DIFFICULTIES: QuizDifficulty[] = ["easy", "medium", "hard"]

/**
 * A category groups quizzes within a sport (e.g. "Players", "History"). Purely
 * organizational — it drives the landing-page grid.
 */
export interface QuizCategory {
  /** Stable slug, unique within a sport. */
  id: string
  sport: QuizSport
  title: string
  description: string
  /** lucide-react icon name, resolved in the UI. */
  icon: string
}

/**
 * A single multiple-choice question.
 *
 * `options` holds 2-6 choices; `answer` is the 0-based index into `options` of
 * the correct choice. `explanation` is shown after grading.
 */
export interface Question {
  id: string
  prompt: string
  options: string[]
  /** 0-based index into `options` of the correct choice. Server-only. */
  answer: number
  explanation?: string
}

/**
 * A question in a generated bank, tagged with the coarse bucket it belongs to.
 * The three buckets map onto the three quizzes shown per sport: player, team,
 * and mixed (everything else). `data.ts` groups these into `Quiz` objects.
 */
export type QuizBucket = "player" | "team" | "mixed"

export interface BankQuestion extends Question {
  bucket: QuizBucket
}

/** A playable quiz: an ordered set of questions within a category. */
export interface Quiz {
  /** Stable slug, globally unique across sports. */
  id: string
  sport: QuizSport
  categoryId: string
  title: string
  description: string
  difficulty: QuizDifficulty
  questions: Question[]
}

// ─── Client-facing shapes (answers stripped) ─────────────────────────────────

/** A question as sent to the browser: no `answer`, no `explanation`. */
export interface ClientQuestion {
  id: string
  prompt: string
  options: string[]
}

/** A quiz as sent to the browser, plus lightweight metadata for the play UI. */
export interface ClientQuiz {
  id: string
  sport: QuizSport
  categoryId: string
  title: string
  description: string
  difficulty: QuizDifficulty
  questionCount: number
  questions: ClientQuestion[]
}

/** Summary used by the landing-page cards (no questions payload). */
export interface QuizSummary {
  id: string
  sport: QuizSport
  categoryId: string
  title: string
  description: string
  difficulty: QuizDifficulty
  questionCount: number
}

/**
 * Strip server-only fields from a quiz before sending it to the client.
 * This is the single chokepoint that keeps correct answers off the wire.
 */
export function toClientQuiz(quiz: Quiz): ClientQuiz {
  return {
    id: quiz.id,
    sport: quiz.sport,
    categoryId: quiz.categoryId,
    title: quiz.title,
    description: quiz.description,
    difficulty: quiz.difficulty,
    questionCount: quiz.questions.length,
    questions: quiz.questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      options: q.options,
    })),
  }
}

/** Collapse a quiz to its card summary. */
export function toQuizSummary(quiz: Quiz): QuizSummary {
  return {
    id: quiz.id,
    sport: quiz.sport,
    categoryId: quiz.categoryId,
    title: quiz.title,
    description: quiz.description,
    difficulty: quiz.difficulty,
    questionCount: quiz.questions.length,
  }
}
