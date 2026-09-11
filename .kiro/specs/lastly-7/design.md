# Design Document: LASTLY 7

## Overview

LASTLY 7 is a daily NBA fantasy game mode. This design specifies the data model, scoring engine, settlement pipeline, API surface, and UI structure needed to deliver the requirements. It is built to reuse existing Lasyly infrastructure rather than introduce parallel systems:

- **NBA data**: reads `nba_games` (schedule) and `nba_player_stats` (per-game box scores) produced by `scripts/scrape_nba.py`, and `nba_players` / `nba_player_team_history` for player identity and team membership.
- **Scoring**: a new pure-function scoring module modeled on `lib/rankings/potw/engine.ts` (`productionPerGame`-style formula, deterministic, no I/O).
- **Settlement**: a new job that mirrors `lib/parlays/settlement.ts` — read stats for the slate date, bind picks to games by date, resolve idempotently, expire stale.
- **Async execution**: the existing Redis job queue (`lib/queue`) with a new handler registered in `lib/queue/handlers.ts`, plus a CRON_SECRET-protected route chained after scraping (like `cron/settle-parlays`).
- **Caching**: `lib/cache.ts` `cached()` with new `CACHE_TTL` presets for slate and leaderboard reads.
- **Auth/RLS**: entries owned by `auth.uid()` with RLS, matching the `parlays` pattern; guests cannot persist entries.

### Key Design Decisions

1. **Post-game authoritative scoring, provisional live scoring.** The live ESPN feed (`matches`) is game-level only. Final Fantasy_Scores come from `nba_player_stats` after box scores land. Live scores are provisional and clearly labeled. This is the same constraint parlay settlement already accepts.
2. **Slate is the unit of idempotency.** A slate is keyed by `slate_date`. Regeneration upserts; scoring is a pure function of final box scores, so re-runs are safe. Mirrors the "version-keyed upsert" pattern used by rankings/POTW.
3. **Scoring engine is pure and separated from I/O.** All formula logic lives in `lib/lastly7/scoring.ts` as pure functions; a loader/settlement layer supplies data and persists results. This makes the formula unit-testable exactly like the POTW engine.
4. **Player identity via `nba_players.id`, not name strings.** Picks reference a stable player id to avoid the fuzzy name-matching fragility seen in parlay settlement. A name fallback exists only for reconciling box-score rows keyed by `player_name`.
5. **Denormalized per-entry breakdown.** Each entry stores its scored breakdown (per-player points, captain flag, differential bonus) so results are auditable and leaderboards read cheaply without recomputation.
6. **Leaderboards are read-computed + cached for provisional, materialized for final.** While a slate is live, leaderboards are computed on read with a short cache TTL. Once final, ranks are materialized (stored) so historical reads are cheap and stable — same philosophy as the POTW upsert.
7. **Ownership computed at entries-close.** Ownership (needed for the Differential bonus) is computed once submissions lock for a slate, then frozen.

---

## Architecture

