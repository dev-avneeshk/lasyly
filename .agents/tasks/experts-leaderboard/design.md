# Design: Experts Category Leaderboard + Full Odds/Multiplier Removal + Chat Skeleton Update

Worktree root: `/Users/ayushkumar/development/betroom/.worktrees/experts-leaderboard`
Status: First pass (no `design-verdict.json` present at
`/Users/ayushkumar/development/betroom/.worktrees/experts-leaderboard/.agents/tasks/experts-leaderboard/design-verdict.json`).

Framework: Next.js 16.3.8 (App Router, React 19.2.4). Confirmed against the bundled
upgrade guide at
`/Users/ayushkumar/development/betroom/node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`.
Relevant v16 facts that shape this design:
- Request APIs are async-only. Route handlers that read `context.params` must `await` it
  (the repo already does: `app/api/betslips/[betslipId]/status/route.ts` does `await context!.params`).
- `middleware` is renamed to `proxy` — the repo already ships `proxy.ts`. No touch here.
- Next's own `fetch`/`revalidateTag` cache is **not** used for these surfaces. All caching in this
  repo goes through the custom Redis cache-aside helper `lib/cache.ts` (`cached()`), so the v16
  caching-API churn (`revalidateTag` second arg, `updateTag`, `cacheLife`) does **not** apply.
- All existing API routes are plain `Request`-based handlers wrapped by `withSecurity(...)` from
  `lib/security/routeHelpers.ts`. New routes follow the same shape.

---

## Overview

Three locked deliverables:

- **(A)** Add a **category leaderboard of top predictors** to the Experts surface (`/marketplace`),
  without removing the existing tipster marketplace grid. Ranking is by hit rate (win %) within a
  category, with supporting columns, and a category selector reusing the marketplace sport chips.
- **(B)** Remove the **odds / multiplier** concept entirely from the user-facing product and from
  all ranking/"won how much" math. The DB `odds` columns stay (no drop migration); we stop
  requiring, writing, validating, and displaying odds.
- **(C)** Update the **chat loading skeleton** so it matches the new no-odds shared-prediction
  message layout.

The investigation surfaced a **critical data-model reality that contradicts one of the locked
assumptions** and forces an explicit decision, documented in the next section. The rest of the
design is concrete and buildable without further architectural choices.

---

## Critical finding: there is no "coins won from settled predictions" to aggregate

The task brief assumes `'won how much' = coins won / net from the coin-economy settlement, aggregated
per user`. That data source **does not exist** in this codebase. Verified:

1. **Two independent "prediction" systems exist, neither credits coins on win:**
   - **Betslips** (`betslips` table) — created from `components/betslip/CreateBetslipModal.tsx` via
     `POST /api/betslips` (`app/api/betslips/route.ts`). Graded by the owner through
     `PATCH /api/betslips/[betslipId]/status` (`app/api/betslips/[betslipId]/status/route.ts`).
     Columns in play: `odds`, `stake`, `payout`, `status` ('Pending'/'Won'/'Lost'/'Void'/'Partial'),
     `sportsbook`, `bet_type`, `matches` (jsonb), `is_for_sale`, `price`. **No `sport`/`category`
     column.** `payout` is computed as `Math.round(betslip.stake * betslip.odds * 100) / 100`
     (`status/route.ts:75`) — i.e. **directly from the user-set multiplier**, and it is **never
     credited to a wallet**. It is a display number only.
   - **Parlays** (`parlays` + `parlay_legs`, `supabase/migrations/20250526_create_parlays.sql`) —
     created from `components/parlays/SaveParlayDialog.tsx` via `POST /api/parlays`. Auto-settled by
     `lib/parlays/settlement.ts` to `won`/`lost`/`void`. `parlays.odds`/`parlays.stake` are nullable
     display fields; **settlement writes no coins**, only `status` + `resolved_at`. Category lives
     on `parlay_legs.sport`, constrained to `NBA | Tennis | Soccer | NFL | NHL`
     (`lib/parlays/validation.ts` `VALID_SPORTS`).

2. **The real coin economy (`supabase/migrations/20260921_arena_economy.sql`, `lib/economy/wallet.ts`)
   is the Arena mini-game only** — `start_arena_stake`, `award_cpu_reward`, `settle_1v1_stake`,
   `grant_weekly_level_bonus`. It is keyed on `game_id`, has nothing to do with betslips/parlays, and
   must not be conflated with prediction performance.

