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
  initialSport = "nba",
}: {
  categories: QuizCategory[]
  quizzes: QuizSummary[]
  initialSport?: QuizSport
}) {
  const [sport, setSport] = useState<QuizSport>(initialSport)

  // Each category holds exactly one quiz. Pair them up so we render a single
  // clean card per category (icon + title + count) instead of a redundant
  // section header stacked above an identical card.
  const cards = useMemo(() => {
    const quizByCategory = new Map<string, QuizSummary>()
    for (const q of quizzes) {
      if (q.sport === sport) quizByCategory.set(q.categoryId, q)
    }
    return categories
      .filter((c) => c.sport === sport)
      .map((category) => ({ category, quiz: quizByCategory.get(category.id) ?? null }))
  }, [categories, quizzes, sport])

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

      {/* One card per category — clean three-up grid */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ category, quiz }) => (
          <CategoryCard key={category.id} category={category} quiz={quiz} />
        ))}
      </div>
    </div>
  )
}

function CategoryCard({
  category,
  quiz,
}: {
  category: QuizCategory
  quiz: QuizSummary | null
}) {
  const Icon = ICONS[category.icon] ?? HelpCircle

  if (!quiz) {
    return (
      <div className="flex h-full flex-col rounded-2xl border border-dashed border-[var(--color-border)] bg-white/[0.01] p-5">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/[0.04] text-[var(--color-text-muted)]">
          <Icon className="h-5 w-5" />
        </span>
        <h3 className="mt-4 text-lg font-black text-[var(--color-text-primary)]">{category.title}</h3>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">{category.description}</p>
        <p className="mt-auto pt-4 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
          Coming soon
        </p>
      </div>
    )
  }

  return (
    <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.15 }} className="h-full">
      <Link
        href={`/quiz/${quiz.id}`}
        className="group flex h-full flex-col rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5 transition-all hover:border-[var(--color-lime)]/40 hover:bg-white/[0.04] hover:shadow-[0_0_40px_-20px_rgba(212,255,0,0.6)]"
      >
        <div className="flex items-start justify-between">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--color-lime)]/10 text-[var(--color-lime)]">
            <Icon className="h-5 w-5" />
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              DIFFICULTY_STYLE[quiz.difficulty]
            )}
          >
            {quiz.difficulty}
          </span>
        </div>

        <h3 className="mt-4 text-lg font-black text-[var(--color-text-primary)]">{category.title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
          {category.description}
        </p>

        <div className="mt-auto flex items-center justify-between pt-5">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
            {quiz.questionCount.toLocaleString()} in the bank
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-lime)]">
            Play
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </Link>
    </motion.div>
  )
}