```mermaid
graph TD
    subgraph "Cron / Workflows"
        SC[scrape-sports.yml: scrape_nba.py] -->|chains| GEN[POST /api/cron/lastly7/generate-slate]
        SC -->|chains after boxscores| SET[POST /api/cron/lastly7/score-slate]
        PJ[process-jobs.yml every 2m] --> Q[/api/jobs/process/]
    end

    subgraph "Jobs (lib/queue + handlers)"
        GEN --> GJ[handleGenerateSlate]
        SET --> SJ[handleScoreSlate]
        Q --> SJ
        GJ --> SCORE[lib/lastly7/slate.ts]
        SJ --> SETTLE[lib/lastly7/settlement.ts]
        SETTLE --> ENG[lib/lastly7/scoring.ts pure fns]
    end

    subgraph "Client (Next.js App Router)"
        UI1[/app/(app)/lastly7 — Today] -->|GET| A1[/api/lastly7/slate/]
        UI2[Lineup builder] -->|POST/PUT| A2[/api/lastly7/entry/]
        UI3[Leaderboards] -->|GET| A3[/api/lastly7/leaderboard/]
        UI4[Leagues] -->|POST/GET| A4[/api/lastly7/leagues/]
    end

    subgraph "API Layer"
        A1 --> C1[cached slate read]
        A2 --> DBW[Supabase insert/update + RLS]
        A3 --> C2[cached leaderboard read]
        A4 --> DBW
    end

    subgraph "Database (Supabase Postgres)"
        SCORE --> T1[(lastly7_slates)]
        SCORE --> T2[(lastly7_slate_players)]
        DBW --> T3[(lastly7_entries)]
        DBW --> T4[(lastly7_entry_players)]
        SETTLE --> T3
        SETTLE --> T2
        SETTLE --> T5[(lastly7_rounds)]
        DBW --> T6[(lastly7_leagues)]
        DBW --> T7[(lastly7_league_members)]
        C1 --> T1
        C2 --> T3
    end

    subgraph "Source Data (existing)"
        NG[(nba_games)] --> SCORE
        NPS[(nba_player_stats)] --> SETTLE
        NP[(nba_players)] --> SCORE
        NPTH[(nba_player_team_history)] --> SCORE
        MATCH[(matches ESPN live)] --> A3
    end
```

---

## Data Model

New tables, all prefixed `lastly7_`. Follows the repo migration style (uuid PK via `uuid_generate_v4()`, `TIMESTAMPTZ` timestamps, RLS enabled, composite unique constraints for idempotent upserts).

### `lastly7_slates`

One row per slate day.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `slate_date` | DATE, UNIQUE | The slate day in slate timezone (US Eastern). Natural key. |
| `status` | TEXT | `open` \| `locked` \| `scoring` \| `final` \| `no_games`. |
| `mode` | TEXT | `any7` \| `salary`. |
| `budget` | INTEGER | Salary cap (null for `any7`). |
| `modifier` | TEXT | Daily_Modifier key (`none`, `shooters`, `bigman`, `underdog`, `rivalry`, `rookie`). |
| `modifier_config` | JSONB | Modifier parameters (multipliers, thresholds). |
| `game_ids` | TEXT[] | `nba_games` identifiers in this slate. |
| `first_tipoff_at` | TIMESTAMPTZ | Earliest game start (for slate-level UI). |
| `entries_close_at` | TIMESTAMPTZ | When ownership is frozen (last tipoff or configured). |
| `differential_threshold` | NUMERIC | Ownership % below which Differential bonus applies. |
| `differential_bonus` | NUMERIC | Fixed bonus points. |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

### `lastly7_slate_players`

The eligible pool for a slate with cost/projection, and (after scoring) the final Fantasy_Score and ownership.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `slate_id` | UUID FK → `lastly7_slates` | ON DELETE CASCADE |
| `player_id` | UUID FK → `nba_players` | |
| `player_name` | TEXT | Denormalized canonical name (for box-score reconciliation). |
| `team` | TEXT | |
| `opponent` | TEXT | |
| `game_id` | TEXT | The `nba_games` id this player plays in. |
| `game_start_at` | TIMESTAMPTZ | Per-player lock time. |
| `position` | TEXT | For modifier logic (e.g., Big Man Night). |
| `cost` | INTEGER | Player_Cost (salary mode). |
| `projected_score` | NUMERIC | Projection shown pre-lock. |
| `fantasy_score` | NUMERIC | Final score; null until scored. |
| `is_final` | BOOLEAN | Player's game final and box score ingested. |
| `ownership_pct` | NUMERIC | Frozen at entries-close. |

Unique: `(slate_id, player_id)`.

### `lastly7_entries`

One entry per user per slate.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `slate_id` | UUID FK → `lastly7_slates` | ON DELETE CASCADE |
| `user_id` | UUID FK → `auth.users` | RLS owner. |
| `status` | TEXT | `draft` \| `submitted` \| `locked` \| `provisional` \| `final`. |
| `mode` | TEXT | Copied from slate at submit. |
| `total_score` | NUMERIC | Entry_Score (provisional then final). |
| `differential_bonus_applied` | NUMERIC | 0 or the bonus. |
| `is_final` | BOOLEAN | All member games final. |
| `submitted_at` / `locked_at` / `scored_at` | TIMESTAMPTZ | |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

