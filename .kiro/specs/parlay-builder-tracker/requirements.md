# Requirements Document

## Introduction

A parlay builder and tracker feature for Lasyly that extends the existing props analysis page and bet tracker. Users can build multi-leg parlays from player prop cards, save them with a status (pending/won/lost), and choose to share them publicly as styled betslip cards on the social feed or keep them private on their personal dashboard. The feature integrates with the existing ParlayBuilder bottom sheet on the analysis page, the existing dashboard, and the social rooms/feed system.

## Glossary

- **Parlay_Builder**: The UI component (bottom sheet on the analysis page) that allows users to add, remove, and review parlay legs before saving.
- **Parlay**: A saved multi-leg bet consisting of two or more player prop selections that must all hit for the parlay to win.
- **Parlay_Leg**: A single player prop selection within a parlay, containing the player name, stat category, prop line, and direction (over/under).
- **Parlay_Tracker**: The system responsible for persisting parlays, tracking their status, and displaying them on the dashboard.
- **Betslip_Card**: A styled, shareable image/card displaying parlay details (legs, odds, stake, custom text) that can be posted to the social feed or rooms.
- **Social_Feed**: The public feed where users can post betslip cards for others to view and react to.
- **Dashboard_Widget**: A section on the user's dashboard displaying their tracked parlays with performance statistics.
- **Visibility**: The access level of a parlay — either "public" (visible on social feed) or "private" (visible only to the owner on their dashboard).
- **Parlay_Status**: The outcome state of a parlay — one of "pending", "won", or "lost".
- **Combined_Hit_Rate**: The computed probability that all legs in a parlay hit simultaneously, based on overlapping historical game data.

## Requirements

### Requirement 1: Parlay Saving from Builder

**User Story:** As a user, I want to save my built parlay from the analysis page, so that I can track its outcome and optionally share it with others.

#### Acceptance Criteria

1. WHEN the user has two or more legs in the Parlay_Builder and taps the "Save Parlay" button, THE Parlay_Builder SHALL display a save dialog with fields for: visibility toggle (public/private), odds (optional numeric input accepting values between -10000 and +10000), stake amount (optional numeric input accepting values between 0.01 and 99999.99), and custom note (optional text, maximum 280 characters).
2. WHEN the user confirms the save with visibility set to "private", THE Parlay_Tracker SHALL persist the parlay to the database with status "pending" and visibility "private", and close the save dialog within 3 seconds of confirmation.
3. WHEN the user confirms the save with visibility set to "public", THE Parlay_Tracker SHALL persist the parlay to the database with status "pending" and visibility "public", generate a Betslip_Card, and post it to the Social_Feed.
4. THE Parlay_Tracker SHALL require a minimum of 2 legs and a maximum of 10 legs to save a parlay.
5. IF the user is not authenticated when attempting to save, THEN THE Parlay_Builder SHALL redirect the user to the login page.
6. WHEN a parlay is saved, THE Parlay_Tracker SHALL store each leg with: player name, stat category, prop line, direction, and the L10 hit rate at the time of creation.
7. THE Parlay_Tracker SHALL assign a unique identifier to each saved parlay and record the creation timestamp in UTC.
8. IF the save operation fails due to a database or network error, THEN THE Parlay_Tracker SHALL display an error message indicating the save was unsuccessful, retain all entered dialog field values, and not close the save dialog.
9. IF the user provides an odds value outside the range -10000 to +10000 or a stake amount outside the range 0.01 to 99999.99, THEN THE Parlay_Builder SHALL display a validation error indicating the allowed range and SHALL NOT submit the save request.
10. WHILE the Parlay_Builder contains fewer than 2 legs, THE Parlay_Builder SHALL disable the "Save Parlay" button and SHALL NOT allow the user to open the save dialog.

---

### Requirement 2: Parlay Status Tracking

**User Story:** As a user, I want to mark my parlays as won, lost, or keep them pending, so that I can track my parlay betting performance over time.

#### Acceptance Criteria

