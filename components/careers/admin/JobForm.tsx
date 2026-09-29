"use client"

import { useId, useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { jobSchema, fieldErrors } from "@/lib/careers/validation"

export interface JobFormValues {
  title: string
  department: string
  location: string
  employmentType: string
  experienceLevel: string
  description: string
  requirements: string[]
  skills: string[]
  isActive: boolean
}

const EMPTY: JobFormValues = {
  title: "",
  department: "",
  location: "",
  employmentType: "Full-time",
  experienceLevel: "",
  description: "",
  requirements: [],
  skills: [],
  isActive: false,
}

const splitLines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean)
const splitComma = (s: string) => s.split(",").map((l) => l.trim()).filter(Boolean)

export function JobForm({ jobId, initial }: { jobId?: string; initial?: JobFormValues }) {
  const uid = useId()
  const router = useRouter()
  const start = initial ?? EMPTY
  const [v, setV] = useState({
    ...start,
    requirementsText: start.requirements.join("\n"),
    skillsText: start.skills.join(", "),
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const set = (k: keyof typeof v, value: string | boolean) => setV((p) => ({ ...p, [k]: value }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setFormError(null)
    const payload = {
      title: v.title,
      department: v.department,
      location: v.location,
      employmentType: v.employmentType,
      experienceLevel: v.experienceLevel,
      description: v.description,
      requirements: splitLines(v.requirementsText),
      skills: splitComma(v.skillsText),
      isActive: v.isActive,
    }
    const parsed = jobSchema.safeParse(payload)
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error))
      return
    }
    setErrors({})
    setSaving(true)
    try {
      const res = await fetch(jobId ? `/api/careers/admin/jobs/${jobId}` : "/api/careers/admin/jobs", {
        method: jobId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(String(res.status))
      router.push("/admin/careers/jobs")
      router.refresh()
    } catch {
      setFormError("Couldn't save the job. Please check the fields and try again.")
      setSaving(false)
    }
  }

  const input = (err?: string) =>
    cn(
      "block w-full rounded-xl border bg-[var(--color-background)] px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/70",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-lime)]/70",
      err ? "border-[var(--color-danger)]/60" : "border-[var(--color-border)]"
    )

  const text = (k: "title" | "department" | "location" | "employmentType" | "experienceLevel", label: string, placeholder: string) => (
    <div>
      <label htmlFor={`${uid}-${k}`} className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]">{label}</label>
      <input
        id={`${uid}-${k}`}
        value={v[k]}
        onChange={(e) => set(k, e.target.value)}
        placeholder={placeholder}
        aria-invalid={!!errors[k] || undefined}
        aria-describedby={errors[k] ? `${uid}-${k}-err` : undefined}
        className={input(errors[k])}
      />
      {errors[k] && <p id={`${uid}-${k}-err`} className="mt-2 text-[13px] text-[var(--color-danger)]">{errors[k]}</p>}
    </div>
  )

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-7">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">{text("title", "Job title", "Software Engineer")}</div>
        {text("department", "Department", "Engineering")}
        {text("location", "Location", "Hyderabad / Remote")}
        {text("employmentType", "Employment type", "Full-time")}
        {text("experienceLevel", "Experience level", "0–2 years")}
      </div>

      <div>
        <label htmlFor={`${uid}-description`} className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]">Short description</label>
        <textarea
          id={`${uid}-description`}
          rows={4}
          value={v.description}
          onChange={(e) => set("description", e.target.value)}
          aria-invalid={!!errors.description || undefined}
          aria-describedby={errors.description ? `${uid}-description-err` : undefined}
          className={input(errors.description)}
        />
        {errors.description && <p id={`${uid}-description-err`} className="mt-2 text-[13px] text-[var(--color-danger)]">{errors.description}</p>}
      </div>

      <div>
        <label htmlFor={`${uid}-req`} className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]">Requirements</label>
        <textarea
          id={`${uid}-req`}
          rows={4}
          value={v.requirementsText}
          onChange={(e) => set("requirementsText", e.target.value)}
          aria-describedby={`${uid}-req-hint`}
          className={input(errors.requirements)}
        />
        <p id={`${uid}-req-hint`} className="mt-2 text-[13px] text-[var(--color-text-muted)]">One per line.</p>
        {errors.requirements && <p className="mt-1 text-[13px] text-[var(--color-danger)]">{errors.requirements}</p>}
      </div>

      <div>
        <label htmlFor={`${uid}-skills`} className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]">Skills</label>
        <input
          id={`${uid}-skills`}
          value={v.skillsText}
          onChange={(e) => set("skillsText", e.target.value)}
          placeholder="React, Next.js, Node.js"
          aria-describedby={`${uid}-skills-hint`}
          className={input(errors.skills)}
        />
        <p id={`${uid}-skills-hint`} className="mt-2 text-[13px] text-[var(--color-text-muted)]">Comma separated.</p>
        {errors.skills && <p className="mt-1 text-[13px] text-[var(--color-danger)]">{errors.skills}</p>}
      </div>

      <div className="flex items-center gap-3">
        <input
          id={`${uid}-active`}
          type="checkbox"
          checked={v.isActive}
          onChange={(e) => set("isActive", e.target.checked)}
          className="h-5 w-5 accent-[var(--color-lime)]"
        />
        <label htmlFor={`${uid}-active`} className="text-sm text-[var(--color-text-primary)]">
          Active (visible on the public careers page)
        </label>
      </div>

      {formError && (
        <p role="alert" className="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex min-h-11 items-center rounded-full bg-[var(--color-lime)] px-6 py-2.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-lime)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
      >
        {saving ? "Saving…" : jobId ? "Save changes" : "Create job"}
      </button>
    </form>
  )
}
