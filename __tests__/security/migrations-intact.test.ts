import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"

// DB-05: an applied migration (20260915_retention.sql) was emptied in place, so
// a fresh database never got the functions the retention cron calls.
const dir = path.resolve(__dirname, "../../supabase/migrations")
const all = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
const sql = all.map((f) => readFileSync(path.join(dir, f), "utf8")).join("\n")

describe("supabase/migrations", () => {
  it("has no empty migration files", () => {
    expect(all.filter((f) => readFileSync(path.join(dir, f), "utf8").trim() === "")).toEqual([])
  })

  it("the latest cleanup_expired_data revoke names anon and authenticated, not just PUBLIC", () => {
    // Supabase grants EXECUTE to anon/authenticated directly (default
    // privileges), so `REVOKE ... FROM PUBLIC` alone left this bulk-delete
    // SECURITY DEFINER function callable with the public key.
    // (cleanup_old_chat_data is covered by 20260927's lockdown list.)
    const last = sql.match(/REVOKE ALL ON FUNCTION public\.cleanup_expired_data\b.*/g)?.at(-1)
    expect(last).toMatch(/FROM PUBLIC, anon, authenticated;/)
  })

  it("defines every RPC the retention cron calls", () => {
    for (const fn of ["cleanup_expired_data", "cleanup_old_chat_data"]) {
      expect(sql).toContain(`FUNCTION public.${fn}(`)
    }
  })
})
