# Implementation Plan: Props Advanced Analytics

## Overview

This plan implements the advanced analytics layer for the props/analysis page, building on the existing `props-ui-overhaul` base. Implementation proceeds in dependency order: database schema first, then computation modules, API routes, UI components, and finally property-based and integration tests. All code is TypeScript targeting the existing Next.js + Supabase stack.

## Tasks

- [x] 1. Database migrations for new tables
  - [x] 1.1 Create `prop_line_history` table migration
    - Create migration file in `supabase/migrations/`
    - Define table with columns: id (UUID PK), player_name, sport (CHECK NBA/Tennis), stat_category, line_value (NUMERIC), recorded_at, created_at
    - Add indexes: `idx_line_history_player_stat` on (player_name, stat_category, recorded_at DESC), `idx_line_history_recorded` on (recorded_at DESC)
    - Enable RLS with public SELECT policy
    - _Requirements: 8.1, 8.5_

  - [x] 1.2 Create `prop_votes` table migration
    - Define table with columns: id (UUID PK), user_id (FK auth.users CASCADE), prop_identifier, sport (CHECK), direction (CHECK over/under), vote_date (DATE), created_at, updated_at
    - Add UNIQUE constraint on (user_id, prop_identifier, vote_date)
    - Add indexes: `idx_votes_prop` on (prop_identifier, vote_date), `idx_votes_user` on (user_id)
    - Enable RLS with policies: public SELECT, user-scoped INSERT/UPDATE
    - _Requirements: 9.4, 9.6_

  - [x] 1.3 Create `bet_tracker` table migration
    - Define table with columns: id (UUID PK), user_id (FK auth.users CASCADE), player_name, sport, stat_category, prop_line, direction, confidence_score (1-5), matchup_grade (A-F), odds (-10000 to 10000), stake (0.01-99999.99), status (pending/won/lost/push), created_at, resolved_at
    - Add indexes: `idx_bets_user` on (user_id, created_at DESC), `idx_bets_status` on (user_id, status)
    - Enable RLS with user-scoped SELECT/INSERT/UPDATE policies
    - _Requirements: 7.1, 7.7, 7.9_

  - [x] 1.4 Create `correlations_cache` table migration
    - Define table with columns: id (UUID PK), sport (CHECK), prop_a, prop_b, coefficient (NUMERIC(5,4)), overlapping_games (INTEGER), computed_at
    - Add UNIQUE constraint on (sport, prop_a, prop_b)
    - Add indexes: `idx_correlations_prop_a`, `idx_correlations_prop_b`, `idx_correlations_sport`
    - Enable RLS with public SELECT policy
    - _Requirements: 5.1, 5.3_

  - [x] 1.5 Create `ai_writeup_cache` table migration
    - Define table with columns: id (UUID PK), prop_identifier, sport (CHECK), writeup (TEXT), prop_line_at_generation (NUMERIC), generated_at, expires_at
    - Add UNIQUE constraint on (prop_identifier, sport)
    - Add indexes: `idx_writeup_cache_prop`, `idx_writeup_cache_expires`
    - Enable RLS with public SELECT policy
    - _Requirements: 10.4, 10.6_

- [x] 2. Checkpoint - Verify migrations
  - Ensure all migrations apply cleanly, ask the user if questions arise.