3. **Marketplace categories ≠ prediction categories.** The marketplace chips are
   `All, Football, Basketball, Tennis, Cricket, NFL, Formula 1, Esports, MMA, Boxing, Golf`
   (`TipstersClient.tsx` `SPORT_FILTERS`). Betslips carry no sport at all. Parlays carry only
   `NBA/Tennis/Soccer/NFL/NHL` per leg. The existing tipster API
   (`app/api/tipsters/route.ts`) does **not** categorize picks — it filters tipsters by
   `profiles.favourite_sports` (a self-declared profile array), which is a declared-interest tag,
   not evidence of what a pick actually was.

### Decision (chosen approach, with reasoning)

**Data source for the leaderboard = `betslips` (settled: `status IN ('Won','Lost')`), aggregated per
`user_id`.** Betslips are the Experts/marketplace pick system (shared via the "Share a Pick" modal,
surfaced on tipster profiles and `components/room/BetslipCard.tsx`), so they are the correct basis for
"top predictors" on the Experts surface. This also matches the existing tipster-grid stats, which
already aggregate `betslips` (`app/api/tipsters/route.ts`).

**"Won how much" is redefined to honor deliverable (B), not the (contradicted) coins premise.**
Because `payout` is literally `stake * odds` and `odds` is a user-set multiplier that we are
removing, we **cannot and must not** rank or display any odds-derived "coins won" figure — doing so
would violate the user's explicit reason for the change ("people can manually set any multiplier").
Chosen metric set (all odds-free):
- **Primary ranking metric:** category **win % (hit rate)** = `Won / (Won + Lost)` over settled
  betslips, matching the existing `app/api/tipsters/route.ts` convention.
- **Supporting columns:** **wins** (`Won` count), **settled count** (`Won + Lost`).
- **"Net" column:** net **record** = `wins − losses` (settled only). This is the honest, odds-free
  reading of "who won how much": how far ahead a predictor is on resolved picks, with no multiplier
  able to inflate it. The leaderboard will label this column **"Net"** (wins minus losses), not
  "coins won", and the design explicitly drops the self-set-multiplier payout from ranking.

**Category mapping — minimal, non-inventing solution.** Betslips have no per-pick sport, and adding
real per-pick sport tagging (classifier over `matches` text, or a new required field + settlement
pipeline) is a large, out-of-scope subsystem that the three locked deliverables do not ask for.
Chosen mapping, in order of preference:
- **"All" tab:** overall leaderboard across every tipster's settled betslips. No category needed.
  This is the primary, always-correct view.
- **Per-category tabs:** a tipster is bucketed into a category when that sport appears in their
  `profiles.favourite_sports` (same signal the marketplace grid already uses for its chips, so the
  behavior is consistent with what users already see). Within a category, tipsters are ranked by the
  **same betslip-derived win %/wins/settled/net** as the overall board. This reuses existing data,
  adds no migration, and never fabricates a per-pick sport.
