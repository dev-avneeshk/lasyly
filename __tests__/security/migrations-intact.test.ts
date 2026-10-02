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

  it("columns added to column-granted tables (profiles, betslips, room_subchannels) after the column-grant lockdown are granted explicitly", () => {
    // 20261002_lock_down_profile_betslip_member_writes.sql replaced the table
    // SELECT grant with a column list captured at migration time. A column
    // added later is unreadable to anon/authenticated (42501 on any select
    // naming it) unless its migration also runs `GRANT SELECT (col) ON ...`.
    const later = all.filter((f) => f > "20261002_lock_down_profile_betslip_member_writes.sql")
    for (const f of later) {
      const text = readFileSync(path.join(dir, f), "utf8")
      for (const table of ["profiles", "betslips", "room_subchannels"]) {
        const added = [...text.matchAll(new RegExp(`ALTER TABLE (?:public\\.)?${table}\\s+ADD COLUMN(?: IF NOT EXISTS)?\\s+(\\w+)`, "gi"))]
        for (const [, col] of added) {
          expect(text, `${f}: grant SELECT on ${table}.${col} (or state why not)`).toMatch(
            new RegExp(`GRANT SELECT \\([^)]*\\b${col}\\b[^)]*\\) ON (?:public\\.)?${table}|-- no select grant: ${col}`, "i")
          )
        }
      }
    }
  })

  it("defines every RPC the retention cron calls", () => {
    for (const fn of ["cleanup_expired_data", "cleanup_old_chat_data"]) {
      expect(sql).toContain(`FUNCTION public.${fn}(`)
    }
  })
})