1. WHEN a parlay has status "pending", THE Parlay_Tracker SHALL display action buttons allowing the user to mark it as "won" or "lost".
2. WHEN the user marks a parlay as "won", THE Parlay_Tracker SHALL update the parlay status to "won" and record the resolution timestamp in UTC.
3. WHEN the user marks a parlay as "lost", THE Parlay_Tracker SHALL update the parlay status to "lost" and record the resolution timestamp in UTC.
4. WHEN a parlay status changes from "pending" to "won" or "lost", THE Parlay_Tracker SHALL update the user's parlay performance statistics: win count (total parlays with status "won"), loss count (total parlays with status "lost"), win rate (won divided by won plus lost, expressed as a percentage rounded to 1 decimal place), and total profit/loss (sum of payout minus stake for all resolved parlays that have both stake and odds values defined).
5. WHILE the undo window is active (within 60 seconds of marking a parlay as "won" or "lost"), WHEN the user taps the undo action, THE Parlay_Tracker SHALL revert the parlay status to "pending", remove the resolution timestamp, and recalculate the user's parlay performance statistics to exclude the reverted parlay.
6. IF the user attempts to undo a parlay resolution after the 60-second undo window has elapsed, THEN THE Parlay_Tracker SHALL not modify the parlay status and SHALL not display the undo action.
7. IF a user who is not the parlay owner attempts to change the parlay status, THEN THE Parlay_Tracker SHALL reject the request with an authorization error and leave the parlay status unchanged.

---

### Requirement 3: Public Betslip Card Generation

**User Story:** As a user, I want my public parlays to appear as styled betslip cards on the social feed, so that other users can see my picks and react to them.

#### Acceptance Criteria

1. WHEN a parlay is saved with visibility "public", THE Betslip_Card SHALL display: all leg details (player, stat, line, direction), the combined hit rate percentage, the user's display name and avatar, the creation date, and the parlay status.
2. WHERE the user provides odds, THE Betslip_Card SHALL display the odds value formatted with a "+" prefix for positive American odds or as a decimal multiplier.
3. WHERE the user provides a stake amount, THE Betslip_Card SHALL display the stake formatted as a currency value and compute the potential payout as stake × odds for decimal odds or stake × (odds/100) for positive American odds or stake × (100/|odds|) for negative American odds.
4. WHERE the user provides a custom note, THE Betslip_Card SHALL display the note text below the leg details.
5. THE Betslip_Card SHALL use the Lasyly dark theme styling with the lime accent color for "over" legs and the danger color for "under" legs.
6. WHEN a public parlay's status changes to "won", THE Betslip_Card SHALL display a "WON" badge with a success color indicator.
7. WHEN a public parlay's status changes to "lost", THE Betslip_Card SHALL display a "LOST" badge with a danger color indicator.
8. WHEN a public parlay's status is "pending", THE Betslip_Card SHALL display a "PENDING" badge with a neutral/muted color indicator.
9. IF the combined hit rate is null (computation failed), THE Betslip_Card SHALL omit the combined hit rate section rather than displaying zero or an error.
10. THE Betslip_Card SHALL be rendered as a React component that accepts a parlay object as props and is reusable in the social feed, rooms chat, and profile pages.

---

### Requirement 4: Social Feed Integration

**User Story:** As a user, I want to see other users' public parlays in the social feed, so that I can discover picks, react to them, and engage with the community.

#### Acceptance Criteria

1. WHEN a parlay is saved with visibility "public", THE Social_Feed SHALL display the Betslip_Card in the feed ordered by creation timestamp descending (newest first) within 5 seconds of the save completing.
2. THE Social_Feed SHALL allow authenticated users to react to Betslip_Cards using the existing reaction system, supporting up to 5 distinct emoji reactions per user per Betslip_Card with toggle behavior (tapping an already-placed reaction removes it).
3. THE Social_Feed SHALL display the reaction counts grouped by emoji on each Betslip_Card, where each group shows the emoji and its total count across all users.
4. WHEN a user taps on a Betslip_Card in the feed, THE Social_Feed SHALL expand the card to show all leg details (player name, stat category, prop line, direction, and L10 hit rate for each leg) and the combined hit rate percentage.
5. THE Social_Feed SHALL paginate public parlays with a page size of 20 items per request, loading additional pages on scroll until no more items are available.
6. THE Social_Feed SHALL filter out Betslip_Cards from users that the viewing user has blocked, so that no content from blocked users appears in the feed results.
7. WHEN a public parlay's status is updated (won/lost), THE Social_Feed SHALL reflect the updated status badge on the Betslip_Card within 5 seconds via Supabase Realtime subscriptions.
8. IF the user is not authenticated, THEN THE Social_Feed SHALL display public Betslip_Cards in read-only mode without reaction controls.
9. IF the feed query returns zero results, THEN THE Social_Feed SHALL display an empty state message indicating no public parlays are available.
10. IF the feed data fails to load due to a network or server error, THEN THE Social_Feed SHALL display an error indication and provide a retry action to re-fetch the feed.

