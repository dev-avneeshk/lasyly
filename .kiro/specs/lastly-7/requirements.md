# Requirements Document

## Introduction

LASTLY 7 is a daily NBA fantasy game mode for Lasyly. Each day, the system builds a slate from the NBA games scheduled that day. Only players whose teams play that day are eligible. A user picks exactly 7 players, designates one as Captain (2x points) and one as Differential (bonus if low-owned), optionally staying under a salary cap in the strategic mode, then locks their entry. After the real games complete, each player earns fantasy points from their box score using the LASTLY scoring formula plus stat bonuses and the day's modifier. Entries are scored, ranked on a daily leaderboard, aggregated into weekly rounds (best 6 of 7 days), then monthly seasons with a playoff bracket.

The mode reuses existing Lasyly infrastructure: NBA game/schedule data (`nba_games`), per-game player box scores (`nba_player_stats`), the canonical player identity table (`nba_players`), the Player-of-the-Week style windowed scoring engine, the parlay settlement pattern, the Redis-backed job queue, cache-aside caching, and Supabase auth with `auth.uid()` RLS.

## Key Constraints (from existing infrastructure)

- **No true real-time per-player stats.** The live ESPN feed (`matches` table) is game-level only (scores/clock/status). Per-player box scores land only after `scrape_nba.py` processes a completed game. Therefore "live scoring" is refresh-based and approximate, not play-by-play. Final scores are authoritative and computed from `nba_player_stats` after box scores land.
- **Guests cannot own persisted entries.** The guest cookie carries only an "is a guest" bit with no identity. A LASTLY 7 entry requires an authenticated `auth.uid()`.
- **Scoring is post-game and idempotent**, mirroring parlay settlement: read `nba_player_stats` for the slate date, bind picks to games via the game date, compute scores, resolve entries once all their games are final.

## Glossary

- **Slate**: The set of NBA games scheduled on a given calendar day (in a fixed slate timezone, US Eastern) and the pool of eligible players derived from those games.
- **Eligible_Player**: A player whose team appears in a slate game and who is expected to be available. Eligibility is derived from `nba_players` / `nba_player_team_history` joined against the slate's `nba_games`.
- **Entry**: A user's submission for a slate: exactly 7 players, one Captain, one Differential, and (in salary mode) a total cost within the budget.
- **Captain**: One of the 7 picked players whose fantasy score is multiplied by 2 in the entry total.
- **Differential**: One of the 7 picked players; if that player's slate ownership percentage is below the differential threshold, the entry receives a fixed differential bonus.
- **Player_Cost**: A per-player price used in salary mode, derived from recent production, bounded to an integer dollar range.
- **Fantasy_Score**: A single player's points for one slate, computed from that player's box score via the LASTLY scoring formula plus bonuses and the active modifier.
- **Entry_Score**: The total points for an entry: sum of member Fantasy_Scores, with Captain doubled and Differential bonus applied.
- **Lock**: The moment an entry (or an individual player within it) can no longer be edited, tied to game start times.
- **Daily_Modifier**: A per-slate rule (e.g., "Shooters Night") that adjusts scoring for that day.
- **Ownership**: The percentage of submitted entries in a slate that selected a given player.
- **Round**: A weekly competition (Mon–Sun) whose score is the sum of a user's best 6 of 7 daily Entry_Scores.
- **Season**: A monthly grouping of ~4 Rounds, culminating in a playoff bracket among top qualifiers.
- **Daily_Leaderboard / Round_Leaderboard / Season_Leaderboard**: Ranked lists of Entry_Scores / Round scores / Season standings, filterable (global, friends, private league, region).
- **Private_League**: A user-created group with an invite code whose members share a scoped leaderboard.

## Requirements

### Requirement 1: Daily Slate Generation

**User Story:** As a player, I want a fresh set of eligible players each day based on the real NBA schedule, so that I can build a lineup from players who are actually playing.

#### Acceptance Criteria

