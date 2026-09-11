# NFL Auction — Tasks

## v1 (this build)

- [ ] 1. `lib/nfl/rng.ts` + `lib/nfl/types.ts` — positions, slots, attributes, config, result/drive types
- [ ] 2. `lib/nfl/data/players-2025.ts` + `data/index.ts` — hand-authored pool (~40) + registry
- [ ] 3. `lib/nfl/roster.ts` + `lib/nfl/budget.ts` — 9-slot eligibility + budget invariants
- [ ] 4. `lib/nfl/value.ts` + `lib/nfl/auction.ts` — value/scarcity/opening bid + auction engine
- [ ] 5. `lib/nfl/teamRating.ts` — offense/defense unit profile
- [ ] 6. `lib/nfl/simulation.ts` + `analysis.ts` + `game.ts` — drive sim + scout report + facade
- [ ] 7. `lib/nfl/ai.ts` — CPU bidder (NFL desirability)
- [ ] 8. `lib/nfl/store.ts` + `lib/nfl/server.ts` — Redis persistence + orchestration
- [ ] 9. `app/api/nfl/*` — create, get, bid, pass, join, simulate
- [ ] 10. `__tests__/nfl/` — budget, roster, auction, determinism, win-rate sanity
- [ ] 11. Verify: tsc, eslint, tests, build

## v2 (next)

- [ ] Interactive down-by-down play-calling (offense call + defense counter) via the `resolvePlay` seam
- [ ] Coach cards (No-Huddle, Stack the Box, All-Out Blitz, Attack the Matchup, Prevent) — limited uses
- [ ] 4th-quarter clock-management mode (run clock vs attack)
- [ ] Frontend: `app/(app)/nfl/` pages + `components/nfl/` (PlayerCard, DriveBoard, PlayCaller, GameSummary)
- [ ] Human-vs-human seat P2 (join-by-link), reusing arena's join pattern
