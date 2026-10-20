import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

// Static checks on the Novig prop-lines migration: public read of lines/events,
// service-only writes, a service-only run log, and the store-once primary key
// the ingest inserts on. The behavior itself is proven against a throwaway
// Postgres by scripts/db/test-novig-prop-lines-rls.sh.
const sql = readFileSync(
  path.resolve(__dirname, "../../supabase/migrations/20261020_novig_prop_lines.sql"),
  "utf8",
)
const flat = sql.replace(/\s+/g, " ")
const TABLES = ["novig_prop_events", "novig_prop_lines", "novig_ingest_runs"]

describe("20261020_novig_prop_lines.sql", () => {
  it("is wrapped in a transaction and documents the undo", () => {
    expect(sql).toMatch(/^BEGIN;/m)
    expect(sql).toMatch(/^COMMIT;/m)
    expect(sql).toContain(
      "DROP TABLE public.novig_prop_lines, public.novig_prop_events, public.novig_ingest_runs;",
    )
  })

  it("enables RLS on all three tables", () => {
    for (const table of TABLES) {
      expect(flat).toMatch(new RegExp(`ALTER TABLE public\\.${table} +ENABLE ROW LEVEL SECURITY;`))
    }
  })

  it("creates public-select policies for events and lines only (re-runnable)", () => {
    for (const table of ["novig_prop_events", "novig_prop_lines"]) {
      const policy = `${table}_select_public`
      expect(flat).toContain(`DROP POLICY IF EXISTS "${policy}" ON public.${table};`)
      expect(flat).toContain(`CREATE POLICY "${policy}" ON public.${table} FOR SELECT USING (true);`)
    }
    expect(flat).not.toMatch(/CREATE POLICY [^;]* ON public\.novig_ingest_runs/)
  })

  it("grants SELECT and revokes writes for anon/authenticated; run log is service-only", () => {
    expect(flat).toContain("GRANT SELECT ON public.novig_prop_events, public.novig_prop_lines TO anon, authenticated;")
    expect(flat).toContain(
      "REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.novig_prop_events, public.novig_prop_lines FROM anon, authenticated;",
    )
    expect(flat).toContain("REVOKE ALL ON public.novig_ingest_runs FROM anon, authenticated;")
    expect(flat).not.toMatch(/GRANT (ALL|INSERT|UPDATE|DELETE|TRUNCATE)[^;]*novig_/i)
    expect(flat).not.toMatch(/GRANT [^;]*novig_ingest_runs/i)
  })

  it("keys lines on (event, player, market) and constrains stat/line/match_method", () => {
    expect(flat).toContain("PRIMARY KEY (canonical_event_id, player_key, market_key)")
    expect(flat).toContain("CHECK (stat IN ('pts','trb','ast','tp','stl','blk','tov'))")
    expect(flat).toContain("CHECK (line > 0)")
    expect(flat).toContain("CHECK (match_method IN ('exact','alias','fuzzy','unmatched'))")
  })

  it("is safe to re-run", () => {
    for (const table of TABLES) {
      expect(flat).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`)
    }
    for (const index of [
      "idx_novig_prop_events_date",
      "idx_novig_prop_lines_date",
      "idx_novig_ingest_runs_slate",
      "idx_novig_ingest_runs_run_at",
    ]) {
      expect(flat).toContain(`CREATE INDEX IF NOT EXISTS ${index}`)
    }
  })
})