1. WHEN a new slate day begins (at the configured daily cutover in US Eastern time), THE system SHALL generate one Slate for that date containing every NBA game in `nba_games` whose `game_date` matches the slate date.
2. THE system SHALL derive the Eligible_Player pool from the teams appearing in the slate games, using `nba_players` for identity and `nba_player_team_history` (primary team for the current season) for team membership.
3. WHERE a slate date has zero scheduled NBA games, THE system SHALL mark the slate as "no games" and SHALL NOT accept entries for that date.
4. THE system SHALL persist each Slate with: slate date, slate status (open / locked / scoring / final / no_games), the list of game identifiers, the eligible player pool, and the active Daily_Modifier.
5. THE system SHALL compute and store each Eligible_Player's Player_Cost and a projected Fantasy_Score at slate generation, derived from that player's recent games in `nba_player_stats`.
6. IF slate generation runs more than once for the same date, THEN THE system SHALL upsert (idempotently regenerate) the slate without creating duplicates, and SHALL NOT alter any entries already submitted.
7. THE system SHALL cache the read model of an open slate (games, eligible players, costs, projections, modifier) using the shared cache-aside helper with a slate-appropriate TTL.

---

### Requirement 2: Lineup Construction

**User Story:** As a player, I want to select exactly 7 players and assign a Captain and Differential, so that I can express strategy beyond just picking the best players.

#### Acceptance Criteria

1. THE system SHALL require an Entry to contain exactly 7 distinct Eligible_Players from the same slate.
2. WHILE an entry contains fewer or more than 7 players, THE system SHALL disable submission and SHALL indicate the current count (e.g., "5 / 7").
3. THE system SHALL require exactly one of the 7 players to be designated Captain and exactly one (which may differ from the Captain) to be designated Differential before submission.
4. WHEN the user adds a player already in the entry, THE system SHALL reject the duplicate and leave the entry unchanged.
5. WHEN the user adds a player whose team is not in the current slate, THE system SHALL reject the selection.
6. WHERE the slate is in "salary" mode, THE system SHALL enforce that the sum of selected Player_Costs is less than or equal to the slate budget and SHALL block submission when the budget is exceeded, showing remaining budget.
7. WHERE the slate is in "any 7" (no-budget) mode, THE system SHALL allow any 7 eligible players regardless of cost.
8. THE system SHALL display a projected Entry_Score that updates as players, Captain, and Differential change, applying the Captain 2x multiplier to the projection.

---

### Requirement 3: Entry Submission and Locking

**User Story:** As a player, I want my picks locked when games start so that no one can wait to see partial results before choosing, keeping the competition fair.

#### Acceptance Criteria

1. IF an unauthenticated user attempts to submit an Entry, THEN THE system SHALL redirect to login and SHALL NOT persist the entry.
2. WHEN an authenticated user submits a valid Entry before lock, THE system SHALL persist it owned by `auth.uid()` with a creation timestamp in UTC and return confirmation within 3 seconds.
3. THE system SHALL allow a user at most one Entry per slate; a resubmission before lock SHALL replace the prior entry for that slate.
4. THE system SHALL lock each individual player in an entry at the scheduled start time of that player's game, after which that player selection cannot be changed.
5. WHEN all of an entry's players' games have started, THE system SHALL mark the entire Entry as locked and SHALL reject further edits.
6. IF a user attempts to add, remove, or reassign a player whose game has already started, THEN THE system SHALL reject the change and explain that the player is locked.
7. THE system SHALL enforce ownership via RLS so that a user can read and modify only their own entries, consistent with the existing `auth.uid()` policy pattern.
8. THE system SHALL record each entry's slate-relative Ownership contribution so ownership percentages can be computed once entries close.

---

### Requirement 4: Fantasy Scoring Formula

**User Story:** As a player, I want a distinctive scoring system with bonuses, so that LASTLY 7 feels different from generic fantasy basketball.

#### Acceptance Criteria

1. THE system SHALL compute a player's base Fantasy_Score from their slate box score in `nba_player_stats` as: PTS + REB + AST + (2 × STL) + (2 × BLK) + (1 × 3PM) − (1 × TO).
2. THE system SHALL add stat bonuses to the base score: Double-Double +5, Triple-Double +10, 40+ points +5, 20+ rebounds +5.
3. WHERE the box score data required to determine a Game Winner bonus is available, THE system SHALL add +5 for a game-winning contribution; WHERE that data is not available from `nba_player_stats`, THE system SHALL omit the Game Winner bonus rather than guess.
4. WHEN a Daily_Modifier is active for the slate, THE system SHALL apply the modifier's scoring adjustment to each affected player's Fantasy_Score.
5. THE system SHALL compute the Fantasy_Score deterministically as a pure function of (box score, bonuses, modifier), producing identical results on re-runs.
6. IF a picked player did not play (no box score row for the slate), THEN THE system SHALL assign that player a Fantasy_Score of 0.
7. THE system SHALL round the final Fantasy_Score to one decimal place.