Unique: `(slate_id, user_id)` — enforces one entry per slate; resubmission updates in place.

### `lastly7_entry_players`

The 7 members of an entry with role flags and per-player scored breakdown.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `entry_id` | UUID FK → `lastly7_entries` | ON DELETE CASCADE |
| `slate_player_id` | UUID FK → `lastly7_slate_players` | |
| `player_id` | UUID FK → `nba_players` | |
| `is_captain` | BOOLEAN | Exactly one true per entry. |
| `is_differential` | BOOLEAN | Exactly one true per entry. |
| `locked` | BOOLEAN | Player's game started. |
| `fantasy_score` | NUMERIC | Copied from slate player at scoring. |
| `contribution` | NUMERIC | Score after captain multiplier. |

Unique: `(entry_id, player_id)`. Partial unique indexes enforce one captain and one differential per entry.

### `lastly7_rounds`

Weekly (and monthly/season) aggregates, materialized as underlying dailies finalize.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → `auth.users` | |
| `round_key` | TEXT | e.g., `2026-W37` (ISO week). |
| `season_key` | TEXT | e.g., `2026-09`. |
| `round_score` | NUMERIC | Best 6 of 7 daily Entry_Scores. |
| `counted_days` | JSONB | Which slate dates counted. |
| `tier` | TEXT | `elite` \| `allstar` \| `starter` \| null. |
| `updated_at` | TIMESTAMPTZ | |

Unique: `(user_id, round_key)`.

### `lastly7_leagues` / `lastly7_league_members`

| `lastly7_leagues` | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `name` | TEXT | |
| `invite_code` | TEXT UNIQUE | Short shareable code. |
| `owner_id` | UUID FK → `auth.users` | |
| `created_at` | TIMESTAMPTZ | |

| `lastly7_league_members` | Type | Notes |
|---|---|---|
| `league_id` | UUID FK → `lastly7_leagues` | ON DELETE CASCADE |
| `user_id` | UUID FK → `auth.users` | |
| `joined_at` | TIMESTAMPTZ | |

Unique: `(league_id, user_id)`.

### RLS summary

- `lastly7_slates`, `lastly7_slate_players`: public SELECT (read-only game data), writes via service role only (jobs).
- `lastly7_entries`, `lastly7_entry_players`: SELECT/INSERT/UPDATE where `user_id = auth.uid()`. Leaderboards read aggregate/limited fields via a `SECURITY DEFINER` RPC or service-role API route so other users' full entries aren't exposed before lock.
- `lastly7_rounds`: SELECT own row; leaderboard reads via API.
- `lastly7_leagues`: SELECT if member; `lastly7_league_members`: SELECT if member of the same league; INSERT self on join.

---

## Scoring Engine (`lib/lastly7/scoring.ts`)

Pure functions, no I/O — the template is `lib/rankings/potw/engine.ts`.

```ts
export interface BoxLine {
  pts: number; trb: number; ast: number; stl: number; blk: number
  tp: number; tov: number   // tp = 3PM
  played: boolean
}

export interface ModifierConfig {
  key: "none" | "shooters" | "bigman" | "underdog" | "rivalry" | "rookie"
  // e.g. shooters: { tpMultiplier: 2 }, bigman: { rebBonus, blkBonus }, ...
  params?: Record<string, number>
}

/** Base: PTS + REB + AST + 2*STL + 2*BLK + 1*3PM - 1*TO */
export function baseScore(b: BoxLine): number

/** Bonuses: DD +5, TD +10, 40+pts +5, 20+reb +5 (game-winner omitted unless derivable) */
export function statBonuses(b: BoxLine): number

/** Applies the active daily modifier to a player line. */
export function applyModifier(b: BoxLine, mod: ModifierConfig, ctx: PlayerContext): number

/** Full player Fantasy_Score, rounded to 1 decimal. 0 if !played. */
export function fantasyScore(b: BoxLine, mod: ModifierConfig, ctx: PlayerContext): number

/** Entry total: sum of members, captain 2x, + differential bonus if ownership < threshold. */
export function entryScore(members: ScoredMember[], opts: {
  captainId: string; differentialId: string
  ownership: Record<string, number>; threshold: number; bonus: number
}): { total: number; differentialBonusApplied: number; breakdown: ScoredMember[] }
```

