"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { ChevronRight, Trophy, User, Users, CircleDot, Shield, HelpCircle } from "lucide-react"
import type { QuizCategory, QuizSummary, QuizSport, QuizDifficulty } from "@/lib/quiz/types"
import { cn } from "@/lib/utils"

const SPORTS: { id: QuizSport; label: string }[] = [
  { id: "nba", label: "NBA" },
  { id: "nfl", label: "NFL" },
]

// The data uses friendly icon names; map them to the icons we ship.
const ICONS: Record<string, typeof Trophy> = {
  Trophy,
  User,
  Users,
  Basketball: CircleDot,
  Shield,
}

const DIFFICULTY_STYLE: Record<QuizDifficulty, string> = {
  easy: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
  medium: "bg-amber-400/15 text-amber-300",
  hard: "bg-[var(--color-danger)]/15 text-[var(--color-danger)]",
}

export default function QuizHome({
  categories,
  quizzes,
}: {
  categories: QuizCategory[]
  quizzes: QuizSummary[]
}) {
  const [sport, setSport] = useState<QuizSport>("nba")

  const sportCategories = useMemo(
    () => categories.filter((c) => c.sport === sport),
    [categories, sport]
  )
  const quizzesByCategory = useMemo(() => {
    const map = new Map<string, QuizSummary[]>()
    for (const q of quizzes) {
      if (q.sport !== sport) continue
      const list = map.get(q.categoryId) ?? []
      list.push(q)
      map.set(q.categoryId, list)
    }
    return map
  }, [quizzes, sport])

  return (
    <div className="relative mx-auto max-w-5xl px-4 py-10 pb-40 md:pb-12">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-64 w-[120%] -translate-x-1/2 rounded-full bg-[var(--color-lime)]/10 blur-[120px]"
      />

      {/* Hero */}
      <header className="relative text-center">
        <span className="text-xs font-bold uppercase tracking-[0.4em] text-[var(--color-lime)]">
          Lasyly Quiz
        </span>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-[var(--color-text-primary)] sm:text-5xl">
          Test Your <span className="text-[var(--color-lime)]">Sports IQ</span>
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-text-muted)]">
          Pick a category, answer the questions, and prove you know more than the box score.
        </p>
      </header>

      {/* Sport toggle */}
      <div className="mt-8 flex justify-center gap-2">
        {SPORTS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={sport === s.id}
            onClick={() => setSport(s.id)}
            className={cn(
              "rounded-full border px-6 py-2 text-sm font-bold uppercase tracking-wide transition-all",
              sport === s.id
                ? "border-[var(--color-lime)] bg-[var(--color-lime)]/10 text-[var(--color-lime)] shadow-[0_0_30px_-14px_rgba(212,255,0,0.6)]"
                : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-white/20 hover:bg-white/[0.03]"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Categories */}
      <div className="mt-10 space-y-10">
        {sportCategories.map((category) => {
          const catQuizzes = quizzesByCategory.get(category.id) ?? []
          const Icon = ICONS[category.icon] ?? HelpCircle
          return (
            <section key={category.id}>
              <div className="mb-4 flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--color-lime)]/10 text-[var(--color-lime)]">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-black text-[var(--color-text-primary)]">
                    {category.title}
                  </h2>
                  <p className="text-xs text-[var(--color-text-muted)]">{category.description}</p>
                </div>
              </div>

              {catQuizzes.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">
                  No quizzes here yet — check back soon.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {catQuizzes.map((quiz) => (
                    <QuizCard key={quiz.id} quiz={quiz} />
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function QuizCard({ quiz }: { quiz: QuizSummary }) {
  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
      <Link
        href={`/quiz/${quiz.id}`}
        className="group flex items-center justify-between gap-4 rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-4 transition-all hover:border-white/20 hover:bg-white/[0.04]"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-black text-[var(--color-text-primary)]">
              {quiz.title}
            </h3>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                DIFFICULTY_STYLE[quiz.difficulty]
              )}
            >
              {quiz.difficulty}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">{quiz.description}</p>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
            {quiz.questionCount} {quiz.questionCount === 1 ? "question" : "questions"}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-[var(--color-text-muted)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--color-lime)]" />
      </Link>
    </motion.div>
  )
}
