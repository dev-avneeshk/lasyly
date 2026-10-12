# Design Review: Experts Category Leaderboard + Odds/Multiplier Removal + Chat Skeleton

Reviewer: design-review subagent (fresh context, spot-checked against real source)
Design doc: `.agents/tasks/experts-leaderboard/design.md`
Worktree: `/Users/ayushkumar/development/betroom/.worktrees/experts-leaderboard`

## Verdict: APPROVED

Zero HIGH and zero MEDIUM findings. All hard-block gates pass against the real code. Findings below are NITs only; they do not block implementation.

---

## Hard-block gate results

1. **`category` has a real, stated source — PASS.** The design does not hand-wave. It names `profiles.favourite_sports` (a declared-interest array) as the per-category bucket, explicitly states betslips carry no per-pick sport, defaults to an "All" overall board, and flags true per-pick tagging as out-of-scope backlog. Verified: `app/api/tipsters/route.ts` already filters by `favourite_sports` with the same case-insensitive `.some()` logic, and `TipstersClient.tsx:28` `SPORT_FILTERS` is exactly the array the design claims (`All, Football, Basketball, Tennis, Cricket, NFL, Formula 1, Esports, MMA, Boxing, Golf`). The vocabulary is self-consistent (chips ↔ `favourite_sports`), not conflated with parlay-leg sports (`NBA/Tennis/Soccer/NFL/NHL`).

2. **"net coins won" correctly identified as having NO ledger — PASS.** Verified `lib/economy/wallet.ts` is the Arena mini-game economy only (`start_arena_stake`, keyed on `game_id`), with nothing crediting betslip/parlay wins. Verified `app/api/betslips/[betslipId]/status/route.ts:75` computes `payout = Math.round(stake * odds * 100)/100` purely from the user-set multiplier and never writes a wallet. The design refuses to invent a coins figure and redefines the metric to an odds-free **win % (primary)** + **net record (wins − losses)**, matching the user's stated reason for the change ("people can manually set any multiplier"). This is the honest reading.

3. **Odds/multiplier removal enumerated with file:line + safe order; DB column KEPT — PASS.** The design keeps `betslips.odds`, `betslips.payout`, and `parlays.odds` (verified nullable in `20250526_create_parlays.sql`; `payout` grant confirmed in `20261002_lock_down_profile_betslip_member_writes.sql:76`). No drop migration. Removal order is bottom-up (display → input → response shapes → ranking libs → create/validate/grade → delete leaf functions), with a build gate between phases. Spot-checked call sites are accurate: `lib/data/leaderboard.ts` imports `decimalOdds` (line 9) and emits `average_odds`; `MessageRow.tsx` `BetslipCardView` renders a `Multiplier` cell `${bet.odds}x`; `createBetslipSchema.odds` is `z.number().gt(0).lte(100000)` at `app/api/betslips/route.ts:12`; `computeParlayStats.net_profit_loss` uses `decimalOdds`; `bets/page.tsx` renders `stats.net_profit_loss` as `±N.Nu`.

4. **Redis cache-aside key/TTL/fallback follows repo convention — PASS.** Verified against `lib/cache.ts`: `cached(key, fetcher, ttlMs)` is the real signature, it is cache-aside with Redis → in-memory fallback (no extra fallback code needed), and `CACHE_TTL.explore = 60_000` already exists. Key `experts-leaderboard:${category}` (enum-guarded so only known chips mint keys) and adding `expertsLeaderboard: 60_000` to `CACHE_TTL` are consistent with existing usage (`tipsters:${sort}:${sport}`). The 60s TTL honors the brief's ~60s ask without reusing the 5-min `tipsters` preset.

5. **No migration — justified — PASS.** (A) reads existing columns; `idx_betslips_user` on `betslips(user_id)` is confirmed present (`20260914_hot_path_indexes.sql:105-106`) and covers the `.in("user_id", ...)` aggregation. (B) keeps all columns (no DDL). (C) is UI-only. The design offers an optional covering index only if measured slow, and declines to add it now.

6. **Next.js v16 docs heeded — PASS.** The referenced upgrade guide exists at `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`. The design correctly notes async request APIs (`await context.params`, matching the real `status/route.ts`), `middleware`→`proxy` rename (repo ships `proxy.ts`, untouched), and that the custom Redis cache — not Next's `fetch`/`revalidateTag` cache — is used, so v16 caching-API churn does not apply. New routes follow the existing `withSecurity(...)` + `Request` shape.

---

## Findings