- [x] 3. Analytics Engine computation modules
  - [x] 3.1 Implement multi-window hit rate computation
    - Create `lib/analytics/hit-rates.ts`
    - Implement `computeHitRates(gameValues: number[], propLine: number): HitRateWindow[]` for windows L5, L10, L15, L20, Season, vsOpp
    - Mark windows with < 3 games as `available: false`
    - Hit rate = count of values >= propLine / window size
    - _Requirements: 1.1, 1.4, 1.6, 1.7_

  - [x] 3.2 Implement matchup grade computation
    - Create `lib/analytics/matchup-grades.ts`
    - Implement `computeMatchupGrade(opponentDefensiveValue: number, allTeamValues: number[]): Grade | null`
    - Percentile ranking: A (top 20%), B (21-40%), C (41-60%), D (61-80%), F (bottom 20%)
    - Return null if < 5 teams in dataset or opponent has < 3 games
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 2.7_

  - [x] 3.3 Implement confidence score computation
    - Create `lib/analytics/confidence-score.ts`
    - Implement `computeConfidenceScore(l5HitRate: number, l10HitRate: number, matchupGrade: Grade | null, gamesPlayed: number): ConfidenceBreakdown | null`
    - Weights: L5=0.30, L10=0.20, matchup=0.25, sampleSize=0.25
    - Star mapping: [0,0.39]→1, [0.40,0.54]→2, [0.55,0.69]→3, [0.70,0.84]→4, [0.85,1.0]→5
    - Business rules: min 4★ when L5>=80% AND grade A/B; cap 3★ when <5 games; cap overrides min
    - Return null if < 3 games
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6, 3.8_

  - [x] 3.4 Implement advanced filter logic
    - Create `lib/analytics/filters.ts`
    - Implement `applyAdvancedFilters(props: EnhancedPropCardData[], filters: AdvancedFilterState): EnhancedPropCardData[]`
    - Support: withoutPlayer, homeAway, opposingTeam, minConfidence, direction, hitRateMin/Max
    - All filters applied as logical AND
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 3.5 Implement the enhanced props aggregator
    - Create `lib/analytics/engine.ts`
    - Implement `computeEnhancedProps(sport, stat, filters)` that orchestrates hit rates, matchup grades, confidence scores, and correlations lookup
    - Use existing `cached()` pattern with 60s TTL
    - _Requirements: 1.1, 2.1, 3.1_

- [x] 4. Correlation Engine
  - [x] 4.1 Implement Pearson correlation computation
    - Create `lib/analytics/correlations.ts`
    - Implement `computePearsonCorrelation(valuesA: number[], valuesB: number[]): number` returning coefficient in [-1, 1]
    - Require minimum 10 overlapping games; same-sport constraint
    - Cap at 500 unique player-stat combinations per sport per cycle
    - _Requirements: 5.1, 5.5, 5.6, 5.9_

  - [x] 4.2 Implement daily correlation cron job
    - Create `app/api/cron/correlations/route.ts`
    - Fetch all active props per sport, compute pairwise correlations
    - Upsert results into `correlations_cache` table
    - Add appropriate auth/secret verification for cron endpoint
    - _Requirements: 5.3_

- [ ] 5. Line Movement Monitor
  - [x] 5.1 Implement line history recording hook
    - Create `lib/analytics/line-movement.ts`
    - Implement `recordLineHistory(player: string, sport: string, stat: string, lineValue: number)` that appends to `prop_line_history`
    - Implement `getLineMovement(player: string, stat: string): LineMovementData | null`
    - Compute direction, absolute change, significant movement flag (>=10% from earliest in 24h)
    - _Requirements: 8.1, 8.2, 8.3, 8.6_

  - [x] 5.2 Integrate line recording into existing scraper flow
    - Modify scraper output hook to call `recordLineHistory` for each prop line scraped
    - Ensure append-only behavior (no updates to existing rows)
    - _Requirements: 8.1, 8.5_

- [x] 6. Parlay computation module
  - [x] 6.1 Implement parlay combined hit rate and correlation analysis
    - Create `lib/analytics/parlay.ts`
    - Implement `computeParlayStats(legs: ParlayLeg[]): ParlayResult`
    - Combined hit rate: count overlapping dates where ALL legs hit / total overlapping dates
    - Require minimum 5 overlapping dates, else "Insufficient data"
    - Identify correlated pairs (coefficient > 0.5), conflict pairs (< -0.3)
    - Identify weak link (lowest L10 hit rate, ties all labeled)
    - _Requirements: 6.5, 6.6, 6.7, 6.8, 6.11_

