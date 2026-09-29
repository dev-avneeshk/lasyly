/**
 * Careers validation schemas, shared by the client form (instant feedback) and
 * the API routes (the authoritative check — the client is never trusted).
 */
import { z } from "zod"
import {
  APPLICATION_STATUSES,
  EXPERIENCE_OPTIONS,
  REFERRAL_OPTIONS,
} from "./constants"

// ─── Primitives ──────────────────────────────────────────────────────────────

// Strip ASCII control characters (keeps \n for multi-line fields) and trim.
const CONTROL_CHARS = /[\u0000-\u0009\u000B-\u001F\u007F]/g
const ANGLE_BRACKETS = /[<>]/

export function cleanText(value: unknown): unknown {
  if (typeof value !== "string") return value
  return value.replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim()
}

/** Empty strings become undefined so optional fields can be left blank. */
function blankToUndefined(value: unknown): unknown {
  const cleaned = cleanText(value)
  return cleaned === "" ? undefined : cleaned
}

function text(min: number, max: number, requiredMsg: string) {
  return z.preprocess(
    cleanText,
    z
      .string({ error: requiredMsg })
      .min(min, requiredMsg)
      .max(max, `Please keep this under ${max} characters.`)
      .refine((v) => !ANGLE_BRACKETS.test(v), "Please remove the < and > characters.")
  )
}

function optionalText(max: number) {
  return z.preprocess(
    blankToUndefined,
    z
      .string()
      .max(max, `Please keep this under ${max} characters.`)
      .refine((v) => !ANGLE_BRACKETS.test(v), "Please remove the < and > characters.")
      .optional()
  )
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".")
  } catch {
    return false
  }
}

function optionalUrl(message: string) {
  return z.preprocess(
    blankToUndefined,
    z.string().max(300, message).refine(isHttpUrl, message).optional()
  )
}

/**
 * The FileXL link the widget shows after an upload. Only https links on
 * filexl.com (or a subdomain) are accepted, so this field cannot be used to
 * store arbitrary URLs that an admin would later click.
 */
export function isFileXLUrl(value: string): boolean {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    return (
      url.protocol === "https:" &&
      (host === "filexl.com" || host.endsWith(".filexl.com")) &&
      url.pathname.length > 1
    )
  } catch {
    return false
  }
}

/** International phone: optional leading +, 7–15 digits, common separators. */
export function isValidPhone(value: string): boolean {
  if (!/^\+?[0-9\s().-]+$/.test(value)) return false
  const digits = value.replace(/\D/g, "")
  return digits.length >= 7 && digits.length <= 15
}

const experienceValues = EXPERIENCE_OPTIONS.map((o) => o.value) as [string, ...string[]]
const referralValues = REFERRAL_OPTIONS.map((o) => o.value) as [string, ...string[]]
const statusValues = APPLICATION_STATUSES.map((o) => o.value) as [string, ...string[]]

// ─── Application ─────────────────────────────────────────────────────────────

export const MESSAGES = {
  name: "Please enter your full name.",
  email: "Please enter a valid email address.",
  phone: "Please enter your phone number.",
  phoneInvalid: "Please enter a valid phone number, including the country code.",
  location: "Please enter your current location.",
  experience: "Please select your experience.",
  linkedin: "Please enter a valid LinkedIn URL, e.g. https://linkedin.com/in/your-name.",
  github: "Please enter a valid URL, e.g. https://github.com/your-name.",
  referralOther: "Please tell us where you heard about us.",
  cv: "Please upload your CV before submitting your application.",
  cvLink: "Paste the FileXL link shown after your upload finishes (it starts with https://www.filexl.com/).",
  consent: "Please confirm the information is accurate and consent to processing.",
} as const

/** Fields the applicant fills in. Used by the client form and the API. */
export const applicationFieldsSchema = z
  .object({
    fullName: text(2, 120, MESSAGES.name),
    email: z.preprocess(
      (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
      z.string({ error: MESSAGES.email }).max(254, MESSAGES.email).pipe(z.email(MESSAGES.email))
    ),
    phone: z.preprocess(
      cleanText,
      z
        .string({ error: MESSAGES.phone })
        .min(1, MESSAGES.phone)
        .max(32, MESSAGES.phoneInvalid)
        .refine(isValidPhone, MESSAGES.phoneInvalid)
    ),
    location: text(2, 120, MESSAGES.location),
    currentJobTitle: optionalText(120),
    currentCompany: optionalText(120),
    experience: z.enum(experienceValues, { error: MESSAGES.experience }),
    linkedin: optionalUrl(MESSAGES.linkedin),
    github: optionalUrl(MESSAGES.github),
    referralSource: z.preprocess(
      blankToUndefined,
      z.enum(referralValues).optional()
    ),
    referralOther: optionalText(120),
    cvFileUrl: z.preprocess(
      blankToUndefined,
      z
        .string({ error: MESSAGES.cv })
        .max(500, MESSAGES.cvLink)
        .refine(isFileXLUrl, MESSAGES.cvLink)
    ),
    consent: z.literal(true, { error: MESSAGES.consent }),
  })
  .superRefine((data, ctx) => {
    if (data.referralSource === "other" && !data.referralOther) {
      ctx.addIssue({ code: "custom", path: ["referralOther"], message: MESSAGES.referralOther })
    }
  })

export type ApplicationFields = z.infer<typeof applicationFieldsSchema>

/** Full request body accepted by POST /api/careers/applications. */
export const applicationRequestSchema = z.object({
  fields: applicationFieldsSchema,
  // null for the general/talent-pool application.
  jobId: z.uuid().nullable(),
  submissionKey: z.uuid(),
  // Anti-spam: honeypot must stay empty; startedAt is when the form rendered.
  website: z.string().max(200).optional(),
  startedAt: z.number().int().positive(),
})

export type ApplicationRequest = z.infer<typeof applicationRequestSchema>

/** Map zod issues to { fieldName: firstMessage } for the form. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form")
    if (!out[key]) out[key] = issue.message
  }
  return out
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export const statusUpdateSchema = z.object({
  status: z.enum(statusValues),
})

const listOfShortText = (maxItems: number, maxLen: number) =>
  z
    .array(z.preprocess(cleanText, z.string().min(1).max(maxLen)))
    .max(maxItems)

export const jobSchema = z.object({
  title: text(2, 120, "Please enter a job title."),
  department: text(2, 80, "Please enter a department."),
  location: text(2, 120, "Please enter a location."),
  employmentType: text(2, 40, "Please enter the employment type."),
  experienceLevel: text(1, 40, "Please enter the experience level."),
  description: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(CONTROL_CHARS, "").trim() : v),
    z.string().min(10, "Please write a short description (10+ characters).").max(4000)
  ),
  requirements: listOfShortText(30, 300),
  skills: listOfShortText(20, 40),
  isActive: z.boolean(),
})

export type JobInput = z.infer<typeof jobSchema>
