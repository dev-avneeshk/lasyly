# Implementation Plan: Live Scores App

## Overview

Convert the feature design into a series of prompts for a code-generation LLM that will implement each step with incremental progress. Each prompt builds on the previous prompts, ending with wiring things together. There is no hanging or orphaned code that isn't integrated into a previous step. Focus is ONLY on tasks that involve writing, modifying, or testing code.

## Tasks

- [ ] 1. Extend types and configure image domains
  - [ ] 1.1 Extend LiveMatch type and add MatchSummary type
    - Add `homeLogo`, `awayLogo`, `homeColor`, `awayColor`, `venue`, and `eventId` as optional fields to the `LiveMatch` type in `types/index.ts`
    - Add the new `MatchSummary` type with `eventId`, `venue`, `broadcasts`, `odds`, `leaders`, and `headline` fields
    - Ensure all new fields are optional for backward compatibility with existing code
    - _Requirements: 1.1_

  - [ ] 1.2 Configure next.config.js for ESPN CDN image domains
    - Add `a.espncdn.com` and `s.espncdn.com` as allowed remote image patterns in the Next.js configuration
    - Read the relevant Next.js docs in `node_modules/next/dist/docs/` before modifying config
    - _Requirements: 10.1, 10.2_

- [ ] 2. Enhance ESPN service with date support and summary endpoint
  - [ ] 2.1 Add date parameter support to ESPN scoreboard fetch
    - Modify `fetchESPNScores` in `lib/services/espn.ts` to accept an optional `date` parameter (YYYYMMDD format)
    - When date is provided, append `?dates={dateString}` to the ESPN scoreboard URL
    - When date is not provided, do not include the dates query parameter
    - _Requirements: 4.6, 8.1_

  - [ ] 2.2 Enrich ESPN event mapping with logos, colors, venue, and eventId
    - Update the ESPN event-to-LiveMatch mapping function to extract `homeLogo` from `competitors[home].team.logo`, `awayLogo` from `competitors[away].team.logo`, `homeColor` from `competitors[home].team.color`, `awayColor` from `competitors[away].team.color`, `venue` from `competitions[0].venue.fullName`, and `eventId` from the event `id`
    - Set fields to `undefined` when source data is absent
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

  - [ ]* 2.3 Write property test for ESPN event mapping (Property 1)
    - **Property 1: ESPN event mapping preserves team metadata**
    - Use fast-check to generate arbitrary ESPN event objects with optional logo, color, venue, and eventId fields
    - Assert that the mapping function correctly transfers present fields and sets absent fields to `undefined`
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5**

  - [ ]* 2.4 Write property test for date URL construction (Property 5)
    - **Property 5: Date parameter URL construction**
    - Use fast-check to generate valid YYYYMMDD date strings
    - Assert that the constructed URL includes `?dates={dateString}` when date is provided and omits it when not
    - **Validates: Requirements 4.6**

  - [ ] 2.5 Implement ESPN summary endpoint fetch
    - Add `fetchESPNSummary(sportPath: string, eventId: string): Promise<MatchSummary>` to `lib/services/espn.ts`
    - Fetch from ESPN's summary API: `/apis/site/v2/sports/{sport}/{league}/summary?event={eventId}`
    - Map the response to the `MatchSummary` type, extracting venue, odds, broadcasts, leaders, and headline
    - Set fields to `undefined` when absent in the response
    - Apply a 5-second request timeout
    - _Requirements: 9.2, 9.3_

  - [ ]* 2.6 Write property test for ESPN summary mapping (Property 11)
    - **Property 11: ESPN summary mapping extracts available fields**
    - Use fast-check to generate arbitrary ESPN summary response objects with optional venue, odds, broadcasts, and leaders
    - Assert correct extraction when fields are present and `undefined` when absent
    - **Validates: Requirements 9.3**

- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Create Supabase finished_matches table and cache logic
  - [ ] 4.1 Create Supabase migration for finished_matches table
    - Create the `finished_matches` table with columns: `id` (TEXT PK), `event_id`, `home_team`, `away_team`, `home_score` (CHECK 0-999), `away_score` (CHECK 0-999), `home_logo`, `away_logo`, `home_color`, `away_color`, `venue`, `league`, `sport`, `status`, `clock`, `match_date` (DATE), `cached_at` (TIMESTAMPTZ DEFAULT NOW())
    - Add index `idx_finished_matches_date` on `match_date`
    - Add index `idx_finished_matches_league` on `(match_date, league)`
    - _Requirements: 6.1_

  - [ ] 4.2 Implement cache insert and query functions
    - Create `lib/services/matchCache.ts` with functions:
      - `insertFinishedMatches(matches: LiveMatch[], matchDate: string): Promise<void>` — uses INSERT ON CONFLICT (id) DO NOTHING
      - `getCachedMatchesByDate(date: string): Promise<LiveMatch[]>` — queries by `match_date`, maps rows to LiveMatch format
    - Map database rows to the same LiveMatch response structure used for live ESPN data
    - _Requirements: 6.2, 6.3, 6.6_

  - [ ]* 4.3 Write property test for cache insertion idempotence (Property 7)
    - **Property 7: Finished match cache insertion is idempotent**
    - Use fast-check to generate arbitrary finished LiveMatch objects
    - Mock Supabase client, assert that inserting the same match multiple times results in exactly one row
    - **Validates: Requirements 6.2**

  - [ ]* 4.4 Write property test for cache row to LiveMatch mapping (Property 9)
    - **Property 9: Cache row to LiveMatch mapping round-trip**
    - Use fast-check to generate arbitrary `finished_matches` row objects
    - Assert that mapping produces a valid LiveMatch with all fields correctly transferred
    - **Validates: Requirements 6.6**

- [ ] 5. Enhance Scores API route with date support and caching
  - [ ] 5.1 Enhance `/api/scores` route with date parameter and cache logic
    - Modify `app/api/scores/route.ts` to accept optional `date` query parameter (YYYYMMDD)
    - Validate date format: return 400 if invalid
    - For past dates: query `finished_matches` first, fallback to ESPN on cache miss, insert finished matches into cache
    - For today/no date: use existing in-memory cache + ESPN live fetch
    - For future dates: fetch from ESPN with date parameter
    - Include `meta` field in response with `date`, `source`, and optional `cachedAt`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 6.3, 6.4, 6.5_

  - [ ]* 5.2 Write property test for invalid date rejection (Property 10)
    - **Property 10: Invalid date parameter rejection**
    - Use fast-check to generate strings that are NOT valid YYYYMMDD dates
    - Assert that the API returns 400 with `success: false`
    - **Validates: Requirements 8.5**

  - [ ]* 5.3 Write property test for past date cache-first routing (Property 8)
    - **Property 8: Past date routing queries cache first**
    - Use fast-check to generate valid past date strings
    - Mock Supabase and ESPN services, assert cache is queried before ESPN
    - **Validates: Requirements 6.3, 8.2**

- [ ] 6. Create Match Detail API route
  - [ ] 6.1 Implement `/api/scores/[eventId]/summary` route
    - Create `app/api/scores/[eventId]/summary/route.ts`
    - Fetch from ESPN summary endpoint using the `eventId` param
    - Cache successful responses in-memory for 30 seconds
    - Return 502 with descriptive message on ESPN failure/timeout
    - Return the `MatchSummary` response shape
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Build UI utility functions
  - [ ] 8.1 Implement match grouping and sorting utilities
    - Create `lib/utils/scores.ts` with:
      - `groupByLeague(matches: LiveMatch[]): Record<string, LiveMatch[]>` — groups matches by `league` field
      - `sortMatchesInGroup(matches: LiveMatch[]): LiveMatch[]` — sorts: live first, then finished, then upcoming (ascending by start time)
      - `filterBySport(matches: LiveMatch[], sport: string): LiveMatch[]` — filters by sport, returns all when "All"
    - _Requirements: 3.2, 3.4, 3.6_

  - [ ]* 8.2 Write property test for match grouping (Property 2)
    - **Property 2: Match grouping by league is a partition**
    - Use fast-check to generate arrays of LiveMatch objects with varying league values
    - Assert: every match appears in exactly one group, all matches in a group share the same league, total count equals input length
    - **Validates: Requirements 3.2**

  - [ ]* 8.3 Write property test for sport filter (Property 3)
    - **Property 3: Sport filter correctness**
    - Use fast-check to generate arrays of LiveMatch objects and a sport string
    - Assert: filtered results only contain matches with matching sport; "All" returns all matches
    - **Validates: Requirements 3.4**

  - [ ]* 8.4 Write property test for match sort ordering (Property 4)
    - **Property 4: Match sort ordering within league groups**
    - Use fast-check to generate arrays of LiveMatch objects with mixed statuses
    - Assert: live matches appear before finished, finished before upcoming, upcoming sorted ascending by time
    - **Validates: Requirements 3.6**

