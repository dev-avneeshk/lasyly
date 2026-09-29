"use client"

import { useId, useState } from "react"
import { useRouter } from "next/navigation"
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/careers/constants"

export function StatusSelect({ applicationId, initial }: { applicationId: string; initial: ApplicationStatus }) {
  const id = useId()
  const router = useRouter()
  const [status, setStatus] = useState<ApplicationStatus>(initial)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null)

  async function change(next: ApplicationStatus) {
    const previous = status
    setStatus(next)
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/careers/admin/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error(String(res.status))
      setMessage({ kind: "ok", text: "Status updated." })
      router.refresh()
    } catch {
      setStatus(previous)
      setMessage({ kind: "error", text: "Couldn't update the status. Please try again." })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
        Status
      </label>
      <select
        id={id}
        value={status}
        disabled={saving}
        onChange={(e) => change(e.target.value as ApplicationStatus)}
        className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-lime)]/70 disabled:opacity-60"
      >
        {APPLICATION_STATUSES.map((s) => (
          <option key={s.value} value={s.value} className="text-black">
            {s.label}
          </option>
        ))}
      </select>
      <p
        aria-live="polite"
        className={`mt-2 min-h-5 text-xs ${message?.kind === "error" ? "text-[var(--color-danger)]" : "text-[var(--color-text-muted)]"}`}
      >
        {saving ? "Saving…" : message?.text}
      </p>
    </div>
  )
}
