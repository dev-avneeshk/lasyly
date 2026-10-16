import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

// Static checks on the Big-5 match-stats migration: public read, service-only
// writes, and the natural key the importer upserts on. The behavior itself is
// proven against a throwaway Postgres by scripts/db/test-soccer-match-stats-rls.sh.
const sql = readFileSync(
  path.resolve(__dirname, "../../supabase/migrations/20261016_soccer_match_stats.sql"),
  "utf8",
)
const flat = sql.replace(/\s+/g, " ")

describe("20261016_soccer_match_stats.sql", () => {
  it("is wrapped in a transaction", () => {
    expect(sql).toMatch(/^BEGIN;/m)
    expect(sql).toMatch(/^COMMIT;/m)
  })

  it("enables RLS on both tables", () => {
    expect(flat).toMatch(/ALTER TABLE public\.soccer_matches ENABLE ROW LEVEL SECURITY;/)
    expect(flat).toMatch(/ALTER TABLE public\.soccer_match_stats ENABLE ROW LEVEL SECURITY;/)
  })

  it("creates both public-select policies (re-runnable)", () => {
    for (const [policy, table] of [
      ["soccer_matches_select_public", "soccer_matches"],
      ["soccer_match_stats_select_public", "soccer_match_stats"],
    ]) {
      expect(flat).toContain(`DROP POLICY IF EXISTS "${policy}" ON public.${table};`)
      expect(flat).toContain(`CREATE POLICY "${policy}" ON public.${table} FOR SELECT USING (true);`)
    }
  })

  it("grants SELECT and revokes writes for anon/authenticated", () => {
    expect(flat).toContain("GRANT SELECT ON public.soccer_matches, public.soccer_match_stats TO anon, authenticated;")
    expect(flat).toContain(
      "REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.soccer_matches, public.soccer_match_stats FROM anon, authenticated;",
    )
    expect(flat).not.toMatch(/GRANT (ALL|INSERT|UPDATE|DELETE)[^;]*soccer_match/i)
  })

  it("declares the natural keys and the cascading FK", () => {
    expect(flat).toContain(
      "CONSTRAINT soccer_match_stats_natural_key UNIQUE (league, season, match_no, period, stat_group, stat_name)",
    )
    expect(flat).toContain("CONSTRAINT soccer_matches_league_season_match_no_key UNIQUE (league, season, match_no)")
    expect(flat).toMatch(
      /CONSTRAINT soccer_match_stats_match_fk FOREIGN KEY \(league, season, match_no\) REFERENCES public\.soccer_matches \(league, season, match_no\) ON DELETE CASCADE/,
    )
  })

  it("is safe to re-run", () => {
    expect(flat).toContain("CREATE TABLE IF NOT EXISTS public.soccer_matches")
    expect(flat).toContain("CREATE TABLE IF NOT EXISTS public.soccer_match_stats")
    expect(flat).toContain("CREATE INDEX IF NOT EXISTS idx_soccer_match_stats_prop_scan")
    expect(flat).toContain("CREATE INDEX IF NOT EXISTS idx_soccer_matches_league_date")
  })
})
