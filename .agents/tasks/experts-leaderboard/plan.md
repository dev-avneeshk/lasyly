# Implementation Plan: Experts Category Leaderboard + Full Odds/Multiplier Removal + Chat Skeleton

Worktree root (all paths absolute): `/Users/ayushkumar/development/betroom/.worktrees/experts-leaderboard`

Source of truth: the APPROVED design at
`/Users/ayushkumar/development/betroom/.worktrees/experts-leaderboard/.agents/tasks/experts-leaderboard/design.md`
(verdict `APPROVED`, see `design-verdict.json`).

Verification commands (run from inside the worktree root for every verify step):
`npx tsc --noEmit` · `npm run lint` · `npm run build` · `npm test` (vitest run).

Ordering rationale: Deliverable (B) odds/multiplier removal goes first — it is the widest, riskiest
change and the chat skeleton in (C) must mirror the *post-B* no-odds card shape, so (C) can only be
done correctly after (B). Within (B), edits run bottom-up (stop producing before stop consuming;
delete leaf functions last) exactly as the design's "Safe removal ORDER" enumerates, so the build
never breaks mid-way. (A) is purely additive (new files + two small edits) and independent of
(B)/(C); it is sequenced after (B) only to keep one linear, always-buildable history in the single
shared worktree. (C) is last because it depends on the (B) `BetslipCardView` layout.

The DB keeps the `odds` and `payout` columns — there is NO drop migration anywhere in this plan.

---

## Deliverable (B) — Remove odds / multiplier completely (steps 1–6)

Run bottom-up. After each step the build must stay green. Run `npm run build` after steps 2 and 6
at minimum (full verify runs on every step below).

- [ ] 1. Remove odds/multiplier/implied/payout from the **display** components (pure display edits,
      cannot break a producer).
      - `components/room/BetslipCard.tsx`: delete the "Total Odds" hero block (`betslip.odds.toFixed(2)x`),
        the implied-probability line and its `impliedProb = Math.round((1/betslip.odds)*100)` computation,
        and the Payout/Potential block (payout is odds-derived). Rework the hero row to show **Stake only**
        (keep status). Remove the now-unused `TrendingUp` import if it becomes unused.
      - `components/room/MessageRow.tsx` (`BetslipCardView`): delete the "Multiplier" cell
        (`{bet.odds != null ? ...}`). Card now renders header + the Hit rate / Entry cells + optional note.
      - `components/room/TopBetPanel.tsx`: delete the "Multiplier" label + `${bet.odds}x`.
      - `components/parlays/PredictionRow.tsx`: remove the `formatOdds` import, the "Odds" column, and the
        odds-based P/L (`unitResult` using `decimalOdds`) — remove the P/L units column rather than invent
        an odds-free unit.
      - `components/parlays/ParlayBetslipCard.tsx`: remove the `computePayout` import, the payout return,
        and the "Multiplier & Return" block (`formatOdds`).
      - `components/room/PredictionPickerModal.tsx`: remove the `formatOdds` import and the "Odds" display.
      - `app/(app)/l/[username]/PublicProfileClient.tsx`: remove the `@ {parlay.odds}` odds line.
      - `app/(app)/leaderboard/LeaderboardClient.tsx`: remove the "Avg Odds" column and the `average_odds`
        field from its local type.
      - `app/(app)/wallet/WalletClient.tsx`: remove `odds` from the betslip summary client type.
      - `components/props/BetTrackerView.tsx` and `app/api/bets/route.ts` are OUT OF SCOPE (private
        `bet_tracker`, American odds) — leave untouched.
      Files: the nine files listed above.
      Verify: `npx tsc --noEmit && npm run lint && npm run build` from the worktree root — all pass with
      no references to `formatOdds`/`computePayout`/`decimalOdds`/`.odds`/`payout`/`average_odds` left in
      these components.

- [ ] 2. Remove odds from the **client input** components and stop sending it.
      - `components/betslip/CreateBetslipModal.tsx`: delete the "Total Multiplier" `<label>` + `odds`
        number `<Input>`, the `odds` `useState`, `odds: parseFloat(odds)` from the POST payload, and the
        `!odds` term in the submit `disabled` guard.
      - `components/parlays/SaveParlayDialog.tsx`: delete the "Multiplier" field label + input, its
        validation messages, and the `computePayout` payout preview; stop sending `odds` in the save
        payload (send `null` / omit).
      Files: `components/betslip/CreateBetslipModal.tsx`, `components/parlays/SaveParlayDialog.tsx`.
      Verify: `npx tsc --noEmit && npm run lint && npm run build` pass.

