# Implementation Plan: Parlay Builder & Tracker

## Overview

This plan implements the parlay builder and tracker feature end-to-end: database migration, shared types, CRUD API routes, UI components (SaveParlayDialog, ParlayBetslipCard, DashboardParlayWidget), ParlayBuilder integration, social feed with Realtime, and property-based + integration tests. Each task builds incrementally on the previous, wiring everything together at the end.

## Tasks

- [x] 1. Database migration and shared types
  - [x] 1.1 Create Supabase migration for `parlays` and `parlay_legs` tables
    - Create migration file at `supabase/migrations/YYYYMMDD_create_parlays.sql`
    - Define `parlays` table with all columns, CHECK constraints, and defaults per design
    - Define `parlay_legs` table with FK to parlays (ON DELETE CASCADE), CHECK constraints
    - Enable RLS on both tables
    - Add RLS policies: select_own, select_public, insert_own, update_own, delete_own_pending for parlays
    - Add RLS policies: select_via_parlay, insert_via_parlay for parlay_legs
    - Create indexes: `idx_parlays_user_status`, `idx_parlays_feed`, `idx_parlay_legs_parlay`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 1.2 Create shared TypeScript types for parlays
    - Create `lib/types/parlay.ts` with `Parlay`, `ParlayLeg`, `ParlayStatus`, `ParlayVisibility` types
    - Add `ParlayWithLegs`, `ParlayLegRow`, `ParlayStats`, `SaveParlayPayload`, `ParlayLegInput` interfaces
    - Add `ParlayBetslipCardProps`, `DashboardParlayWidgetProps`, `SaveParlayDialogProps` interfaces
    - _Requirements: 10.1, 10.3, 3.10_

