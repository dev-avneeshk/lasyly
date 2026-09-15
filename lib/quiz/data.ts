/**
 * The quiz question bank (NBA + NFL).
 *
 * This is the ONLY file you edit to add questions. Each quiz lists its
 * questions inline; the correct answer is the 0-based index into `options`.
 *
 * The user is filling in the real questions/answers later — the entries below
 * are a small, correct starter set that establishes the shape and gives every
 * category at least one playable quiz. Add more questions to any `questions`
 * array, or add whole new `Quiz` objects, and the API + UI pick them up with no
 * further changes.
 *
 * Invariants (enforced by `assertBankValid` in dev/tests):
 *  - every quiz id is globally unique
 *  - every quiz.categoryId points at a real category of the same sport
 *  - every question has >= 2 options and a valid `answer` index
 */

import type { Quiz, QuizCategory, QuizSport } from "./types"

// ─── Categories ──────────────────────────────────────────────────────────────

export const QUIZ_CATEGORIES: QuizCategory[] = [
  // NBA
  { id: "nba-general", sport: "nba", title: "General NBA", description: "Test your all-around basketball IQ.", icon: "Basketball" },
  { id: "nba-players", sport: "nba", title: "Players", description: "Stars, legends, and role players.", icon: "User" },
  { id: "nba-teams", sport: "nba", title: "Teams", description: "Franchises, dynasties, and rivalries.", icon: "Users" },
  { id: "nba-history", sport: "nba", title: "History", description: "Championships and defining moments.", icon: "Trophy" },
  // NFL
  { id: "nfl-general", sport: "nfl", title: "General NFL", description: "How well do you know football?", icon: "Shield" },
  { id: "nfl-players", sport: "nfl", title: "Players", description: "QBs, skill players, and defenders.", icon: "User" },
  { id: "nfl-teams", sport: "nfl", title: "Teams", description: "Franchises, divisions, and rivalries.", icon: "Users" },
  { id: "nfl-history", sport: "nfl", title: "History", description: "Super Bowls and legendary games.", icon: "Trophy" },
]

// ─── Quizzes ───────────────────────────────────────────────────────────────

export const QUIZZES: Quiz[] = [
  // ── NBA ──────────────────────────────────────────────────────────────────
  {
    id: "nba-general-warmup",
    sport: "nba",
    categoryId: "nba-general",
    title: "NBA Warmup",
    description: "A quick round to get your basketball IQ going.",
    difficulty: "easy",
    questions: [
      {
        id: "nba-g-1",
        prompt: "How many players from one team are on the court at a time?",
        options: ["4", "5", "6", "7"],
        answer: 1,
        explanation: "Each team fields five players at a time.",
      },
      {
        id: "nba-g-2",
        prompt: "How many points is a shot made from beyond the arc worth?",
        options: ["1", "2", "3", "4"],
        answer: 2,
        explanation: "A made shot beyond the three-point line is worth three points.",
      },
    ],
  },
  {
    id: "nba-players-legends",
    sport: "nba",
    categoryId: "nba-players",
    title: "Legends",
    description: "Icons who defined the game.",
    difficulty: "medium",
    questions: [
      {
        id: "nba-p-1",
        prompt: "Which player is the NBA's all-time leading scorer?",
        options: ["Kareem Abdul-Jabbar", "Karl Malone", "LeBron James", "Kobe Bryant"],
        answer: 2,
        explanation: "LeBron James passed Kareem Abdul-Jabbar for the all-time scoring record in 2023.",
      },
    ],
  },
  {
    id: "nba-teams-franchises",
    sport: "nba",
    categoryId: "nba-teams",
    title: "Franchises",
    description: "Know your teams and cities.",
    difficulty: "easy",
    questions: [
      {
        id: "nba-t-1",
        prompt: "Which team plays its home games at Madison Square Garden?",
        options: ["Brooklyn Nets", "New York Knicks", "Boston Celtics", "Philadelphia 76ers"],
        answer: 1,
        explanation: "The New York Knicks call Madison Square Garden home.",
      },
    ],
  },
  {
    id: "nba-history-titles",
    sport: "nba",
    categoryId: "nba-history",
    title: "Title Town",
    description: "Champions through the years.",
    difficulty: "hard",
    questions: [
      {
        id: "nba-h-1",
        prompt: "Which franchise has won the most NBA championships (tied at the top)?",
        options: ["Los Angeles Lakers", "Chicago Bulls", "Golden State Warriors", "Miami Heat"],
        answer: 0,
        explanation: "The Lakers and Celtics are tied atop the all-time championship list.",
      },
    ],
  },

  // ── NFL ──────────────────────────────────────────────────────────────────
  {
    id: "nfl-general-warmup",
    sport: "nfl",
    categoryId: "nfl-general",
    title: "NFL Warmup",
    description: "Kick off with the basics of football.",
    difficulty: "easy",
    questions: [
      {
        id: "nfl-g-1",
        prompt: "How many points is a touchdown worth (before the extra point)?",
        options: ["3", "6", "7", "2"],
        answer: 1,
        explanation: "A touchdown is worth six points; the try afterward can add one or two.",
      },
      {
        id: "nfl-g-2",
        prompt: "How many players from one team are on the field at a time?",
        options: ["10", "11", "12", "9"],
        answer: 1,
        explanation: "Each team fields eleven players at a time.",
      },
    ],
  },
  {
    id: "nfl-players-stars",
    sport: "nfl",
    categoryId: "nfl-players",
    title: "Stars",
    description: "The names that move the needle.",
    difficulty: "medium",
    questions: [
      {
        id: "nfl-p-1",
        prompt: "Which quarterback has won the most Super Bowls?",
        options: ["Joe Montana", "Tom Brady", "Peyton Manning", "Terry Bradshaw"],
        answer: 1,
        explanation: "Tom Brady won seven Super Bowls, the most by any player.",
      },
    ],
  },
  {
    id: "nfl-teams-franchises",
    sport: "nfl",
    categoryId: "nfl-teams",
    title: "Franchises",
    description: "Cities, colors, and divisions.",
    difficulty: "easy",
    questions: [
      {
        id: "nfl-t-1",
        prompt: "Which team plays its home games at Lambeau Field?",
        options: ["Chicago Bears", "Green Bay Packers", "Minnesota Vikings", "Detroit Lions"],
        answer: 1,
        explanation: "Lambeau Field is the home of the Green Bay Packers.",
      },
    ],
  },
  {
    id: "nfl-history-superbowls",
    sport: "nfl",
    categoryId: "nfl-history",
    title: "Super Bowl History",
    description: "The biggest games ever played.",
    difficulty: "hard",
    questions: [
      {
        id: "nfl-h-1",
        prompt: "What is the championship game of the NFL season called?",
        options: ["The Finals", "The Super Bowl", "The Grey Cup", "The Pro Bowl"],
        answer: 1,
        explanation: "The Super Bowl decides the NFL champion each season.",
      },
    ],
  },
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
