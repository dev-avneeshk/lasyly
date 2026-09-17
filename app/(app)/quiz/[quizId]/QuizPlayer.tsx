"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft, ArrowRight, Check, ChevronLeft, Loader2, RotateCcw, X } from "lucide-react"
import type { ClientQuestion, QuizDifficulty, QuizSport } from "@/lib/quiz/types"
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

/** Seconds allowed per question before it auto-advances. */
const PER_QUESTION_SECONDS = 10

/** Decorative pull-quotes in the side rail. Rotated per question. */
const TAGLINES: Record<QuizSport, string[]> = {
  nba: ["Defense builds legends.", "Buckets are earned.", "Rings over numbers.", "Every possession counts."],
  nfl: ["Trenches decide rings.", "Fourth down. Full send.", "Defense wins Februarys.", "Every yard is earned."],
}

interface AttemptResponse {
  quizId: string
  title: string
  difficulty: DifficultyChoice
  questionCount: number
  questions: ClientQuestion[]
  token: string
}

/**
 * Function words that must never open or close the accent phrase. Without this
 * the headline highlights read as broken fragments: "MVP while", "Which Bulls".
 */
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "for", "of", "in", "on", "at", "to", "with", "from", "by",
  "was", "is", "are", "were", "has", "had", "have", "did", "do", "does", "that", "who",
  "whom", "which", "what", "when", "where", "why", "how", "after", "before", "during",
  "while", "against", "over", "under", "into", "without", "since", "until", "though",
  "then", "per", "than", "as", "but", "his", "her", "their", "its", "this", "these",
  "those", "name", "true", "false", "all", "less", "more", "most", "least", "only",
  "same", "such", "both", "each", "any", "some", "not",
])

/**
 * Split a prompt into `[before, accent, after]` so the headline can lime-out the
 * most interesting phrase — an acronym (DPOY, MVP, NBA) or a proper-noun run
 * (Ben Wallace). Falls back to no accent, which renders as a plain headline.
 */
