"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import { Check, X, ChevronLeft, RotateCcw, Trophy, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ClientQuestion, QuizDifficulty } from "@/lib/quiz/types"
import type { GradedResult } from "@/lib/quiz/grade"
import { cn } from "@/lib/utils"

type Phase = "setup" | "loading" | "playing" | "submitting" | "done"

type PoolStats = { total: number; easy: number; medium: number; hard: number } | null
type DifficultyChoice = QuizDifficulty | "any"

const DIFFICULTY_OPTIONS: { id: DifficultyChoice; label: string }[] = [
  { id: "any", label: "Any" },
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "hard", label: "Hard" },
]

const COUNT_OPTIONS = [10, 15, 20] as const

interface AttemptResponse {
  quizId: string
  title: string
  difficulty: DifficultyChoice
  questionCount: number
  questions: ClientQuestion[]
  token: string
}

export default function QuizPlayer({
  quizId,
  title,
  description,
  pool,
}: {
  quizId: string
  title: string
  description: string
  pool: PoolStats
}) {
  const [phase, setPhase] = useState<Phase>("setup")
  const [difficulty, setDifficulty] = useState<DifficultyChoice>("any")
  const [count, setCount] = useState<(typeof COUNT_OPTIONS)[number]>(10)

  const [questions, setQuestions] = useState<ClientQuestion[]>([])
  const [token, setToken] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [result, setResult] = useState<GradedResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // How many questions actually exist for the chosen difficulty. Used to warn
  // when a level has fewer than the requested count.
  const available = useMemo(() => {
    if (!pool) return null
    if (difficulty === "any") return pool.total
    return pool[difficulty]
  }, [pool, difficulty])

  async function startAttempt() {
    setPhase("loading")
    setError(null)
    try {
      const res = await fetch(
        `/api/quiz/${quizId}/attempt?difficulty=${difficulty}&count=${count}`
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? "Couldn't start the quiz. Try again.")
        setPhase("setup")
        return
      }
      const data = (await res.json()) as AttemptResponse
      setQuestions(data.questions)
      setToken(data.token)
      setIndex(0)
      setAnswers({})
      setResult(null)
      setPhase("playing")
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.")
      setPhase("setup")
    }
  }

  const total = questions.length
  const current = questions[index]
  const selected = current ? answers[current.id] : undefined
  const answeredCount = Object.keys(answers).length
  const progress = total > 0 ? (answeredCount / total) * 100 : 0
  const isLast = index === total - 1

  function choose(choice: number) {
    if (!current) return
    setAnswers((prev) => ({ ...prev, [current.id]: choice }))
  }

  async function submit() {
    setPhase("submitting")
    setError(null)
    try {
      const payload = {
        answers: Object.entries(answers).map(([questionId, choice]) => ({ questionId, choice })),
        token,
      }
      const res = await fetch(`/api/quiz/${quizId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.status === 401) {
        setError("Please log in to submit your quiz.")
        setPhase("playing")
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? "Something went wrong submitting your quiz.")
        setPhase("playing")
        return
      }
      const graded = (await res.json()) as GradedResult
      setResult(graded)
      setPhase("done")
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.")
      setPhase("playing")
    }
  }

  function backToSetup() {
    setQuestions([])
    setToken(null)
    setAnswers({})
    setIndex(0)
    setResult(null)
    setError(null)
    setPhase("setup")
  }

  if (phase === "done" && result) {
    return <Results title={title} result={result} onRetry={backToSetup} />
  }

  if (phase === "setup" || phase === "loading") {
    return (
      <Setup
        title={title}
        description={description}
        pool={pool}
        difficulty={difficulty}
        count={count}
        available={available}
        loading={phase === "loading"}
        error={error}
        onDifficulty={setDifficulty}
        onCount={setCount}
        onStart={startAttempt}
      />
    )
  }

  return (
    <div className="relative mx-auto max-w-2xl px-4 py-8 pb-40 md:pb-12">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-56 w-[120%] -translate-x-1/2 rounded-full bg-[var(--color-lime)]/10 blur-[120px]"
      />

      {/* Top bar */}
      <div className="relative mb-6 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={backToSetup}
          className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          <ChevronLeft className="h-4 w-4" /> Setup
        </button>
        <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
          {index + 1} / {total}
        </span>
      </div>

      <div className="relative">
        <h1 className="text-sm font-bold uppercase tracking-[0.3em] text-[var(--color-lime)]">
          {title}
        </h1>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-[var(--color-lime)]"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Question */}
        <AnimatePresence mode="wait">
          <motion.div
            key={current?.id}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
          >
            <h2 className="mt-6 text-2xl font-black leading-tight text-[var(--color-text-primary)]">
              {current?.prompt}
            </h2>

            <div className="mt-6 space-y-3">
              {current?.options.map((option, i) => {
                const active = selected === i
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => choose(i)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all",
                      active
                        ? "border-[var(--color-lime)] bg-[var(--color-lime)]/10 shadow-[0_0_30px_-16px_rgba(212,255,0,0.7)]"
                        : "border-[var(--color-border)] hover:border-white/20 hover:bg-white/[0.03]"
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black",
                        active
                          ? "bg-[var(--color-lime)] text-black"
                          : "bg-white/10 text-[var(--color-text-muted)]"
                      )}
                    >
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="font-semibold text-[var(--color-text-primary)]">{option}</span>
                  </button>
                )
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        {error && <p className="mt-4 text-center text-sm text-[var(--color-danger)]">{error}</p>}

        {/* Nav */}
        <div className="mt-8 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
          >
            Back
          </Button>

          {isLast ? (
            <Button
              className="font-black"
              disabled={answeredCount === 0 || phase === "submitting"}
              onClick={submit}
            >
              {phase === "submitting" ? "Scoring…" : "Submit"}
            </Button>
          ) : (
            <Button className="font-black" onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function Setup({
  title,
  description,
  pool,
  difficulty,
  count,
  available,
  loading,
  error,
  onDifficulty,
  onCount,
  onStart,
}: {
  title: string
  description: string
  pool: PoolStats
  difficulty: DifficultyChoice
  count: (typeof COUNT_OPTIONS)[number]
  available: number | null
  loading: boolean
  error: string | null
  onDifficulty: (d: DifficultyChoice) => void
  onCount: (c: (typeof COUNT_OPTIONS)[number]) => void
  onStart: () => void
}) {
  const shortfall = available != null && available < count
  return (
    <div className="relative mx-auto max-w-lg px-4 py-10 pb-40 md:pb-12">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-56 w-[120%] -translate-x-1/2 rounded-full bg-[var(--color-lime)]/10 blur-[120px]"
      />

      <div className="relative mb-6">
        <Link
          href="/quiz"
          className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          <ChevronLeft className="h-4 w-4" /> Quizzes
        </Link>
      </div>

      <header className="relative text-center">
        <span className="text-xs font-bold uppercase tracking-[0.4em] text-[var(--color-lime)]">
          {title} Quiz
        </span>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-[var(--color-text-primary)]">
          Set up your round
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--color-text-muted)]">{description}</p>
      </header>

      {/* Difficulty */}
      <section className="mt-8">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
          Difficulty
        </h2>
        <div className="grid grid-cols-4 gap-2">
          {DIFFICULTY_OPTIONS.map((opt) => {
            const n = pool ? (opt.id === "any" ? pool.total : pool[opt.id]) : null
            const disabled = n === 0
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled}
                aria-pressed={difficulty === opt.id}
                onClick={() => onDifficulty(opt.id)}
                className={cn(
                  "rounded-xl border px-2 py-3 text-center transition-all",
                  disabled && "cursor-not-allowed opacity-40",
                  difficulty === opt.id
                    ? "border-[var(--color-lime)] bg-[var(--color-lime)]/10 text-[var(--color-lime)]"
                    : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-white/20 hover:bg-white/[0.03]"
                )}
              >
                <span className="block text-sm font-black">{opt.label}</span>
                {n != null && (
                  <span className="mt-0.5 block text-[10px] tabular-nums opacity-70">{n}</span>
                )}
              </button>
            )
          })}
        </div>
      </section>

      {/* Count */}
      <section className="mt-6">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
          Questions
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {COUNT_OPTIONS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={count === c}
              onClick={() => onCount(c)}
              className={cn(
                "rounded-xl border py-3 text-center text-lg font-black transition-all",
                count === c
                  ? "border-[var(--color-lime)] bg-[var(--color-lime)]/10 text-[var(--color-lime)]"
                  : "border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-white/20 hover:bg-white/[0.03]"
              )}
            >
              {c}
            </button>
          ))}
        </div>
        {shortfall && (
          <p className="mt-2 text-center text-xs text-amber-300">
            Only {available} question{available === 1 ? "" : "s"} at this level — you&apos;ll get all
            of them.
          </p>
        )}
      </section>

      {error && <p className="mt-5 text-center text-sm text-[var(--color-danger)]">{error}</p>}

      <div className="mt-8">
        <Button
          size="lg"
          className="w-full rounded-2xl py-6 text-lg font-black"
          disabled={loading || available === 0}
          onClick={onStart}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
            </>
          ) : (
            "Start Quiz"
          )}
        </Button>
      </div>
    </div>
  )
}

function Results({
  title,
  result,
  onRetry,
}: {
  title: string
  result: GradedResult
  onRetry: () => void
}) {
  const passed = result.accuracy >= 60
  const headline = useMemo(() => {
    if (result.accuracy >= 90) return "Elite. You know your stuff."
    if (result.accuracy >= 60) return "Solid run."
    if (result.accuracy >= 30) return "Not bad — keep going."
    return "Rough one. Run it back."
  }, [result.accuracy])

  return (
    <div className="relative mx-auto max-w-2xl px-4 py-10 pb-40 md:pb-12">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-56 w-[120%] -translate-x-1/2 rounded-full bg-[var(--color-lime)]/10 blur-[120px]"
      />

      <div className="relative text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[var(--color-lime)]/10 text-[var(--color-lime)]">
          <Trophy className="h-8 w-8" />
        </span>
        <h1 className="mt-4 text-3xl font-black text-[var(--color-text-primary)]">{headline}</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{title}</p>

        <div className="mt-6 flex items-center justify-center gap-6">
          <Stat label="Score" value={`${result.score}/${result.total}`} />
          <Stat label="Accuracy" value={`${result.accuracy}%`} accent={passed} />
        </div>
      </div>

      {/* Answer review */}
      <div className="mt-10 space-y-4">
        {result.questions.map((q, i) => (
          <div
            key={q.questionId}
            className="rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-4"
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full",
                  q.correct
                    ? "bg-[var(--color-success)]/20 text-[var(--color-success)]"
                    : "bg-[var(--color-danger)]/20 text-[var(--color-danger)]"
                )}
              >
                {q.correct ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[var(--color-text-primary)]">
                  {i + 1}. {q.prompt}
                </p>
                <div className="mt-2 space-y-1 text-sm">
                  {q.choice !== null && q.choice !== q.answer && (
                    <p className="text-[var(--color-danger)]">Your answer: {q.options[q.choice]}</p>
                  )}
                  {q.choice === null && (
                    <p className="text-[var(--color-text-muted)]">You skipped this one.</p>
                  )}
                  <p className="text-[var(--color-success)]">Correct: {q.options[q.answer]}</p>
                  {q.explanation && (
                    <p className="text-[var(--color-text-muted)]">{q.explanation}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 flex items-center justify-center gap-3">
        <Button variant="outline" onClick={onRetry} className="gap-2">
          <RotateCcw className="h-4 w-4" /> New round
        </Button>
        <Button asChild className="font-black">
          <Link href="/quiz">More quizzes</Link>
        </Button>
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-center">
      <div
        className={cn(
          "text-4xl font-black tabular-nums",
          accent ? "text-[var(--color-lime)]" : "text-[var(--color-text-primary)]"
        )}
      >
        {value}
      </div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
        {label}
      </div>
    </div>
  )
}
