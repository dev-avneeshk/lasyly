#!/usr/bin/env node
/**
 * Create the `player-headshots` Storage bucket.
 *
 * Idempotent: re-running reports the existing bucket rather than failing, so it
 * is safe to run against an environment that is already set up.
 *
 * The bucket is PUBLIC-READ on purpose — these are press headshots rendered in
 * every prop card, and public objects are served straight from Supabase's CDN
 * with no signed-URL round trip. Writes are a different matter: they require the
 * service role, because no RLS policy on storage.objects grants insert/update to
 * anon or authenticated. `verify-headshot-bucket.mjs` asserts that.
 *
 * Usage: node scripts/db/create-headshot-bucket.mjs
 * Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
 */
import { readFileSync } from "node:fs"

export const BUCKET = "player-headshots"

/** Only the formats we actually write. Anything else is a bug or an attack. */
const ALLOWED_MIME = ["image/webp"]

/** 320x320 webp lands around 13KB; 256KB is a generous ceiling. */
const FILE_SIZE_LIMIT = 256 * 1024

export function loadEnv(file = ".env.local") {
  let raw
  try {
    raw = readFileSync(file, "utf8")
  } catch {
    console.error(`Could not read ${file}`)
    process.exit(1)
  }
  return Object.fromEntries(
    raw
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=")
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]
      })
  )
}

async function main() {
  const env = loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    process.exit(1)
  }
  const H = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }

  const existing = await fetch(`${url}/storage/v1/bucket/${BUCKET}`, { headers: H })
  if (existing.ok) {
    const b = await existing.json()
    console.log(`✓ bucket "${BUCKET}" already exists (public=${b.public}, limit=${b.file_size_limit})`)
    return
  }

  const res = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({
      id: BUCKET,
      name: BUCKET,
      public: true,
      file_size_limit: FILE_SIZE_LIMIT,
      allowed_mime_types: ALLOWED_MIME,
    }),
  })

  const body = await res.text()
  if (!res.ok) {
    console.error(`✗ create failed (${res.status}): ${body}`)
    process.exit(1)
  }
  console.log(`✓ created bucket "${BUCKET}" — public read, ${FILE_SIZE_LIMIT / 1024}KB limit, ${ALLOWED_MIME.join("/")} only`)
}

// Only act when run directly. Other scripts import `loadEnv`/`BUCKET` from here,
// and importing a module must not have the side effect of creating a bucket.
const isEntry = process.argv[1] && import.meta.url === `file://${process.argv[1]}`
if (isEntry) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
