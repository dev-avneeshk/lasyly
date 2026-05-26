# Implementation Plan: SEO Public Pages

## Overview

Create public, SEO-optimized pages for player analysis, today's props, and live scores by sport. These pages live in the existing `(marketing)` route group, are fully server-rendered with ISR, and include dynamic metadata, JSON-LD structured data, and sitemap/robots integration. Implementation uses TypeScript, Next.js App Router, Tailwind CSS v4, and Supabase.

## Tasks

- [x] 1. Create SEO metadata utilities and player slug helpers
  - [x] 1.1 Create `lib/seo/metadata.ts` with metadata generation functions
    - Implement `generatePlayerTitle(playerName)` — max 60 chars, pattern: `{Name} Props Today — Hit Rates & Matchup Grade | Lasyly`
    - Implement `generatePlayerDescription(playerName, statCategory, propLine, hitRate, matchupGrade)` — 120-160 chars
    - Implement `generatePropsTitle(date)` — pattern: `Today's Player Props — {Month D, YYYY} | Hit Rates & Picks | Lasyly`
    - Implement `generatePropsDescription(propCount, sports)` — max 160 chars
    - Implement `generateScoresTitle(sportName, date)` — pattern: `{Sport} Live Scores Today — {MMM D, YYYY} | Lasyly`
    - Implement `generateScoresDescription(sportName, matchCount, liveCount, upcomingCount)` — max 160 chars
    - _Requirements: 1.3, 1.4, 2.3, 2.4, 3.3, 3.4_

  - [x] 1.2 Create `lib/seo/player-slug.ts` with slug utilities and sport slug map
    - Implement `playerNameToSlug(name)` — lowercase, strip diacritics, replace non-alphanumeric with hyphens, trim leading/trailing hyphens
    - Implement `resolvePlayerSlug(slug)` — query DB to find player by slug
    - Export `SPORT_SLUG_MAP` constant with all 12 supported sport slugs and their DB sport names
    - _Requirements: 1.1, 3.6, 5.1_

  - [ ]* 1.3 Write property tests for metadata and slug utilities
    - **Property 1: Player metadata respects length constraints**
    - **Property 4: Description length constraint**
    - **Property 7: Player slug round-trip**
    - **Validates: Requirements 1.3, 1.4, 2.4, 3.4, 1.1, 5.1**

- [x] 2. Create data layer functions for public pages
  - [x] 2.1 Create `lib/data/public-players.ts`
    - Implement `getPublicPlayerBySlug(slug)` — query `prop_lines` + game logs, return `PublicPlayerData` or null
    - Implement `getAllPlayerSlugs()` — return all player slugs with last game date for sitemap
    - Use `"server-only"` import to prevent client-side usage
    - _Requirements: 1.1, 1.2, 1.8, 1.10, 1.11, 5.1, 5.5_

  - [x] 2.2 Create `lib/data/public-props.ts`
    - Implement `getTodaysPublicProps()` — fetch all props for today (US Eastern Time boundary), group by sport then game
    - Return `{ props, totalCount, sports }` with props ordered: sports alphabetically, games by start time ascending
    - Use `"server-only"` import
    - _Requirements: 2.1, 2.2, 2.6, 2.8, 2.9, 2.10_

  - [ ]* 2.3 Write property test for props ordering invariant
    - **Property 3: Props ordering invariant**
    - **Validates: Requirements 2.2**

- [x] 3. Checkpoint - Ensure data layer and utilities compile
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement public player analysis page
  - [x] 4.1 Create `app/(marketing)/players/[playerSlug]/page.tsx`
    - Server component with ISR (`revalidate: 300`)
    - Call `getPublicPlayerBySlug(slug)` — return `notFound()` if null
    - Render player name, team, sport, prop line, hit rates (L5/L10/season), matchup grade, trend arrow, streak dots (last 10 games)
    - Handle empty prop data state: show player name/team + "No active prop lines" message
    - Include CTA linking to signup and link to authenticated analysis page
    - Generate dynamic metadata via `generateMetadata` export (title, description, OG tags, canonical URL)
    - Render JSON-LD structured data using existing `<JsonLd>` component
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 6.1, 6.4, 6.7_

  - [ ]* 4.2 Write property test for player structured data completeness
    - **Property 2: Player structured data completeness**
    - **Validates: Requirements 1.5, 1.6**

  - [ ]* 4.3 Write property test for props listing field completeness
    - **Property 5: Props listing contains all required fields with player links**
    - **Validates: Requirements 2.7, 2.8**

