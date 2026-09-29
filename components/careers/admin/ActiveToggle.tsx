"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

export function ActiveToggle({ jobId, initial, title }: { jobId: string; initial: boolean; title: string }) {
  const router = useRouter()
  const [active, setActive] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  async function toggle() {
    const next = !active
    setSaving(true)
    setError(false)
    try {
      const res = await fetch(`/api/careers/admin/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      })
      if (!res.ok) throw new Error(String(res.status))
      setActive(next)
      router.refresh()
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label={`${title} is ${active ? "active" : "inactive"}`}
        disabled={saving}
        onClick={toggle}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-60",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-lime)]",
          active ? "border-[var(--color-lime)]/50 bg-[var(--color-lime)]/30" : "border-[var(--color-border)] bg-white/5"
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-0.5 h-4.5 w-4.5 rounded-full transition-all",
            active ? "left-[22px] bg-[var(--color-lime)]" : "left-0.5 bg-white/40"
          )}
        />
      </button>
      <span className="text-xs text-[var(--color-text-muted)]">{active ? "Active" : "Inactive"}</span>
      {error && <span role="alert" className="text-xs text-[var(--color-danger)]">Couldn&apos;t update</span>}
    </span>
  )
}