- [ ] 3. Drop `odds` / average-odds from **API response shapes** (consumers in steps 1–2 already stopped
      reading them).
      - `app/api/betslips/feed/route.ts`: drop `odds` from the select and the returned object.
      - `app/api/rooms/[roomId]/messages/route.ts`: drop `odds` from the shared betslip/parlay message payload.
      - `app/api/rooms/[roomId]/top-bet/route.ts`: drop `odds` from the payload.
      - `app/api/wallet/route.ts`: drop `odds` from the wallet betslip summary projection.
      - `app/api/profiles/[identifier]/route.ts`, `app/(app)/l/[username]/page.tsx`,
        `app/(app)/profile/page.tsx`, `app/api/export/bets/route.ts`: remove the "average odds" computation
        and any field that surfaces it.
      - `app/(app)/explore/ExploreClient.tsx`: drop `odds` from the mapped parlay card object.
      Files: the eight files above.
      Verify: `npx tsc --noEmit && npm run lint && npm run build` pass.

- [ ] 4. Remove odds from the **ranking / stats libs** and their types.
      - `lib/data/leaderboard.ts`: remove the `decimalOdds` import, the `totalOdds` aggregation, the
        `odds` field from the paged select, and `average_odds` from `LeaderboardEntry` + every pushed row.
      - `lib/parlays/computations.ts`: in `computeParlayStats`, drop the `net_profit_loss` computation
        (odds-derived) and the field from the returned object.
      - `lib/types/parlay.ts`: remove `net_profit_loss` from the `ParlayStats` interface.
      - `app/(app)/bets/page.tsx`: remove the block that renders `stats.net_profit_loss` (the `±N.Nu` P/L).
      Files: `lib/data/leaderboard.ts`, `lib/parlays/computations.ts`, `lib/types/parlay.ts`,
      `app/(app)/bets/page.tsx`.
      Verify: `npx tsc --noEmit && npm run lint && npm run build` pass.

- [ ] 5. Stop **requiring / writing / validating** odds on create & grade.
      - `app/api/betslips/route.ts`: change `createBetslipSchema.odds` to `.optional().nullable()`; stop
        inserting a required `odds` (insert `odds: data.odds ?? null`); keep `odds` out of the required
        contract. `payout` is no longer computed anywhere so no NaN risk.
      - `app/api/betslips/[betslipId]/status/route.ts`: stop writing `payout` on grade (remove the
        `updatePayload.payout = Math.round(stake * odds * 100)/100` branch); drop `odds` from the fetch
        select. Keep the concurrency guard (`.eq("status","Pending")`, `handleConflict`) and single-grade
        invariant unchanged.
      - `lib/parlays/validation.ts`: remove the odds validation branch and the `MIN_ODDS`/`MAX_ODDS`
        constants; `odds` becomes an accepted-but-ignored field (do not error if present).
      - `app/api/parlays/route.ts`: already null-tolerant (`odds: payload.odds ?? null`) — leave as-is.
      Files: `app/api/betslips/route.ts`, `app/api/betslips/[betslipId]/status/route.ts`,
      `lib/parlays/validation.ts`.
      Verify: `npx tsc --noEmit && npm run lint && npm run build` pass.

- [ ] 6. Delete the **leaf odds functions** and update their tests (now that TypeScript confirms zero
      callers remain).
      - `lib/parlays/computations.ts`: delete `computePayout`, `decimalOdds`, `formatOdds`. Keep
        `computeStreak`, `computeParlayStats`, `computeMostCommonSport`, `computeByLegCount`.
      - `lib/parlays/computations.test.ts`: delete the `describe("computePayout")` and
        `describe("formatOdds")` blocks and their imports; delete the two `net_profit_loss` test cases
        ("computes net_profit_loss…" and "ignores parlays without stake or odds…"); keep streak/stats
        tests (minus any `net_profit_loss`/odds assertions).
      - Any other `__tests__/*` referencing `odds`/`payout`/`average_odds`/`Multiplier`: update/remove the
        affected assertions in this same step so the suite stays green (grep `__tests__` for those terms).
      - Final residual-reference check: repo-wide grep for `\.odds\b`, `formatOdds`, `computePayout`,
        `decimalOdds`, `average_odds`, `net_profit_loss` in `app/`, `components/`, `lib/` — the only
        remaining hits are the intentionally out-of-scope `bet_tracker` (`BetTrackerView.tsx`,
        `app/api/bets/route.ts`) and the retained DB columns.
      Files: `lib/parlays/computations.ts`, `lib/parlays/computations.test.ts`, plus any affected
      `__tests__/*`.
      Verify: `npx tsc --noEmit && npm run lint && npm run build && npm test` — full suite green, zero
      TypeScript references to the deleted functions.

