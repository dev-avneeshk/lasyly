/**
 * Runtime environment validation.
 * Validates that all required environment variables are present and correctly formatted.
 * Import this module early (e.g., in layout.tsx or instrumentation.ts) to fail fast on misconfiguration.
 */

import { z } from "zod"

const envSchema = z.object({
  // Required: Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),

  // Required: Site URL
  NEXT_PUBLIC_SITE_URL: z.string().url("NEXT_PUBLIC_SITE_URL must be a valid URL").optional(),

  // Required in production: Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Required in production: Service role
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // Optional
  CRON_SECRET: z.string().optional(),
  // Required if /api/auth/guest is used (otherwise guest sessions are denied).
  // Must be at least 32 characters of high-entropy randomness.
  GUEST_TOKEN_SECRET: z.string().min(32).optional(),
  OPENAI_API_KEY: z.string().optional(),
  YOUTUBE_API_KEY: z.string().optional(),
  SPORTS_API_KEY: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  ✗ ${issue.path.join(".")}: ${issue.message}`)
      .join("\n")

    console.error(
      `\n❌ Environment validation failed:\n${formatted}\n\nCheck your .env.local file against .env.example.\n`
    )

    // In production, throw to prevent startup with bad config
    if (process.env.NODE_ENV === "production") {
      throw new Error("Environment validation failed. See logs above.")
    }
  }

  return result.success ? result.data : (process.env as unknown as Env)
}

export const env = validateEnv()