Double-double / triple-double are computed by counting how many of {pts≥10, trb≥10, ast≥10, stl≥10, blk≥10} are met (≥2 → DD, ≥3 → TD). This is standard and fully derivable from `nba_player_stats`.

**Cost & projection** (`lib/lastly7/pricing.ts`): a player's `cost` and `projected_score` are derived from recent games in `nba_player_stats` (e.g., rolling average of `fantasyScore` over last N games), mapped to an integer dollar band. This reuses the "recent stats" access already present in the scraper's `get_player_recent_stats` logic, ported to TS or read directly.

---

## Settlement Pipeline (`lib/lastly7/settlement.ts`)

Mirrors `settleParlayLegs()`.

```
scoreSlate(slateDate):
  1. Load slate + slate_players. If final, skip (idempotent).
  2. Determine each game's status from nba_games (completed?) and matches (live?).
  3. For each slate_player, find their box score row in nba_player_stats
     bound by game date (YYYYMMDD prefix) and team, keyed by player_id→player_name.
     - If game final + box score present: fantasy_score = fantasyScore(...); is_final = true.
     - If game live / not yet ingested: provisional (0 or partial); is_final = false.
     - If player DNP (final game, no row): fantasy_score = 0; is_final = true.
  4. If entries not yet closed and now >= entries_close_at: freeze ownership_pct.
  5. For each entry: recompute total_score via entryScore(); write entry_players breakdown.
     - Mark entry final only when all member games are final.
  6. If slate has games still live: set status='scoring' (provisional), reschedule.
  7. If all games final: set status='final', materialize daily ranks.
  8. Staleness: if a completed game's box score never arrives within N hours,
     finalize affected players at 0 (analogous to expireStaleParlays).
  9. On any final entry change, enqueue/refresh the affected round aggregate.
```

Round aggregation (`lib/lastly7/rounds.ts`): for each user with a finalized daily in the round, recompute best-6-of-7, assign tier by percentile, upsert `lastly7_rounds`. Season/playoffs computed from rounds.

Registered as `JOB_TYPES.LASTLY7_SCORE_SLATE` in `lib/queue/handlers.ts`; the generate job as `JOB_TYPES.LASTLY7_GENERATE_SLATE`.

---

## API Surface (App Router route handlers)

Under `app/api/lastly7/`. Public reads wrapped in `withSecurity(...)` + `cached(...)`; writes require auth; cron under `app/api/cron/lastly7/` with CRON_SECRET.

| Route | Method | Purpose |
|---|---|---|
| `/api/lastly7/slate` | GET | Current (or `?date=`) slate: games, eligible players, costs, projections, modifier. Cached. |
| `/api/lastly7/entry` | GET | The requesting user's entry for a slate. |
| `/api/lastly7/entry` | POST/PUT | Create/replace entry (validates 7 players, captain, differential, budget, not locked). |
| `/api/lastly7/leaderboard` | GET | `?scope=daily\|round\|season&date=&filter=global\|friends\|league:<id>\|region:<code>&cursor=`. Cached. |
| `/api/lastly7/me/rank` | GET | Requesting user's rank + total entries for a scope. |
| `/api/lastly7/leagues` | POST | Create Private_League (returns invite code). |
| `/api/lastly7/leagues/join` | POST | Join by invite code. |
| `/api/lastly7/leagues/:id/leaderboard` | GET | League-scoped leaderboard (members only). |
| `/api/lastly7/preview` | GET | Tomorrow's slate teaser (game count + limited notable players). |
| `/api/cron/lastly7/generate-slate` | POST | CRON_SECRET; generate/upsert slate for a date. |
| `/api/cron/lastly7/score-slate` | POST | CRON_SECRET; run settlement for a date (provisional or final). |