---

## Deliverable (A) — Experts category leaderboard (steps 7–10)

Purely additive. The existing tipster grid is preserved; the leaderboard is a second tab.

- [ ] 7. Add the leaderboard data layer with an exported **pure** aggregation function and the Redis
      cache-aside wrapper.
      - New `lib/data/expertsLeaderboard.ts`:
        - Export `interface ExpertsLeaderboardEntry { rank, user_id, username, display_name, avatar_url,
          is_verified, win_pct, wins, settled, net }`.
        - Export a pure function `rankExpertsLeaderboard(profiles, betslips, category)` that: aggregates
          per `user_id` over graded slips only (title-cased `"Won"`/`"Lost"` — matching
          `app/api/tipsters/route.ts`), computes `wins`, `losses`, `settled = wins+losses`,
          `winPct = settled>0 ? round(wins/settled*100) : 0`, `net = wins-losses`; applies the category
          filter (`"All"` → all with `settled >= MIN_SETTLED`; else `favourite_sports` contains the
          category case-insensitively, with `settled >= MIN_SETTLED`); sorts by `winPct` desc, tie-break
          `settled` desc, then `wins` desc, then `display_name` asc; takes top 50; assigns `rank`.
          Export `MIN_SETTLED = 1` as a named constant.
        - Export `getExpertsLeaderboard(category)` that wraps the Supabase fetch + `rankExpertsLeaderboard`
          in `cached("experts-leaderboard:" + category, fetcher, CACHE_TTL.expertsLeaderboard)`. The fetcher
          uses `createAdminClient()`, selects tipster profiles (`account_type IN ('tipster','both')`,
          columns `id, username, display_name, avatar_url, is_verified, favourite_sports`), then
          `fetchAllIn<{ user_id, status }>(supabase, "betslips", "user_id, status", "user_id", tipsterIds)`,
          then calls the pure function. Return `ExpertsLeaderboardEntry[]`.
      - `lib/cache.ts`: add `expertsLeaderboard: 60_000` to the `CACHE_TTL` map (honors the ~60s requirement;
        single-line addition).
      Files: `lib/data/expertsLeaderboard.ts` (new), `lib/cache.ts`.
      Verify: `npx tsc --noEmit && npm run lint && npm run build` pass.

- [ ] 8. Add the new unit tests for the pure aggregation.
      - New `lib/data/expertsLeaderboard.test.ts` (vitest) exercising `rankExpertsLeaderboard`: title-case
        status handling, win%/net math, `MIN_SETTLED` gate, category (`favourite_sports`) filtering,
        tie-break ordering (winPct → settled → wins → display_name), top-50 cap, empty input.
      Files: `lib/data/expertsLeaderboard.test.ts` (new).
      Verify: `npm test` — the new `expertsLeaderboard` test file passes; whole suite stays green.

- [ ] 9. Add the API route.
      - New `app/api/experts-leaderboard/route.ts`: `GET = withSecurity(async (request) => {...}, {
        cacheControl: CACHE_CONTROL.PUBLIC_MEDIUM })` mirroring `app/api/tipsters/route.ts`. Read
        `category` from the query, coerce to the `SPORT_FILTERS` enum (unknown/malformed → `"All"`, never
        400), run `checkQueryParams({ category })` for defense-in-depth, return
        `NextResponse.json(await getExpertsLeaderboard(category))`. Define `CATEGORIES` as the same array
        as `SPORT_FILTERS` from `TipstersClient.tsx` (duplicate the literal or export it; prefer exporting
        `SPORT_FILTERS` and importing it to avoid drift).
      Files: `app/api/experts-leaderboard/route.ts` (new); optionally export `SPORT_FILTERS` from
      `app/(app)/marketplace/TipstersClient.tsx`.
      Verify: `npx tsc --noEmit && npm run lint && npm run build` pass.