---

### Requirement 5: Dashboard Parlay Widget

**User Story:** As a user, I want to see all my tracked parlays on my dashboard with performance stats, so that I can monitor my parlay betting history and success rate.

#### Acceptance Criteria

1. THE Dashboard_Widget SHALL display a paginated list of the user's parlays (both public and private) sorted by creation date descending, showing a maximum of 20 parlays per page, with a tab filter for: All, Pending, Won, Lost.
2. THE Dashboard_Widget SHALL display summary statistics at the top: total parlays, won count, lost count, pending count, win rate percentage, and net profit/loss.
3. WHEN the user has no saved parlays, THE Dashboard_Widget SHALL display an empty state message with a call-to-action linking to the analysis page.
4. THE Dashboard_Widget SHALL display each parlay as a compact card showing: number of legs, first two player names with a "+N more" indicator (where N is the remaining leg count, omitted when the parlay has exactly 2 legs), status badge (Pending, Won, or Lost), odds formatted as a decimal multiplier (if provided), and creation date in "DD Mon YYYY" format.
5. WHEN the user taps a parlay card in the dashboard, THE Dashboard_Widget SHALL expand it to show all leg details (player name, stat category, prop line, direction, and L10 hit rate per leg), the combined hit rate, stake, potential payout, and status action buttons (for pending parlays).
6. THE Dashboard_Widget SHALL compute win rate as: (won_count / (won_count + lost_count)) × 100, rounded to one decimal place, excluding pending parlays from the calculation. IF won_count and lost_count are both zero, THEN THE Dashboard_Widget SHALL display win rate as "—".
7. THE Dashboard_Widget SHALL compute net profit/loss as: sum of (stake × (odds - 1)) for won parlays minus sum of stake for lost parlays, rounded to 2 decimal places, using only parlays where both stake and odds are provided. IF no parlays have both stake and odds provided, THEN THE Dashboard_Widget SHALL display net profit/loss as "$0.00".

---

### Requirement 6: Database Schema for Parlays

**User Story:** As a developer, I want a well-structured database schema for parlays and their legs, so that the tracker can efficiently store, query, and update parlay data.

#### Acceptance Criteria

1. THE system SHALL create a Supabase migration adding a `parlays` table with columns: id (UUID, primary key, default gen_random_uuid()), user_id (UUID, NOT NULL, references auth.users), status (TEXT, NOT NULL, CHECK constraint limiting to 'pending', 'won', 'lost', default 'pending'), visibility (TEXT, NOT NULL, CHECK constraint limiting to 'public', 'private'), odds (NUMERIC(10,2), nullable), stake (NUMERIC(10,2), nullable), custom_note (TEXT, nullable, max 280 characters), combined_hit_rate (NUMERIC(4,1), nullable, CHECK constraint limiting to range 0.0 to 100.0), created_at (TIMESTAMPTZ, NOT NULL, default now()), and resolved_at (TIMESTAMPTZ, nullable).
2. THE system SHALL create a `parlay_legs` table with columns: id (UUID, primary key, default gen_random_uuid()), parlay_id (UUID, NOT NULL, references parlays with ON DELETE CASCADE), player_name (TEXT, NOT NULL, max 200 characters), stat_category (TEXT, NOT NULL, max 100 characters), prop_line (NUMERIC(10,2), NOT NULL), direction (TEXT, NOT NULL, CHECK constraint limiting to 'over', 'under'), l10_hit_rate (NUMERIC(4,1), nullable, CHECK constraint limiting to range 0.0 to 100.0), leg_order (INTEGER, NOT NULL, CHECK constraint limiting to range 1 to 20), and sport (TEXT, NOT NULL).
3. THE migration SHALL enable Row Level Security on both tables with policies: users can SELECT their own parlays, users can INSERT parlays where user_id matches their auth.uid(), users can UPDATE only the status, resolved_at, and visibility columns of their own parlays, users can DELETE their own parlays where status is 'pending', and public parlays are readable by all authenticated users via a separate SELECT policy.
4. THE migration SHALL create an index on parlays(user_id, status) for efficient dashboard queries.
5. THE migration SHALL create an index on parlays(visibility, created_at DESC) for efficient social feed queries.
6. THE migration SHALL create an index on parlay_legs(parlay_id) for efficient leg lookups.

