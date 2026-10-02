import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"

// DB-05: an applied migration (20260915_retention.sql) was emptied in place, so
// a fresh database never got the functions the retention cron calls.
const dir = path.resolve(__dirname, "../../supabase/migrations")
const all = readdirSync(dir).filter((f) => f.endsWith(".sql"))
const sql = all.map((f) => readFileSync(path.join(dir, f), "utf8")).join("\n")

describe("supabase/migrations", () => {
  it("has no empty migration files", () => {
    expect(all.filter((f) => readFileSync(path.join(dir, f), "utf8").trim() === "")).toEqual([])
  })

  it("defines every RPC the retention cron calls", () => {
    for (const fn of ["cleanup_expired_data", "cleanup_old_chat_data"]) {
      expect(sql).toContain(`FUNCTION public.${fn}(`)
    }
  })
})
