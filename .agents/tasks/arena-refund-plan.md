# Implementation Plan — Arena practice-match disclosure fix

Audit verdict: **A** (presentation/disclosure bug, not an economy hole). The ledger
signature −25 / +25 / no-winnings is the *designed* result of a converted bot/practice
match: the owner's stake is charged at matchmake and refunded at conversion, settlement
pays nothing. The bug the user hit ("I won but the coins were refunded") is a **UI
contradiction**: `GameSummary` renders a competitive **"You Win"** verdict for a match
whose coin line says **"no coins changed hands … stake is back."** The fix reframes the
verdict and copy for a friendly match so a practice win no longer reads as a cheated win,
and a practice loss no longer reads as a lost stake.

## Design decisions (made here, grounded in the code I read)

1. **Signal "friendly" to `GameSummary` through a new boolean prop, derived at the call
   site from the already-sanctioned view projection** — not a new raw flag. `ServerArena`
   already computes `coinNote={friendlyCoinNote(view.econ)}` and `stakeOutcome` from
   `view.econ`. `view.econ.mode === "friendly"` is the exact, server-masked signal that a
   match paid nothing (see `viewEcon` in `lib/arena/server.ts`, which maps a `botMatch` to
   `{ mode: "friendly", … }` and *only* that). We pass `friendly={view.econ?.mode === "friendly"}`
   into `GameSummary`. This reuses the existing projection and never introduces or leaks the
   internal `botMatch` field — `serverView` keeps masking `isAI → {false,false}` and emitting
   `shownConfig`, untouched. (Chosen over threading a second data path or widening the view;
   the `friendly` mode already carries exactly this fact.)