---

### Requirement 7: Add-to-Parlay Integration with Props Page

**User Story:** As a user, I want to add props to my parlay directly from the prop cards on the analysis page, so that building a parlay is seamless and integrated with my research workflow.

#### Acceptance Criteria

1. WHEN the user taps the "Add to Parlay" button on a prop card, THE Parlay_Builder SHALL add the prop as a new leg with the player name, stat category, prop line, direction (over/under), and L10 hit rate.
2. IF the user attempts to add a prop that shares the same player name and stat category combination as an existing leg, THEN THE Parlay_Builder SHALL reject the addition and display a toast notification for 3 seconds indicating the prop is already in the parlay.
3. WHEN a prop is added to the parlay, THE prop card SHALL display a visual indicator (disabled styling on the "Add to Parlay" button) showing it is part of the current parlay.
4. WHILE the parlay contains one or more legs, THE Parlay_Builder SHALL display the current leg count as a badge on the floating action button.
5. WHEN the parlay has two or more legs, THE Parlay_Builder SHALL compute and display the combined hit rate by calling the existing `/api/props/parlay` endpoint.
6. IF the `/api/props/parlay` endpoint call fails, THEN THE Parlay_Builder SHALL retain the optimistic leg state without displaying a combined hit rate value.
7. WHEN the user taps the direction indicator on a leg within the parlay panel, THE Parlay_Builder SHALL toggle the direction between over and under and recalculate the combined hit rate by re-calling the `/api/props/parlay` endpoint.
8. IF the parlay already contains 10 legs, THEN THE Parlay_Builder SHALL disable all "Add to Parlay" buttons on prop cards.
9. WHEN the user removes all legs from the parlay, THE Parlay_Builder SHALL hide the floating action button and reset the parlay state to zero legs, null combined hit rate, and zero overlapping dates.

---

### Requirement 8: Parlay Performance Analytics

**User Story:** As a user, I want to see analytics about my parlay performance, so that I can understand my strengths and improve my parlay building strategy.

#### Acceptance Criteria

1. THE Dashboard_Widget SHALL display a "Parlay Stats" section showing: average number of legs per parlay rounded to 1 decimal place, most common sport in parlays, best streak (consecutive wins), and current streak.
2. THE Dashboard_Widget SHALL display a breakdown of win rate by number of legs grouped into "2-leg", "3-leg", and "4+ leg" buckets, where win rate for each bucket is the count of parlays with status "won" divided by the count of resolved parlays (status "won" or "lost") in that bucket, expressed as a percentage rounded to the nearest integer.
3. WHEN the user has fewer than 5 resolved parlays, THE Dashboard_Widget SHALL display a message indicating more data is needed for meaningful analytics and SHALL NOT display the stats from criteria 1 and 2.
4. THE Dashboard_Widget SHALL compute the best streak as the maximum consecutive sequence of parlays with status "won" ordered by resolved_at ascending.
5. THE Dashboard_Widget SHALL compute the current streak as the count of consecutive parlays with the same outcome status ("won" or "lost") from the most recently resolved parlay backwards (ordered by resolved_at descending).
6. IF two or more sports are tied for most common sport in parlays, THEN THE Dashboard_Widget SHALL display the one that appears in the most recently resolved parlay among the tied sports.
7. IF the user has zero resolved parlays, THEN THE Dashboard_Widget SHALL display the "Parlay Stats" section with all counts and streaks as 0 and the most common sport as "—".

---

### Requirement 9: Privacy and Access Control