1. **NIT — Chat skeleton assumes exactly two meta cells, but the real post-B card renders 0–2.**
   Location: Deliverable (C), `BetslipCardSkeleton` spec ("a meta row of two cells (Hit rate, Entry)").
   In `components/room/MessageRow.tsx` `BetslipCardView`, both `combined_hit_rate` and `stake` are rendered conditionally (`!= null`), so after the Multiplier cell is removed the card can show zero, one, or two cells. A fixed two-cell skeleton is a reasonable approximation (skeletons model the common case), but the design's testability note asserts the skeleton renders "exactly two meta cells" as a regression guard — that guard is really protecting against a *Multiplier* cell returning, not asserting the loaded card always has two.
   Concrete fix: reword the deliverable-C test assertion to "renders at most two meta cells and no Multiplier/odds cell," or state explicitly that the skeleton models the both-fields-present case by design. Keep the two-cell visual.

2. **NIT — "Wins / Settled" column vs. the brief's "who won how much" wording.**
   Location: Deliverable (A), UI table columns.
   The chosen columns (Win %, Wins/Settled, Net record) are the correct odds-free interpretation and the design justifies this well. Since the original request literally said "who won how much," add one line of in-UI copy or a tooltip clarifying that "Net" is wins minus settled losses (not coins), so the user is not surprised the board shows no currency figure. The design already plans category copy ("category reflects the predictor's declared sports"); mirror that for the Net column.

3. **NIT — Confirm no existing caller breaks when `createBetslipSchema.odds` becomes optional.**
   Location: Deliverable (B), step 5, `app/api/betslips/route.ts`.
   Making `odds` optional/nullable and dropping it from the insert is correct, and `status/route.ts` stops computing `payout` so the `stake * odds` NaN risk is removed. This is internally consistent. As a cheap guard, the implementer should grep for any other producer that still POSTs `odds` as required and any consumer that reads `betslip.odds` as non-null after the response-shape edits in step 3 — the enumeration looks complete, but a repo-wide `\.odds\b` grep at the end of step 6 (TypeScript will confirm zero references to the deleted leaf functions) is the stated safety net; keep it.

---

## Verified assumptions (checked against source)

- `app/api/tipsters/route.ts` aggregates `betslips` by `user_id`, uses title-case `"Won"`/`"Lost"` status, win rate over graded slips only, and filters by `favourite_sports` — the new board mirrors this exactly. ✔
- `lib/cache.ts` `cached()` signature, cache-aside + Redis→memory fallback, and `CACHE_TTL.explore = 60_000` are real. ✔
- `app/api/betslips/[betslipId]/status/route.ts:75` payout = `stake * odds`, select includes `odds` at the fetch, single-grade guard (`.eq("status","Pending")` + `handleConflict`) present. ✔
- `createBetslipSchema.odds = z.number().gt(0).lte(100000)` at line 12; insert and echo-select include `odds`. ✔
- `lib/data/leaderboard.ts` imports `decimalOdds`, carries `average_odds` in `LeaderboardEntry` and output, `totalOdds += decimalOdds(...)`. ✔
- `lib/parlays/computations.ts` has `computePayout`, `decimalOdds`, `formatOdds`, and `computeParlayStats.net_profit_loss` built on `decimalOdds`; streak/sport/leg-count functions are odds-independent. ✔
- `app/(app)/bets/page.tsx` renders `stats.net_profit_loss` as a `±N.Nu` figure. ✔
- `lib/parlays/validation.ts` has `MIN_ODDS/MAX_ODDS` constants and an optional-odds validation branch; `VALID_SPORTS = NBA/Tennis/Soccer/NFL/NHL`. ✔
- `app/api/parlays/route.ts` insert already uses `odds: payload.odds ?? null` (null-tolerant). ✔
- `components/room/MessageRow.tsx` `BetslipCardView` renders Multiplier/Hit rate/Entry cells (conditional). ✔
- `components/room/skeletons.tsx` is server-safe (no `"use client"`/hooks), deterministic `MESSAGE_WIDTHS`, `PULSE` includes `motion-reduce:animate-none`, and has no existing odds placeholder — matching the design's "reality check." ✔
- `idx_betslips_user` on `betslips(user_id)` exists (`20260914_hot_path_indexes.sql:105-106`). ✔
- `lib/economy/wallet.ts` is Arena-economy-only (game_id keyed) — no betslip/parlay coin settlement exists. ✔
- Next.js v16 upgrade doc present at the cited path; `proxy.ts` rename and async `context.params` are real repo conventions. ✔
- `TipstersClient.tsx:28` `SPORT_FILTERS` matches the design verbatim. ✔

## Unverified / wrong assumptions

- **`betslips` table columns are not verifiable from repo source.** The table was created in the Supabase dashboard, not in a repo migration (confirmed by comments in `20260914_hot_path_indexes.sql` and `20260916_indexes_no_concurrent.sql` noting `betslips` "is not defined anywhere in this repo"). The design's claim that `betslips` has no `sport`/`category` column therefore rests on the absence of any code reading such a column (verified: no reference found) plus the dashboard-created reality — it cannot be confirmed from a `CREATE TABLE`. This does not change the design (it correctly uses no `sport` on betslips), so it is recorded here, not raised as a finding.
- No other design claim was found to be wrong.
