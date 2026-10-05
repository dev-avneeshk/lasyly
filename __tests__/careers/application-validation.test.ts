import { describe, it, expect } from "vitest"
import {
  applicationFieldsSchema,
  applicationRequestSchema,
  fieldErrors,
  fitAnswerLength,
  FIT_ANSWER_MAX,
  FIT_ANSWER_MIN,
  MESSAGES,
  PORTFOLIO_URL_MAX,
} from "@/lib/careers/validation"

// The same schema runs in the form (instant feedback) and in
// POST /api/careers/applications (authoritative). These tests pin the server
// rules for the portfolio link and "why are you a fit" answer that replaced
// the CV upload.

const FIT = "I have shipped two realtime sports dashboards and enjoy owning features end to end."

const valid = {
  fullName: "Test Applicant",
  email: "Applicant@Example.com",
  phone: "+91 98765 43210",
  location: "Bengaluru, India",
  currentJobTitle: "",
  currentCompany: "",
  experience: "2-4",
  linkedin: "",
  portfolioUrl: "  https://github.com/test-applicant  ",
  fitAnswer: FIT,
  referralSource: "",
  referralOther: "",
  consent: true,
}

function errorsFor(fields: Record<string, unknown>) {
  const r = applicationFieldsSchema.safeParse(fields)
  return r.success ? {} : fieldErrors(r.error)
}

describe("careers application: portfolio link", () => {
  it("accepts a valid payload and trims the link", () => {
    const r = applicationFieldsSchema.safeParse(valid)
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.portfolioUrl).toBe("https://github.com/test-applicant")
    expect(r.data.fitAnswer).toBe(FIT)
    expect(r.data.email).toBe("applicant@example.com")
  })

  it("accepts http as well as https", () => {
    expect(errorsFor({ ...valid, portfolioUrl: "http://my-portfolio.dev/work" })).toEqual({})
  })

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(document.cookie)",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "ftp://example.com/cv",
    "github.com/no-scheme",
    "https://localhost",
  ])("rejects %s", (portfolioUrl) => {
    expect(errorsFor({ ...valid, portfolioUrl }).portfolioUrl).toBe(MESSAGES.portfolioInvalid)
  })

  it("is required", () => {
    expect(errorsFor({ ...valid, portfolioUrl: "   " }).portfolioUrl).toBe(MESSAGES.portfolio)
    const { portfolioUrl: _omit, ...rest } = valid
    void _omit
    expect(errorsFor(rest).portfolioUrl).toBe(MESSAGES.portfolio)
  })

  it("rejects links over the max length", () => {
    const long = `https://example.com/${"a".repeat(PORTFOLIO_URL_MAX)}`
    expect(errorsFor({ ...valid, portfolioUrl: long }).portfolioUrl).toBe(MESSAGES.portfolioTooLong)
  })
})

describe("careers application: why are you a fit", () => {
  it("rejects an answer shorter than the minimum after trimming", () => {
    const short = `   ${"x".repeat(FIT_ANSWER_MIN - 1)}   `
    expect(errorsFor({ ...valid, fitAnswer: short }).fitAnswer).toBe(MESSAGES.fitTooShort)
  })

  it("accepts an answer of exactly the minimum length", () => {
    expect(errorsFor({ ...valid, fitAnswer: "x".repeat(FIT_ANSWER_MIN) })).toEqual({})
  })

  it("is required", () => {
    expect(errorsFor({ ...valid, fitAnswer: "  \n " }).fitAnswer).toBe(MESSAGES.fit)
  })

  it("rejects an answer over the maximum length", () => {
    expect(errorsFor({ ...valid, fitAnswer: "x".repeat(FIT_ANSWER_MAX + 1) }).fitAnswer).toBe(MESSAGES.fitTooLong)
  })

  it("keeps paragraphs but strips control characters and excess blank lines", () => {
    const r = applicationFieldsSchema.safeParse({
      ...valid,
      fitAnswer: `${FIT}\u0007\r\n\r\n\r\n\r\nSecond paragraph.   \n`,
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.fitAnswer).toBe(`${FIT}\n\nSecond paragraph.`)
  })
})

describe("careers application: fit-answer counter agrees with the server", () => {
  // The form's CharCounter shows fitAnswerLength(value). For every input, the
  // counter being within [MIN, MAX] must match the schema accepting the answer.
  const counterOk = (v: string) => {
    const n = fitAnswerLength(v)
    return n >= FIT_ANSWER_MIN && n <= FIT_ANSWER_MAX
  }
  const serverOk = (v: string) => !errorsFor({ ...valid, fitAnswer: v }).fitAnswer

  it.each([
    ["49 chars", "x".repeat(FIT_ANSWER_MIN - 1), FIT_ANSWER_MIN - 1, false],
    ["50 chars", "x".repeat(FIT_ANSWER_MIN), FIT_ANSWER_MIN, true],
    ["49 chars + surrounding whitespace", ` \n\t ${"x".repeat(FIT_ANSWER_MIN - 1)} \n `, FIT_ANSWER_MIN - 1, false],
    ["50 chars + surrounding whitespace", ` \n\t ${"x".repeat(FIT_ANSWER_MIN)} \n `, FIT_ANSWER_MIN, true],
    // Padding that .trim() alone would count: trailing spaces before a newline,
    // extra blank lines and control characters are all removed by the server.
    ["49 chars padded with blank lines", `${"x".repeat(24)}   \n\n\n\n\n${"x".repeat(23)}\u0007`, FIT_ANSWER_MIN - 1, false],
    ["CRLF counted as one newline", `${"x".repeat(24)}\r\n\r\n${"x".repeat(24)}`, FIT_ANSWER_MIN, true],
    ["3000 chars", "x".repeat(FIT_ANSWER_MAX), FIT_ANSWER_MAX, true],
    ["3001 chars", "x".repeat(FIT_ANSWER_MAX + 1), FIT_ANSWER_MAX + 1, false],
    ["3000 chars + surrounding whitespace", `  ${"x".repeat(FIT_ANSWER_MAX)}\n\n  `, FIT_ANSWER_MAX, true],
  ])("%s", (_label, value, expectedLength, expectedOk) => {
    expect(fitAnswerLength(value)).toBe(expectedLength)
    expect(counterOk(value)).toBe(expectedOk)
    expect(serverOk(value)).toBe(expectedOk)
  })
})

describe("careers application: CV upload removed", () => {
  it("does not require or keep a CV link", () => {
    const r = applicationFieldsSchema.safeParse({ ...valid, cvFileUrl: "https://example.com/cv.pdf" })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).not.toHaveProperty("cvFileUrl")
  })
})

describe("careers application: request envelope", () => {
  it("accepts a valid request and surfaces field errors under fields.*", () => {
    const base = {
      jobId: null,
      submissionKey: "6f1c1f43-6a4e-4a8a-9a0c-7c2f5b0d8f11",
      website: "",
      startedAt: Date.now() - 60_000,
    }
    expect(applicationRequestSchema.safeParse({ ...base, fields: valid }).success).toBe(true)

    const bad = applicationRequestSchema.safeParse({
      ...base,
      fields: { ...valid, portfolioUrl: "javascript:alert(1)", fitAnswer: "too short" },
    })
    expect(bad.success).toBe(false)
    if (bad.success) return
    const paths = bad.error.issues.map((i) => i.path.join("."))
    expect(paths).toContain("fields.portfolioUrl")
    expect(paths).toContain("fields.fitAnswer")
  })
})
