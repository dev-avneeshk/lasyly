"use client"

import { motion } from "framer-motion"
import { TrendingUp, TrendingDown } from "lucide-react"
import type { LetterGrade, ManagerGrade } from "@/lib/nfl/grades"
import { cn } from "@/lib/utils"

/** Grade → accent color. A/B green-ish, C neutral, D/F warn/danger. */
function gradeColor(grade: LetterGrade): string {
  const letter = grade[0]
  if (letter === "A") return "var(--color-lime)"
  if (letter === "B") return "var(--color-secondary)"
  if (letter === "C") return "var(--color-primary)"
  if (letter === "D") return "var(--color-warning)"
  return "var(--color-danger)"
}

function GradePill({ grade, size = "sm" }: { grade: LetterGrade; size?: "sm" | "lg" }) {
  const color = gradeColor(grade)
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-black tabular-nums",
        size === "lg" ? "h-16 w-16 text-4xl" : "h-8 min-w-8 px-2 text-sm"
      )}
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {grade}
    </span>
  )
}

export function NflManagerGrade({ grade, title }: { grade: ManagerGrade; title?: string }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-5">
      {/* Overall */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
            {title ?? "Manager Grade"}
          </p>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Overall Report Card</p>
        </div>
        <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }}>
          <GradePill grade={grade.overall} size="lg" />
        </motion.div>
      </div>

      {/* Position groups */}
      <div className="grid grid-cols-1 gap-1.5">
        {grade.positions.map((p) => (
          <div key={p.group} className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2">
            <GradePill grade={p.grade} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[var(--color-text-primary)]">{p.label}</p>
              <p className="truncate text-[11px] text-[var(--color-text-muted)]">{p.note}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Meta grades */}
      <div className="grid grid-cols-3 gap-2">
        <MetaGrade label="Budget Mgmt" grade={grade.budgetManagement.grade} note={grade.budgetManagement.note} />
        <MetaGrade label="Value Hunting" grade={grade.valueHunting.grade} note={grade.valueHunting.note} />
        <MetaGrade label="Balance" grade={grade.rosterBalance.grade} note={grade.rosterBalance.note} />
      </div>

      {/* Best buy / biggest overpay */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {grade.bestBuy && (
          <InsightRow
            tone="good"
            heading="Best Buy"
            name={grade.bestBuy.playerName}
            position={grade.bestBuy.position}
            price={grade.bestBuy.price}
            estimate={grade.bestBuy.estimate}
            delta={grade.bestBuy.delta}
          />
        )}
        {grade.biggestOverpay && (
          <InsightRow
            tone="bad"
            heading="Biggest Overpay"
            name={grade.biggestOverpay.playerName}
            position={grade.biggestOverpay.position}
            price={grade.biggestOverpay.price}
            estimate={grade.biggestOverpay.estimate}
            delta={grade.biggestOverpay.delta}
          />
        )}
      </div>

      {/* Budget efficiency bar */}
      <div>
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
          <span>Budget Efficiency</span>
          <span className="tabular-nums text-[var(--color-text-primary)]">{grade.budgetEfficiency}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/5">
          <motion.div
            className="h-full rounded-full bg-[var(--color-lime)]"
            initial={{ width: 0 }}
            animate={{ width: `${grade.budgetEfficiency}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
      </div>
    </div>
  )
}

function MetaGrade({ label, grade, note }: { label: string; grade: LetterGrade; note: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] p-2.5 text-center" title={note}>
      <GradePill grade={grade} />
      <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
    </div>
  )
}

function InsightRow({
  tone, heading, name, position, price, estimate, delta,
}: {
  tone: "good" | "bad"
  heading: string
  name: string
  position: string
  price: number
  estimate: number
  delta: number
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2",
        tone === "good" ? "border-[var(--color-lime)]/30 bg-[var(--color-lime)]/[0.06]" : "border-[var(--color-danger)]/30 bg-[var(--color-danger)]/[0.06]"
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: tone === "good" ? "var(--color-lime)" : "var(--color-danger)" }}>
        {tone === "good" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {heading}
      </div>
      <p className="mt-0.5 text-sm font-bold text-[var(--color-text-primary)]">{name} <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">{position}</span></p>
      <p className="text-[11px] text-[var(--color-text-muted)]">
        Paid ${price} · Est. ${estimate}
        <span className="ml-1 font-semibold" style={{ color: tone === "good" ? "var(--color-lime)" : "var(--color-danger)" }}>
          ({delta > 0 ? "+" : ""}{delta})
        </span>
      </p>
    </div>
  )
}
