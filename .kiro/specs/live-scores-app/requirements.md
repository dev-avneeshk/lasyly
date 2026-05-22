# Requirements Document

## Introduction

A comprehensive SofaScore-style live scores experience for the betroom platform. The feature provides real-time match scores grouped by league, team logos from ESPN, date navigation, match detail views, and a Supabase-backed cache for finished matches. It extends the existing ESPN integration and replaces the basic score cards on the explore page with a dedicated, full-featured scores page.

## Glossary

- **Scores_Page**: The dedicated `/scores` route providing the full live scores UI
- **Score_Card**: A UI component displaying a single match with team logos, names, scores, and status
- **ESPN_Service**: The existing server-side module at `lib/services/espn.ts` that fetches scoreboard data from ESPN's public API
- **Match_Cache**: A Supabase database table (`finished_matches`) that stores completed match data to avoid re-fetching from ESPN
- **Match_Detail_Modal**: A modal/drawer overlay showing extended match information (venue, broadcasts, odds)
- **Date_Navigator**: A UI control allowing users to browse scores for today, yesterday, tomorrow, and arbitrary dates
- **League_Group**: A visual grouping of matches under their league header (e.g., "Premier League", "NBA")
- **Live_Indicator**: A pulsing visual element indicating a match is currently in progress
- **Polling_Manager**: Client-side logic that fetches updated scores at intervals, stopping for finished matches
- **LiveMatch**: The TypeScript type representing a single match with scores, teams, logos, and metadata
- **ESPN_Summary_Endpoint**: The ESPN API endpoint (`/apis/site/v2/sports/{sport}/{league}/summary?event={id}`) providing detailed match data

## Requirements

### Requirement 1: Extended LiveMatch Type

**User Story:** As a developer, I want the LiveMatch type to include team logos, colors, venue, and event ID, so that the UI can render rich match cards with branding and enable detail lookups.

#### Acceptance Criteria

1. THE LiveMatch type SHALL include `homeLogo` (string, URL to home team logo image), `awayLogo` (string, URL to away team logo image), `homeColor` (string, hex color code in 6-character format e.g. "1d428a"), `awayColor` (string, hex color code in 6-character format e.g. "ce1141"), `venue` (string, arena/stadium name, maximum 200 characters), and `eventId` (string, ESPN event identifier, maximum 20 characters) as optional fields
2. WHEN the ESPN_Service maps an ESPN event to a LiveMatch, THE ESPN_Service SHALL populate `homeLogo` from `competitors[home].team.logo`, `awayLogo` from `competitors[away].team.logo`, `homeColor` from `competitors[home].team.color`, `awayColor` from `competitors[away].team.color`, `venue` from `competitions[0].venue.fullName`, and `eventId` from the ESPN event `id`
3. IF a competitor lacks a `logo` field in the ESPN response, THEN THE ESPN_Service SHALL set the corresponding logo field to `undefined`
4. IF a competitor lacks a `color` field in the ESPN response, THEN THE ESPN_Service SHALL set the corresponding color field to `undefined`
5. IF the ESPN event lacks a `venue` or `venue.fullName` field in the response, THEN THE ESPN_Service SHALL set the `venue` field to `undefined`

### Requirement 2: Team Logo Display

**User Story:** As a user, I want to see team logos next to team names in score cards, so that I can quickly identify teams visually.

#### Acceptance Criteria

1. WHEN a Score_Card renders a match with a defined `homeLogo` or `awayLogo`, THE Score_Card SHALL display the logo as a 24x24 pixel image adjacent to the team name
2. WHEN a Score_Card renders a match where `homeLogo` or `awayLogo` is undefined, THE Score_Card SHALL display a fallback placeholder (team abbreviation or generic icon) in place of the logo
3. THE Score_Card SHALL load team logo images with `next/image` using the ESPN CDN domain as an allowed remote pattern

### Requirement 3: Dedicated Scores Page

**User Story:** As a user, I want a dedicated scores page with a SofaScore-like layout, so that I can browse all matches organized by league with sport tabs and date navigation.

#### Acceptance Criteria

