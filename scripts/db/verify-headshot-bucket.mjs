#!/usr/bin/env node
/**
 * Assert the headshot bucket is readable by the public and writable only by the
 * service role.
 *
 * A public bucket is a deliberate choice (see create-headshot-bucket.mjs), and
 * the thing that makes it safe is that no RLS policy on storage.objects grants
 * insert/update/delete to anon. That is easy to break later by adding a
 * permissive policy, so this asserts it rather than assuming it. Run after any
 * change to storage policies.
 *
 * Exits non-zero if anon can write, or if public read is broken.
 */
import { loadEnv, BUCKET } from "./create-headshot-bucket.mjs"

const env = loadEnv()
const url = env.NEXT_PUBLIC_SUPABASE_URL
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const service = env.SUPABASE_SERVICE_ROLE_KEY

let failures = 0
const check = (ok, label, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`)
  if (!ok) failures++
}

const PROBE = `_probe/anon-write-test.webp`
// A 1x1 webp. Content does not matter; we only care whether the write is refused.
const tinyWebp = Buffer.from(
  "UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==",
  "base64"
)

console.log("Storage hardening — player-headshots\n")

// 1. anon must NOT be able to upload.
{
  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${PROBE}`, {
    method: "POST",
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      "Content-Type": "image/webp",
    },
    body: tinyWebp,
  })
  check(!res.ok, "anon upload is refused", `http ${res.status}`)
  if (res.ok) {
    // Clean up the object we should never have been able to create.
    await fetch(`${url}/storage/v1/object/${BUCKET}/${PROBE}`, {
      method: "DELETE",
      headers: { apikey: service, Authorization: `Bearer ${service}` },
    })
  }
}

// 2. anon must NOT be able to delete an existing object.
{
  const list = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: "", limit: 1 }),
  })
  const objs = await list.json()
  const victim = Array.isArray(objs) && objs[0]?.name
  if (!victim) {
    console.log("  SKIP  anon delete is refused — bucket empty, run the backfill first")
  } else {
    const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${victim}`, {
      method: "DELETE",
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
    })
    check(!res.ok, "anon delete is refused", `http ${res.status}`)
  }
}

// 3. public read must work WITHOUT any key (this is the whole point of the bucket).
//    Objects live under a league prefix, so list inside one — a root listing
//    returns folder entries, which have no .webp name and made this silently skip.
{
  let sample = null
  for (const prefix of ["nfl/", "nhl/"]) {
    const list = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
      method: "POST",
      headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, limit: 1 }),
    })
    const objs = await list.json()
    const found = Array.isArray(objs) ? objs.find((o) => o.name?.endsWith(".webp")) : null
    if (found) {
      sample = `${prefix}${found.name}`
      break
    }
  }
  if (!sample) {
    console.log("  SKIP  public read — no .webp objects yet, run the backfill first")
  } else {
    const pub = `${url}/storage/v1/object/public/${BUCKET}/${sample}`
    const res = await fetch(pub) // deliberately no apikey header
    check(
      res.ok && res.headers.get("content-type") === "image/webp",
      "public read works with no credentials",
      `http ${res.status} ${res.headers.get("content-type")} ${sample}`
    )
    // Long-lived immutable caching is what keeps these off our origin. Note this
    // header is only present on GET; a HEAD returns no-cache and looks broken.
    check(
      (res.headers.get("cache-control") ?? "").includes("max-age=31536000"),
      "served with a long immutable cache-control",
      res.headers.get("cache-control") ?? "none"
    )
  }
}

// 4. bucket config still what we intended.
{
  const res = await fetch(`${url}/storage/v1/bucket/${BUCKET}`, {
    headers: { apikey: service, Authorization: `Bearer ${service}` },
  })
  const b = await res.json()
  check(b.public === true, "bucket is public-read", `public=${b.public}`)
  check(
    Array.isArray(b.allowed_mime_types) && b.allowed_mime_types.join() === "image/webp",
    "only image/webp is accepted",
    JSON.stringify(b.allowed_mime_types)
  )
}

console.log("")
if (failures > 0) {
  console.error(`${failures} check(s) FAILED`)
  process.exit(1)
}
console.log("All storage hardening checks passed.")
