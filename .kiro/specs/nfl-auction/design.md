# NFL Auction — Design

## Module layout (`lib/nfl/`)

Mirrors `lib/arena/`. Generic pieces are re-implemented (small, self-contained)
so the NFL module has zero coupling to the NBA engine and the NBA game can't
break.

```
lib/nfl/
├── rng.ts          seeded RNG (mulberry32) + helpers          [generic]
├── types.ts        NFL positions, slots, PlayerAttributes,     [nfl]
│                   config, auction state, GameResult, drives
├── data/
│   ├── index.ts    registry: getSeasonPlayers / findPlayer     [generic shape]
│   └── players-2025.ts   hand-authored NFL pool (~40)          [nfl data]
├── roster.ts       9-slot eligibility, placement, feasibility  [nfl slots]
├── budget.ts       maxAffordable / validateBidAmount / snapshot [generic]
├── value.ts        offense/defense score, scarcity, opening bid [nfl weights]
├── auction.ts      ArenaState-equivalent + lot lifecycle        [generic loop]
├── teamRating.ts   roster → TeamProfile (off/def units)         [nfl]
├── simulation.ts   drive-based sim → GameResult                 [nfl]
├── analysis.ts     scout report + why-won/lost + matchup notes  [nfl]
├── game.ts         facade: runSimulation, difficultyEdge        [generic]
├── ai.ts           walk-away/personality/difficulty bidder      [nfl weights]
├── store.ts        Redis persistence (nfl:game:) + mutateGame    [generic]
└── server.ts       driveAI / serverTick / serverView / seatFor  [generic]
```

## Positions & roster

```ts
type Position = "QB" | "RB" | "WR" | "TE" | "EDGE" | "LB" | "CB" | "S"
type RosterSlot = "QB" | "RB" | "WR1" | "WR2" | "TE" | "EDGE" | "LB" | "CB" | "S"
```

Slot→eligible-position map: `WR1`/`WR2` → `WR`; all others map 1:1. A player's
`eligibleSlots` derives from its position (a WR fits WR1 or WR2). This replaces
the NBA primary/secondary-position system with an explicit slot mapping, which
is simpler for football's fixed units.

## Player attributes

Position-relevant, 0-99. Not every attribute matters for every position; the
sim reads only the ones that apply to a player's role.

- **Passing (QB):** armStrength, shortAccuracy, deepAccuracy, pocketAwareness,
  mobility, decisionMaking, clutch
- **Rushing (RB, mobile QB):** speed, agility, power, vision, catching
- **Receiving (WR/TE/RB):** catching, routeRunning, separation, speed,
  contestedCatch, yac
- **Blocking (TE):** runBlock, passBlock
- **Pass rush (EDGE/LB):** passRush, power, speed
- **Run defense (EDGE/LB/S):** runStop, tackling, strength
- **Coverage (CB/S/LB):** coverage, ballHawk, speed, agility
- **Universal:** stamina, football IQ (awareness), consistency

Each player stores a partial attribute set over a shared BASE, exactly like the
NBA pool keeps data terse.

## Auction engine

Direct port of arena semantics (the loop is sport-agnostic):
- `NflAuctionState` = { gameId, seed, season, config, status, queue, lot,
  passed, rosters, isAI, history, results, lotDeadline, completedAt, result? }
- `createGame`, `openNextLot`, `placeBid`, `pass`, `minRaise`, `resolveLot`,
  `maybeResolveLot`, `tick`, `finalizeAuction`, `buildAuctionOrder` (stars-last
  for ≤$25), `MAX_LOTS` (~22, enough for two 9-man rosters + competition).
- Budget invariant identical to arena: `maxAffordable = remaining − (openSlots−1)`.

## Team rating (`teamRating.ts`)

Roster → `NflTeamProfile` with **unit ratings** instead of NBA's spacing/usage:

- **Offense:** `passingOffense` (QB × pass-catcher separation/catching × TE
  blocking as protection proxy), `rushingOffense` (RB power/vision/speed),
  `explosiveness` (deep accuracy × WR speed/yac), `passProtection` (TE + QB
  pocket awareness/mobility), `offenseOverall`.
- **Defense:** `passRush` (EDGE/LB), `coverage` (CB/S + LB), `runDefense`
  (EDGE/LB/S), `defenseOverall`.
- **Meta:** `balance` (offense vs defense evenness — lopsided teams get punished
  by exposure), `qbDependence` (how much the team leans on one player),
  `overall` (display/seed only).

## Drive simulation (`simulation.ts`)

Possession-based, seeded. Structure that leaves room for v2 play-calling:

- Game = 4 quarters. Each quarter is a series of **drives**; teams alternate
  possession. A drive is a loop of **plays** starting 1st & 10 at own 25 (or
  post-score/turnover spot).
- **Per play:** pick an offensive tendency and a defensive posture. In v1 both
  are chosen by a weighted model from team profile + game state (down/distance/
  score/clock). In v2 the human supplies the offensive call; the seam is a
  single `resolvePlay(offCall, defCall, ctx, rng)` function.
- **`resolvePlay`** returns yards gained, clock used, and event (completion,
  incompletion, run, sack, turnover, touchdown, field-goal attempt). Matchup:
  offensive tendency strength vs the defensive posture that counters it (e.g.
  DEEP PASS strong vs COVERAGE-light, weak into a disciplined 2-high; BLITZ
  boosts sack/pressure but concedes explosives). Player attributes scale the
  base probabilities; bounded randomness keeps underdogs alive.
- Drive ends on: touchdown, field goal (inside ~38 yd line on 4th & long),
  turnover (INT/fumble), turnover-on-downs, or punt. Scoreboard + clock advance.
- Output: `NflGameResult` with finalScore, quarters, scoringPlays/moments,
  per-player box (passing/rushing/receiving/defense lines), team box (total
  yards, pass/rush yards, turnovers, sacks, 3rd-down %), MVP, topPerformers,
  matchupNotes, teamComparison, scoutReport, whyWon/whyAlmostLost.

Determinism: single seed via `mulberry32`; result computed once inside a mutate
and cached (`ensureResult`), never recomputed on poll — same as arena.

## AI (`ai.ts`)

Reuse the arena bidder framework: `PERSONALITIES`, `difficultyProfile`,
`walkAwayPrice` (lookahead budget planning that reads the true future queue),
`decideAI`. Only `desirability` is reweighted for NFL: value a player by unit
impact + positional need (needs a QB? needs coverage?) + scarcity + star
premium. Same "declines by standing pat, not calling pass()" behavior so lots
get a real "going once… SOLD" beat.

## Persistence & API

- `store.ts`: `nfl:game:<id>` (3h TTL), `mutateGame` with NX/PX Redis lock +
  optimistic `rev`, in-memory dev fallback. Identical strategy to arena.
- `server.ts`: `driveAI`, `serverTick`, `ensureResult`, `serverView`,
  `startSimulation`, `seatForUser`.
- Routes: `POST /api/nfl`, `GET /api/nfl/[gameId]`, `POST /api/nfl/[gameId]/bid`,
  `.../pass`, `.../join`, `.../simulate`. `withSecurity` + `CACHE_CONTROL.SENSITIVE`.

## Testing

`__tests__/nfl/`: budget math, roster eligibility (WR1/WR2, wrong-slot reject),
auction resolution (award to high bidder, queue prune, finalize auto-fill),
`buildAuctionOrder` stars-last, and simulation determinism + stronger-team
win-rate over N seeded runs.