- [x] 7. Checkpoint - Verify computation modules
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. API routes
  - [x] 8.1 Enhance `GET /api/props` with analytics data
    - Extend existing route to call `computeEnhancedProps`
    - Add new query parameters: withoutPlayer, homeAway, opponent, minConfidence, direction, hitRateMin, hitRateMax
    - Return `EnhancedPropCardData[]` with hit rates, matchup grades, confidence, correlations, line movement, sentiment
    - Apply 60s in-memory cache
    - _Requirements: 1.1, 2.1, 3.1, 4.1-4.10_

  - [x] 8.2 Create `GET /api/props/correlations` endpoint
    - Accept `propId` query parameter
    - Fetch from `correlations_cache` table where prop_a or prop_b matches
    - Return top correlations with coefficient > 0.5
    - _Requirements: 5.2_

  - [x] 8.3 Create `POST /api/props/parlay` endpoint
    - Accept `{ legs: [...] }` request body
    - Call `computeParlayStats` module
    - Return combined hit rate, correlation pairs, weak link, per-leg flags
    - _Requirements: 6.5, 6.6, 6.7, 6.8_

  - [x] 8.4 Create `POST /api/props/votes` and `GET /api/props/votes` endpoints
    - POST: Validate auth, upsert vote (user_id, prop_identifier, direction, vote_date)
    - GET: Return totals (over count, under count, total, userVote)
    - Enforce one vote per user per prop per UTC day via UNIQUE constraint
    - Apply 10s in-memory cache for vote totals
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

  - [x] 8.5 Create `GET /api/props/line-history` endpoint
    - Accept player, stat, days (default 7) query parameters
    - Fetch from `prop_line_history` ordered by recorded_at
    - Return history array, currentLine, change24h
    - Cap at 100 data points
    - _Requirements: 8.4, 8.5_

  - [x] 8.6 Create `POST /api/bets` and `PATCH /api/bets/[betId]` and `GET /api/bets` endpoints
    - POST: Validate auth, validate input ranges (odds, stake), insert into `bet_tracker`
    - PATCH: Update status (pending → won/lost/push)
    - GET: Fetch user's bets with optional filters, compute BetTrackerStats (ROI, win rate, best signals)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.8, 7.9_

  - [x] 8.7 Create `GET /api/props/ai-writeup` endpoint
    - Accept propId query parameter
    - Check `ai_writeup_cache` for valid cached writeup (not expired, line change <= 5%)
    - If cache miss: call OpenAI gpt-4o-mini with prompt template, store result with 6h expiry
    - Handle timeout (15s), return error placeholder
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [x] 9. Checkpoint - Verify API routes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. UI Components
  - [x] 10.1 Implement HitRateBars component
    - Create `components/props/HitRateBars.tsx`
    - Render bars in fixed order: L5, L10, L15, L20, Season, vsOpp
    - Color bands: red (0-30%), yellow (31-60%), green (61-100%)
    - Show "N/A" for unavailable windows
    - Tooltip on hover/tap: "{over}/{total} over"
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

  - [x] 10.2 Implement MatchupBadge component
    - Create `components/props/MatchupBadge.tsx`
    - Colored letter badge: green for A/B, yellow for C, red for D/F
    - Render nothing when grade is null
    - _Requirements: 2.4, 2.5, 2.6_

  - [x] 10.3 Implement ConfidenceStars component
    - Create `components/props/ConfidenceStars.tsx`
    - Display 1-5 filled star icons
    - Tooltip on tap showing factor breakdown (label, normalized %, weighted contribution)
    - Show "Not enough data" when breakdown is null
    - _Requirements: 3.3, 3.7, 3.8_

  - [x] 10.4 Implement CorrelationsSection component
    - Create `components/props/CorrelationsSection.tsx`
    - List top 3 correlated props with player name, stat, coefficient (2 decimal places)
    - Tap handler to scroll to correlated prop card with 2s highlight
    - _Requirements: 5.2, 5.4, 5.7_

  - [x] 10.5 Implement SentimentBar component
    - Create `components/props/SentimentBar.tsx`
    - Over/Under vote buttons for authenticated users
    - Percentage bar showing over% + under% = 100%
    - "Not enough votes" when < 5 total votes
    - Read-only mode for unauthenticated users
    - _Requirements: 9.1, 9.2, 9.3, 9.5, 9.7_

  - [x] 10.6 Implement LineMovementIndicator component
    - Create `components/props/LineMovementIndicator.tsx`
    - Directional arrow (up/down) with absolute change value
    - Expandable line chart (7 days, max 100 data points)
    - Omit entirely when no data
    - _Requirements: 8.3, 8.4, 8.6_

  - [x] 10.7 Implement AIWriteup component
    - Create `components/props/AIWriteup.tsx`
    - Expandable text area for 3-5 sentence analysis
    - Loading state, error state with retry button (max 3 retries)
    - "Insufficient data" message when < 3 games
    - _Requirements: 10.1, 10.5, 10.7_

  - [x] 10.8 Implement AdvancedFilters panel
    - Create `components/props/AdvancedFilters.tsx`
    - Without Player text input (NBA only), Home/Away toggle, Opposing Team dropdown
    - Min Confidence slider (1-5), Over/Under toggle, Hit Rate range (0-100, step 5)
    - Active filter count badge, "Clear All" button
    - Empty state message when zero results
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8, 4.9, 4.10_

  - [x] 10.9 Implement ParlayBuilder bottom sheet
    - Create `components/props/ParlayBuilder.tsx`
    - Persistent bottom sheet showing selected legs, combined hit rate, leg count
    - "Add to Parlay" button on PropCard (max 10 legs, no duplicates)
    - Correlated/Conflict flags, Weak Link label
    - Remove leg, clear all, auto-hide when empty
    - "Insufficient data" when < 5 overlapping dates
    - Single leg shows individual L10 hit rate
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11_

  - [x] 10.10 Implement BetTrackerView page
    - Create `app/(app)/bets/page.tsx` and `components/props/BetTrackerView.tsx`
    - Display logged bets with status management (pending → won/lost/push)
    - ROI computation display, win/loss record with filters
    - "Best Signals" section (top 3 confidence+grade combos with >=5 picks)
    - Auth gate: prompt sign-in if unauthenticated
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.8_