1. THE Scores_Page SHALL be accessible at the `/scores` route within the `(app)` layout group
2. THE Scores_Page SHALL display matches grouped by League_Group, with each group showing the league name as a header, and SHALL display an empty state message when no matches exist for the current filters
3. THE Scores_Page SHALL provide sport filter tabs for "All", "Football", "Basketball", and "American Football"
4. WHEN a sport tab is selected, THE Scores_Page SHALL display only matches belonging to that sport category, and WHEN "All" is selected, THE Scores_Page SHALL display matches from all sport categories
5. THE Scores_Page SHALL distinguish live matches by displaying a Live_Indicator and the current match clock, finished matches by displaying an "FT" badge, and upcoming matches by displaying the scheduled start time in the user's local timezone
6. WHEN live matches exist, THE Scores_Page SHALL sort them above finished and upcoming matches within each League_Group, with finished matches sorted below live matches and upcoming matches sorted in ascending order by start time
7. THE Scores_Page SHALL provide date navigation controls allowing the user to select a date within a range of 7 days in the past and 7 days in the future relative to today, defaulting to today's date on initial load
8. IF the scores data fails to load, THEN THE Scores_Page SHALL display an error message indicating the data could not be retrieved and SHALL provide a retry action

### Requirement 4: Date Navigation

**User Story:** As a user, I want to navigate between dates to see yesterday's results and tomorrow's schedule, so that I can review past scores and plan for upcoming matches.

#### Acceptance Criteria

1. THE Date_Navigator SHALL display navigation controls for "Yesterday", "Today", and "Tomorrow" with the selected date highlighted
2. WHEN the user selects a date, THE Scores_Page SHALL fetch and display scores for that date only
3. THE Scores_Page SHALL default to "Today" on initial load
4. WHEN the user selects "Today", THE Polling_Manager SHALL enable live polling for in-progress matches
5. WHEN the user selects a date other than "Today", THE Polling_Manager SHALL disable live polling (historical/future data is static)
6. THE ESPN_Service SHALL accept an optional `date` parameter (YYYYMMDD format) and append it to the ESPN scoreboard URL as a query parameter

### Requirement 5: Live Match Polling

**User Story:** As a user, I want live match scores to update automatically every 10-15 seconds, so that I can follow games in real time without manually refreshing.

#### Acceptance Criteria

1. WHILE the Scores_Page is displaying today's matches and at least one match has a status of "In Progress" or "Halftime", THE Polling_Manager SHALL fetch updated scores every 12 seconds
2. WHILE no matches on the current view have a status of "In Progress" or "Halftime", THE Polling_Manager SHALL reduce polling frequency to every 60 seconds
3. WHEN the browser tab becomes hidden (Page Visibility API `visibilitychange` event with `document.hidden` = true), THE Polling_Manager SHALL pause polling and cancel any pending poll requests
4. WHEN the browser tab becomes visible again, THE Polling_Manager SHALL fetch fresh scores within 1 second of the visibility change and resume the applicable polling interval
5. WHEN all matches on the current view have a status of "Finished" or "Not Started" with start times more than 30 minutes away, THE Polling_Manager SHALL stop polling entirely until a page navigation or match start time falls within 30 minutes
6. IF a poll request fails due to network error or server error, THEN THE Polling_Manager SHALL retry the request up to 3 times with exponential backoff (2s, 4s, 8s delays) before displaying a non-blocking error indicator to the user and resuming the normal polling interval on the next cycle
7. IF a poll request does not receive a response within 10 seconds, THEN THE Polling_Manager SHALL abort the request, treat it as a failed attempt, and proceed with the retry logic defined in criterion 6

### Requirement 6: Finished Match Database Cache

**User Story:** As a platform operator, I want finished matches stored in Supabase, so that historical scores load instantly without ESPN API calls and we build a match history database.

#### Acceptance Criteria

1. THE Match_Cache table SHALL store: `id` (primary key, matches LiveMatch.id), `event_id`, `home_team` (max 200 characters), `away_team` (max 200 characters), `home_score` (integer, 0 to 999), `away_score` (integer, 0 to 999), `home_logo`, `away_logo`, `home_color`, `away_color`, `venue` (max 200 characters), `league`, `sport`, `status`, `match_date` (date of the match in UTC), `clock` (final clock value), and `cached_at` (UTC timestamp of insertion)
2. WHEN the ESPN_Service returns a match with status "Finished", THE Scores API SHALL insert that match into the Match_Cache table using INSERT ON CONFLICT (id) DO NOTHING, so that existing cached records are never overwritten
3. WHEN the Scores API receives a request for a date strictly before the current UTC date, THE Scores API SHALL query the Match_Cache table for rows matching that date and return cached results without calling ESPN, provided at least one row exists for that date
4. WHEN the Match_Cache contains zero rows for a requested past date, THE Scores API SHALL fetch from ESPN with the date parameter, insert any finished matches found into the Match_Cache, and return the full set of matches from the ESPN response
5. IF the ESPN API call fails or times out during a cache-miss fallback for a past date, THEN THE Scores API SHALL return a 500 status with success as false and an error field indicating the upstream failure, without inserting any rows into the Match_Cache
6. WHEN returning cached matches from the Match_Cache, THE Scores API SHALL map each row to the same LiveMatch response structure used for live ESPN data, so that clients receive a consistent format regardless of data source

