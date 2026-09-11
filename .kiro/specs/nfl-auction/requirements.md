# NFL Auction — Drive to Win

## Summary

A 1v1, strategy-heavy game mode: each player gets a **$25 budget**, competes in
a live auction to build a **9-player roster** (5 offense, 4 defense), then the
two teams face off in a **possession-based drive simulation**.

This is a distinct mode from the existing NBA Auction ("arena"). The NBA mode is
a lineup-construction + auto-simulation game. NFL is a **budget + matchup +
(eventually) play-calling** game. They intentionally feel different even though
both are auction + simulation over real athletes.

## Architecture decision

Build a **self-contained `lib/nfl/` module** that mirrors the proven
server-authoritative pattern of `lib/arena/` rather than modifying the working
NBA game. Redis-backed state, seeded determinism, pure reducers, thin API
routes. No new Supabase tables (state lives in Redis, 3h TTL — same as arena).

Player ratings are **hand-authored designer estimates** (0-99), like the NBA
pool — a game-balance model, not scraped stats, with a clear disclaimer.

## Staging

- **v1 (this build):** auction + drive simulation (auto-resolved) + rich
  drive-by-drive result view + scout report + "why you won/almost lost". CPU
  opponent with easy/medium/hard difficulty.
- **v2 (designed-for, not built yet):** interactive down-by-down play-calling
  (RUN / SHORT PASS / DEEP PASS / PLAY ACTION vs RUN STOP / COVERAGE / BLITZ /
  PASS RUSH), coach cards (limited-use tactical modifiers), and 4th-quarter
  clock-management mode. The v1 drive engine is written so these layer on top
  without a rewrite (the play-resolution function is the seam).

## Requirements

### R1 — Roster & budget
- Each player has a **$25 budget** and must fill exactly **9 slots**:
  - Offense: `QB`, `RB`, `WR1`, `WR2`, `TE`
  - Defense: `EDGE`, `LB`, `CB`, `S`
- `WR1` and `WR2` both accept any `WR`; every other slot accepts its position.
- Invariant: a bid may never leave a roster that cannot still be legally
  completed (reserve $1 per remaining slot). Identical to arena's budget rule.

### R2 — Auction
- Live, timed, open-information 1v1 auction. Lots open at a budget-scaled price,
  bids raise by a league increment, a countdown resets on each bid, and the lot
  resolves on timeout or when the non-leader passes.
- Small-budget board puts the biggest stars LAST so "can you still afford a
  stud?" tension survives (same tactic as arena).
- Server is authoritative: the client proposes bids/passes; the server validates
  against the same pure engine.

### R3 — Player cards
- Per-attribute model (not one OVR). Example: a QB exposes arm strength, short
  accuracy, deep accuracy, pocket awareness, mobility, decision making, clutch.
- Attributes feed the simulation, so two equal-OVR players play differently.

### R4 — Drive simulation
- Possession-based: each drive is a sequence of downs; each play resolves an
  offensive tendency vs a defensive posture using the on-field players'
  attributes with bounded, **seeded** randomness (reproducible).
- Produces a full result: final score, quarter scores, scoring drives, per-team
  box, per-player box, MVP, top performers, matchup notes, team comparison, and
  a **scout report** + **why you won / almost lost** narrative.

### R5 — CPU opponent
- Reuses the arena AI framework: walk-away pricing with lookahead budget
  planning, personalities, and easy/medium/hard difficulty (valuation accuracy +
  a small in-game execution edge). NFL-specific desirability weighting.

### R6 — API & limits
- Routes under `/api/nfl/*` mirroring arena: create, get (poll), bid, pass,
  join, simulate. Auth required; `RATE_LIMITS.arenaBid` on bids,
  `RATE_LIMITS.roomCreate` on create. All wrapped in `withSecurity`.

### R7 — Determinism & tests
- Same rosters + seed ⇒ same game. Unit tests cover budget math, roster
  eligibility, auction resolution, and simulation determinism + a stronger-team
  win-rate sanity check.

## Non-goals (v1)
- Real-time push (arena uses HTTP polling; NFL matches that).
- Live interactive play-calling and coach cards (v2).
- Wiring to real NFL data / scrapers (hand-authored pool by design).