- [x] 11. Integrate enhanced components into Analysis page
  - [x] 11.1 Wire enhanced PropCard with all new sub-components
    - Update existing PropCard to include HitRateBars, MatchupBadge, ConfidenceStars, CorrelationsSection, SentimentBar, LineMovementIndicator, AIWriteup
    - Add "Add to Parlay" and "Log Pick" action buttons
    - Connect AdvancedFilters panel to page state and API calls
    - Wire ParlayBuilder bottom sheet to page-level state
    - _Requirements: 1.2, 2.4, 3.3, 5.2, 6.1, 8.3, 9.1, 10.1_

- [x] 12. Checkpoint - Verify UI components render correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Property-based tests for computation modules
  - [ ]* 13.1 Write property test for hit rate computation correctness
    - **Property 1: Hit rate computation correctness**
    - Generate random game value arrays and prop lines; verify hit rate = count(values >= line) / min(total, W); verify unavailable when < 3 games
    - **Validates: Requirements 1.1, 1.4, 1.6, 1.7**

  - [ ]* 13.2 Write property test for hit rate color band assignment
    - **Property 2: Hit rate color band assignment**
    - Generate random percentages 0-100; verify red [0,30], yellow [31,60], green [61,100]
    - **Validates: Requirements 1.3**

  - [ ]* 13.3 Write property test for matchup grade percentile mapping
    - **Property 3: Matchup grade percentile mapping**
    - Generate random stat arrays (N>=5) and target values; verify grade corresponds to percentile rank
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.6, 2.7**

  - [ ]* 13.4 Write property test for confidence score formula
    - **Property 4: Confidence score formula**
    - Generate random normalized inputs [0,1]; verify weighted sum maps to correct star rating
    - **Validates: Requirements 3.1, 3.2**

  - [ ]* 13.5 Write property test for confidence score business rule overrides
    - **Property 5: Confidence score business rule overrides**
    - Generate edge-case inputs; verify min-4★ rule, 3★ cap, and cap-takes-precedence
    - **Validates: Requirements 3.4, 3.5, 3.6**

  - [ ]* 13.6 Write property test for filter correctness
    - **Property 6: Filter correctness**
    - Generate random prop sets and filter combinations; verify all returned props satisfy ALL filters and no valid prop is excluded
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.6, 4.7**

  - [ ]* 13.7 Write property test for over/under hit rate complementarity
    - **Property 7: Over/Under hit rate complementarity**
    - Generate random game arrays and lines; verify over count + under count = total games in window
    - **Validates: Requirements 4.5**

  - [ ]* 13.8 Write property test for Pearson correlation bounds
    - **Property 8: Pearson correlation bounds and same-sport constraint**
    - Generate random value pairs with >=10 overlapping games; verify coefficient in [-1, 1]; verify no result for < 10 games or cross-sport
    - **Validates: Requirements 5.1, 5.5, 5.6**

  - [ ]* 13.9 Write property test for parlay state transitions
    - **Property 9: Parlay state transitions**
    - Generate random parlay states (0-10 legs) and candidate props; verify add succeeds iff N<10 AND not duplicate; verify count = N+1 after add
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [ ]* 13.10 Write property test for combined parlay hit rate
    - **Property 10: Combined parlay hit rate**
    - Generate random multi-leg game data with >=5 overlapping dates; verify combined rate = dates where ALL hit / total overlapping dates
    - **Validates: Requirements 6.5, 6.11**

  - [ ]* 13.11 Write property test for parlay correlation flags
    - **Property 11: Parlay correlation flags**
    - Generate random coefficients; verify "Correlated" iff > 0.5, "Conflict" iff < -0.3, mutually exclusive
    - **Validates: Requirements 6.6, 6.7**

  - [ ]* 13.12 Write property test for weak link identification
    - **Property 12: Weak link identification**
    - Generate random leg hit rates; verify weak link = leg(s) with minimum L10 hit rate
    - **Validates: Requirements 6.8**

  - [ ]* 13.13 Write property test for bet tracker ROI computation
    - **Property 13: Bet tracker ROI computation**
    - Generate random resolved bet sets; verify ROI = ((winnings - staked) / staked) × 100; verify 0% when staked = 0
    - **Validates: Requirements 7.3, 7.4**

  - [ ]* 13.14 Write property test for bet logging round trip
    - **Property 14: Bet logging round trip**
    - Generate random valid bet inputs; verify all fields unchanged after log + fetch
    - **Validates: Requirements 7.1**

  - [ ]* 13.15 Write property test for bet input validation
    - **Property 15: Bet input validation**
    - Generate random invalid odds/stake values; verify rejection; generate valid values and verify acceptance
    - **Validates: Requirements 7.9**

  - [ ]* 13.16 Write property test for line movement detection
    - **Property 16: Line movement detection**
    - Generate random line pairs; verify direction, absolute change, significant movement flag (>=10%)
    - **Validates: Requirements 8.2, 8.3**

  - [ ]* 13.17 Write property test for vote percentage invariant
    - **Property 17: Vote percentage invariant**
    - Generate random vote counts (>=5 total); verify over% + under% = 100%
    - **Validates: Requirements 9.3, 9.5**

  - [ ]* 13.18 Write property test for one vote per user per prop per day
    - **Property 18: One vote per user per prop per day**
    - Generate random vote sequences; verify exactly one record per user/prop/day; direction = most recent
    - **Validates: Requirements 9.4**

  - [ ]* 13.19 Write property test for AI writeup cache invalidation
    - **Property 19: AI writeup cache invalidation**
    - Generate random line pairs (L_gen, L_cur); verify cache invalidated iff |L_cur - L_gen| / L_gen > 0.05
    - **Validates: Requirements 10.6**