- [ ] 9. Build client-side hooks
  - [ ] 9.1 Implement usePollingManager hook
    - Create `hooks/usePollingManager.ts`
    - Implement adaptive polling: 12s when live matches exist, 60s when idle, paused when tab hidden, stopped for non-today dates
    - Use Page Visibility API for tab detection
    - Implement exponential backoff retry (2s, 4s, 8s) on failure, max 3 retries
    - Abort requests after 10s timeout using AbortController
    - Resume polling within 1s of tab becoming visible
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 9.2 Write property test for exponential backoff (Property 6)
    - **Property 6: Exponential backoff delay calculation**
    - Use fast-check to generate retry attempt numbers 1-3
    - Assert: delay equals 2^N seconds (2s, 4s, 8s)
    - **Validates: Requirements 5.6**

  - [ ] 9.3 Implement useMatchDetail hook
    - Create `hooks/useMatchDetail.ts`
    - Fetch from `/api/scores/[eventId]/summary` when an eventId is provided
    - Cache results client-side to avoid re-fetching on modal reopen
    - Handle loading, error, and success states
    - Skip fetch when eventId is undefined
    - _Requirements: 7.3, 7.4, 7.5_

- [ ] 10. Build React components
  - [ ] 10.1 Create DateNavigator component
    - Create `components/scores/DateNavigator.tsx`
    - Display Yesterday/Today/Tomorrow shortcuts with ±7 day range
    - Highlight the currently selected date
    - Call `onDateChange` callback with YYYYMMDD string when a date is selected
    - Default to today on initial render
    - _Requirements: 4.1, 4.2, 4.3, 3.7_

  - [ ] 10.2 Create ScoreCard component
    - Create `components/scores/ScoreCard.tsx`
    - Display team logos (24x24 via `next/image`), team names, scores, and match status
    - Show fallback placeholder when logo is undefined (team abbreviation or generic icon)
    - Show Live_Indicator (pulsing element) + clock for in-progress matches
    - Show "FT" badge for finished matches
    - Show scheduled start time in local timezone for upcoming matches
    - Accept `onClick` handler for opening match detail
    - _Requirements: 2.1, 2.2, 2.3, 3.5_

  - [ ] 10.3 Create LeagueGroup component
    - Create `components/scores/LeagueGroup.tsx`
    - Display league name as header
    - Render a list of ScoreCard components for matches in the group
    - _Requirements: 3.2_

  - [ ] 10.4 Create MatchDetailModal component
    - Create `components/scores/MatchDetailModal.tsx`
    - Display venue, team names with logos, score, status/clock, and odds (moneyline) when available
    - Show loading indicator while fetching summary data
    - Show "Details unavailable" message on fetch failure
    - Display basic LiveMatch data when no eventId exists
    - Update score/clock from polling data without closing modal
    - Close on overlay click or close button, return focus to triggering ScoreCard
    - Open within 300ms of click
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [ ] 11. Assemble the Scores Page
  - [ ] 11.1 Create the ScoresPage at `/scores`
    - Create `app/(app)/scores/page.tsx`
    - Integrate DateNavigator, sport filter tabs ("All", "Football", "Basketball", "American Football"), LeagueGroup, and MatchDetailModal
    - Wire usePollingManager to fetch scores and update state
    - Wire useMatchDetail to MatchDetailModal
    - Apply groupByLeague, sortMatchesInGroup, and filterBySport utilities to organize match data
    - Display empty state when no matches exist for current filters
    - Display error state with retry action on data load failure
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.4, 4.5_

  - [ ]* 11.2 Write unit tests for ScoreCard rendering
    - Test logo rendering when present and fallback when absent
    - Test live indicator display for in-progress matches
    - Test "FT" badge for finished matches
    - Test scheduled time display for upcoming matches
    - _Requirements: 2.1, 2.2, 3.5_

  - [ ]* 11.3 Write unit tests for DateNavigator
    - Test correct date range display (±7 days)
    - Test today is highlighted by default
    - Test date selection callback fires with correct YYYYMMDD format
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 11.4 Write integration tests for Scores API
    - Test `/api/scores` returns correct shape with and without date param
    - Test past date queries cache first
    - Test invalid date returns 400
    - Test future date fetches from ESPN
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The existing `fast-check` and `vitest` devDependencies are used for all testing
- Read Next.js docs in `node_modules/next/dist/docs/` before modifying next.config.js or creating new routes

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2", "4.1"] },
    { "id": 2, "tasks": ["2.3", "2.4", "2.5", "4.2"] },
    { "id": 3, "tasks": ["2.6", "4.3", "4.4", "5.1"] },
    { "id": 4, "tasks": ["5.2", "5.3", "6.1", "8.1"] },
    { "id": 5, "tasks": ["8.2", "8.3", "8.4", "9.1"] },
    { "id": 6, "tasks": ["9.2", "9.3", "10.1", "10.2"] },
    { "id": 7, "tasks": ["10.3", "10.4"] },
    { "id": 8, "tasks": ["11.1"] },
    { "id": 9, "tasks": ["11.2", "11.3", "11.4"] }
  ]
}
```