- [x] 2. Parlay validation and computation utilities
  - [x] 2.1 Implement parlay validation functions
    - Create `lib/parlays/validation.ts`
    - Implement `validateCreateParlay(body)` — validates leg count (2–10), required fields per leg, odds range, stake range, custom_note length, direction enum
    - Return structured validation errors with field-level details
    - _Requirements: 1.4, 1.9, 10.1, 10.2, 10.10_

  - [x] 2.2 Implement parlay computation utilities
    - Create `lib/parlays/computations.ts`
    - Implement `computeParlayStats(parlays: ParlayWithLegs[]): ParlayStats` — win rate, net P/L, streaks, by-leg-count buckets, avg legs, most common sport
    - Implement `computePayout(stake, odds): number` — handles decimal and American odds
    - Implement `formatOdds(odds): string` — "+" prefix for positive American, "-" for negative, "x" suffix for decimal
    - Implement `computeStreak(parlays): { best, current }` — ordered by resolved_at
    - _Requirements: 2.4, 3.2, 3.3, 5.6, 5.7, 8.1, 8.2, 8.4, 8.5_

  - [ ]* 2.3 Write property tests for validation logic
    - **Property 1: Leg Count Validation**
    - **Property 4: Odds and Stake Range Validation**
    - **Property 11: Duplicate Prop Rejection**
    - **Validates: Requirements 1.4, 1.9, 7.2, 10.2, 10.10**

  - [ ]* 2.4 Write property tests for computation utilities
    - **Property 5: Performance Stats Computation**
    - **Property 6: Payout Computation**
    - **Property 7: Odds Formatting**
    - **Property 12: Streak Computation**
    - **Property 13: Win Rate by Leg Bucket**
    - **Validates: Requirements 2.4, 3.2, 3.3, 5.6, 5.7, 8.2, 8.4, 8.5**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. API routes for parlay CRUD
  - [x] 4.1 Implement POST `/api/parlays` route
    - Create `app/api/parlays/route.ts` with POST handler
    - Use existing `withSecurity` wrapper for auth
    - Validate request body using `validateCreateParlay`
    - Insert into `parlays` table, then bulk insert legs into `parlay_legs` with `leg_order`
    - If visibility = "public", broadcast to `parlays-feed` Realtime channel
    - Return 201 with created parlay object including generated id and created_at
    - _Requirements: 1.2, 1.3, 1.6, 1.7, 10.1, 10.2, 10.3, 10.8, 10.10_

  - [x] 4.2 Implement GET `/api/parlays` route
    - Add GET handler to `app/api/parlays/route.ts`
    - Accept query params: status (optional filter), limit (1–50, default 20), offset (>=0, default 0)
    - Query user's parlays with RLS, join parlay_legs, order by created_at DESC
    - Return paginated results with total count
    - _Requirements: 5.1, 10.4, 10.8_

  - [x] 4.3 Implement PATCH `/api/parlays/[id]` route
    - Create `app/api/parlays/[id]/route.ts` with PATCH handler
    - Accept status or visibility update in body
    - On status change to "won"/"lost": set resolved_at to current UTC timestamp
    - On status revert to "pending": set resolved_at to null
    - On visibility change to "public": broadcast new parlay to feed channel
    - On visibility change to "private": broadcast removal from feed channel
    - Return 404 for non-existent or non-owned parlays (RLS handles this)
    - _Requirements: 2.1, 2.2, 2.3, 2.7, 9.4, 9.5, 10.5, 10.6, 10.9, 10.11_

  - [x] 4.4 Implement GET `/api/parlays/feed` route
    - Create `app/api/parlays/feed/route.ts` with GET handler
    - Query public parlays with cursor-based pagination (cursor = last item's id)
    - Join parlay_legs and user profile data (display_name, username, avatar_url, is_verified)
    - Exclude blocked users from results
    - Order by created_at DESC, limit (1–50, default 20)
    - Return `{ parlays, nextCursor }` shape
    - _Requirements: 4.1, 4.5, 4.6, 9.2, 10.7, 10.8_

  - [ ]* 2.5 Write property tests for API validation (round-trip and pagination)
    - **Property 2: Parlay Data Round-Trip**
    - **Property 3: Unique Parlay Identifiers**
    - **Property 8: Pagination Invariant**
    - **Property 14: Resolved_at Timestamp Management**
    - **Validates: Requirements 1.6, 1.7, 4.5, 5.1, 10.1, 10.3, 10.4, 10.6, 10.7**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. SaveParlayDialog component
  - [x] 6.1 Implement SaveParlayDialog component
    - Create `components/parlays/SaveParlayDialog.tsx`
    - Use Radix UI Dialog primitive for modal behavior
    - Include fields: visibility toggle (public/private), odds input, stake input, custom note textarea (280 char limit)
    - Show potential payout computed from odds + stake
    - Client-side validation for odds range, stake range, note length
    - Display inline error messages on validation failure
    - Retain field values on API error (don't close dialog)
    - Show loading state during submission
    - _Requirements: 1.1, 1.8, 1.9, 1.10_

  - [ ]* 6.2 Write unit tests for SaveParlayDialog
    - Test renders correct fields and defaults
    - Test validation error display for out-of-range values
    - Test dialog retains values on save error
    - Test disabled state when fewer than 2 legs
    - _Requirements: 1.1, 1.8, 1.9, 1.10_

- [x] 7. ParlayBetslipCard component
  - [x] 7.1 Implement ParlayBetslipCard component
    - Create `components/parlays/ParlayBetslipCard.tsx`
    - Accept `variant` prop: "compact", "expanded", "feed"
    - Compact: show first 2 player names + "+N more", status badge, odds, date
    - Expanded: show all legs with details, combined hit rate, stake, payout, action buttons
    - Feed: show user info (avatar, name), all legs, reactions area
    - Use Framer Motion for expand/collapse animation
    - Status badges: "WON" (success/lime), "LOST" (danger/red), "PENDING" (muted/gray)
    - Leg colors: lime accent for "over", danger for "under"
    - Use Lucide icons for status indicators
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 5.4_

  - [ ]* 7.2 Write property tests for ParlayBetslipCard rendering
    - **Property 15: Betslip Card Completeness**
    - **Property 16: Compact Card Display**
    - **Validates: Requirements 3.1, 5.4**

- [x] 8. ParlayBuilder integration (extend existing save flow)
  - [x] 8.1 Extend ParlayBuilder with save dialog and API integration
    - Modify existing ParlayBuilder component to replace "not available yet" toast with SaveParlayDialog
    - Wire save handler to call POST `/api/parlays`
    - On success: close dialog, clear parlay state, show success toast
    - On error: keep dialog open with error message
    - Disable "Save Parlay" button when fewer than 2 legs
    - Redirect to login if unauthenticated
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.8, 1.10_

  - [x] 8.2 Implement duplicate prop detection and max-leg enforcement
    - Add duplicate check: reject add when (player_name, stat_category) already exists in legs
    - Show toast notification for 3 seconds on duplicate rejection
    - Disable all "Add to Parlay" buttons when parlay has 10 legs
    - Show visual indicator on prop cards already in parlay
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.8, 7.9_

  - [x] 8.3 Implement direction toggle and combined hit rate recalculation
    - Add tap handler on direction indicator within parlay panel to toggle over/under
    - Re-call `/api/props/parlay` on direction change
    - Handle API failure gracefully (retain legs, omit hit rate)
    - _Requirements: 7.5, 7.6, 7.7_

- [x] 9. Dashboard parlay widget
  - [x] 9.1 Implement DashboardParlayWidget component
    - Create `components/parlays/DashboardParlayWidget.tsx`
    - Fetch user's parlays via GET `/api/parlays` with status filter tabs (All, Pending, Won, Lost)
    - Display summary stats at top using `computeParlayStats`
    - Render parlays as compact ParlayBetslipCards with expand on tap
    - Show status action buttons (Won/Lost) on pending parlays in expanded view
    - Implement undo toast with 60-second window on status change
    - Paginate with 20 items per page
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 9.2 Implement parlay performance analytics section
    - Add "Parlay Stats" section to widget
    - Show avg legs, most common sport, best streak, current streak
    - Show win rate by leg bucket (2-leg, 3-leg, 4+-leg)
    - Show "more data needed" message when fewer than 5 resolved parlays
    - Handle zero resolved parlays state (all counts 0, sport "—")
    - Handle tied most common sport (use most recently resolved)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [x] 9.3 Integrate DashboardParlayWidget into DashboardClient
    - Add "My Parlays" section to existing `app/(app)/dashboard/DashboardClient.tsx`
    - Fetch initial parlays and stats server-side for SSR
    - Pass as props to DashboardParlayWidget
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 10. Social feed integration with Realtime
  - [x] 10.1 Implement useParlayFeed hook with Realtime subscription
    - Create `hooks/useParlayFeed.ts`
    - Fetch public parlays from GET `/api/parlays/feed` with cursor-based pagination
    - Subscribe to `parlays-feed` Supabase Realtime channel (Broadcast pattern matching ChatPanel)
    - Handle new parlay broadcasts: prepend to feed
    - Handle status update broadcasts: update affected card in-place
    - Handle removal broadcasts (visibility changed to private): remove from feed
    - Implement `loadMore()` for infinite scroll
    - _Requirements: 4.1, 4.5, 4.7, 4.9, 4.10_

  - [x] 10.2 Integrate parlay feed into social feed page
    - Add ParlayBetslipCard (feed variant) rendering in the bets/feed page
    - Wire expand/collapse on card tap
    - Show empty state when no public parlays
    - Show error state with retry on load failure
    - Handle unauthenticated users (read-only, no reactions)
    - _Requirements: 4.1, 4.4, 4.8, 4.9, 4.10_

  - [ ]* 10.3 Write property tests for feed filtering
    - **Property 9: Private Parlay Exclusion from Feed**
    - **Property 10: Blocked User Exclusion**
    - **Validates: Requirements 4.6, 9.2**

- [x] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Integration tests
  - [ ]* 12.1 Write integration tests for parlay CRUD API
    - Test full save flow: build parlay → POST → verify 201 response with all fields
    - Test GET returns user's parlays with correct filtering
    - Test PATCH status update sets resolved_at
    - Test PATCH status revert to pending clears resolved_at
    - Test 401 for unauthenticated requests
    - Test 404 for non-owned parlay PATCH
    - Test 400 for invalid leg count, missing fields, out-of-range values
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.8, 10.9, 10.10, 10.11_

  - [ ]* 12.2 Write integration tests for feed endpoint and RLS
    - Test feed returns only public parlays
    - Test feed excludes blocked users
    - Test cursor-based pagination returns correct pages
    - Test private parlays never appear in feed
    - Test visibility change from private→public adds to feed
    - _Requirements: 4.1, 4.5, 4.6, 9.1, 9.2, 9.4_

- [x] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The existing `withSecurity` wrapper handles auth consistently across all API routes
- Supabase Realtime uses Broadcast (not postgres_changes) matching the ChatPanel pattern
- All UI components use the existing dark theme with lime accent (Tailwind v4 + Radix UI)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["2.3", "2.4"] },
    { "id": 3, "tasks": ["4.1", "4.2", "4.4"] },
    { "id": 4, "tasks": ["4.3", "2.5"] },
    { "id": 5, "tasks": ["6.1", "7.1"] },
    { "id": 6, "tasks": ["6.2", "7.2", "8.1"] },
    { "id": 7, "tasks": ["8.2", "8.3"] },
    { "id": 8, "tasks": ["9.1", "10.1"] },
    { "id": 9, "tasks": ["9.2", "9.3", "10.2"] },
    { "id": 10, "tasks": ["10.3", "12.1", "12.2"] }
  ]
}
```