2. **For a friendly match, replace the win/lose verdict with a neutral "practice" verdict**
   that states the stake was returned, instead of "You Win"/"You Lose". The scoreboard,
   box score, analysis, MVP and matchups stay (they're the fun of a practice game); only the
   top verdict word, its win/lose coloring, and the stake sub-line change. Copy is sentence
   case / lowercase-leaning to match the codebase's existing friendly copy
   ("Friendly match: no coins changed hands…"). (Chosen over hiding the result entirely —
   the user still played a full auction and wants to see how it went.)

3. **Reuse `friendlyCoinNote` verbatim** for the coin line (it already yields
   "Friendly match: no coins changed hands. Your N-coin stake is back/being returned…",
   or "Friendly match." on terminal refund failure). We do **not** invent a parallel copy
   helper. The only new copy is the short verdict word shown in place of "You Win"/"You Lose"
   for a friendly match.

4. **Vocabulary**: use "practice"/"friendly" only. No `bot`/`cpu`/`ai`/`computer`/difficulty
   text — this matches the backlog disclosure line ("matchmaking may use practice opponents
   when few players are online; no coins change hands") recorded in
   `.agents/tasks/arena-bot-fallback-2026-10-13/report.md`, and is enforced by the existing
   `client copy never names a machine opponent` test.

## Hard constraints carried into every item

- Do **not** change any economy/settlement/refund logic (`lib/arena/settle.ts`,
  `lib/economy/*`, the RPCs). This is UI/copy only.
- Do **not** make a friendly/bot match pay winnings.
- Do **not** leak the internal `botMatch` field; keep `serverView`/`viewEcon` masking intact.
- Do **not** reveal `bot`/`CPU`/`AI`/difficulty wording anywhere.

## Build / test commands (from `package.json` — vitest, always `--run`, never watch)

- Typecheck: `npx tsc --noEmit`
- Focused tests: `npx vitest run <path>` (the repo's `test` script is `vitest run`; never
  `vitest`/`test:watch`). Env is **node**, not jsdom — component tests render with
  `renderToStaticMarkup` from `react-dom/server`, per `__tests__/rooms/skeletons.test.ts`.
- Full build (final gate only): `npm run build` (`next build --webpack`; this is Next 16,
  a non-standard setup — if a framework convention surfaces, read
  `node_modules/next/dist/docs/` first).

---

# Implementation Plan

- [ ] 1. Add a `friendly` prop to `GameSummary` and branch the verdict + stake sub-line on it.
      Add `friendly?: boolean` to the `GameSummary` props. When `friendly` is true: (a) render a
      neutral verdict instead of "You Win"/"You Lose" — show `humanWon ? "Practice win" : "Practice loss"`
      (sentence case) and drop the win/lose green/red coloring in favor of the muted/neutral token
      used elsewhere (e.g. `text-[var(--color-text-primary)]` with the lime border reserved for real
      wins), so a practice win is clearly not a coin win; (b) suppress the competitive stake sub-line
      entirely — a friendly match has no `stakeOutcome` (it's only set for `mode: "pvp"`), so the
      existing `!stakeOutcome && coinNote` branch already renders `friendlyCoinNote`'s "stake is back"
      line; just make sure the "You won N coins"/"You lost your stake" block cannot show for a friendly
      match (it already can't, since `stakeOutcome` is undefined — assert this with a test rather than
      adding dead code). Keep scoreboard, OT badge, MVP, analysis, matchups, box scores unchanged.
      Keep all copy sentence case / lowercase-leaning to match existing friendly copy.
      Files: /Users/ayushkumar/development/betroom/.worktrees/arena-bot-refund-disclosure/components/arena/GameSummary.tsx
      Verify: `npx tsc --noEmit` passes (prop type threads through); the component test added in item 3 passes.

- [ ] 2. Pass `friendly` from `ServerArena` using the existing sanctioned projection.
      In the `view.status === "complete"` render branch, add
      `friendly={view.econ?.mode === "friendly"}` to the `<GameSummary … />` call. Leave
      `coinNote={friendlyCoinNote(view.econ)}` and `stakeOutcome={stakeOutcome}` exactly as they are
      (`stakeOutcome` is already `undefined` for friendly matches). Do not read or reference any
      `botMatch` field — only `view.econ`, which is the masked projection.
      Files: /Users/ayushkumar/development/betroom/.worktrees/arena-bot-refund-disclosure/app/(app)/arena/ServerArena.tsx
      Verify: `npx tsc --noEmit` passes. `npx vitest run __tests__/arena/bot-match-view.test.ts` still
      passes — confirms `serverView`'s no-leak assertion (`INTERNAL` regex) and the `friendly` econ
      projection are untouched.

- [ ] 3. Add a focused component test for the friendly verdict and the no-contradiction rule.
      New file `__tests__/arena/game-summary.test.ts` following the `renderToStaticMarkup` pattern in
      `__tests__/rooms/skeletons.test.ts` (node env, no jsdom). Build a minimal `GameResult` fixture
      (reuse the shape from `lib/arena/types.ts`; a small helper that fills `winner`, `finalScore`,
      `quarters`, `teamComparison`, `analysis`, `matchupNotes`, `mvp`, box-score fields). Cover:
      (a) `friendly` + human wins → markup contains "Practice win", does NOT contain "You Win",
      and does NOT contain any "You won" / "coins" winnings phrasing;
      (b) `friendly` + human loses → contains "Practice loss", does NOT contain "You Lose" or
      "You lost your"/"stake" loss phrasing, and the `coinNote` "stake is back" line is present when
      passed;
      (c) non-friendly (pvp) + win with a `stakeOutcome` → still renders "You Win" and the
      "You won N coins" line (guards against regressing real matches);
      (d) the rendered friendly markup matches neither `/\b(cpu|ai|bot|computer)\b/i` nor any
      difficulty word — mirrors the existing "never names a machine opponent" guard.
      Files: /Users/ayushkumar/development/betroom/.worktrees/arena-bot-refund-disclosure/__tests__/arena/game-summary.test.ts
      Verify: `npx vitest run __tests__/arena/game-summary.test.ts` — all new cases pass.

- [ ] 4. Keep the pure-copy helper coverage green (no helper changes expected).
      `friendlyCoinNote`, `coinChipText`, `matchedLine` in `lib/arena/clientRequests.ts` are reused
      as-is; do not modify them. Re-run their suite to confirm the plan didn't drift the copy.
      Files: (none modified) — verification only against
      /Users/ayushkumar/development/betroom/.worktrees/arena-bot-refund-disclosure/__tests__/arena/client-requests.test.ts
      Verify: `npx vitest run __tests__/arena/client-requests.test.ts` — the `friendlyCoinNote (D-21 copy)`
      and `client copy never names a machine opponent` describes still pass.

- [ ] 5. Full arena/economy regression and build gate.
      Confirm nothing in the economy/settlement path moved and the app still builds.
      Files: (none modified) — verification only.
      Verify: `npx vitest run __tests__/arena/ __tests__/economy/` all pass (notably
      `bot-match-view.test.ts` no-leak + friendly econ, and `bot-match-settlement.test.ts` "nothing is
      ever paid"); then `npx tsc --noEmit` clean; then `npm run build` succeeds.

## Notes / assumptions

- The exact verdict words "Practice win" / "Practice loss" are a reasonable, neutral choice
  consistent with the "practice"/"friendly" vocabulary in the backlog line and report. If a
  product owner prefers different wording (e.g. "Practice match — stake returned"), it's a
  one-line change in item 1; the structure (friendly branch, reuse of `friendlyCoinNote`) is
  unaffected.
- No server/economy files change. `serverView`/`viewEcon` masking and the `botMatch` secrecy
  are preserved precisely because the client branches on `view.econ.mode === "friendly"`, the
  value that masking already produces.
- The report at `.agents/tasks/arena-bot-fallback-2026-10-13/report.md` lives in the main
  workspace (not mirrored into this worktree); its naming guidance ("practice"/"friendly",
  no cpu/ai/bot/difficulty) is applied above.