- This limitation is stated plainly in the design and in the UI copy ("category reflects the
  predictor's declared sports") so the review and the user can decide if deeper per-pick tagging is a
  future follow-up. **If the user requires true per-pick category accuracy, that is a separate
  feature (new schema + settlement work) and is called out as a backlog item, not silently invented
  here.**

This decision is faithful to the three locked deliverables: a category table of top predictors (A),
zero odds/multiplier in the math or UI (B), and it uses only data that exists.

---

## Technology stack (locked once approved)

- Next.js 16.3.8 App Router server/client components; React 19.2.4.
- Data: Supabase via `createAdminClient()` (`lib/supabase/admin.ts`) for the aggregation; paged reads
  via `lib/supabase/paged.ts` (`fetchPagedParallel` / `fetchAllIn`).
- Caching: `cached()` + `CACHE_TTL` from `lib/cache.ts`, backed by Upstash Redis
  (`lib/redis.ts`, `@upstash/redis`). Cache-aside with in-memory fallback (already built-in).
- API: `withSecurity(...)` + `CACHE_CONTROL` from `lib/security/routeHelpers.ts`; `checkQueryParams`
  for injection guarding (mirrors `app/api/tipsters/route.ts`).
- UI: Tailwind v4 tokens (`--color-*`), `lucide-react` icons, `next/image`, `next/link`,
  `framer-motion` already in use. No new dependencies.

---

## Deliverable (A): Experts category leaderboard

### Placement — chosen: tabbed view inside `/marketplace`

Keep `app/(app)/marketplace/page.tsx` as the server entry. Convert the Experts surface into a
**two-tab client view — "Marketplace" (existing grid) and "Leaderboard" (new table)** — so the
follow/marketplace cards are preserved and the leaderboard is prominent. Rationale: adding a separate
route would fragment the "Experts" nav item (`Sidebar.tsx`/`BottomNav.tsx` both point `Experts →
/marketplace`); a tab keeps one destination and reuses the existing chip/sort UI patterns. The
category chips already live in `TipstersClient.tsx`; the leaderboard tab reuses the identical
`SPORT_FILTERS` array and chip markup.

Files:
- **New:** `app/(app)/marketplace/ExpertsClient.tsx` — client wrapper holding the active tab state
  (`"marketplace" | "leaderboard"`) and rendering the tab switcher. Renders the existing
  `TipstersClient` for the marketplace tab and the new `LeaderboardTable` for the leaderboard tab.
- **New:** `app/(app)/marketplace/LeaderboardTable.tsx` — client component: category chip row
  (reusing `SPORT_FILTERS`), fetches `/api/experts-leaderboard?category=<chip>`, renders the ranked
  table.
- **Modify:** `app/(app)/marketplace/page.tsx` — render `<ExpertsClient />` instead of
  `<TipstersClient />`. Metadata unchanged ("Tipster Marketplace").
- **Unchanged:** `app/(app)/marketplace/TipstersClient.tsx` grid logic (only the odds-free edits in
  deliverable B touch anything adjacent; the tipster grid itself has no odds).

The existing standalone parlay leaderboard at `app/(app)/leaderboard/*` is **left intact** (it is a
different, parlay-based board). It is only touched for the odds-removal in deliverable (B) — see
`LeaderboardClient.tsx` "Avg Odds" column and `lib/data/leaderboard.ts` `average_odds`.

### Data model + aggregation query

Source table `betslips`, columns `user_id, status, stake` (no odds needed, honoring B). Profiles for
display come from `profiles` (`id, username, display_name, avatar_url, is_verified, favourite_sports,
account_type`).

Precise aggregation (implemented in a new `lib/data/expertsLeaderboard.ts`, modeled on
`app/api/tipsters/route.ts` which already does this exact betslip aggregation):

1. Fetch tipster profiles: `profiles` where `account_type IN ('tipster','both')`, selecting
   `id, username, display_name, avatar_url, is_verified, favourite_sports`.
2. Fetch all betslips for those tipster ids past the 1000-row cap using
   `fetchAllIn<{ user_id, status }>(supabase, "betslips", "user_id, status", "user_id", tipsterIds)`
   (same call shape as `app/api/tipsters/route.ts`).
3. Aggregate per `user_id` over **graded** slips only (statuses are stored title-cased — `"Won"`,
   `"Lost"` — a bug comment in `tipsters/route.ts` notes comparing lowercase zeroed every rate):
   - `wins = count(status === "Won")`
   - `losses = count(status === "Lost")`
   - `settled = wins + losses`
   - `winPct = settled > 0 ? round(wins / settled * 100) : 0`
   - `net = wins - losses`
4. **Category filter:**
   - `category === "All"` → include every tipster with `settled >= MIN_SETTLED`.
   - otherwise → include tipsters whose `favourite_sports` contains the category
     (case-insensitive), with `settled >= MIN_SETTLED`.
   - `MIN_SETTLED = 1` initially (the betslip dataset is young; the parlay board's `>= 10` gate left
     it empty). This threshold is a single named constant so it is trivial to raise later.
5. **Rank:** sort by `winPct` desc, tie-break by `settled` desc, then `wins` desc, then
   `display_name` asc (stable, deterministic — matters for cache correctness). Take top 50.
6. Shape each row: `{ rank, user_id, username, display_name, avatar_url, is_verified, win_pct, wins,
   settled, net }`.

Return type (new, in `lib/data/expertsLeaderboard.ts`):

```ts
export interface ExpertsLeaderboardEntry {
  rank: number
  user_id: string
  username: string
  display_name: string
  avatar_url: string | null
  is_verified: boolean
  win_pct: number   // 0..100, integer
  wins: number      // Won count
  settled: number   // Won + Lost
  net: number        // wins - losses
}
```

### API route

**New:** `app/api/experts-leaderboard/route.ts` — mirrors `app/api/tipsters/route.ts` exactly:

```ts
export const GET = withSecurity(async (request: Request) => {
  const url = new URL(request.url)
  const raw = url.searchParams.get("category") ?? "All"
  // Enum-guard: only the known chip values can mint a cache key.
  const category = CATEGORIES.includes(raw) ? raw : "All"   // CATEGORIES = SPORT_FILTERS
  const injectionCheck = checkQueryParams({ category })
  if (injectionCheck) return injectionCheck
  return NextResponse.json(await getExpertsLeaderboard(category))
}, { cacheControl: CACHE_CONTROL.PUBLIC_MEDIUM })
```

Validation rule for the one external input (`category`): optional string; coerced to the
`SPORT_FILTERS` enum; any unknown/malformed value falls back to `"All"` (never 400 — a bad category
is harmless and must not break the Experts page). The enum guard both prevents arbitrary cache-key
minting and makes `checkQueryParams` redundant-but-cheap defense-in-depth (kept for parity with
`tipsters/route.ts`).

### Redis cache key + TTL + fallback

Via `cached()` in `lib/data/expertsLeaderboard.ts`:
- **Key:** `experts-leaderboard:${category}` (e.g. `experts-leaderboard:All`,
  `experts-leaderboard:Football`). `lib/cache.ts` prefixes with `cache:` internally.
- **TTL:** the brief asks for ~60s. The repo's nearest preset is `CACHE_TTL.explore` (`60_000`).
  **Chosen: add `expertsLeaderboard: 60_000` to the `CACHE_TTL` map** (rather than reuse `tipsters`'
  5-minute TTL) to honor the ~60s requirement. Single-line addition to `lib/cache.ts`.
- **Fallback:** `cached()` already implements cache-aside with Redis → in-memory fallback and a DB
  fetcher. The fetcher is the Supabase aggregation above; if Redis is down, `lib/cache.ts`
  transparently uses the in-memory store and still runs the DB query. No extra fallback code needed.

### UI table (`LeaderboardTable.tsx`)

Columns, left→right: **Rank**, **Tipster** (avatar + display name + `@username` + verified badge,
whole row is a `Link href={`/l/${username}`}` to the existing tipster profile), **Win %**,
**Wins / Settled** (e.g. `18 / 25`), **Net** (`+N` / `−N`, colored lime/red). Most-winning first.
Reuses the row styling and rank-medal treatment from `app/(app)/leaderboard/LeaderboardClient.tsx`
(top-3 colored badges) and the chip styling from `TipstersClient.tsx`. Loading state reuses the
pulse-skeleton pattern already in `LeaderboardClient.tsx`. Empty state copy: "No ranked predictors in
this category yet."

### Testability
- **Unit (vitest):** extract the pure aggregation (map betslip rows + profiles + category →
  ranked entries) into an exported pure function in `lib/data/expertsLeaderboard.ts` so it is tested
  without Supabase. Cases: title-case status handling, win%/net math, `MIN_SETTLED` gate, category
  (favourite_sports) filtering, tie-break ordering, top-50 cap, empty input.
- **Integration:** the route is thin; covered by the existing API integration harness
  (`__tests__/integration/`) hitting `/api/experts-leaderboard` with a seeded dataset. Redis is not
  required (in-memory fallback).

---

## Deliverable (B): Remove odds / multiplier completely

**The DB `odds` columns STAY.** `parlays.odds` (`20250526_create_parlays.sql`) and `betslips.odds`
remain, nullable/ignored. **No drop migration.** We stop requiring, writing on create, validating,
and displaying odds, and we remove odds from all ranking/payout math.

### Full enumeration of call sites (file:line) and classification

Collected via `grep -rn "formatOdds\|decimalOdds\|computePayout\|\.odds\b\|[Mm]ultiplier\|implied\|payout"`
across `app/`, `components/`, `lib/`, `__tests__/`.

**User-facing input (remove the control + stop sending odds):**
- `components/betslip/CreateBetslipModal.tsx:150` — "Total Multiplier" `<label>` + the `odds` number
  `<Input>` (lines ~148–160), `odds` state (`useState` ~line 20), `odds: parseFloat(odds)` in the
  POST payload (~line 61), and `disabled={... || !odds}` on submit (~line 274). **Remove all.**
- `components/parlays/SaveParlayDialog.tsx:43,45,47,98,254,257,260,267,273,278,281` — "Multiplier"
  field label, its validation messages, `computePayout` preview, and the `odds` input. **Remove the
  multiplier input + its validation + the payout preview; stop sending `odds`.**

**User-facing display (remove the odds/multiplier/implied UI):**
- `components/room/BetslipCard.tsx:76` (`impliedProb = Math.round((1/betslip.odds)*100)%`),
  `:208–215` ("Total Odds" hero block + `betslip.odds.toFixed(2)x` + implied line). **Remove the
  Total Odds block and implied-probability line.** Keep the Stake and Payout blocks? → **No for
  Payout** (payout is odds-derived, see below); keep **Stake** only. Rework the hero row to show
  Stake (and status) without odds/payout.
- `components/room/MessageRow.tsx:69-70` — `BetslipCardView` "Multiplier" label + `${bet.odds}x`.
  **Remove the Multiplier cell.** (This is the chat shared-prediction card — see deliverable C for
  the matching skeleton.)
- `components/room/TopBetPanel.tsx:66-67` — "Multiplier" label + `${bet.odds}x`. **Remove.**
- `components/parlays/PredictionRow.tsx:16` (import), `:216` ("Odds" column `formatOdds`), `:87-88`
  (`unitResult` uses `decimalOdds`). **Remove the Odds column; remove the odds-based P/L** (see
  net-math note below).
- `components/parlays/ParlayBetslipCard.tsx:15` (import), `:243-244` (`computePayout` return),
  `:323-329` ("Multiplier & Return" block + `formatOdds`). **Remove the Multiplier/Return block and
  the payout computation.**
- `components/room/PredictionPickerModal.tsx:7` (import), `:128` ("Odds" `formatOdds`). **Remove the
  Odds display.**
- `components/props/BetTrackerView.tsx:58` (local `formatOdds`), `:348` ("Odds:" display).
  BetTrackerView is the personal **bet tracker** (`bet_tracker` table, American `odds INTEGER`), a
  separate private tool — the brief scopes removal to the prediction/parlay product. **Decision:
  leave BetTrackerView as-is** (it is not the shared-pick/odds-multiplier surface the user is
  objecting to, and it has its own local `formatOdds`). Flagged for the review to confirm scope; if
  the user wants it gone too, it is an isolated two-line removal with no shared dependency.
- `app/(app)/l/[username]/PublicProfileClient.tsx:300-302` — `@ {parlay.odds}` on the public tipster
  profile. **Remove the odds line.**

**Ranking / "won how much" math (must not use odds):**
- `lib/data/leaderboard.ts:9` (import `decimalOdds`), `:70` (`existing.totalOdds += decimalOdds(...)`),
  and `average_odds` in `LeaderboardEntry` + each pushed row. **Remove `average_odds` from the
  parlay leaderboard** entirely (type, aggregation, output).
- `app/(app)/leaderboard/LeaderboardClient.tsx:9-20` (`average_odds` in type), `:181-187` ("Avg Odds"
  column). **Remove the Avg Odds column + the type field.**
- `app/api/betslips/[betslipId]/status/route.ts:75` — `payout = stake * odds`. **Decision: stop
  writing `payout`** on grade (the figure is a self-set-multiplier artifact and is never credited to
  a wallet). The `payout` column stays (like `odds`), just no longer written. Remove `odds` from the
  fetch select at `:42`.
- `app/api/bets/route.ts:153,178,267-269` — `bet_tracker` winnings via `americanToDecimal`. This is
  the private bet tracker, same scope note as BetTrackerView. **Leave as-is**, flagged for review.

**Create/validation (stop requiring/writing odds):**
- `app/api/betslips/route.ts:12` (`odds: z.number().gt(0).lte(100000)` in `createBetslipSchema`),
  `:75` (`odds: data.odds` in insert), `:84` (echo select includes `odds`). **Change schema `odds`
  to `.optional().nullable()`; stop inserting a required odds; drop from the create payload.** Column
  stays nullable in DB.
- `app/api/parlays/route.ts:174` (`odds: payload.odds ?? null`). Already nullable — **leave the write
  as `null`-tolerant; stop sending odds from the client** (SaveParlayDialog change above).
- `lib/parlays/validation.ts` — `validateCreateParlay` odds block (lines ~80–90, `MIN_ODDS/MAX_ODDS`
  constants). **Remove the odds validation branch and the constants** (odds becomes an
  ignored/absent field; keep accepting a stray `odds` without erroring for backward compat → simply
  do not validate it).

**Shared feed / message plumbing that passes odds through (stop surfacing it):**
- `app/api/betslips/feed/route.ts:202` and the select at `:68` include `odds`. **Keep the column in
  the select is harmless, but stop including `odds` in the response shape** so clients can't render
  it. Simpler + safer: drop `odds` from both the select and the returned object.
- `app/api/rooms/[roomId]/messages/route.ts:386` — `odds: parlayRes.data.odds ?? null` on the shared
  betslip/parlay message payload. **Drop `odds` from the message payload.**
- `app/api/rooms/[roomId]/top-bet/route.ts:35` — `odds: row.odds`. **Drop from payload.**
- `app/api/wallet/route.ts:88` and `app/(app)/wallet/WalletClient.tsx:13` — `odds` in the wallet
  betslip summary. **Drop `odds` from this projection + the client type.**
- `app/api/export/bets/route.ts:49` and `app/(app)/profile/page.tsx:100-103`,
  `app/(app)/l/[username]/page.tsx:63,108`, `app/api/profiles/[identifier]/route.ts:93` compute an
  "average odds" for profiles. **Remove the average-odds computation + any field that surfaces it.**
  (These are odds-derived display stats, squarely in scope for B.)
- `app/(app)/explore/ExploreClient.tsx:988` — `odds: post.parlay.odds ?? null` passed into a card.
  **Drop `odds` from the mapped object** (the card no longer renders it after the component edits).

**Functions in `lib/parlays/computations.ts`:**
- `computePayout` (`:14`), `decimalOdds` (`:28`), `formatOdds` (`:37`). After the edits above, their
  only callers are display/ranking code being removed. **Decision: delete `computePayout`,
  `decimalOdds`, `formatOdds` and their tests** once every enumerated call site is removed.
  `computeStreak`, `computeParlayStats`, `computeMostCommonSport`, `computeByLegCount` **stay** — but
  `computeParlayStats`'s `net_profit_loss` (`:130-139`) uses `decimalOdds`. **Decision: redefine
  `net_profit_loss` to an odds-free net = `(won count − lost count)` by stake units, or drop the
  field.** Chosen: **drop `net_profit_loss` from `ParlayStats`** (it is an odds-derived P/L and
  cannot survive B honestly); remove its consumers in the same pass. **Confirmed consumer:**
  `app/(app)/bets/page.tsx:211-219` renders `stats.net_profit_loss` as a `±N.Nu` P/L figure — remove
  that block. Also update the `ParlayStats` type (`lib/types/parlay.ts`) and the
  `net_profit_loss` test in `lib/parlays/computations.test.ts:188-210`.
- `components/parlays/PredictionRow.tsx` `unitResult` similarly becomes odds-free: **remove the P/L
  "units" column** rather than invent an odds-free unit (there is no honest unit without a
  multiplier).
- `lib/parlays/computations.test.ts:3-4,54-108` — delete the `computePayout`/`formatOdds` test
  blocks; keep streak/stats tests (minus any `net_profit_loss`/odds assertions).

**Tests referencing odds:** grep `__tests__` for `odds`, `formatOdds`, `payout`, `average_odds`,
`net_profit_loss`, `Multiplier` and update/remove the affected cases in the same commit as each
source edit so the suite stays green.

### Confirmed: DB `odds` column kept
No migration drops `odds` or `payout`. `parlays.odds`, `betslips.odds`, and `betslips.payout` all
remain nullable and are simply no longer written/validated/shown. `bet_tracker.odds` is untouched
(out of scope per decision above).

### Safe removal ORDER (build never breaks mid-way)

Bottom-up: stop producing before stop consuming, delete leaf functions last.

1. **UI components first** (pure display; removing an odds line can't break a producer): edit
   `BetslipCard.tsx`, `MessageRow.tsx` (`BetslipCardView`), `TopBetPanel.tsx`, `PredictionRow.tsx`,
   `ParlayBetslipCard.tsx`, `PredictionPickerModal.tsx`, `PublicProfileClient.tsx`,
   `LeaderboardClient.tsx` (Avg Odds column), `WalletClient.tsx` type. After this step the UI no
   longer references `formatOdds`/`computePayout`/`decimalOdds`/`.odds`/`payout`/`average_odds`.
2. **Client input components:** `CreateBetslipModal.tsx`, `SaveParlayDialog.tsx` — remove inputs +
   stop sending `odds`. (API still accepts it; now it just arrives absent/null.)
3. **API response shapes:** `betslips/feed`, `rooms/[roomId]/messages`, `rooms/[roomId]/top-bet`,
   `wallet`, `profiles/[identifier]`, `export/bets`, `explore` map — drop `odds`/avg-odds from
   payloads. (Consumers in step 1/2 already stopped reading them.)
4. **Ranking/data libs:** `lib/data/leaderboard.ts` (`average_odds`), `lib/parlays/computations.ts`
   `computeParlayStats` (`net_profit_loss`), and their types in `lib/types/parlay.ts`.
5. **Create/validate/grade:** `app/api/betslips/route.ts` (schema `odds` → optional, drop insert),
   `app/api/betslips/[betslipId]/status/route.ts` (stop writing `payout`, drop odds from select),
   `lib/parlays/validation.ts` (remove odds branch + constants), `app/api/parlays/route.ts`
   (already null-tolerant).
6. **Delete leaf functions + tests:** remove `computePayout`/`decimalOdds`/`formatOdds` from
   `lib/parlays/computations.ts` and their test blocks — now that no caller remains, TypeScript
   confirms zero references. Run `npm run build` + `npm run test` after this step.

Run `npm run build` after steps 1–2 and again after 4–6 to catch any missed reference before the
leaf deletion.

### Error handling / invariants for B
- **Create (`POST /api/betslips`):** `odds` becomes optional. Validation failures still return 400
  via `validateRequestBody` with the Zod error (unchanged mechanism). Recoverable (client fixes
  input). Logged at the existing level (none added).
- **Grade (`PATCH .../status`):** removing the `payout` write cannot fail. The concurrency guard
  (`handleConflict`, 409 on 0 rows) and single-grade invariant are **unchanged** — grading still
  flips Pending→final exactly once, owned by `app/api/betslips/[betslipId]/status/route.ts` with the
  service role (enforcement layer unchanged: DB column grants + the `.eq("status","Pending")` guard).
- **Invariant ownership:** "a betslip is graded once" stays enforced at the API+DB layer; this change
  only removes a derived display field and does not touch that path's guards.

---

## Deliverable (C): Chat skeleton update

### Current shape vs target

**Reality check (differs slightly from the brief):** the rooms/chat loading skeleton
(`components/room/skeletons.tsx` → `MessageListSkeleton`, used by `RoomShellSkeleton`,
`app/(app)/rooms/loading.tsx`, and `app/(app)/rooms/[roomId]/loading.tsx`) is a **generic text-message
skeleton** — avatar + name/time line + 1–2 text lines. It does **not** currently render an
odds/multiplier placeholder, so there is no literal "odds line" in the skeleton to delete.

The odds/multiplier actually lives in the **real** shared-prediction card, `BetslipCardView` inside
`components/room/MessageRow.tsx:55-84`: a `Multiplier` cell (`${bet.odds}x`) next to `Hit rate` and
`Entry` (Coins). After deliverable (B) removes the Multiplier cell, the shared-prediction card's
layout becomes: header (`Prediction` label + status pill) → a 2-cell meta row (`Hit rate`, `Entry`)
→ optional note.

**Target:** make the loading skeleton faithfully mirror the **new no-odds shared-prediction card** so
there is no layout flash when a room containing shared predictions loads. Concretely:

- **Add a `BetslipCardSkeleton` to `components/room/skeletons.tsx`** that mirrors the post-B
  `BetslipCardView`: a `max-w-[320px]` rounded card, a header bar (label pulse + status-pill pulse),
  and a meta row of **two** cells (Hit rate, Entry) — **not three** (no Multiplier cell). This encodes
  the new no-odds layout and is the deliverable-C change.
- **Update `MessageListSkeleton`** so a subset of skeleton rows render the `BetslipCardSkeleton`
  under the text lines (e.g. every 3rd deterministic row), matching that real chat feeds interleave
  text and shared-prediction messages. Keep it deterministic (no `Math.random`) — the file comment
  already requires server/client markup parity, so widths stay in the existing `MESSAGE_WIDTHS`
  constant pattern.

This is a **visual/layout-only** change; no data or behavior. It stays server-safe (no `"use client"`,
no hooks) exactly as the file's header comment mandates, so it keeps working as both the route
`loading.tsx` fallback and the client components' loading state.

### Edge cases
- `motion-reduce:animate-none` is already applied via the shared `PULSE` constant — the new skeleton
  reuses `PULSE`, so reduced-motion is preserved.
- Deterministic widths keep SSR/client hydration identical (no mismatch warning).

### Testability
- The skeleton is pure presentational markup. A lightweight render test
  (`__tests__`) can assert the new `BetslipCardSkeleton` renders exactly **two** meta cells (guarding
  against a Multiplier cell regressing back in). Primarily verified visually against the loaded
  `BetslipCardView`.

---

## Migration assessment: none required

No schema migration is needed.
- (A) reads existing `betslips` + `profiles` columns; the aggregation is the same shape as the
  already-shipped `app/api/tipsters/route.ts`, which performs well behind the 5-min cache; the new
  board runs behind a 60s cache. **Index check:** `fetchAllIn` filters `betslips` by `user_id` and
  reads `status`; confirm an index on `betslips(user_id)` exists (the lock-down/hot-path migrations
  `20260914_hot_path_indexes.sql` / `20260916_indexes_no_concurrent.sql` reference `betslips` — the
  implementer should verify `idx` coverage there). If, and only if, the aggregation is measured too
  slow under load, the **minimal** addition is a covering index
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_betslips_user_status ON public.betslips (user_id, status)`
  (non-`CONCURRENTLY` variant for the repo's `_no_concurrent` migration style). **Confirmed:**
  `betslips(user_id)` is already indexed — `idx_betslips_user` in
  `supabase/migrations/20260914_hot_path_indexes.sql:105-106` — which covers the aggregation's
  `.in("user_id", ...)` filter. **No new index now**, further justified by the 60s Redis cache
  collapsing load to ~one aggregation per key per minute across the fleet (via the cross-instance
  refresh lease in `lib/cache.ts`).
- (B) explicitly keeps all `odds`/`payout` columns — no DDL.
- (C) is UI-only.

---

## Files touched (summary, absolute paths)

New:
- `/Users/ayushkumar/development/betroom/.worktrees/experts-leaderboard/app/(app)/marketplace/ExpertsClient.tsx`
- `/Users/ayushkumar/development/betroom/.worktrees/experts-leaderboard/app/(app)/marketplace/LeaderboardTable.tsx`
- `/Users/ayushkumar/development/betroom/.worktrees/experts-leaderboard/app/api/experts-leaderboard/route.ts`
- `/Users/ayushkumar/development/betroom/.worktrees/experts-leaderboard/lib/data/expertsLeaderboard.ts`

Modified (A): `app/(app)/marketplace/page.tsx`; `lib/cache.ts` (add `expertsLeaderboard: 60_000`).

Modified (B): `components/betslip/CreateBetslipModal.tsx`, `components/parlays/SaveParlayDialog.tsx`,
`components/parlays/PredictionRow.tsx`, `components/parlays/ParlayBetslipCard.tsx`,
`components/room/BetslipCard.tsx`, `components/room/MessageRow.tsx`, `components/room/TopBetPanel.tsx`,
`components/room/PredictionPickerModal.tsx`, `app/(app)/l/[username]/PublicProfileClient.tsx`,
`app/(app)/l/[username]/page.tsx`, `app/(app)/leaderboard/LeaderboardClient.tsx`,
`app/(app)/profile/page.tsx`, `app/(app)/explore/ExploreClient.tsx`,
`app/(app)/wallet/WalletClient.tsx`, `app/(app)/bets/page.tsx`, `lib/data/leaderboard.ts`, `lib/parlays/computations.ts`,
`lib/parlays/computations.test.ts`, `lib/parlays/validation.ts`, `lib/types/parlay.ts`,
`app/api/betslips/route.ts`, `app/api/betslips/[betslipId]/status/route.ts`,
`app/api/betslips/feed/route.ts`, `app/api/parlays/route.ts`,
`app/api/rooms/[roomId]/messages/route.ts`, `app/api/rooms/[roomId]/top-bet/route.ts`,
`app/api/wallet/route.ts`, `app/api/profiles/[identifier]/route.ts`, `app/api/export/bets/route.ts`,
plus any affected `__tests__/*`.

Modified (C): `components/room/skeletons.tsx` (add `BetslipCardSkeleton`, interleave into
`MessageListSkeleton`).

Explicitly out of scope / flagged for review: `components/props/BetTrackerView.tsx` and
`app/api/bets/route.ts` (private `bet_tracker`, American odds) — left as-is; confirm with user.

---

## Open items for the design review
1. **Metric semantics:** confirm "Net = wins − losses (settled)" is the accepted odds-free reading of
   "won how much", given coins-from-settlement does not exist. (Primary ranking is win %.)
2. **Category mapping via `profiles.favourite_sports`:** confirm this declared-interest bucketing is
   acceptable for the per-category tabs, with true per-pick sport tagging deferred as a backlog
   feature (requires new schema + settlement work).
3. **BetTracker scope:** confirm the private `bet_tracker` odds display/winnings stay (out of the
   prediction/multiplier scope) or should also be stripped.

The design is ready for review.