- [x] 5. Implement public today's props page
  - [x] 5.1 Create `app/(marketing)/props/today/page.tsx`
    - Server component with ISR (`revalidate: 3600`)
    - Call `getTodaysPublicProps()` — render props grouped by sport then game
    - Display each prop: player name (linked to `/players/{playerSlug}`), stat category, prop line, L10 hit rate %, matchup grade
    - Handle empty state: "No props available" message + links to next 3 dates with games
    - Handle >200 props: server-render first 200, add client "Load more" button
    - Generate dynamic metadata (title with date, description with count/sports, JSON-LD ItemList)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 6.2, 6.5, 6.7_

- [x] 6. Implement public scores page by sport
  - [x] 6.1 Create `app/(marketing)/scores/[sportSlug]/page.tsx`
    - Server component with ISR (`revalidate: 30` when live matches exist, `revalidate: 300` otherwise)
    - Validate `sportSlug` against `SPORT_SLUG_MAP` — return `notFound()` if invalid
    - Call existing `getScoresForDate()` with sport filter from slug map
    - Render matches: team names, scores, status (live/upcoming/finished), start times
    - Handle empty state: "No matches scheduled" message with valid SEO metadata (match count = 0)
    - Generate dynamic metadata (title, description, OG tags, canonical URL, JSON-LD SportsEvent per match)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 6.3, 6.6, 6.7_

  - [ ]* 6.2 Write property test for scores JSON-LD SportsEvent validity
    - **Property 6: Scores JSON-LD SportsEvent validity**
    - **Validates: Requirements 3.5**

- [x] 7. Checkpoint - Ensure all pages render correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Update robots.txt and sitemap
  - [x] 8.1 Update `app/robots.ts` to allow new public paths
    - Add `/players/`, `/props/`, `/scores/` to the allow list for all user-agent rules
    - Remove `/analysis/` from the disallow list
    - Keep existing disallow paths (`/dashboard/`, `/wallet/`, `/profile/`, `/bets/`, `/rooms/`, `/api/`)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 8.2 Update `app/sitemap.ts` to include new public page entries
    - Add entries for all players with prop lines (URL: `/players/{playerSlug}`, changeFrequency: daily, priority: 0.7, lastModified: most recent game date)
    - Add entry for `/props/today` (changeFrequency: daily, priority: 0.9, lastModified: current date)
    - Add entries for all 12 sport scores pages (changeFrequency: hourly, priority: 0.8, lastModified: current date)
    - Handle DB unreachable: serve static entries without dynamic player entries
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 8.3 Write property test for sitemap lastModified correctness
    - **Property 8: Sitemap lastModified correctness**
    - **Validates: Requirements 5.5**

- [x] 9. Create database migration for player slug indexes
  - [x] 9.1 Create migration file for player slug lookup indexes
    - Add `idx_prop_lines_player_slug` index on `prop_lines` for fast slug lookups
    - Add `idx_prop_lines_recent_players` index for sitemap generation (players with recent activity)
    - _Requirements: 1.1, 5.1, 5.5_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using `fast-check`
- Unit tests validate specific examples and edge cases
- The existing `(marketing)` layout, `JsonLd` component, and `lib/data/scores.ts` are reused — no need to recreate them
- All pages are server components; client components only for interactive elements (Load more button, filters)
- Test file location: `__tests__/seo/public-pages.property.test.ts`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1", "2.2", "9.1"] },
    { "id": 2, "tasks": ["2.3", "4.1", "5.1", "6.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "6.2", "8.1", "8.2"] },
    { "id": 4, "tasks": ["8.3"] }
  ]
}
```
