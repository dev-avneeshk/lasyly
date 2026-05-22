# Tasks: Props UI Overhaul

## Task 1: Create Games API Endpoint

### Description
Create the new `/api/props/games` endpoint that returns today's games for NBA and upcoming matches for Tennis.

### Requirements Covered
- Requirement 10 (API - Games Endpoint)

### Acceptance Criteria
- 10.1, 10.2, 10.3, 10.4, 10.5, 10.6

### Steps
- [ ] 1.1 Create `app/api/props/games/route.ts` with GET handler
- [ ] 1.2 Implement NBA games query: fetch from `nba_games` where `game_date` = today's date
- [ ] 1.3 Implement Tennis games query: fetch from `tennis_matches` where `status` = "upcoming"
- [ ] 1.4 Return response with `games` array and `meta` object (sport, date)
- [ ] 1.5 Add 30-second caching using existing `cached()` utility
- [ ] 1.6 Define and export `Game` and `GamesAPIResponse` TypeScript interfaces

---

## Task 2: Enhance Props API Endpoint

### Description
Upgrade the existing `/api/props` endpoint to return richer data including per-game breakdowns, hit rates, and proper sorting.

### Requirements Covered
- Requirement 6 (Prop Line Computation)
- Requirement 7 (Hit Rate and Streak Calculation)
- Requirement 9 (API Enhancement)

### Acceptance Criteria
- 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7

### Steps
- [ ] 2.1 Define new TypeScript interfaces: `PropCardData`, `GameResult`, `HitRate`, `PropsAPIResponse`
- [ ] 2.2 Implement `computePropLine()` function using median calculation, rounded to nearest 0.5
- [ ] 2.3 Implement `computeHitRate()` function that counts games over the prop line in a given window
- [ ] 2.4 Implement `computeTrend()` function comparing recent 2 games avg vs previous 3 games avg
- [ ] 2.5 Refactor `fetchPropsFromDB()` to return `PropCardData[]` with `lastGames`, `hitRate`, `trend`, `l5Avg`, `l10Avg`
- [ ] 2.6 Refactor `fetchTennisPropsFromDB()` to return `PropCardData[]` with tennis-specific stats
- [ ] 2.7 Add `limit` query parameter support (default 30, max 100)
- [ ] 2.8 Sort results by hit rate descending, L5 average as tiebreaker
- [ ] 2.9 Add `meta` object to response with sport, stat, total, computedAt
- [ ] 2.10 Handle invalid stat parameter by defaulting to "pts" (NBA) or "aces" (Tennis)
- [ ] 2.11 Add PRA (Points + Rebounds + Assists) combo stat support for NBA

---

## Task 3: Build Shared Types and Constants

### Description
Create shared type definitions and constants used across the UI components and API.

### Requirements Covered
- Requirement 3 (Stat Category Filters)
- Requirement 5 (Prop Card Display)

### Steps
- [ ] 3.1 Create `lib/props/types.ts` with shared interfaces: `PropCardData`, `GameResult`, `HitRate`, `Game`, `StatFilter`
- [ ] 3.2 Create `lib/props/constants.ts` with NBA_STAT_FILTERS, TENNIS_STAT_FILTERS, STAT_LABELS mappings
- [ ] 3.3 Export sport-specific default stat values (pts for NBA, aces for Tennis)

---

## Task 4: Build GameStrip Component

### Description
Create the horizontally scrollable today's games strip component.

