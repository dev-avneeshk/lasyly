# Verification — Chart click: remove blue outline + open boxscore popup (NFL & NBA)

## What was built

### PART 1 — remove the blue focus/selection outline on a clicked bar
- `app/globals.css`: added a chart-scoped block under `.perf-chart` that sets
  `outline:none` on `:focus`/`:focus-visible` and
  `-webkit-tap-highlight-color:transparent` on the recharts SVG / bar rectangles.
  **Scoped to the chart only** — no global `*:focus{outline:none}`, so keyboard
  focus visibility elsewhere is unaffected.
- `components/analysis/PerformanceCard.tsx`: the `ResponsiveContainer` wrapper
  now carries the `perf-chart` class so the scoped rules apply.

### PART 2 — click a bar → boxscore popup (NBA & NFL only)
- `lib/props/types.ts` / `components/analysis/PerformanceCard.tsx` /
  `app/(app)/analysis/[playerId]/page.tsx`: added optional `eventId?: string` to
  the shared game shapes (`GameResult`, `PerformanceGame`, the page's inline
  `lastGames` type). Optional, so NBA and every other sport compile unchanged.
- `lib/analytics/engine-nfl.ts` (path a — stored ESPN event id):
  - added `game_id` to `SELECT_COLUMN_LIST` (so it's fetched and packed via the
    derived `PACKED_COLUMNS`);
  - emit `eventId` on each `lastGames` entry from the row's `game_id`
    (`nfl_games.id` IS the ESPN event id);
  - bumped the player-rows cache key `nfl-player-rows:v2:` → `v3:` because the
    packed column set changed and v2 blobs lack `game_id`.
- `lib/scores/resolveGameEvent.ts` (new, client-safe — no `server-only`, no
  supabase): `resolveBoxscoreMatch({ sport, playerTeam, opponent, date, eventId })`:
  - NFL: returns a minimal `LiveMatch` synchronously from the stored `eventId`
    (`league:"NFL"`, `sport:"American Football"`, `status:"Finished"`);
  - NBA: `fetch('/api/scores?date=YYYYMMDD&sport=Basketball')`, matches the stored
    opponent abbreviation to a scoreboard team (via `NBA_TEAM_FULL_NAME` +
    `normalizeTeamName`), forces `status:"Finished"`;
  - any other sport, or no match / fetch failure → `null` (graceful no-op).
- `components/analysis/PerformanceCard.tsx`: added `onGameClick?` prop; `<Bar>`
  now has `onClick` (maps the clicked datum back to a `PerformanceGame`) and
  `cursor: pointer` when interactive. The `<Tooltip>`/hover block is unchanged.
- `app/(app)/analysis/[playerId]/page.tsx`: holds `boxscoreMatch`/`boxscoreLoading`
  state, computes `isBoxscoreSport = sportParam === "NBA" || "NFL"`, passes
  `onGameClick={isBoxscoreSport ? handleGameClick : undefined}` (so non-NBA/NFL
  sports are non-interactive), and renders a single
  `<MatchDetailModal match={boxscoreMatch} onClose=... />` near the end of the
  page. The modal self-handles loading / "Detailed stats unavailable".

Reused as-is: `MatchDetailModal` (BOX_SCORE_SPORTS already includes Basketball
and American Football), `/api/scores`, `/api/scores/[eventId]/summary`.

## Commands run (inside the worktree)

- `npx vitest run __tests__/scores/resolveGameEvent.test.ts` → **6 passed**.
- `npx vitest run __tests__/analytics/nfl-event-id.test.ts` → **1 passed**.
- `npx vitest run __tests__/scores __tests__/analytics` → **11 files, 110 passed**.
- `npm run lint` → **0 errors** (pre-existing warnings only; the one new
  unused-import warning I introduced in the resolver test was removed).
- `npm run build` → **`Compiled successfully` + `Finished TypeScript`** (no type
  errors). The build then stops at the "Collecting page data" step with
  `Environment validation failed: NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY invalid`
  because this worktree has no `.env.local` (only the main checkout does). This is
  a sandbox/env limitation, not a code error — compilation and the full TypeScript
  pass both succeeded.
- `npx vitest run` (full suite) → **1401 passed, 1 failed, 16 skipped**. The 28
  failing files (including the 1 failing assertion) all fail with
  `Cannot find package 'server-only'` — `node_modules/server-only` is not installed
  in this worktree (nor the main checkout). Pre-existing dependency gap, unrelated
  to this change; none of my changed files import `server-only`.

## New focused tests added

- `__tests__/scores/resolveGameEvent.test.ts` — NFL returns a match synchronously
  from a passed `eventId` (no fetch); NBA resolves the correct event by opponent
  abbreviation; the scoreboard URL uses `YYYYMMDD` + `sport=Basketball`; returns
  `null` for an unknown sport, a no-match, and a failed fetch.
- `__tests__/analytics/nfl-event-id.test.ts` — mocks the NFL engine's data layer
  and asserts each computed `lastGames[i].eventId` equals its row's `game_id`
  (numeric ESPN event id).

## Verified vs. couldn't verify at runtime

- **Verified (data path):** NFL `eventId` is threaded onto `lastGames` (engine
  test); the resolver returns the right `LiveMatch` for NFL (sync) and NBA
  (scoreboard lookup), and a graceful `null` for unsupported sports / no match /
  fetch failure (resolver test). Type-safety of the whole wiring is confirmed by
  the passing TypeScript step of `npm run build`.
- **Couldn't verify (full browser render):** the live DOM behavior — that
  clicking a bar paints no blue outline and that `MatchDetailModal` visibly opens
  with ESPN boxscore content for a real NBA/NFL player — was not executed in the
  sandbox because `next build` can't collect page data without Supabase env, and
  there is no running app. The CSS rule is scoped and standard; the modal + fetch
  path are the existing, tested `MatchDetailModal` + `/api/scores/[id]/summary`.
