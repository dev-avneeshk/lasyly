# Verification — Arena practice-match disclosure fix

Iteration: **first** (no `arena-refund-review.json` present).

## What changed (UI/copy only — no economy/settlement/refund logic touched)

- `components/arena/GameSummary.tsx`
  - Added a `friendly?: boolean` prop (documented: derived at the call site from the
    sanctioned `view.econ.mode === "friendly"` projection; the internal `botMatch`
    flag never reaches the component).
  - When `friendly` is true the top verdict renders a neutral **"Practice win"** /
    **"Practice loss"** instead of **"You Win"** / **"You Lose"**, and the win/lose
    lime/danger coloring + win glow is replaced by the neutral border + primary text
    token. The scoreboard, OT badge, MVP, analysis, matchups and box scores are
    unchanged.
  - The competitive stake sub-line is already gated on `stakeOutcome`, which is
    `undefined` for a friendly match, so the "You won N coins" / "You lost your stake"
    block cannot render for a friendly match. The existing `!stakeOutcome && coinNote`
    branch renders `friendlyCoinNote`'s honest "no coins changed hands … stake is
    back" line. No dead code added; this is asserted by tests instead.

- `app/(app)/arena/ServerArena.tsx`
  - Passed `friendly={view.econ?.mode === "friendly"}` into the completed-match
    `<GameSummary … />` call. `coinNote={friendlyCoinNote(view.econ)}` and
    `stakeOutcome` are unchanged. No `botMatch` field is read.

- `lib/arena/clientRequests.ts`, `lib/arena/server.ts`
  - **Unchanged.** `friendlyCoinNote` and the `viewEcon`/`serverView` masking are
    reused verbatim; no parallel helpers introduced, no new field exposed.

- `__tests__/arena/game-summary.test.ts` (new)
  - Node-env `renderToStaticMarkup` test (mirrors `__tests__/rooms/skeletons.test.ts`).
  - friendly WIN → markup contains "Practice win", NOT "You Win", NOT "You won" /
    "winnings"; shows "no coins changed hands" + "stake is back".
  - friendly LOSS → "Practice loss", NOT "You Lose" / "You lost your"; "stake is back".
  - pvp WIN (regression) → still "You Win" + "You won 48 coins" + "winnings".
  - pvp LOSS (regression) → still "You Lose" + "You lost your 25-coin stake".
  - machine-opponent guard on the visible verdict + coin copy (cpu/ai/bot/computer,
    and difficulty words), mirroring the existing client-copy guard.

## Commands run (against the worktree) and results

Dependencies were not installed in the worktree (`node_modules` was empty, so the
`vitest.config.ts` `server-only` alias target `node_modules/next/dist/compiled/server-only/empty.js`
did not exist and `bot-match-view.test.ts` could not import `lib/arena/botMatch.ts`).
Installed them first:

```
$ npm install --no-audit --no-fund
added 621 packages in 47s
```

### Tests (vitest, --run / single-run, never watch)

```
$ npx vitest run __tests__/arena/ __tests__/economy/
 Test Files  36 passed (36)
      Tests  541 passed (541)
```

Includes the required suites, all green:
- `__tests__/arena/bot-match-view.test.ts` — no-leak (`INTERNAL` regex) + friendly econ.
- `__tests__/economy/bot-match-settlement.test.ts` — "nothing is ever paid".
- `__tests__/arena/game-summary.test.ts` — new verdict/no-contradiction cases.
- `__tests__/arena/client-requests.test.ts` — `friendlyCoinNote` + machine-opponent guard.

### Typecheck

```
$ npx tsc --noEmit
app/(marketing)/compare/[slug]/page.tsx(7,23): error TS2307: Cannot find module '@/public/hero-optimized.png' …
app/(marketing)/page.tsx(8,23): error TS2307: Cannot find module '@/public/hero-optimized.png' …
```

Two errors, both pre-existing and unrelated to this change (missing static-image
module declaration in marketing pages; no arena file involved). They do NOT surface
in the webpack build, which resolves image imports — see below.

### Build

```
$ npm run build   # next build --webpack
✓ Compiled successfully in 2.9min
  Running TypeScript ...
  Finished TypeScript in 19.5s ...
  Collecting page data using 7 workers ...
❌ Environment validation failed:
  ✗ NEXT_PUBLIC_SUPABASE_URL: Invalid input
  ✗ NEXT_PUBLIC_SUPABASE_ANON_KEY: Invalid input
```

Compilation and the build's own TypeScript pass both succeeded. The build then fails
at page-data collection because this worktree has no `.env.local` (only `.env.example`)
and `lib/env.ts` throws in production without Supabase env vars. This is an environment
limitation, not a defect introduced by this change — the arena code compiled and
type-checked cleanly.

## Constraints honored

- No economy/settlement/refund logic changed; a friendly match still pays nothing.
- `serverView`/`viewEcon` masking untouched; the `botMatch` field is never exposed and
  the client branches only on the sanctioned `view.econ.mode === "friendly"`.
- Vocabulary is "practice"/"friendly" only; no bot/cpu/ai/difficulty wording introduced.
- `friendlyCoinNote` reused verbatim; no parallel copy helper added.