- [ ] 10. Add the Experts tabbed UI and the leaderboard table, preserving the existing grid.
      - New `app/(app)/marketplace/ExpertsClient.tsx` (`"use client"`): holds tab state
        (`"marketplace" | "leaderboard"`), renders a tab switcher, renders `<TipstersClient />` for the
        marketplace tab and `<LeaderboardTable />` for the leaderboard tab.
      - New `app/(app)/marketplace/LeaderboardTable.tsx` (`"use client"`): category chip row reusing the
        `SPORT_FILTERS` array + chip markup from `TipstersClient.tsx`; fetches
        `/api/experts-leaderboard?category=<chip>`; renders the ranked table with columns
        **Rank · Tipster (avatar + display name + @username + verified badge, row is `Link href={`/l/${username}`}`) · Win % · Wins / Settled · Net** (`+N`/`−N`, lime/red). Reuse the rank-medal / row
        styling from `app/(app)/leaderboard/LeaderboardClient.tsx` and the pulse-skeleton loading pattern.
        Empty state: "No ranked predictors in this category yet." Add the clarifying copy/tooltip
        "Net = wins minus settled losses (not coins)" and "category reflects the predictor's declared
        sports" (per design + design-verdict NITs).
      - `app/(app)/marketplace/page.tsx`: render `<ExpertsClient />` instead of `<TipstersClient />`.
        Metadata unchanged.
      Files: `app/(app)/marketplace/ExpertsClient.tsx` (new),
      `app/(app)/marketplace/LeaderboardTable.tsx` (new), `app/(app)/marketplace/page.tsx`.
      Verify: `npx tsc --noEmit && npm run lint && npm run build` pass.

---

## Deliverable (C) — Chat loading skeleton update (step 11)

Depends on step 1 (the post-B `BetslipCardView` layout).

- [ ] 11. Mirror the new no-odds shared-prediction card in the rooms loading skeleton.
      - `components/room/skeletons.tsx` (stays server-safe: no `"use client"`, no hooks, deterministic
        widths, reuse the `PULSE` constant): add a `BetslipCardSkeleton` that mirrors the post-B
        `BetslipCardView` — a `max-w-[320px]` rounded card, a header bar (label pulse + status-pill pulse),
        and a meta row of **two** cells (Hit rate, Entry) — NO Multiplier/odds cell. Update
        `MessageListSkeleton` so a deterministic subset of rows (e.g. every 3rd) renders the
        `BetslipCardSkeleton` under the text lines, keeping SSR/client markup identical.
      - Optional guard test in `__tests__/`: render `BetslipCardSkeleton` and assert it renders **at most
        two** meta cells and **no** Multiplier/odds cell (per design-verdict NIT — guards against a
        Multiplier cell regressing back in).
      Files: `components/room/skeletons.tsx`, optionally a new `__tests__/*` render test.
      Verify: `npx tsc --noEmit && npm run lint && npm run build && npm test` — all pass.

---

## Cross-cutting / final verification

- [ ] 12. Full integration verification from the worktree root:
      `npx tsc --noEmit && npm run lint && npm run build && npm test`. Confirm the whole suite is green,
      no odds/multiplier appears in any user-facing prediction surface, the Experts page shows both the
      marketplace grid and the new leaderboard tab, and the rooms skeleton matches the no-odds card.

## Tests to update vs add (summary)
- UPDATE (odds removal invalidates): `lib/parlays/computations.test.ts` (delete `computePayout`,
  `formatOdds`, and `net_profit_loss` cases); any `__tests__/*` asserting `odds` / `payout` /
  `average_odds` / `Multiplier`.
- ADD (new coverage): `lib/data/expertsLeaderboard.test.ts` (aggregation); optional
  `BetslipCardSkeleton` render guard test.

## Assumptions / gaps (from the design, carried forward)
- "Won how much" is implemented as the odds-free **Net = wins − settled losses** (ranking is win %),
  because coins-from-settlement does not exist in this codebase.
- Per-category bucketing uses `profiles.favourite_sports` (declared interest), consistent with the
  existing marketplace grid; true per-pick sport tagging is a deferred backlog feature (new schema +
  settlement work), surfaced in UI copy.
- `bet_tracker` (private tool, American odds) is explicitly out of scope and left untouched.