### Entry validation (server-side, authoritative)

Even though the client disables invalid submits, the POST/PUT handler re-validates: exactly 7 distinct players in the slate, exactly one captain, exactly one differential, budget satisfied in salary mode, and no player past its `game_start_at`. This prevents tampering.

---

## Cron & Workflow Integration

Reuse `.github/workflows/scrape-sports.yml` chaining pattern (like `scrape-nfl.yml` chaining `settle-parlays`):

1. After the daily schedule scrape → `curl -X POST .../api/cron/lastly7/generate-slate` (generates tomorrow's / today's slate).
2. After box-score scrape → `curl -X POST .../api/cron/lastly7/score-slate?date=today`.
3. `process-jobs.yml` (every 2 min) drains any queued `lastly7-score-slate` jobs so provisional scores refresh during games without a dedicated workflow.

New `CACHE_TTL` presets in `lib/cache.ts`:

```ts
lastly7Slate: 30_000,        // open slate read model
lastly7Live: 10_000,         // provisional leaderboard (matches scores cadence)
lastly7Leaderboard: 300_000, // final leaderboards
```

---

## UI Structure

Under `app/(app)/lastly7/`, dark theme + lime accent consistent with existing pages.

- **Today (`page.tsx`)**: slate header (N games, M eligible, countdown to first lock, active modifier), player browser (cards: name, team, cost, projection, recent form, matchup), and the lineup rail (`0/7`, captain/differential pickers, projected Entry_Score, budget meter in salary mode, Lock button).
- **Player card**: reuses styling from the analysis player views; shows cost, projection, opponent, recent-form indicator.
- **Locked / Live view**: per-player provisional score with a "LIVE"/"FINAL" badge, entry total, live rank; polls `/api/lastly7/leaderboard?scope=daily` on the 10s cadence with tab-hidden pause (reuse the `ScoresPanel` visibility pattern).
- **Leaderboards**: tabbed Daily / Round / Season; filter chips Global / Friends / League / Region; shows "You: #X / N".
- **Leagues**: create/join, member leaderboard.
- **Preview**: "Tomorrow — K games" teaser card after final.

---

## Testing Strategy

- **Scoring engine (`lib/lastly7/scoring.ts`)**: pure-function unit tests mirroring `__tests__/rankings/potw`. Cover base formula, each bonus (DD/TD/40pts/20reb), each modifier, DNP→0, captain 2x, differential bonus on/off at the threshold boundary, rounding.
- **Settlement (`lib/lastly7/settlement.ts`)**: unit tests mirroring `__tests__/parlays/settlement.test.ts` — provisional vs final transitions, idempotent re-runs, date-binding to the correct game, DNP handling, stale finalization.
- **Rounds**: best-6-of-7 selection including <7 days played; tier percentile boundaries.
- **API**: entry validation (wrong count, missing captain/differential, over budget, locked player rejected, unauthenticated redirect, one-entry-per-slate replacement); leaderboard filters and self-rank.
- **RLS**: a user cannot read/modify another user's entry; league leaderboard visible only to members.

Coverage target consistent with repo testing standards.

---

## Open Questions / Config Defaults

- **Slate mode per day**: default `any7`; `salary` can be enabled per-slate via config. Confirm whether both run simultaneously (two leaderboards) or one mode per day.
- **Budget & cost band**: default budget `$35`, costs `$4–$10` integer band. Tunable in slate config.
- **Differential threshold / bonus**: default `< 5%` ownership → `+10`. Tunable.
- **Playoff bracket size**: default top 128 single-elimination. Confirm.
- **Region source**: uses profile country if present; otherwise Region filter is hidden.