---

### Requirement 5: Entry Scoring, Captain, and Differential

**User Story:** As a player, I want my Captain doubled and a bonus for picking an unpopular player who performs, so that my choices matter beyond raw talent.

#### Acceptance Criteria

1. THE system SHALL compute Entry_Score as the sum of the 7 players' Fantasy_Scores, with the Captain's Fantasy_Score counted at 2x.
2. WHEN entries for a slate close, THE system SHALL compute each player's Ownership as the percentage of submitted entries that selected that player.
3. WHEN scoring an entry, IF the designated Differential player's Ownership is below the differential threshold, THEN THE system SHALL add the fixed Differential bonus to the Entry_Score.
4. THE system SHALL compute Entry_Score deterministically and idempotently: re-running scoring for a fully-final slate SHALL not change any Entry_Score.
5. THE system SHALL only mark an Entry as final once all of its players' games are final in `nba_games`; until then the Entry_Score is provisional.
6. THE system SHALL store, per entry, the breakdown (each player's Fantasy_Score, which was Captain, the Differential bonus applied) so results are auditable.

---

### Requirement 6: Live and Provisional Scoring

**User Story:** As a player, I want to watch my score climb during games, so that the mode is engaging while games are in progress.

#### Acceptance Criteria

1. WHILE a slate's games are in progress, THE system SHALL display a provisional Entry_Score and provisional ranking, clearly labeled as not final.
2. THE system SHALL source in-progress game status (which games have started, are live, or are final) from the live scores pipeline (`matches`) and per-player production from `nba_player_stats` as box scores become available.
3. WHERE per-player stats for an in-progress game are not yet available, THE system SHALL show that player's contribution as pending (0 or last-known) and SHALL NOT present it as final.
4. THE system SHALL update provisional scores on a bounded refresh interval consistent with the existing scores polling cadence, and SHALL cache provisional leaderboard reads.
5. WHEN all games in a slate are final and box scores are ingested, THE system SHALL replace provisional scores with final Fantasy_Scores and mark the slate final.

---

### Requirement 7: Daily Modifiers

**User Story:** As a player, I want each day to have a twist, so that no two slates feel identical.

#### Acceptance Criteria

1. THE system SHALL assign exactly one Daily_Modifier to each slate at generation from a defined modifier set (e.g., Shooters Night, Big Man Night, Underdog Day, Rivalry Day, Rookie Night, or a neutral "No Modifier").
2. THE system SHALL display the active modifier and its rule to users before lock so it can inform lineup choices.
3. THE system SHALL apply the modifier's scoring rule consistently to every affected player when computing Fantasy_Scores for that slate.
4. THE system SHALL record which modifier was active on each slate so historical scores remain reproducible.
5. WHERE a modifier depends on data not present in `nba_player_stats` (e.g., fourth-quarter-only production for a Clutch Night), THE system SHALL either omit that modifier from the available set or degrade it to a supported approximation, and SHALL document the behavior.

---

### Requirement 8: Daily Leaderboard

**User Story:** As a player, I want to see where I rank each day among everyone, so that I have a reason to come back.

#### Acceptance Criteria

1. WHEN a slate is scored (provisional or final), THE system SHALL produce a Daily_Leaderboard ranking entries by Entry_Score descending, with deterministic tie-breaking.
2. THE system SHALL display the requesting user's own rank and the total number of entries (e.g., "You: #127 / 48,921"), even when the user is outside the visible top page.
3. THE system SHALL support leaderboard filters: Global (all entries), Friends, Private_League, and Region.
4. THE system SHALL paginate the leaderboard and cache leaderboard reads using the shared cache-aside helper with a leaderboard-appropriate TTL.
5. WHILE a slate is not yet final, THE system SHALL label the Daily_Leaderboard as provisional/live.

---

### Requirement 9: Weekly Rounds (Best 6 of 7)

**User Story:** As a player, I want my week scored as the best 6 of 7 days, so that missing a single day doesn't ruin my week.

#### Acceptance Criteria

1. THE system SHALL group each week's slates into a Round covering Monday through Sunday in the slate timezone.
2. THE system SHALL compute a user's Round score as the sum of their best 6 of their 7 daily Entry_Scores for that Round, dropping the single lowest counted day.
3. WHERE a user submitted fewer than 7 daily entries in a Round, THE system SHALL sum all submitted daily Entry_Scores (up to 6 highest) without imputing scores for missed days.
4. THE system SHALL produce a Round_Leaderboard ranking users by Round score descending with the same filters as the Daily_Leaderboard.
5. THE system SHALL assign a tier to each user based on Round percentile (e.g., Top 10% Elite, Top 25% All-Star, Top 50% Starter).
6. THE system SHALL recompute Round standings idempotently as underlying daily scores become final.

---

### Requirement 10: Monthly Seasons and Playoffs

**User Story:** As a player, I want monthly seasons that culminate in a bracket, so that the mode has long-term competitive structure.

#### Acceptance Criteria

1. THE system SHALL group approximately four consecutive Rounds into a Season.
2. THE system SHALL produce a Season_Leaderboard aggregating Round performance across the Season.
3. WHEN a Season's regular Rounds conclude, THE system SHALL seed a single-elimination playoff bracket from the top qualifiers (bracket size configurable, e.g., top 128 → rounds of 128/64/32/16/8/4/final).
4. THE system SHALL advance the higher-scoring entrant in each bracket matchup based on a defined tie-break, and SHALL crown a Season champion.
5. THE system SHALL record Season and playoff results as historical, immutable records once finalized.

---

### Requirement 11: Social — Friends, Private Leagues, Regions

**User Story:** As a player, I want to compete with my friends and in private leagues, so that the game is more fun with people I know.

#### Acceptance Criteria

1. THE system SHALL allow a user to create a Private_League with a name and a shareable invite code, becoming its first member.
2. WHEN a user joins via a valid invite code, THE system SHALL add them to that Private_League; an invalid or expired code SHALL be rejected with a clear message.
3. THE system SHALL scope Daily, Round, and Season leaderboards to a selected Private_League on request.
4. THE system SHALL support a Friends filter that ranks only the requesting user's friends.
5. THE system SHALL support a Region filter (e.g., country) based on user profile data where available.
6. THE system SHALL enforce that only members of a Private_League can view that league's scoped leaderboard.

---

### Requirement 12: Retention — Tomorrow's Slate Preview

**User Story:** As a player, I want a teaser of tomorrow's games, so that I'm motivated to come back.

#### Acceptance Criteria

1. WHEN a slate reaches final (or after the daily cutover), THE system SHALL display a preview of the next day's slate showing the number of scheduled games and a limited set of notable players.
2. THE system SHALL NOT reveal the full eligible pool, costs, or modifier for the upcoming slate in the preview.
3. WHERE the next day's schedule is not yet available in `nba_games`, THE system SHALL show a neutral "next slate coming soon" state.

---

### Requirement 13: Scoring Settlement Pipeline

**User Story:** As the operator, I want daily scoring to run automatically and reliably after games finish, so that leaderboards settle without manual work.

#### Acceptance Criteria

1. THE system SHALL run slate scoring via the existing job/cron infrastructure (Redis-backed queue and/or a CRON_SECRET-protected route), chained after NBA box-score scraping, mirroring the parlay settlement trigger.
2. THE system SHALL bind each picked player to the correct game by matching the slate date to the game date, consistent with the parlay settlement date-matching approach.
3. THE system SHALL settle scoring idempotently: entries already marked final SHALL be skipped, and re-runs SHALL not change final results.
4. WHERE a slate has games still in progress, THE system SHALL compute provisional scores and leave the slate non-final so a later run finalizes it.
5. WHERE box scores for a completed slate never arrive within a bounded staleness window, THE system SHALL finalize using available data and flag missing players as 0, analogous to stale-parlay expiry.
6. THE system SHALL protect all scoring/cron endpoints with the existing CRON_SECRET bearer-token check.
7. THE system SHALL emit a per-run summary (slates scored, entries settled, entries finalized, errors) for observability.
