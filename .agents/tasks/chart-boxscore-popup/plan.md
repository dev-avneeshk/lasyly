# Implementation Plan — Chart click: remove blue outline + open boxscore popup (NFL & NBA)

## Context & key decisions (grounded in the code I read)

**User ask (verbatim):** "when i click on the chart it doesn't highlight like the blue
border it made, and when i click it should open a popup of the boxscore of that game.
Both for NFL and NBA."

**Where the chart lives:** `components/analysis/PerformanceCard.tsx` — a recharts
`ComposedChart` with one `<Bar dataKey="value">` whose children are `<Cell>`s. It is
rendered from `app/(app)/analysis/[playerId]/page.tsx` (~line 817) with
`games={filteredHistory}`, where `filteredHistory` derives from `prop.lastGames`
(sorted by date, optional NFL season filter, `.slice(-timeRangeNum)`; page lines
~448-460). The page is already a `"use client"` component.

**The blue border:** recharts renders each bar as an SVG `<path>`/`<rect>` inside the
chart `<svg>`. On click the element receives focus and the browser paints the default
focus ring (and on touch, a tap-highlight). There is no custom selection styling in
`PerformanceCard.tsx` — so the fix is purely to suppress the browser/SVG focus outline
scoped to this chart, NOT a global `*:focus{outline:none}` (that hurts keyboard a11y).

**CENTRAL QUESTION — mapping a clicked bar to a real ESPN event — RESOLVED per sport:**

- **NFL → path (a) (thread a stored ESPN event id).** CONFIRMED by
  `supabase/migrations/20260911_create_nfl_tables.sql`: `nfl_games.id` is literally
  "ESPN event id (stable, unique)" and `nfl_player_stats.game_id TEXT NOT NULL
  REFERENCES nfl_games(id)`. The NFL engine (`lib/analytics/engine-nfl.ts`) builds
  `lastGames` from `rawRows` but its `SELECT_COLUMN_LIST` does **not** currently include
  `game_id`. Adding `game_id` to the select + packed columns and emitting it on each
  `lastGames` entry threads a numeric ESPN event id straight through
  `GameResult → prop.lastGames → filteredHistory → PerformanceGame → modal`. The
  summary route accepts exactly this (`/^\d{1,20}$/`).

- **NBA → path (b) (resolve at click time).** CONFIRMED there is **no** ESPN event id in
  NBA data: `scripts/scrape_nba.py` scrapes **Basketball Reference**, and `nba_games.id`
  / `nba_player_stats.game_id` are Basketball-Reference box-score slugs (e.g.
  `202510210OKC`), upserted `on_conflict="game_url"`. These are not ESPN event ids and
  the summary route would reject them. The NBA engine (`engine-v2.ts`) already carries,
  per historical game, `gameDate` (`nba_games.game_date`) and `opponent`
  (`nba_player_stats.opponent`, a 3-letter abbr) in `GraphDataPoint`/`lastGames`. That is
  enough to resolve the event at click time by querying the ESPN scoreboard for that date
  and matching the opponent. We already have a date-scoped, sport-filtered scoreboard
  endpoint: `GET /api/scores?date=YYYYMMDD&sport=Basketball` → `LiveMatch[]` (each with
  `eventId`, `league:"NBA"`, `homeTeam`/`awayTeam` full names). `getScoresForDate`
  excludes only in-progress games and returns Finished ones, so completed historical NBA
  games are returned.

**Reuse the existing modal.** `components/scores/MatchDetailModal.tsx` already renders a
boxscore via `createPortal`, takes `{ match: LiveMatch | null; onClose }`, fetches
`/api/scores/${eventId}/summary?league=${league}`, and has a Box Score tab for
`Basketball` and `American Football` (`BOX_SCORE_SPORTS`). We will reuse it as-is for
both sports and construct a minimal `LiveMatch` to drive it. No new modal.

**`LiveMatch` fields the modal needs** (`types/index.ts`): `eventId` (drives the summary
fetch), `league` (`"NBA"`/`"NFL"` → resolves the ESPN sport path), `sport`
(`"Basketball"`/`"American Football"` → gates the Box Score tab), `status` (use
`"Finished"` so it opens on the stats/boxscore tab, not the "Preview" branch), plus
`homeTeam/awayTeam/homeScore/awayScore/id`. We know the player's team and the opponent;
scores aren't needed for the boxscore tab (the summary fetch populates everything), so
header scores can be 0 and names best-effort.