**User Story:** As a user, I want my private parlays to be visible only to me, so that I can track bets without exposing them to other users.

#### Acceptance Criteria

1. WHILE a parlay has visibility "private", THE Parlay_Tracker SHALL restrict database access to queries where user_id matches the authenticated user's ID, enforced by Row Level Security, such that no other authenticated user's query returns the parlay in any result set.
2. THE Social_Feed SHALL exclude all parlays with visibility "private" from feed queries regardless of any filter or search parameters.
3. WHEN a user views another user's profile, THE system SHALL display only that user's public parlays with their Betslip_Cards, ordered by creation date descending, limited to the 20 most recent entries with pagination support for older results.
4. WHEN the owner changes a parlay's visibility from "private" to "public", THE Parlay_Tracker SHALL generate a Betslip_Card and post it to the Social_Feed within 5 seconds of the change.
5. WHEN the owner changes a parlay's visibility from "public" to "private", THE Parlay_Tracker SHALL remove the Betslip_Card from the Social_Feed and discard all associated reactions within 5 seconds of the change.
6. IF a user attempts to access a private parlay belonging to another user via direct URL or API call, THEN THE system SHALL return a 404 response identical to the response for a non-existent parlay, without revealing the parlay's existence.
7. IF an unauthenticated user attempts to access any parlay by direct URL, THEN THE system SHALL return a 401 response indicating authentication is required.

---

### Requirement 10: Parlay API Endpoints

**User Story:** As a frontend developer, I want well-structured API endpoints for creating, reading, updating, and listing parlays, so that the UI can interact with parlay data efficiently.

#### Acceptance Criteria

1. THE system SHALL provide a POST `/api/parlays` endpoint that accepts a JSON body with: legs (array of 2 to 10 leg objects, each with player_name (string, max 100 characters), stat_category (string, max 50 characters), prop_line (number, 0.5 to 999.5), direction (one of "over" or "under"), l10_hit_rate (number, 0 to 100), and sport (string, max 50 characters)), visibility (one of "public" or "private"), odds (optional number, -10000 to 10000), stake (optional number, 0.01 to 99999.99), custom_note (optional string, max 280 characters), and combined_hit_rate (optional number, 0 to 100).
2. IF the POST request contains fewer than 2 legs or more than 10 legs, THEN THE endpoint SHALL return a 400 status with an error message indicating the valid leg count range of 2 to 10.
3. WHEN a parlay is successfully created, THE endpoint SHALL return a 201 status with the created parlay object including its generated id, all submitted fields, a status of "pending", and a created_at timestamp in ISO 8601 format.
4. THE system SHALL provide a GET `/api/parlays` endpoint that returns the authenticated user's parlays with query parameters: status (optional, one of "pending", "won", "lost"), limit (optional, integer 1-50, default 20), and offset (optional, integer >= 0, default 0).
5. THE system SHALL provide a PATCH `/api/parlays/[id]` endpoint that accepts a JSON body with: status (one of "pending", "won", "lost") or visibility (one of "public", "private"), and updates only the specified field.
6. WHEN the PATCH endpoint receives a status update to "won" or "lost", THE endpoint SHALL set the resolved_at timestamp to the current UTC time in ISO 8601 format. WHEN the status is reverted to "pending", THE endpoint SHALL set resolved_at to null.
7. THE system SHALL provide a GET `/api/parlays/feed` endpoint that returns public parlays from all users, sorted by created_at descending, with pagination parameters: limit (optional, integer 1-50, default 20) and cursor (optional, UUID of the last item from the previous page).
8. IF any endpoint receives a request from an unauthenticated user, THEN THE endpoint SHALL return a 401 status with an error message indicating authentication is required.
9. IF the PATCH endpoint receives a request for a parlay that does not belong to the authenticated user, THEN THE endpoint SHALL return a 404 status without revealing the parlay's existence.
10. IF the POST request contains a leg object missing any required field (player_name, stat_category, prop_line, direction, l10_hit_rate, or sport) or containing an invalid direction value, THEN THE endpoint SHALL return a 400 status with an error message indicating which field failed validation.
11. IF the PATCH endpoint receives a request with an id that does not correspond to any existing parlay, THEN THE endpoint SHALL return a 404 status.
