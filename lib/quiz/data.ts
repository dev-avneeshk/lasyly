/**
 * The quiz question bank (NBA + NFL).
 *
 * Each sport exposes exactly THREE quizzes — Player, Team, and Mixed — so the
 * landing page stays a clean three-card grid. The large NBA banks are generated
 * (scripts/quiz/*) into flat, bucketed question lists; this file pools them into
 * one quiz per bucket. To add questions, edit the raw files and regenerate, or
 * push entries into the STARTER_* arrays below.
 *
 * Invariants (enforced by `assertBankValid` in dev/tests):
 *  - every quiz id is globally unique
 *  - every quiz.categoryId points at a real category of the same sport
 *  - every question has >= 2 options and a valid `answer` index
 */

import { NBA_500_QUESTIONS } from "./nba-500"
import { NBA_1000_QUESTIONS } from "./nba-501-1000"
import type { BankQuestion, Question, Quiz, QuizBucket, QuizCategory, QuizSport } from "./types"

// ─── Categories: exactly three per sport ─────────────────────────────────────

export const QUIZ_CATEGORIES: QuizCategory[] = [
  // NBA
  { id: "nba-player", sport: "nba", title: "Player", description: "Stars, legends, scorers, and draft lore.", icon: "User" },
  { id: "nba-team", sport: "nba", title: "Team", description: "Franchises, dynasties, arenas, and rivalries.", icon: "Users" },
  { id: "nba-mixed", sport: "nba", title: "Mixed", description: "History, moments, rules, and everything else.", icon: "Trophy" },
  // NFL
  { id: "nfl-player", sport: "nfl", title: "Player", description: "QBs, skill players, and defenders.", icon: "User" },
  { id: "nfl-team", sport: "nfl", title: "Team", description: "Franchises, divisions, and rivalries.", icon: "Users" },
  { id: "nfl-mixed", sport: "nfl", title: "Mixed", description: "Super Bowls, rules, and everything else.", icon: "Trophy" },
]

// ─── Starter questions (small hand-written set), tagged by bucket ────────────

const STARTER_NBA: BankQuestion[] = [
  {
    id: "nba-p-1",
    bucket: "player",
    prompt: "Which player is the NBA's all-time leading scorer?",
    options: ["Kareem Abdul-Jabbar", "Karl Malone", "LeBron James", "Kobe Bryant"],
    answer: 2,
    explanation: "LeBron James passed Kareem Abdul-Jabbar for the all-time scoring record in 2023.",
  },
  {
    id: "nba-t-1",
    bucket: "team",
    prompt: "Which team plays its home games at Madison Square Garden?",
    options: ["Brooklyn Nets", "New York Knicks", "Boston Celtics", "Philadelphia 76ers"],
    answer: 1,
    explanation: "The New York Knicks call Madison Square Garden home.",
  },
  {
    id: "nba-g-1",
    bucket: "mixed",
    prompt: "How many players from one team are on the court at a time?",
    options: ["4", "5", "6", "7"],
    answer: 1,
    explanation: "Each team fields five players at a time.",
  },
  {
    id: "nba-g-2",
    bucket: "mixed",
    prompt: "How many points is a shot made from beyond the arc worth?",
    options: ["1", "2", "3", "4"],
    answer: 2,
    explanation: "A made shot beyond the three-point line is worth three points.",
  },
  {
    id: "nba-h-1",
    bucket: "mixed",
    prompt: "Which franchise has won the most NBA championships (tied at the top)?",
    options: ["Los Angeles Lakers", "Chicago Bulls", "Golden State Warriors", "Miami Heat"],
    answer: 0,
    explanation: "The Lakers and Celtics are tied atop the all-time championship list.",
  },
]

const STARTER_NFL: BankQuestion[] = [
  {
    id: "nfl-p-1",
    bucket: "player",
    prompt: "Which quarterback has won the most Super Bowls?",
    options: ["Joe Montana", "Tom Brady", "Peyton Manning", "Terry Bradshaw"],
    answer: 1,
    explanation: "Tom Brady won seven Super Bowls, the most by any player.",
  },
  {
    id: "nfl-t-1",
    bucket: "team",
    prompt: "Which team plays its home games at Lambeau Field?",
    options: ["Chicago Bears", "Green Bay Packers", "Minnesota Vikings", "Detroit Lions"],
    answer: 1,
    explanation: "Lambeau Field is the home of the Green Bay Packers.",
  },
  {
    id: "nfl-g-1",
    bucket: "mixed",
    prompt: "How many points is a touchdown worth (before the extra point)?",
    options: ["3", "6", "7", "2"],
    answer: 1,
    explanation: "A touchdown is worth six points; the try afterward can add one or two.",
  },
  {
    id: "nfl-g-2",
    bucket: "mixed",
    prompt: "How many players from one team are on the field at a time?",
    options: ["10", "11", "12", "9"],
    answer: 1,
    explanation: "Each team fields eleven players at a time.",
  },
  {
    id: "nfl-h-1",
    bucket: "mixed",
    prompt: "What is the championship game of the NFL season called?",
    options: ["The Finals", "The Super Bowl", "The Grey Cup", "The Pro Bowl"],
    answer: 1,
    explanation: "The Super Bowl decides the NFL champion each season.",
  },
]

// ─── Quiz assembly ───────────────────────────────────────────────────────────