**Decomposition decision:** This is ONE cohesive change (a scoped CSS fix + click-to-modal
wiring on the same chart/page) and does not decompose into separable features. Written as a
single ordered plan; the existing implement-and-review loop will execute it. Gate file is
`.agents/tasks/chart-boxscore-popup/review.json` with `verdict` == `APPROVED` (unchanged).

**Project commands (from `package.json`):** build `npm run build` (`next build --webpack`),
lint `npm run lint`, tests `npm run test` (`vitest run`). Next 16.3.8 / React 19 / recharts
3.8.1. Per `AGENTS.md`, no new Next.js server APIs are introduced (client component +
existing route handlers only), so no framework-doc changes are required; if a verifier is
unsure about a Next API, consult `node_modules/next/dist/docs/`.

---

# Implementation Plan

- [ ] 1. Add an optional ESPN event id to the shared game-result shapes.
      Add `eventId?: string` to `GameResult` in `lib/props/types.ts`, to `PerformanceGame`
      in `components/analysis/PerformanceCard.tsx`, and to the inline `lastGames` element
      type in `app/(app)/analysis/[playerId]/page.tsx` (the `PropData.lastGames` array type
      near line 35, and the local `graphData` type near line 40 if touched). Optional so NBA
      (which won't set it) and every other sport keep compiling unchanged.
      Files: `lib/props/types.ts`, `components/analysis/PerformanceCard.tsx`,
      `app/(app)/analysis/[playerId]/page.tsx`
      Verify: `npm run build` compiles with no type errors (no behavior change yet).

- [ ] 2. Thread the ESPN event id through the NFL engine (path (a)).
      In `lib/analytics/engine-nfl.ts`: add `"game_id"` to `SELECT_COLUMN_LIST` (so it is
      fetched and, via the derived `PACKED_COLUMNS`, cached). When building `lastGames`
      (~line 988), set `eventId: (rawRows[i]?.game_id as string) ?? undefined` aligned to the
      same index as `value`/`date`/`opponent`. `nfl_games.id` is the ESPN event id, so
      `game_id` is directly usable. BUMP the player-rows cache key version
      (`nfl-player-rows:v2:` → `v3:`) because the packed column set changes and old blobs
      lack `game_id`. Leave `graphData` as-is (chart x-axis doesn't need it).
      Files: `lib/analytics/engine-nfl.ts`
      Verify: `npm run build` passes; `npm run test` passes. Add/extend a unit test under
      `__tests__/analytics/` asserting a computed NFL `lastGames` entry carries a numeric
      `eventId` equal to its row's `game_id` (mock `nfl_player_stats` rows with `game_id`
      following the existing supabase-mock pattern in `__tests__/analytics/`).

- [ ] 3. Add a client helper that resolves/open-ready a `LiveMatch` for a clicked game.
      Create `lib/scores/resolveGameEvent.ts` (client-safe; no `server-only`, no supabase —
      it only calls the public `/api/scores` route). Export
      `resolveBoxscoreMatch({ sport, playerTeam, opponent, date, eventId }):
      Promise<LiveMatch | null>`:
      - If `eventId` is present (NFL): return a minimal `LiveMatch` immediately
        (`eventId`, `league: "NFL"`, `sport: "American Football"`, `status: "Finished"`,
        `homeTeam: playerTeam`, `awayTeam: opponent`, scores 0, `id: 'perf-'+eventId`).
      - Else if `sport` is NBA: `fetch('/api/scores?date='+YYYYMMDD+'&sport=Basketball')`,
        read `json.data` (`LiveMatch[]`), and pick the match whose `homeTeam`/`awayTeam`
        full name maps to the `opponent` abbreviation. Match by converting ESPN full names
        to abbrs (reuse `NBA_ESPN_TEAM_MAP`/`NBA_TEAM_FULL_NAME` from `lib/constants/teams.ts`,
        or compare normalized name/abbr both directions). Return the matched `LiveMatch`
        (already has `eventId`, `league:"NBA"`, `sport:"Basketball"`) with `status` forced to
        `"Finished"`; return `null` if no event matches.
      - For any other sport: return `null` (caller then does nothing).
      Convert the stored `date` (`YYYY-MM-DD`) to `YYYYMMDD` for the query param.
      Files: `lib/scores/resolveGameEvent.ts`
      Verify: `npm run build` passes. Add a unit test `__tests__/scores/resolveGameEvent.test.ts`
      that (a) returns an NFL match synchronously from a passed `eventId`, (b) given a mocked
      `fetch` returning NBA `LiveMatch[]`, resolves the correct event by opponent abbr, and
      (c) returns `null` for an unknown sport and for no-match. Run `npm run test`.

- [ ] 4. Make bars clickable in `PerformanceCard` and suppress the blue outline (PART 1 + click plumbing).
      In `components/analysis/PerformanceCard.tsx`:
      - Add an optional prop `onGameClick?: (game: PerformanceGame) => void`.
      - Carry `eventId` into the memoized `chartData` entries (so the click handler can read it).
      - Add `onClick` to the `<Bar>` (recharts passes the datum/activePayload); map the clicked
        datum back to its `PerformanceGame` (by index/opponent+date) and call `onGameClick`.
        Set `cursor: onGameClick ? "pointer" : "default"` on the bar.
      - Remove the focus ring with a TARGETED, chart-scoped style — NOT global. Wrap the
        `ResponsiveContainer` in a container that applies, scoped to this chart only:
        the SVG shapes get `outline: none` on focus and `-webkit-tap-highlight-color: transparent`.
        Implement by adding a `className` on the chart wrapper (e.g. `perf-chart`) plus a scoped
        `<style jsx>`-free rule using a local CSS: add rules targeting
        `.perf-chart :focus{outline:none} .perf-chart svg *:focus{outline:none}
        .perf-chart .recharts-bar-rectangle{-webkit-tap-highlight-color:transparent}` in the
        existing global stylesheet (`app/globals.css`) under a clearly commented, chart-scoped
        selector (confirm the stylesheet path by searching for the current `@import`/`:root`
        tokens like `--color-lime`). Do NOT add `*:focus{outline:none}`.
      - Keep the existing `<Tooltip>` and hover behavior intact (do not alter the Tooltip block).
      Files: `components/analysis/PerformanceCard.tsx`, `app/globals.css` (or the resolved global
      stylesheet that defines the `--color-*` tokens)
      Verify: `npm run build` + `npm run lint` pass. Manual (document for reviewer): clicking a
      bar shows no blue focus border; hovering still shows the tooltip; keyboard focus elsewhere
      is unaffected (no global outline removal). Put any Playwright scratch check under
      `.agents/tasks/chart-boxscore-popup/scratch/` and delete it after.

- [ ] 5. Hold modal state in the analysis page and wire the click to open the boxscore (PART 2).
      In `app/(app)/analysis/[playerId]/page.tsx`:
      - Import `MatchDetailModal` (direct import is fine; the page is already a client
        component) and `resolveBoxscoreMatch` from step 3, and `LiveMatch` from `@/types`.
      - Add state: `const [boxscoreMatch, setBoxscoreMatch] = useState<LiveMatch | null>(null)`
        and `const [boxscoreLoading, setBoxscoreLoading] = useState(false)`.
      - Compute an `isBoxscoreSport` gate: true only when `sportParam === "NBA"` or
        `sportParam === "NFL"`. For any other sport, do NOT pass `onGameClick` (clicking does
        nothing — no broken popup), satisfying the "only NBA & NFL" requirement.
      - Pass `onGameClick={isBoxscoreSport ? handleGameClick : undefined}` to `<PerformanceCard>`
        (the existing usage near line 817).
      - Implement `handleGameClick(game)`: set loading, call
        `resolveBoxscoreMatch({ sport: sportParam, playerTeam: prop.team, opponent: game.opponent,
        date: game.date, eventId: game.eventId })`; on a non-null result `setBoxscoreMatch(match)`,
        on null do nothing graceful (optionally a lightweight toast/console; no crash); clear loading.
      - Render `<MatchDetailModal match={boxscoreMatch} onClose={() => setBoxscoreMatch(null)} />`
        once near the end of the page JSX (sibling to the other top-level sections). The modal
        self-handles its own loading/`fetchError` ("Detailed stats unavailable") states, which
        covers "no boxscore available" gracefully.
      - While `boxscoreLoading` is true before the match resolves (NBA network hop), show a
        minimal non-blocking indicator (e.g. disable re-click / a small spinner); do not block
        the page.
      Files: `app/(app)/analysis/[playerId]/page.tsx`
      Verify: `npm run build` + `npm run lint` pass. Manual (document for reviewer): on an NFL
      player, click a bar → boxscore modal opens for that game (event id from data). On an NBA
      player, click a bar → modal opens after the scoreboard lookup resolves the event; if the
      date/opponent can't be matched, nothing breaks and the modal shows its graceful
      unavailable state. Confirm clicking a chart on a non-NBA/NFL sport (e.g. NHL/Soccer/Tennis)
      does nothing. Scratch Playwright checks go under
      `.agents/tasks/chart-boxscore-popup/scratch/` and are deleted after.

- [ ] 6. Full verification pass and cleanup.
      Run the whole gate: `npm run lint`, `npm run build`, `npm run test`. Fix any failures.
      Confirm no global focus-outline rule leaked in, the Tooltip is unchanged, and `eventId`
      is optional everywhere (no non-NFL/NBA regressions). Delete any scratch scripts/screenshots
      created under `.agents/tasks/chart-boxscore-popup/scratch/`.
      Files: none (verification only)
      Verify: `npm run lint && npm run build && npm run test` all succeed.

---

## File touch list (summary)

- `lib/props/types.ts` — add `eventId?: string` to `GameResult` (step 1).
- `components/analysis/PerformanceCard.tsx` — `eventId?` on `PerformanceGame`, `onGameClick`
  prop, bar `onClick`, pointer cursor, scoped focus-outline suppression; Tooltip untouched
  (steps 1, 4).
- `app/(app)/analysis/[playerId]/page.tsx` — `eventId?` on inline `lastGames` type, modal state,
  `isBoxscoreSport` gate, `handleGameClick`, render `MatchDetailModal` (steps 1, 5).
- `lib/analytics/engine-nfl.ts` — add `game_id` to `SELECT_COLUMN_LIST`, emit `eventId` on
  `lastGames`, bump cache key version (step 2).
- `lib/scores/resolveGameEvent.ts` — NEW client helper resolving a `LiveMatch` for a clicked
  game (NFL from stored id; NBA via `/api/scores` scoreboard match) (step 3).
- `app/globals.css` (or resolved global stylesheet) — chart-scoped focus-outline rules (step 4).
- `__tests__/analytics/*` and `__tests__/scores/resolveGameEvent.test.ts` — unit tests
  (steps 2, 3).

## Reused as-is (no changes)

- `components/scores/MatchDetailModal.tsx` — portal boxscore modal; `BOX_SCORE_SPORTS`
  already includes `Basketball` and `American Football`.
- `app/api/scores/route.ts` + `lib/data/scores.ts` — `GET /api/scores?date&sport` returns
  finished games with `eventId`.
- `app/api/scores/[eventId]/summary/route.ts` — the modal's summary fetch (numeric event id).
- `app/api/props/route.ts` — passes engine `lastGames` straight through to the client, so the
  new `eventId` field reaches `prop.lastGames` with no route change.

## Gaps / assumptions

- NBA opponent matching relies on mapping the stored 3-letter `opponent` abbr to the ESPN
  scoreboard's full team names; a few abbr spellings (e.g. SAS→SA, PHX→PHO) differ. Reuse the
  existing `NBA_ESPN_TEAM_MAP` / `NBA_TEAM_FULL_NAME` and compare both directions. If no event
  matches (old game outside the ±1-day scoreboard window, or an abbr gap), the helper returns
  `null` and the click is a graceful no-op — acceptable fallback, not a crash.
- ESPN's `/api/scores` reads a ±1-day window around the requested date; historical NBA games
  are "Finished" and returned, so same-date lookups resolve. Deep-history games far in the past
  still resolve as long as ESPN's scoreboard serves that date (it does, per `?dates=YYYYMMDD`).