function accentPrompt(prompt: string): [string, string, string] {
  const patterns = [
    /\b[A-Z]{2,}\b/g, // acronym: DPOY, MVP, NBA
    /\b[A-Z][a-z]+(?:\s+[A-Z][a-z'’.-]+)+\b/g, // capitalized run: "Ben Wallace"
    /\b[A-Z][a-z]{3,}(?:['’]s)?\b/g, // single proper noun: "Warriors"
  ]
  for (const [i, re] of patterns.entries()) {
    for (const match of prompt.matchAll(re)) {
      let text = match[0]
      let start = match.index

      // Never start mid-hyphenation ("Three-|Point Contest" reads as a typo).
      if (start > 0 && /[-'’]/.test(prompt[start - 1])) continue

      // Trim leading function words: "The Miami Heat" → "Miami Heat".
      for (;;) {
        const lead = /^([A-Za-z]+)(\s+)/.exec(text)
        if (!lead || !STOPWORDS.has(lead[1].toLowerCase())) break
        const shift = lead[1].length + lead[2].length
        start += shift
        text = text.slice(shift)
      }
      // …and trailing ones, plus dangling punctuation: "Toronto All-" → "Toronto".
      for (;;) {
        text = text.replace(/[-.'’\s]+$/, "")
        const tail = /(\s+)([A-Za-z]+)$/.exec(text)
        if (!tail || !STOPWORDS.has(tail[2].toLowerCase())) break
        text = text.slice(0, text.length - tail[0].length)
      }
      if (text.length < 3) continue
      // A bare "Which" / "Where" opening the sentence is not an accent phrase.
      if (STOPWORDS.has(text.toLowerCase().replace(/['’]s$/, ""))) continue

      // Pull the noun after an acronym into the accent ("DPOY awards").
      if (i === 0) {
        const next = /^\s+([A-Za-z]+)/.exec(prompt.slice(start + text.length))
        if (next && !STOPWORDS.has(next[1].toLowerCase())) text += next[0]
      }
      return [prompt.slice(0, start), text, prompt.slice(start + text.length)]
    }
  }
  return [prompt, "", ""]
}

export default function QuizPlayer({
  quizId,
  sport,
  title,
  description,
  pool,
}: {
  quizId: string
  sport: QuizSport
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
  // Per-question countdown. Resets on each new question; at 0 we auto-advance
  // (or auto-submit on the last question).
  const [timeLeft, setTimeLeft] = useState(PER_QUESTION_SECONDS)
  // Latest answers/token for use inside the timer's auto-submit (which fires
  // from a stable callback and must not close over stale state).
  const answersRef = useRef(answers)
  const tokenRef = useRef(token)
  useEffect(() => { answersRef.current = answers }, [answers])
  useEffect(() => { tokenRef.current = token }, [token])

  const eyebrow = `${sport.toUpperCase()} ${title} Quiz`

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
  const isLast = index === total - 1

  function choose(choice: number) {
    if (!current) return
    setAnswers((prev) => ({ ...prev, [current.id]: choice }))
  }

  const submit = useCallback(async () => {
    setPhase("submitting")
    setError(null)
    try {
      const payload = {
        answers: Object.entries(answersRef.current).map(([questionId, choice]) => ({ questionId, choice })),
        token: tokenRef.current,
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
  }, [quizId])

  // Advance to the next question, or submit if we're on the last one. Shared by
  // the countdown and the manual "Next" button.
  const goNext = useCallback(() => {
    setIndex((i) => {
      if (i >= total - 1) {
        void submit()
        return i
      }
      return i + 1
    })
  }, [total, submit])

  // ── Per-question 10s countdown ─────────────────────────────────────────────
  // Reset to full whenever the question changes (or play begins). A 1s tick
  // decrements; hitting 0 auto-advances. Only runs during the playing phase.
  useEffect(() => {
    if (phase !== "playing") return
    setTimeLeft(PER_QUESTION_SECONDS)
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setTimeout(() => goNext(), 0) // defer transition out of the updater
          return PER_QUESTION_SECONDS
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [phase, index, goNext])

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
    return <Results eyebrow={eyebrow} sport={sport} result={result} onRetry={backToSetup} />
  }

  if (phase === "setup" || phase === "loading") {
    return (
      <Setup
        eyebrow={eyebrow}
        sport={sport}
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

  const [before, accent, after] = accentPrompt(current?.prompt ?? "")
  const tagline = TAGLINES[sport][index % TAGLINES[sport].length]

  return (
    <Frame>
      <button
        type="button"
        onClick={backToSetup}
        className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Quiz
      </button>

      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_236px] lg:gap-10">
        {/* ── Question column ─────────────────────────────────────────────── */}
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
            {eyebrow}
          </p>

          <AnimatePresence mode="wait">
            <motion.div
              key={current?.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--color-lime)]">
                {title}
              </p>

              <h1 className="mt-2 font-display text-[34px] uppercase leading-[0.92] tracking-[0.01em] text-[var(--color-text-primary)] sm:text-[44px]">
                {before}
                {accent && <span className="text-[var(--color-lime)]">{accent}</span>}
                {after}
              </h1>

              <p className="mt-3 text-sm text-[var(--color-text-muted)]">Choose the correct answer.</p>

              <div className="mt-6 space-y-2.5" role="radiogroup" aria-label="Answer options">
                {current?.options.map((option, i) => {
                  const active = selected === i
                  return (
                    <button
                      key={i}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => choose(i)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all",
                        active
                          ? "border-[var(--color-lime)] bg-[var(--color-lime)]/[0.07] shadow-[0_0_40px_-24px_rgba(212,255,0,0.9)]"
                          : "border-[var(--color-border)] bg-white/[0.015] hover:border-white/20 hover:bg-white/[0.04]"
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-black transition-colors",
                          active
                            ? "bg-[var(--color-lime)] text-black"
                            : "bg-white/[0.07] text-[var(--color-text-muted)]"
                        )}
                      >
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="min-w-0 flex-1 text-[15px] font-semibold text-[var(--color-text-primary)]">
                        {option}
                      </span>
                      {active && (
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--color-lime)] text-black">
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          </AnimatePresence>

          {error && <p className="mt-4 text-sm text-[var(--color-danger)]">{error}</p>}

          {/* Nav */}
          <div className="mt-7 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white/[0.02] px-5 py-3 text-sm font-bold text-[var(--color-text-primary)] transition-colors hover:border-white/20 hover:bg-white/[0.05] disabled:pointer-events-none disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>

            {isLast ? (
              <button
                type="button"
                disabled={answeredCount === 0 || phase === "submitting"}
                onClick={submit}
                className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-xl bg-[var(--color-lime)] px-6 py-3 text-sm font-black uppercase tracking-wide text-black transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
              >
                {phase === "submitting" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Scoring
                  </>
                ) : (
                  <>
                    Submit <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-xl bg-[var(--color-lime)] px-6 py-3 text-sm font-black uppercase tracking-wide text-black transition-opacity hover:opacity-90"
              >
                Next <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── Counter rail ────────────────────────────────────────────────── */}
        <aside className="order-first lg:order-none lg:border-l lg:border-[var(--color-border)] lg:pl-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
            Question
          </p>

          <div className="mt-1 flex items-end gap-2">
            <span className="font-display text-[56px] leading-[0.8] text-[var(--color-text-primary)] tabular-nums sm:text-[64px]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="pb-1 text-lg font-bold text-[var(--color-text-muted)] tabular-nums">
              / {total}
            </span>
          </div>

          {/* Segmented progress */}
          <div className="mt-4 flex gap-1">
            {questions.map((q, i) => (
              <span
                key={q.id}
                className={cn(
                  "h-[5px] flex-1 rounded-[1px] transition-colors",
                  i <= index ? "bg-[var(--color-lime)]" : "bg-white/[0.09]"
                )}
              />
            ))}
          </div>

          {/* Countdown */}
          <div className="mt-4 flex items-center gap-2.5">
            <span
              className={cn(
                "font-display text-base tabular-nums transition-colors",
                timeLeft <= 3 ? "text-[var(--color-danger)]" : "text-[var(--color-lime)]"
              )}
              aria-label={`${timeLeft} seconds left`}
            >
              {timeLeft}s
            </span>
            <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.09]">
              <span
                className={cn(
                  "block h-full transition-[width] duration-1000 ease-linear",
                  timeLeft <= 3 ? "bg-[var(--color-danger)]" : "bg-[var(--color-lime)]"
                )}
                style={{ width: `${(timeLeft / PER_QUESTION_SECONDS) * 100}%` }}
              />
            </span>
          </div>

          <PullQuote text={tagline} />
        </aside>
      </div>
    </Frame>
  )
}

function Setup({
  eyebrow,
  sport,
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
  eyebrow: string
  sport: QuizSport
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
    <Frame>
      <Link
        href="/quiz"
        className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
      >
        <ChevronLeft className="h-4 w-4" /> All Quizzes
      </Link>

      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_236px] lg:gap-10">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
            {eyebrow}
          </p>

          <h1 className="mt-2 font-display text-[34px] uppercase leading-[0.92] text-[var(--color-text-primary)] sm:text-[44px]">
            Set up your <span className="text-[var(--color-lime)]">round</span>
          </h1>
          <p className="mt-3 max-w-md text-sm text-[var(--color-text-muted)]">{description}</p>

          {/* Difficulty */}
          <section className="mt-7">
            <h2 className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
              Difficulty
            </h2>
            <div className="grid grid-cols-4 gap-2">
              {DIFFICULTY_OPTIONS.map((opt) => {
                const n = pool ? (opt.id === "any" ? pool.total : pool[opt.id]) : null
                const disabled = n === 0
                const active = difficulty === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={disabled}
                    aria-pressed={active}
                    onClick={() => onDifficulty(opt.id)}
                    className={cn(
                      "rounded-xl border px-2 py-3 text-center transition-all",
                      disabled && "cursor-not-allowed opacity-40",
                      active
                        ? "border-[var(--color-lime)] bg-[var(--color-lime)]/[0.07] text-[var(--color-lime)]"
                        : "border-[var(--color-border)] bg-white/[0.015] text-[var(--color-text-muted)] hover:border-white/20 hover:bg-white/[0.04]"
                    )}
                  >
                    <span className="block text-xs font-black uppercase tracking-wider">{opt.label}</span>
                    {n != null && (
                      <span className="mt-1 block text-[10px] tabular-nums opacity-70">{n}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>

          {/* Count */}
          <section className="mt-5">
            <h2 className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
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
                    "rounded-xl border py-3 text-center font-display text-2xl transition-all",
                    count === c
                      ? "border-[var(--color-lime)] bg-[var(--color-lime)]/[0.07] text-[var(--color-lime)]"
                      : "border-[var(--color-border)] bg-white/[0.015] text-[var(--color-text-primary)] hover:border-white/20 hover:bg-white/[0.04]"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
            {shortfall && (
              <p className="mt-2 text-xs text-amber-300">
                Only {available} question{available === 1 ? "" : "s"} at this level — you&apos;ll get
                all of them.
              </p>
            )}
          </section>

          {error && <p className="mt-5 text-sm text-[var(--color-danger)]">{error}</p>}

          <button
            type="button"
            disabled={loading || available === 0}
            onClick={onStart}
            className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-lime)] px-6 py-4 text-sm font-black uppercase tracking-[0.15em] text-black transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40 sm:w-auto sm:px-10"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Loading
              </>
            ) : (
              <>
                Start Quiz <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>

        {/* Rail */}
        <aside className="order-first lg:order-none lg:border-l lg:border-[var(--color-border)] lg:pl-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
            In the bank
          </p>
          <div className="mt-1 font-display text-[56px] leading-[0.8] text-[var(--color-text-primary)] tabular-nums">
            {pool ? pool.total.toLocaleString() : "—"}
          </div>
          <div className="mt-4 space-y-1.5">
            {(["easy", "medium", "hard"] as const).map((level) => (
              <div
                key={level}
                className="flex items-center justify-between border-b border-[var(--color-border)] pb-1.5 text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]"
              >
                <span>{level}</span>
                <span className="tabular-nums text-[var(--color-text-primary)]">
                  {pool ? pool[level].toLocaleString() : "—"}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
            {PER_QUESTION_SECONDS}s per question
          </p>

          <PullQuote text={TAGLINES[sport][0]} />
        </aside>
      </div>
    </Frame>
  )
}

function Results({
  eyebrow,
  sport,
  result,
  onRetry,
}: {
  eyebrow: string
  sport: QuizSport
  result: GradedResult
  onRetry: () => void
}) {
  const headline = useMemo(() => {
    if (result.accuracy >= 90) return ["Elite.", "You know your stuff."]
    if (result.accuracy >= 60) return ["Solid", "run."]
    if (result.accuracy >= 30) return ["Not bad —", "keep going."]
    return ["Rough one.", "Run it back."]
  }, [result.accuracy])

  return (
    <Frame>
      <Link
        href="/quiz"
        className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
      >
        <ChevronLeft className="h-4 w-4" /> All Quizzes
      </Link>

      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_236px] lg:gap-10">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
            {eyebrow}
          </p>
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--color-lime)]">
            Final
          </p>
          <h1 className="mt-2 font-display text-[34px] uppercase leading-[0.92] text-[var(--color-text-primary)] sm:text-[44px]">
            {headline[0]} <span className="text-[var(--color-lime)]">{headline[1]}</span>
          </h1>

          {/* Answer review */}
          <div className="mt-7 space-y-2.5">
            {result.questions.map((q, i) => (
              <div
                key={q.questionId}
                className="rounded-xl border border-[var(--color-border)] bg-white/[0.015] p-4"
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

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white/[0.02] px-5 py-3 text-sm font-bold text-[var(--color-text-primary)] transition-colors hover:border-white/20 hover:bg-white/[0.05]"
            >
              <RotateCcw className="h-4 w-4" /> New round
            </button>
            <Link
              href="/quiz"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-lime)] px-6 py-3 text-sm font-black uppercase tracking-wide text-black transition-opacity hover:opacity-90"
            >
              More quizzes <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Score rail */}
        <aside className="order-first lg:order-none lg:border-l lg:border-[var(--color-border)] lg:pl-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
            Score
          </p>
          <div className="mt-1 flex items-end gap-2">
            <span className="font-display text-[56px] leading-[0.8] text-[var(--color-lime)] tabular-nums sm:text-[64px]">
              {String(result.score).padStart(2, "0")}
            </span>
            <span className="pb-1 text-lg font-bold text-[var(--color-text-muted)] tabular-nums">
              / {result.total}
            </span>
          </div>

          <div className="mt-4 flex gap-1">
            {result.questions.map((q) => (
              <span
                key={q.questionId}
                className={cn(
                  "h-[5px] flex-1 rounded-[1px]",
                  q.correct ? "bg-[var(--color-lime)]" : "bg-white/[0.09]"
                )}
              />
            ))}
          </div>

          <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
            Accuracy{" "}
            <span className="text-[var(--color-text-primary)] tabular-nums">{result.accuracy}%</span>
          </p>

          <PullQuote text={TAGLINES[sport][1]} />
        </aside>
      </div>
    </Frame>
  )
}

/**
 * The editorial shell every quiz screen sits in: a bordered panel with the
 * court-line backdrop, the vertical brand strip on the left, and the corner
 * marks. Content is passed as children and lays itself out in a two-column grid.
 */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl px-3 py-4 pb-40 sm:px-5 md:pb-10">
      <BrandStrip />

      <div className="relative min-w-0 flex-1 overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 lg:min-h-[540px]">
        <CourtBackdrop />
        <div className="relative px-4 py-6 sm:px-7 sm:py-7 xl:pr-14">{children}</div>
        <CornerMark />
      </div>
    </div>
  )
}

/** Vertical brand rail to the left of the panel. Decorative, desktop only. */
function BrandStrip() {
  return (
    <div aria-hidden className="hidden w-14 shrink-0 flex-col items-center justify-between py-8 lg:flex">
      <div className="flex flex-col items-center">
        {["Play", "Predict", "Compete"].map((word) => (
          <span
            key={word}
            className="text-[8px] font-bold uppercase leading-[1.7] tracking-[0.2em] text-white/30"
          >
            {word}
          </span>
        ))}
        <span className="mt-3 block h-16 w-px bg-gradient-to-b from-[var(--color-lime)]/40 to-transparent" />
      </div>
      <span className="rotate-180 text-[9px] font-bold uppercase tracking-[0.35em] text-white/25 [writing-mode:vertical-rl]">
        Lasyly
      </span>
    </div>
  )
}

/** Faint court geometry + register marks behind the panel content. */
function CourtBackdrop() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute -left-8 -top-10 h-72 w-28 -skew-x-[22deg] bg-gradient-to-b from-[var(--color-lime)]/[0.09] to-transparent blur-[2px]"
      />
      <svg
        aria-hidden
        viewBox="0 0 400 400"
        className="pointer-events-none absolute -right-24 top-8 h-[440px] w-[440px] text-white/[0.07]"
      >
        <circle cx="300" cy="200" r="170" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="300" cy="200" r="96" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <line x1="130" y1="30" x2="130" y2="370" stroke="currentColor" strokeWidth="1.5" />
        <g strokeWidth="1.5" stroke="currentColor">
          <path d="M60 150h18M69 141v18" />
          <path d="M96 196h18M105 187v18" />
          <path d="M48 242h18M57 233v18" />
        </g>
      </svg>
    </>
  )
}

/** Bottom-right and right-edge editorial marks. Decorative, desktop only. */
function CornerMark() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute right-3 top-24 hidden flex-col items-center xl:flex"
      >
        <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/20 [writing-mode:vertical-rl]">
          Know more
        </span>
        <span className="mt-2 h-10 w-px bg-white/10" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-5 right-6 hidden items-center gap-3 lg:flex"
      >
        <p className="text-right text-[9px] font-bold uppercase leading-[1.6] tracking-[0.25em] text-white/25">
          Sports for a
          <br />
          smarter you
        </p>
        <span className="h-px w-8 bg-white/15" />
      </div>
    </>
  )
}

/** Oversized ghost pull-quote that anchors the bottom of the side rail. */
function PullQuote({ text }: { text: string }) {
  return (
    <div aria-hidden className="mt-10 hidden lg:block">
      <span className="block h-[3px] w-7 bg-[var(--color-lime)]" />
      <p className="mt-4 font-display text-[26px] uppercase leading-[0.95] text-white/[0.13]">
        {text}
      </p>
      <p className="mt-4 text-[9px] font-bold uppercase tracking-[0.3em] text-white/20">
        More than a game
      </p>
    </div>
  )
}
