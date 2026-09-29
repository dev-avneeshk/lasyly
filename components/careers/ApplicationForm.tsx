"use client"

import { useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { EXPERIENCE_OPTIONS, REFERRAL_OPTIONS } from "@/lib/careers/constants"
import { applicationFieldsSchema, fieldErrors } from "@/lib/careers/validation"
import { FileXLUpload } from "./FileXLUpload"

type Values = {
  fullName: string
  email: string
  phone: string
  location: string
  currentJobTitle: string
  currentCompany: string
  experience: string
  linkedin: string
  github: string
  referralSource: string
  referralOther: string
  cvFileUrl: string
  consent: boolean
}

const INITIAL: Values = {
  fullName: "",
  email: "",
  phone: "",
  location: "",
  currentJobTitle: "",
  currentCompany: "",
  experience: "",
  linkedin: "",
  github: "",
  referralSource: "",
  referralOther: "",
  cvFileUrl: "",
  consent: false,
}

// Order used to focus the first invalid field on submit.
const FIELD_ORDER: (keyof Values)[] = [
  "fullName", "email", "phone", "location", "currentJobTitle", "currentCompany",
  "experience", "linkedin", "github", "referralSource", "referralOther", "cvFileUrl", "consent",
]

const GENERIC_ERROR =
  "Something went wrong while submitting your application. Please try again."

type Phase = "idle" | "submitting" | "submitted" | "done"

export interface ApplicationFormProps {
  /** null for the general / talent-pool application. */
  jobId: string | null
}

export function ApplicationForm({ jobId }: ApplicationFormProps) {
  const uid = useId()
  const [values, setValues] = useState<Values>(INITIAL)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [phase, setPhase] = useState<Phase>("idle")
  const [formError, setFormError] = useState<string | null>(null)
  const [reference, setReference] = useState<string | null>(null)
  const [honeypot, setHoneypot] = useState("")

  // One idempotency key per form instance: retries/double-clicks reuse it.
  const submissionKey = useRef<string | null>(null)
  const startedAt = useRef<number>(0)
  const inFlight = useRef(false)
  const successHeading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    startedAt.current = Date.now()
    submissionKey.current = crypto.randomUUID()
  }, [])

  useEffect(() => {
    if (phase === "done") {
      window.scrollTo({ top: 0, behavior: "smooth" })
      successHeading.current?.focus()
    }
  }, [phase])

  const id = (name: string) => `${uid}-${name}`

  function validate(next: Values): Record<string, string> {
    const result = applicationFieldsSchema.safeParse(next)
    return result.success ? {} : fieldErrors(result.error)
  }

  function update<K extends keyof Values>(name: K, value: Values[K]) {
    const next = { ...values, [name]: value }
    if (name === "referralSource" && value !== "other") next.referralOther = ""
    setValues(next)
    // Re-validate live only once a field has been visited, so errors don't
    // appear while someone is still typing their first attempt.
    if (touched[name] || errors[name]) {
      const all = validate(next)
      setErrors((prev) => {
        const copy = { ...prev }
        if (all[name]) copy[name] = all[name]
        else delete copy[name]
        return copy
      })
    }
  }

  function blur(name: keyof Values) {
    setTouched((t) => ({ ...t, [name]: true }))
    const all = validate(values)
    setErrors((prev) => {
      const copy = { ...prev }
      if (all[name]) copy[name] = all[name]
      else delete copy[name]
      return copy
    })
  }

  function focusFirstError(errs: Record<string, string>) {
    const first = FIELD_ORDER.find((f) => errs[f])
    if (first) document.getElementById(id(first))?.focus()
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (inFlight.current || phase !== "idle") return
    setFormError(null)

    const errs = validate(values)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      setTouched(Object.fromEntries(FIELD_ORDER.map((f) => [f, true])))
      focusFirstError(errs)
      return
    }

    inFlight.current = true
    setPhase("submitting")
    try {
      const res = await fetch("/api/careers/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: values,
          jobId,
          submissionKey: submissionKey.current,
          website: honeypot,
          startedAt: startedAt.current,
        }),
      })
      const data = (await res.json().catch(() => null)) as
        | { reference?: string; error?: string; fields?: Record<string, string> }
        | null

      if (res.ok && data?.reference) {
        setReference(data.reference)
        setPhase("submitted")
        setTimeout(() => setPhase("done"), 900)
        return
      }

      if (res.status === 400 && data?.fields && Object.keys(data.fields).length > 0) {
        setErrors(data.fields)
        focusFirstError(data.fields)
        setFormError("Please check the highlighted fields.")
      } else if ((res.status === 409 || res.status === 429) && data?.error) {
        setFormError(data.error)
      } else {
        setFormError(GENERIC_ERROR)
      }
      setPhase("idle")
    } catch {
      setFormError(GENERIC_ERROR)
      setPhase("idle")
    } finally {
      inFlight.current = false
    }
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (phase === "done" && reference) {
    return (
      <section
        aria-labelledby={id("success")}
        className="careers-rise rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-12 sm:px-12 sm:py-16 text-center"
      >
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-lime)]/10 text-[var(--color-lime)]">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2
          id={id("success")}
          ref={successHeading}
          tabIndex={-1}
          className="text-2xl sm:text-3xl font-bold font-serif tracking-tight text-white outline-none"
        >
          Application Submitted Successfully
        </h2>
        <p className="mt-4 text-[15px] text-[var(--color-text-muted)] leading-relaxed max-w-[52ch] mx-auto">
          Thank you for your interest in joining our team. We&apos;ve received your application and will review your details.
        </p>
        <div className="mt-8 inline-flex flex-col items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-8 py-4">
          <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
            Application ID
          </span>
          <span className="mt-1 font-mono text-xl font-semibold text-white tabular-nums">#{reference}</span>
        </div>
        <p className="mt-8 text-sm text-[var(--color-text-muted)]">
          We&apos;ll contact you if your profile matches an opportunity.
        </p>
        <Link
          href="/careers"
          className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--color-lime)] px-6 py-3 text-sm font-semibold text-black transition-transform duration-300 hover:scale-[0.98] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-lime)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]"
        >
          Back to Careers
        </Link>
      </section>
    )
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  const busy = phase !== "idle"
  const showErr = (name: keyof Values) => errors[name]

  return (
    <form onSubmit={onSubmit} noValidate aria-describedby={formError ? id("form-error") : undefined} className="space-y-6">
      {/* Honeypot: hidden from people and assistive tech, bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
        <label htmlFor={id("website")}>Website</label>
        <input
          id={id("website")}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <FormSection no="01" title="Personal information" id={id("s-personal")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name" required htmlFor={id("fullName")} error={showErr("fullName")} errorId={id("fullName-error")} className="sm:col-span-2">
            <TextInput
              id={id("fullName")} name="fullName" autoComplete="name" placeholder="Enter your full name"
              value={values.fullName} error={!!errors.fullName} errorId={id("fullName-error")}
              onChange={(v) => update("fullName", v)} onBlur={() => blur("fullName")} required
            />
          </Field>
          <Field label="Email address" required htmlFor={id("email")} error={showErr("email")} errorId={id("email-error")}>
            <TextInput
              id={id("email")} name="email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com"
              value={values.email} error={!!errors.email} errorId={id("email-error")}
              onChange={(v) => update("email", v)} onBlur={() => blur("email")} required
            />
          </Field>
          <Field label="Phone number" required htmlFor={id("phone")} error={showErr("phone")} errorId={id("phone-error")} hint="Include your country code." hintId={id("phone-hint")}>
            <TextInput
              id={id("phone")} name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="+91 98765 43210"
              value={values.phone} error={!!errors.phone} errorId={id("phone-error")} hintId={id("phone-hint")}
              onChange={(v) => update("phone", v)} onBlur={() => blur("phone")} required
            />
          </Field>
          <Field label="Current location" required htmlFor={id("location")} error={showErr("location")} errorId={id("location-error")} className="sm:col-span-2">
            <TextInput
              id={id("location")} name="location" autoComplete="address-level2" placeholder="City, Country"
              value={values.location} error={!!errors.location} errorId={id("location-error")}
              onChange={(v) => update("location", v)} onBlur={() => blur("location")} required
            />
          </Field>
        </div>
      </FormSection>

      <FormSection no="02" title="Professional information" id={id("s-pro")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Current job title" htmlFor={id("currentJobTitle")} error={showErr("currentJobTitle")} errorId={id("currentJobTitle-error")}>
            <TextInput
              id={id("currentJobTitle")} name="currentJobTitle" autoComplete="organization-title" placeholder="e.g. Frontend Developer"
              value={values.currentJobTitle} error={!!errors.currentJobTitle} errorId={id("currentJobTitle-error")}
              onChange={(v) => update("currentJobTitle", v)} onBlur={() => blur("currentJobTitle")}
            />
          </Field>
          <Field label="Current company" htmlFor={id("currentCompany")} error={showErr("currentCompany")} errorId={id("currentCompany-error")}>
            <TextInput
              id={id("currentCompany")} name="currentCompany" autoComplete="organization" placeholder="e.g. Acme Inc."
              value={values.currentCompany} error={!!errors.currentCompany} errorId={id("currentCompany-error")}
              onChange={(v) => update("currentCompany", v)} onBlur={() => blur("currentCompany")}
            />
          </Field>
          <Field label="Experience" required htmlFor={id("experience")} error={showErr("experience")} errorId={id("experience-error")} className="sm:col-span-2">
            <SelectInput
              id={id("experience")} name="experience" value={values.experience}
              error={!!errors.experience} errorId={id("experience-error")}
              onChange={(v) => update("experience", v)} onBlur={() => blur("experience")} required
              placeholder="Select your experience"
              options={EXPERIENCE_OPTIONS}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection no="03" title="Online profiles" id={id("s-profiles")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="LinkedIn" htmlFor={id("linkedin")} error={showErr("linkedin")} errorId={id("linkedin-error")}>
            <TextInput
              id={id("linkedin")} name="linkedin" type="url" inputMode="url" autoComplete="url" placeholder="https://linkedin.com/in/..."
              value={values.linkedin} error={!!errors.linkedin} errorId={id("linkedin-error")}
              onChange={(v) => update("linkedin", v)} onBlur={() => blur("linkedin")}
            />
          </Field>
          <Field label="GitHub / Portfolio" htmlFor={id("github")} error={showErr("github")} errorId={id("github-error")}>
            <TextInput
              id={id("github")} name="github" type="url" inputMode="url" placeholder="https://github.com/..."
              value={values.github} error={!!errors.github} errorId={id("github-error")}
              onChange={(v) => update("github", v)} onBlur={() => blur("github")}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection no="04" title="How did you hear about us?" id={id("s-referral")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Source" htmlFor={id("referralSource")} error={showErr("referralSource")} errorId={id("referralSource-error")}>
            <SelectInput
              id={id("referralSource")} name="referralSource" value={values.referralSource}
              error={!!errors.referralSource} errorId={id("referralSource-error")}
              onChange={(v) => update("referralSource", v)} onBlur={() => blur("referralSource")}
              placeholder="Select an option"
              options={REFERRAL_OPTIONS}
            />
          </Field>
          {values.referralSource === "other" && (
            <Field label="Please specify" required htmlFor={id("referralOther")} error={showErr("referralOther")} errorId={id("referralOther-error")}>
              <TextInput
                id={id("referralOther")} name="referralOther" placeholder="Please specify"
                value={values.referralOther} error={!!errors.referralOther} errorId={id("referralOther-error")}
                onChange={(v) => update("referralOther", v)} onBlur={() => blur("referralOther")} required
              />
            </Field>
          )}
        </div>
      </FormSection>

      <FormSection
        no="05"
        title="Upload Your CV"
        id={id("s-cv")}
        description="Upload your latest resume or CV."
      >
        <FileXLUpload />
        <p className="mt-3 text-[13px] text-[var(--color-text-muted)]">
          Accepted formats: PDF, DOC, DOCX
        </p>

        <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/60 p-4 sm:p-5">
          <Field
            label="Your FileXL CV link"
            required
            htmlFor={id("cvFileUrl")}
            error={showErr("cvFileUrl")}
            errorId={id("cvFileUrl-error")}
            hint="When the upload finishes, FileXL shows a download link inside the box above. Copy that link and paste it here so our team can open your CV. Leave “Self-Destruct” switched off so the link keeps working."
            hintId={id("cvFileUrl-hint")}
          >
            <TextInput
              id={id("cvFileUrl")} name="cvFileUrl" type="url" inputMode="url" autoComplete="off"
              placeholder="https://www.filexl.com/..."
              value={values.cvFileUrl} error={!!errors.cvFileUrl} errorId={id("cvFileUrl-error")} hintId={id("cvFileUrl-hint")}
              onChange={(v) => update("cvFileUrl", v)} onBlur={() => blur("cvFileUrl")} required
            />
          </Field>
        </div>
      </FormSection>

      <section
        aria-labelledby={id("s-submit")}
        className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-7"
      >
        <h2 id={id("s-submit")} className="sr-only">Consent and submission</h2>
        <div className="flex items-start gap-3">
          <input
            id={id("consent")}
            name="consent"
            type="checkbox"
            checked={values.consent}
            onChange={(e) => update("consent", e.target.checked)}
            aria-invalid={!!errors.consent || undefined}
            aria-describedby={errors.consent ? id("consent-error") : undefined}
            required
            className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-[var(--color-border)] accent-[var(--color-lime)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-lime)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
          />
          <label htmlFor={id("consent")} className="text-sm leading-relaxed text-[var(--color-text-primary)]/85 cursor-pointer">
            I confirm that the information provided is accurate and I consent to the processing of my
            application and personal information for recruitment purposes. See our{" "}
            <Link href="/privacy" className="underline underline-offset-4 decoration-white/30 hover:decoration-white/70">
              Privacy Policy
            </Link>
            .
          </label>
        </div>
        {errors.consent && (
          <p id={id("consent-error")} className="mt-2 pl-8 text-[13px] text-[var(--color-danger)]">{errors.consent}</p>
        )}

        {formError && (
          <div
            id={id("form-error")}
            role="alert"
            className="mt-6 rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]"
          >
            {formError}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/careers"
            className="text-center text-sm font-medium text-white/60 hover:text-white transition-colors underline underline-offset-4 decoration-white/20 hover:decoration-white/50"
          >
            Back to Careers
          </Link>
          <button
            type="submit"
            disabled={!values.consent || busy}
            aria-disabled={!values.consent || busy}
            className={cn(
              "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-8 py-3 text-sm font-semibold transition-all duration-300",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-lime)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]",
              phase === "submitted"
                ? "bg-[var(--color-success)] text-black"
                : "bg-[var(--color-lime)] text-black hover:scale-[0.98] active:scale-[0.96]",
              "disabled:cursor-not-allowed disabled:hover:scale-100",
              !values.consent && phase === "idle" && "opacity-40"
            )}
          >
            {phase === "submitting" && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
            {phase === "idle" && "Submit Application"}
            {phase === "submitting" && "Submitting..."}
            {phase === "submitted" && "Application Submitted"}
          </button>
        </div>
        <p className="sr-only" aria-live="polite">
          {phase === "submitting" ? "Submitting your application." : phase === "submitted" ? "Application submitted." : ""}
        </p>
      </section>
    </form>
  )
}

// ─── Building blocks ─────────────────────────────────────────────────────────

function FormSection({
  no,
  title,
  id,
  description,
  children,
}: {
  no: string
  title: string
  id: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-7"
    >
      <div className="mb-6 flex items-baseline gap-3">
        <span className="font-serif text-2xl font-bold leading-none text-white/15 tabular-nums" aria-hidden="true">
          {no}
        </span>
        <div>
          <h2 id={id} className="text-lg sm:text-xl font-bold font-serif tracking-tight text-white">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{description}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  )
}

function Field({
  label,
  htmlFor,
  required,
  error,
  errorId,
  hint,
  hintId,
  className,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  error?: string
  errorId: string
  hint?: string
  hintId?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]">
        {label}
        {required ? (
          <span className="ml-1 text-[var(--color-lime)]" aria-hidden="true">*</span>
        ) : (
          <span className="ml-2 text-xs font-normal text-[var(--color-text-muted)]">Optional</span>
        )}
      </label>
      {children}
      {hint && (
        <p id={hintId} className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-2 text-[13px] text-[var(--color-danger)]">
          {error}
        </p>
      )}
    </div>
  )
}

const controlClass = (error: boolean) =>
  cn(
    "block h-12 w-full min-w-0 rounded-xl border bg-[var(--color-background)] px-4 text-[15px] text-[var(--color-text-primary)]",
    "placeholder:text-[var(--color-text-muted)]/70 transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-lime)]/70 focus-visible:border-transparent",
    error ? "border-[var(--color-danger)]/60" : "border-[var(--color-border)] hover:border-white/20"
  )

function describedBy(error: boolean, errorId: string, hintId?: string) {
  const ids = [hintId, error ? errorId : undefined].filter(Boolean)
  return ids.length ? ids.join(" ") : undefined
}

function TextInput({
  id,
  name,
  type = "text",
  value,
  onChange,
  onBlur,
  error,
  errorId,
  hintId,
  placeholder,
  autoComplete,
  inputMode,
  required,
}: {
  id: string
  name: string
  type?: string
  value: string
  onChange: (v: string) => void
  onBlur: () => void
  error: boolean
  errorId: string
  hintId?: string
  placeholder?: string
  autoComplete?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
  required?: boolean
}) {
  return (
    <input
      id={id}
      name={name}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      autoComplete={autoComplete}
      inputMode={inputMode}
      required={required}
      aria-required={required || undefined}
      aria-invalid={error || undefined}
      aria-describedby={describedBy(error, errorId, hintId)}
      className={controlClass(error)}
    />
  )
}

function SelectInput({
  id,
  name,
  value,
  onChange,
  onBlur,
  error,
  errorId,
  options,
  placeholder,
  required,
}: {
  id: string
  name: string
  value: string
  onChange: (v: string) => void
  onBlur: () => void
  error: boolean
  errorId: string
  options: readonly { value: string; label: string }[]
  placeholder: string
  required?: boolean
}) {
  return (
    <div className="relative">
      <select
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error || undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(controlClass(error), "appearance-none pr-10 cursor-pointer", !value && "text-[var(--color-text-muted)]")}
      >
        <option value="" disabled={required}>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="text-black">
            {o.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