const BUCKET_META: Record<QuizBucket, { title: string; description: string }> = {
  player: { title: "Player", description: "Stars, legends, scorers, and draft lore." },
  team: { title: "Team", description: "Franchises, dynasties, arenas, and rivalries." },
  mixed: { title: "Mixed", description: "History, moments, rules, and everything else." },
}

const BUCKETS: QuizBucket[] = ["player", "team", "mixed"]

/**
 * How many questions each assembled quiz plays. The banks hold hundreds of
 * questions per bucket, but a single sitting should be short and completable —
 * the player answers every question before submitting, and grading counts the
 * whole quiz. We take an evenly-spaced slice across the pool so the sample
 * spans eras rather than just the first N.
 */
const QUESTIONS_PER_QUIZ = 20

/** Strip the bucket tag to get a plain quiz Question. */
function toQuestion(q: BankQuestion): Question {
  return {
    id: q.id,
    prompt: q.prompt,
    options: q.options,
    answer: q.answer,
    explanation: q.explanation,
  }
}

/** Evenly sample up to `count` items across the whole array (stable order). */
function sampleEvenly<T>(arr: T[], count: number): T[] {
  if (arr.length <= count) return arr
  const step = arr.length / count
  const out: T[] = []
  for (let i = 0; i < count; i++) out.push(arr[Math.floor(i * step)])
  return out
}

/**
 * Build the three quizzes for a sport by pooling bank questions into their
 * bucket, then sampling a short, completable set. A bucket with no questions is
 * skipped so we never ship an empty quiz.
 */
function buildSportQuizzes(sport: QuizSport, bank: BankQuestion[]): Quiz[] {
  return BUCKETS.flatMap((bucket) => {
    const pool = bank.filter((q) => q.bucket === bucket).map(toQuestion)
    if (pool.length === 0) return []
    const questions = sampleEvenly(pool, QUESTIONS_PER_QUIZ)
    const meta = BUCKET_META[bucket]
    return [
      {
        id: `${sport}-${bucket}`,
        sport,
        categoryId: `${sport}-${bucket}`,
        title: meta.title,
        description: meta.description,
        difficulty: "medium" as const,
        questions,
      },
    ]
  })
}

const NBA_BANK: BankQuestion[] = [...STARTER_NBA, ...NBA_500_QUESTIONS, ...NBA_1000_QUESTIONS]
const NFL_BANK: BankQuestion[] = [...STARTER_NFL]

export const QUIZZES: Quiz[] = [
  ...buildSportQuizzes("nba", NBA_BANK),
  ...buildSportQuizzes("nfl", NFL_BANK),
]

// ─── Lookups ──────────────────────────────────────────────────────────────

const quizById = new Map(QUIZZES.map((q) => [q.id, q]))
const categoryById = new Map(QUIZ_CATEGORIES.map((c) => [c.id, c]))

/** Return a quiz by id, or null if unknown. */
export function getQuiz(id: string): Quiz | null {
  return quizById.get(id) ?? null
}

/** Return a category by id, or null if unknown. */
export function getCategory(id: string): QuizCategory | null {
  return categoryById.get(id) ?? null
}

/** All categories for a sport. */
export function categoriesForSport(sport: QuizSport): QuizCategory[] {
  return QUIZ_CATEGORIES.filter((c) => c.sport === sport)
}

/** All quizzes for a sport. */
export function quizzesForSport(sport: QuizSport): Quiz[] {
  return QUIZZES.filter((q) => q.sport === sport)
}

/** All quizzes in a category. */
export function quizzesForCategory(categoryId: string): Quiz[] {
  return QUIZZES.filter((q) => q.categoryId === categoryId)
}

/**
 * Validate the bank's structural invariants. Cheap enough to call at module
 * load in dev and from a test. Throws with a specific message on the first
 * problem so a bad edit fails loudly rather than silently mis-grading.
 */
export function assertBankValid(): void {
  const seenQuiz = new Set<string>()
  const seenQuestion = new Set<string>()

  for (const quiz of QUIZZES) {
    if (seenQuiz.has(quiz.id)) {
      throw new Error(`Duplicate quiz id: ${quiz.id}`)
    }
    seenQuiz.add(quiz.id)

    const category = categoryById.get(quiz.categoryId)
    if (!category) {
      throw new Error(`Quiz ${quiz.id} references unknown category ${quiz.categoryId}`)
    }
    if (category.sport !== quiz.sport) {
      throw new Error(
        `Quiz ${quiz.id} (${quiz.sport}) is in category ${quiz.categoryId} (${category.sport})`
      )
    }
    if (quiz.questions.length === 0) {
      throw new Error(`Quiz ${quiz.id} has no questions`)
    }

    for (const q of quiz.questions) {
      if (seenQuestion.has(q.id)) {
        throw new Error(`Duplicate question id: ${q.id}`)
      }
      seenQuestion.add(q.id)

      if (q.options.length < 2) {
        throw new Error(`Question ${q.id} needs at least 2 options`)
      }
      if (q.answer < 0 || q.answer >= q.options.length || !Number.isInteger(q.answer)) {
        throw new Error(`Question ${q.id} has an out-of-range answer index (${q.answer})`)
      }
    }
  }
}

if (process.env.NODE_ENV !== "production") {
  assertBankValid()
}