### Requirements Covered
- Requirement 2 (Today's Games Strip)
- Requirement 8 (Responsive Layout)

### Acceptance Criteria
- 2.1, 2.2, 2.3, 2.5, 8.4

### Steps
- [ ] 4.1 Create `components/analysis/GameStrip.tsx` component
- [ ] 4.2 Implement horizontal scroll container with overflow-x-auto and snap scrolling
- [ ] 4.3 Render individual game cards showing teams/players and time
- [ ] 4.4 Show final scores for completed games, start time for scheduled games
- [ ] 4.5 Display "No games scheduled today" empty state
- [ ] 4.6 Add skeleton loading state (3-4 placeholder cards)
- [ ] 4.7 Style with existing CSS variables (surface, border, lime accent)

---

## Task 5: Build StatFilters Component

### Description
Create the horizontal stat category filter pills.

### Requirements Covered
- Requirement 3 (Stat Category Filters)
- Requirement 8 (Responsive Layout)

### Acceptance Criteria
- 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 8.5

### Steps
- [ ] 5.1 Create `components/analysis/StatFilters.tsx` component
- [ ] 5.2 Render pill-shaped buttons for each stat filter
- [ ] 5.3 Highlight active filter with lime accent background
- [ ] 5.4 Accept `sport` prop to show sport-specific filters
- [ ] 5.5 Make pills horizontally scrollable on mobile with overflow-x-auto
- [ ] 5.6 Call `onStatChange` callback when a filter is clicked

---

## Task 6: Build PropCard Component

### Description
Create the individual player prop card with visual analytics.

### Requirements Covered
- Requirement 5 (Prop Card Display)
- Requirement 12 (Dark Theme Consistency)

### Acceptance Criteria
- 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 12.1, 12.2, 12.3, 12.4

### Steps
- [ ] 6.1 Create `components/analysis/PropCard.tsx` component
- [ ] 6.2 Implement player identity section (avatar with initials fallback, name, team)
- [ ] 6.3 Implement prop line display (prominent number + stat label)
- [ ] 6.4 Build mini bar chart showing last 5-10 game values relative to prop line
- [ ] 6.5 Color bars lime when over prop line, dim (white/20) when under
- [ ] 6.6 Add hit rate badge showing "X/Y over" format
- [ ] 6.7 Add trend indicator (arrow icon + percentage) with up=lime, down=red, neutral=muted
- [ ] 6.8 Display matchup info (opponent name)
- [ ] 6.9 Add hover state with subtle lime border glow
- [ ] 6.10 Make card clickable (navigates to player detail page)

---

## Task 7: Build PropCardGrid Component

### Description
Create the responsive grid layout for prop cards with loading and empty states.

### Requirements Covered
- Requirement 8 (Responsive Layout)
- Requirement 11 (Loading and Error States)

### Acceptance Criteria
- 8.1, 8.2, 8.3, 11.1, 11.4

### Steps
- [ ] 7.1 Create `components/analysis/PropCardGrid.tsx` component
- [ ] 7.2 Implement responsive CSS grid: 1 col (< 768px), 2 col (768-1023px), 3 col (>= 1024px)
- [ ] 7.3 Add skeleton loading state with 6 placeholder cards matching card dimensions
- [ ] 7.4 Add empty state with icon and message when no props match filters
- [ ] 7.5 Render PropCard for each item in the props array

---

## Task 8: Build SportTabs Component

### Description
Create the sport selection tabs.

### Requirements Covered
- Requirement 1 (Sport Tabs)

### Acceptance Criteria
- 1.1, 1.2, 1.3, 1.4, 1.5

### Steps
- [ ] 8.1 Create `components/analysis/SportTabs.tsx` component
- [ ] 8.2 Render "NBA" and "Tennis" tab buttons
- [ ] 8.3 Highlight active tab with lime color and bottom border
- [ ] 8.4 Call `onSportChange` callback on click
- [ ] 8.5 Reset stat filter to sport default when sport changes (handled via callback)

---

## Task 9: Overhaul Analysis Page

### Description
Rewrite the analysis page to compose all new components into the PrizePicks-style layout.

### Requirements Covered
- Requirement 1, 2, 3, 4, 5, 8, 11

### Acceptance Criteria
- 1.2, 1.4, 2.4, 4.1, 4.2, 4.3, 4.4, 4.5, 8.6, 11.2, 11.3, 11.5

### Steps
- [ ] 9.1 Rewrite `app/(app)/analysis/page.tsx` with new component composition
- [ ] 9.2 Add state management: sport, stat, search, props, games, loading states
- [ ] 9.3 Implement dual fetch on mount (props + games) with Promise.all
- [ ] 9.4 Wire sport tab changes to reset stat and re-fetch both endpoints
- [ ] 9.5 Wire stat filter changes to re-fetch props endpoint
- [ ] 9.6 Wire search input with 300ms debounce to re-fetch props
- [ ] 9.7 Add error state with retry button when API fails
- [ ] 9.8 Ensure all touch targets are minimum 44px on mobile
- [ ] 9.9 Remove old table-based layout entirely

---

## Task 10: Mobile Responsiveness Polish

### Description
Final pass ensuring all components work well on mobile devices.

### Requirements Covered
- Requirement 8 (Responsive Layout)

### Acceptance Criteria
- 8.1, 8.2, 8.3, 8.4, 8.5, 8.6

### Steps
- [ ] 10.1 Test and fix GameStrip horizontal scroll on mobile (touch scrolling, no scrollbar)
- [ ] 10.2 Test and fix StatFilters overflow on narrow screens
- [ ] 10.3 Verify PropCard content doesn't overflow on 320px width
- [ ] 10.4 Ensure search input and filters don't overlap on small screens
- [ ] 10.5 Add hide-scrollbar utility class for horizontal scroll containers
- [ ] 10.6 Verify 44px minimum touch targets on all interactive elements
