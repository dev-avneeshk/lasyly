"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import { Check, X, ChevronLeft, RotateCcw, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ClientQuiz } from "@/lib/quiz/types"
import type { GradedResult } from "@/lib/quiz/grade"
import { cn } from "@/lib/utils"

type Phase = "playing" | "submitting" | "done"

export default function QuizPlayer({ quiz }: { quiz: ClientQuiz }) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [phase, setPhase] = useState<Phase>("playing")
  const [result, setResult] = useState<GradedResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const total = quiz.questions.length
  const current = quiz.questions[index]
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
        answers: Object.entries(answers).map(([questionId, choice]) => ({
          questionId,
          choice,
        })),
      }
      const res = await fetch(`/api/quiz/${quiz.id}/submit`, {
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

  function retry() {
    setAnswers({})
    setIndex(0)
    setResult(null)
    setError(null)
    setPhase("playing")
  }

  if (phase === "done" && result) {
    return <Results quiz={quiz} result={result} onRetry={retry} />
  }

  return (
    <div className="relative mx-auto max-w-2xl px-4 py-8 pb-40 md:pb-12">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-56 w-[120%] -translate-x-1/2 rounded-full bg-[var(--color-lime)]/10 blur-[120px]"
      />

      {/* Top bar */}
      <div className="relative mb-6 flex items-center justify-between gap-4">
        <Link
          href="/quiz"
          className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          <ChevronLeft className="h-4 w-4" /> Quizzes
        </Link>
        <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
          {index + 1} / {total}
        </span>
      </div>

      <div className="relative">
        <h1 className="text-sm font-bold uppercase tracking-[0.3em] text-[var(--color-lime)]">
          {quiz.title}
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

function Results({
  quiz,
  result,
  onRetry,
}: {
  quiz: ClientQuiz
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
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{quiz.title}</p>

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
                    <p className="text-[var(--color-danger)]">
                      Your answer: {q.options[q.choice]}
                    </p>
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
          <RotateCcw className="h-4 w-4" /> Try again
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