- [ ] 14. Integration tests
  - [ ]* 14.1 Write integration tests for API routes
    - Test enhanced /api/props with seeded data and various filter combinations
    - Test /api/props/correlations returns correct data from cache table
    - Test /api/props/parlay with real correlation data
    - Test /api/props/votes persistence and uniqueness constraint
    - Test /api/props/line-history returns correct time series
    - Test /api/bets CRUD operations with RLS verification
    - Test /api/props/ai-writeup caching and invalidation flow
    - _Requirements: 1.1, 5.2, 6.5, 7.1, 8.4, 9.4, 10.4_

  - [ ]* 14.2 Write integration tests for cron and scraper hooks
    - Test correlation cron job execution and table population
    - Test line history append during scraper run
    - Verify 30-day retention policy
    - _Requirements: 5.3, 8.1, 8.5_

- [x] 15. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using `fast-check`
- Unit tests validate specific examples and edge cases
- All computation modules are pure functions where possible for easy testing
- The existing `cached()` pattern is reused for in-memory caching (60s TTL for props, 10s for votes)
- AI writeup integration requires `OPENAI_API_KEY` environment variable

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5"] },
    { "id": 1, "tasks": ["3.1", "3.2", "3.3", "3.4"] },
    { "id": 2, "tasks": ["3.5", "4.1", "5.1", "6.1"] },
    { "id": 3, "tasks": ["4.2", "5.2"] },
    { "id": 4, "tasks": ["8.1", "8.2", "8.3", "8.4", "8.5", "8.6", "8.7"] },
    { "id": 5, "tasks": ["10.1", "10.2", "10.3", "10.4", "10.5", "10.6", "10.7", "10.8", "10.9", "10.10"] },
    { "id": 6, "tasks": ["11.1"] },
    { "id": 7, "tasks": ["13.1", "13.2", "13.3", "13.4", "13.5", "13.6", "13.7", "13.8", "13.9", "13.10", "13.11", "13.12", "13.13", "13.14", "13.15", "13.16", "13.17", "13.18", "13.19"] },
    { "id": 8, "tasks": ["14.1", "14.2"] }
  ]
}
```
