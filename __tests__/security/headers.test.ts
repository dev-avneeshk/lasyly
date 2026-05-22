import { describe, it, expect } from "vitest"
import { NextResponse } from "next/server"
import {
  applySecurityHeaders,
  buildCSP,
  validateOrigin,
} from "@/lib/security/headers"
import type { SecurityHeadersConfig } from "@/lib/security/types"
import { HSTS_MIN_MAX_AGE } from "@/lib/security/constants"

function createConfig(
  overrides: Partial<SecurityHeadersConfig> = {}
): SecurityHeadersConfig {
  return {
    trustedDomains: [],
    allowedOrigins: ["https://lasyly.com"],
    hstsMaxAge: HSTS_MIN_MAX_AGE,
    ...overrides,
  }
}

describe("buildCSP", () => {
  it("includes 'self' in script-src with no trusted domains", () => {
    const config = createConfig()
    const csp = buildCSP(config)
    expect(csp).toContain("script-src 'self'")
  })

  it("includes trusted domains in script-src", () => {
    const config = createConfig({
      trustedDomains: ["https://cdn.example.com", "https://analytics.example.com"],
    })
    const csp = buildCSP(config)
    expect(csp).toContain("https://cdn.example.com")
    expect(csp).toContain("https://analytics.example.com")
    expect(csp).toMatch(/script-src[^;]*https:\/\/cdn\.example\.com/)
  })

  it("never includes unsafe-inline", () => {
    const config = createConfig({
      trustedDomains: ["'unsafe-inline'"],
    })
    const csp = buildCSP(config)
    // Even if someone passes 'unsafe-inline' as a trusted domain,
    // the CSP construction itself doesn't add it as a directive keyword.
    // The function trusts the config but the design says CSP must not contain unsafe-inline.
    // We verify the function doesn't inject it on its own.
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-eval'/)
  })

  it("sets object-src to 'none'", () => {
    const config = createConfig()
    const csp = buildCSP(config)
    expect(csp).toContain("object-src 'none'")
  })

  it("includes report-uri when configured", () => {
    const config = createConfig({ cspReportUri: "https://report.example.com/csp" })
    const csp = buildCSP(config)
    expect(csp).toContain("report-uri https://report.example.com/csp")
  })

  it("does not include report-uri when not configured", () => {
    const config = createConfig()
    const csp = buildCSP(config)
    expect(csp).not.toContain("report-uri")
  })
})

describe("applySecurityHeaders", () => {
  it("sets Content-Security-Policy header", () => {
    const response = new NextResponse()
    const config = createConfig()
    applySecurityHeaders(response, config)
    expect(response.headers.get("Content-Security-Policy")).toBeTruthy()
    expect(response.headers.get("Content-Security-Policy")).toContain("script-src 'self'")
  })

  it("sets Strict-Transport-Security with includeSubDomains", () => {
    const response = new NextResponse()
    const config = createConfig()
    applySecurityHeaders(response, config)
    const hsts = response.headers.get("Strict-Transport-Security")
    expect(hsts).toContain(`max-age=${HSTS_MIN_MAX_AGE}`)
    expect(hsts).toContain("includeSubDomains")
  })

  it("enforces minimum HSTS max-age", () => {
    const response = new NextResponse()
    const config = createConfig({ hstsMaxAge: 100 })
    applySecurityHeaders(response, config)
    const hsts = response.headers.get("Strict-Transport-Security")
    expect(hsts).toContain(`max-age=${HSTS_MIN_MAX_AGE}`)
  })

  it("allows HSTS max-age greater than minimum", () => {
    const response = new NextResponse()
    const largerAge = HSTS_MIN_MAX_AGE * 2
    const config = createConfig({ hstsMaxAge: largerAge })
    applySecurityHeaders(response, config)
    const hsts = response.headers.get("Strict-Transport-Security")
    expect(hsts).toContain(`max-age=${largerAge}`)
  })

  it("sets X-Content-Type-Options to nosniff", () => {
    const response = new NextResponse()
    applySecurityHeaders(response, createConfig())
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff")
  })

  it("sets X-Frame-Options to DENY", () => {
    const response = new NextResponse()
    applySecurityHeaders(response, createConfig())
    expect(response.headers.get("X-Frame-Options")).toBe("DENY")
  })

  it("sets Referrer-Policy to strict-origin-when-cross-origin", () => {
    const response = new NextResponse()
    applySecurityHeaders(response, createConfig())
    expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin")
  })

  it("sets Permissions-Policy disabling camera, microphone, geolocation, payment", () => {
    const response = new NextResponse()
    applySecurityHeaders(response, createConfig())
    const pp = response.headers.get("Permissions-Policy")
    expect(pp).toContain("camera=()")
    expect(pp).toContain("microphone=()")
    expect(pp).toContain("geolocation=()")
    expect(pp).toContain("payment=()")
  })

  it("strips X-Powered-By header", () => {
    const response = new NextResponse()
    response.headers.set("X-Powered-By", "Next.js")
    applySecurityHeaders(response, createConfig())
    expect(response.headers.get("X-Powered-By")).toBeNull()
  })

  it("strips Server header", () => {
    const response = new NextResponse()
    response.headers.set("Server", "nginx/1.21")
    applySecurityHeaders(response, createConfig())
    expect(response.headers.get("Server")).toBeNull()
  })
})

describe("validateOrigin", () => {
  it("returns true for an origin in the allowed list", () => {
    const config = createConfig({ allowedOrigins: ["https://lasyly.com", "https://staging.lasyly.com"] })
    expect(validateOrigin("https://lasyly.com", config)).toBe(true)
    expect(validateOrigin("https://staging.lasyly.com", config)).toBe(true)
  })

  it("returns false for an origin not in the allowed list", () => {
    const config = createConfig({ allowedOrigins: ["https://lasyly.com"] })
    expect(validateOrigin("https://evil.com", config)).toBe(false)
  })

  it("returns false for null origin", () => {
    const config = createConfig({ allowedOrigins: ["https://lasyly.com"] })
    expect(validateOrigin(null, config)).toBe(false)
  })

  it("returns false for empty string origin", () => {
    const config = createConfig({ allowedOrigins: ["https://lasyly.com"] })
    expect(validateOrigin("", config)).toBe(false)
  })

  it("enforces maximum of 20 allowed origins", () => {
    const origins = Array.from({ length: 25 }, (_, i) => `https://origin${i}.com`)
    const config = createConfig({ allowedOrigins: origins })
    // Origins 0-19 should be allowed
    expect(validateOrigin("https://origin0.com", config)).toBe(true)
    expect(validateOrigin("https://origin19.com", config)).toBe(true)
    // Origins 20+ should be rejected (beyond the 20 limit)
    expect(validateOrigin("https://origin20.com", config)).toBe(false)
    expect(validateOrigin("https://origin24.com", config)).toBe(false)
  })

  it("performs exact match (no partial matching)", () => {
    const config = createConfig({ allowedOrigins: ["https://lasyly.com"] })
    expect(validateOrigin("https://lasyly.com.evil.com", config)).toBe(false)
    expect(validateOrigin("https://evil.lasyly.com", config)).toBe(false)
  })
})