### Requirement 7: Match Detail View

**User Story:** As a user, I want to click on a match to see detailed information like venue, broadcasts, and odds, so that I can get the full context for a game.

#### Acceptance Criteria

1. WHEN the user clicks on a Score_Card, THE Scores_Page SHALL open a Match_Detail_Modal displaying extended match information within 300 milliseconds of the click
2. THE Match_Detail_Modal SHALL display: venue name, home and away team full names with logos, current score, match status/clock, and odds displayed as moneyline values for each team (if available from ESPN)
3. WHEN the Match_Detail_Modal opens, THE Scores_Page SHALL fetch data from the ESPN_Summary_Endpoint using the match `eventId` with a request timeout of 5 seconds, and SHALL display a loading indicator until the response is received or the request fails
4. IF the ESPN_Summary_Endpoint request fails or times out, THEN THE Match_Detail_Modal SHALL display the basic match data already available from the LiveMatch object (team names, logos, score, status) and show a "Details unavailable" message in place of venue, odds, and other summary-only fields
5. IF the match has no `eventId` defined, THEN THE Match_Detail_Modal SHALL display only the basic match data from the LiveMatch object without attempting to fetch from the ESPN_Summary_Endpoint
6. WHILE the Match_Detail_Modal is open for a live match, THE Match_Detail_Modal SHALL update its score and clock display when the Polling_Manager fetches new data, without closing or resetting the modal
7. WHEN the user clicks the modal close button or clicks outside the Match_Detail_Modal overlay, THE Scores_Page SHALL close the Match_Detail_Modal and return focus to the Score_Card that triggered it

### Requirement 8: Scores API Enhancement

**User Story:** As a developer, I want the scores API to support date filtering and serve cached data for past dates, so that the frontend can request scores for any date efficiently.

#### Acceptance Criteria

1. THE Scores API SHALL accept an optional `date` query parameter in YYYYMMDD format
2. WHEN the `date` parameter is provided and is in the past, THE Scores API SHALL query the Match_Cache first before falling back to ESPN
3. WHEN the `date` parameter is today or not provided, THE Scores API SHALL fetch live data from ESPN (using the existing in-memory cache with 10-second TTL)
4. WHEN the `date` parameter is in the future, THE Scores API SHALL fetch scheduled matches from ESPN with the date parameter appended
5. IF the `date` parameter is not a valid YYYYMMDD string, THEN THE Scores API SHALL return a 400 error with a descriptive message

### Requirement 9: Match Detail API

**User Story:** As a developer, I want a dedicated API endpoint for fetching match details from ESPN's summary endpoint, so that the frontend can load extended match data on demand.

#### Acceptance Criteria

1. THE Match Detail API SHALL be accessible at `/api/scores/[eventId]/summary`
2. WHEN a valid `eventId` is provided, THE Match Detail API SHALL fetch data from the ESPN_Summary_Endpoint for the corresponding sport and league
3. THE Match Detail API SHALL return venue, odds, broadcasts, game leaders/stats, and play-by-play summary when available
4. IF the ESPN_Summary_Endpoint returns an error or times out, THEN THE Match Detail API SHALL return a 502 error with a descriptive message
5. THE Match Detail API SHALL cache successful responses in-memory for 30 seconds to reduce ESPN API load

### Requirement 10: Image Domain Configuration

**User Story:** As a developer, I want ESPN CDN domains configured as allowed image sources, so that team logos load correctly through next/image optimization.

#### Acceptance Criteria

1. THE Next.js configuration SHALL include `a.espncdn.com` as an allowed remote image pattern
2. THE Next.js configuration SHALL include `s.espncdn.com` as an allowed remote image pattern (alternate ESPN CDN)
