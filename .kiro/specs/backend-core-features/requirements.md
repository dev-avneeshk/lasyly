# Requirements Document

## Introduction

This document defines the backend requirements for BetRoom's core features: Rooms, Picks/Betting, Wallet/Payments, Social/Follows, Live Scores, and Dashboard Analytics. These requirements cover the API routes, database queries, real-time subscriptions, and business logic needed to replace all mock data with live Supabase-backed functionality. Authentication is explicitly excluded from this scope and will be handled separately.

## Glossary

- **Room_Service**: The backend module responsible for creating, querying, updating, and managing betting rooms
- **Betslip_Service**: The backend module responsible for creating, querying, updating, and managing betslips (picks)
- **Wallet_Service**: The backend module responsible for wallet balance management, Stripe checkout sessions, and transaction processing
- **Social_Service**: The backend module responsible for follow/unfollow relationships and follower-based feed generation
- **Scores_Service**: The backend module responsible for fetching, caching, and serving live sports match data
- **Analytics_Service**: The backend module responsible for computing and serving dashboard statistics and user performance metrics
- **Betslip**: A user-created betting pick containing odds, matches, sportsbook, and status information
- **Room**: A topic-based community space where users share betslips and chat in real-time
- **Tipster**: A user who sells premium picks to other users
- **Wallet_Balance**: The numeric credit balance stored on a user's profile, used for purchasing picks
- **Transaction**: A ledger entry recording wallet credits or debits (TOP_UP, PURCHASE, EARNING, WITHDRAWAL)
- **Unlocked_Pick**: A record indicating a user has paid to view a premium betslip's selections
- **Room_Member**: A record of a user's membership in a specific room with an assigned role
- **LiveMatch**: A data object representing a live or scheduled sports match with scores and status

## Requirements

### Requirement 1: Room Creation

**User Story:** As a user, I want to create a new betting room, so that I can build a community around a sport or topic.

#### Acceptance Criteria

1. WHEN a user submits a room creation request with name, description, sport_tag, and type, THE Room_Service SHALL insert a new room record into the database with the creator_id set to the authenticated user and a server-generated unique id
2. WHEN a room is created, THE Room_Service SHALL automatically add the creator as a room_member with the role "owner"
3. IF the room name is fewer than 3 characters or exceeds 40 characters, THEN THE Room_Service SHALL reject the request with a validation error indicating the name must be between 3 and 40 characters
4. IF the room type is not one of "Public", "Private", or "Tipster", THEN THE Room_Service SHALL reject the request with a validation error
5. IF the description exceeds 200 characters, THEN THE Room_Service SHALL reject the request with a validation error indicating the maximum allowed length
6. IF the sport_tag is not one of "Football", "Basketball", "Tennis", "Mixed", or "Other", THEN THE Room_Service SHALL reject the request with a validation error indicating the allowed values
7. IF the user is not authenticated, THEN THE Room_Service SHALL reject the room creation request with an authentication error
8. WHEN a room is successfully created, THE Room_Service SHALL return the new room object including its generated id, name, description, type, sport_tag, creator_id, member_count, and created_at timestamp

### Requirement 2: Room Querying and Listing

**User Story:** As a user, I want to browse and search rooms, so that I can find communities to join.

#### Acceptance Criteria

1. WHEN a user requests the explore page, THE Room_Service SHALL return a paginated list of public and tipster rooms ordered by member_count descending with a default page size of 20 and maximum page size of 50
2. WHEN a user provides a sport_tag filter, THE Room_Service SHALL return only rooms matching that sport_tag
3. WHEN a user provides a search query (minimum 2 characters, maximum 100 characters), THE Room_Service SHALL return rooms whose name or description contains the query text (case-insensitive)
4. WHEN a user requests their joined rooms, THE Room_Service SHALL return only rooms where the user has a room_members record, ordered by the most recent message or betslip created_at timestamp in that room
5. THE Room_Service SHALL include the member_count, is_live status, and sport_tag for each room in list responses
6. IF the search query is fewer than 2 characters, THEN THE Room_Service SHALL return a validation error

### Requirement 3: Room Join and Leave

**User Story:** As a user, I want to join or leave rooms, so that I can manage my community memberships.

#### Acceptance Criteria

1. WHEN an authenticated user sends a join request for a room they have not joined, THE Room_Service SHALL insert a room_members record with role "member" and return a response containing joined state as true and the updated member_count
2. WHEN an authenticated user sends a join request for a room they have already joined, THE Room_Service SHALL remove their room_members record and return a response containing joined state as false and the updated member_count
3. WHEN a room_members record is inserted or deleted, THE Room_Service SHALL recalculate and persist the room's member_count so that subsequent queries reflect the change
4. IF the room does not exist, THEN THE Room_Service SHALL return a 404 error indicating the room was not found
5. IF the user is not authenticated, THEN THE Room_Service SHALL return a 401 error indicating that unauthenticated users cannot join rooms, without modifying any room_members records
6. IF a database error occurs during the join or leave operation, THEN THE Room_Service SHALL return a 500 error indicating the failure and leave the membership state unchanged

### Requirement 4: Room Detail Retrieval

**User Story:** As a user, I want to view a room's full details, so that I can see its description, stats, and membership status.

#### Acceptance Criteria

1. WHEN a user requests a room by id, THE Room_Service SHALL return the room record including name, description, type, sport_tag, creator_id, member_count, is_live, and created_at
2. WHEN an authenticated user requests a room, THE Room_Service SHALL include a boolean field indicating whether the requesting user is a member of that room
3. WHEN a user requests a room, THE Room_Service SHALL include the creator's profile information consisting of username, display_name, and avatar_url
4. IF a user requests a room with an id that does not match any existing room, THEN THE Room_Service SHALL return a not-found error response and no room data
5. IF an unauthenticated user requests a room, THEN THE Room_Service SHALL return the room record and creator profile without the membership boolean field

### Requirement 5: Betslip Creation

**User Story:** As a user, I want to create and share a betslip in a room, so that other users can see my picks.

#### Acceptance Criteria

1. WHEN a user submits a betslip with sportsbook (max 100 characters), bet_type, odds, matches (1 to 20 entries), and optional room_id, THE Betslip_Service SHALL insert a new betslip record with user_id set to the authenticated user and status defaulting to "Pending"
2. IF odds is less than or equal to zero or greater than 100000, THEN THE Betslip_Service SHALL reject the request with a validation error indicating the odds value is out of the allowed range
3. IF matches array is empty or contains more than 20 entries, THEN THE Betslip_Service SHALL reject the request with a validation error indicating the matches count is invalid
4. IF a betslip is marked as is_for_sale and price is not provided or is less than or equal to zero, THEN THE Betslip_Service SHALL reject the request with a validation error indicating a positive price is required for sale items
5. WHEN a betslip is successfully created, THE Betslip_Service SHALL return the new betslip object with its generated id and created_at timestamp
6. IF bet_type is not one of "Single", "Accumulator", "System", or "Lucky", THEN THE Betslip_Service SHALL reject the request with a validation error indicating an invalid bet type
7. IF room_id is provided and does not reference an existing room, THEN THE Betslip_Service SHALL reject the request with a validation error indicating the room was not found

### Requirement 6: Betslip Feed Retrieval

**User Story:** As a user, I want to see a feed of betslips from rooms I follow and people I follow, so that I can discover picks.

#### Acceptance Criteria

1. WHEN a user requests the home feed, THE Betslip_Service SHALL return betslips from users the requester follows and from rooms the requester is a member of, ordered by created_at descending
2. WHEN a user requests betslips for a specific room, THE Betslip_Service SHALL return betslips belonging to that room ordered by created_at descending
3. WHEN a feed response is returned, THE Betslip_Service SHALL include the betslip creator's profile data (username, display_name, avatar_url, is_verified, win_rate) with each betslip
4. THE Betslip_Service SHALL support cursor-based pagination with a configurable page size (minimum 1, default 20, maximum 50)
5. WHEN a betslip is marked is_for_sale and the requesting user has not unlocked it, THE Betslip_Service SHALL redact the matches array from the response by returning an empty array
6. IF the home feed or room feed contains no betslips matching the criteria, THEN THE Betslip_Service SHALL return an empty array with pagination metadata indicating zero remaining results
7. IF a user requests betslips for a room_id that does not exist, THEN THE Betslip_Service SHALL return a 404 error
8. IF the pagination cursor is invalid or expired, THEN THE Betslip_Service SHALL return results from the beginning of the feed as if no cursor was provided

### Requirement 7: Betslip Reactions

**User Story:** As a user, I want to react to betslips with emojis, so that I can express my opinion on picks.

#### Acceptance Criteria

1. WHEN a user sends a reaction with a betslip_id and emoji, THE Betslip_Service SHALL insert a reaction record for that user, allowing the same user to hold reactions with different emojis on the same betslip (maximum 5 distinct emojis per user per betslip)
2. WHEN a user sends a reaction they have already placed on the same betslip with the same emoji, THE Betslip_Service SHALL remove that reaction (toggle behavior)
3. WHEN a reaction is added or removed, THE Betslip_Service SHALL return the updated reaction counts grouped by emoji for that betslip, where each entry contains the emoji and its total count across all users
4. WHEN a reaction is added or removed, THE Betslip_Service SHALL broadcast the updated reaction counts for that betslip to all clients subscribed to the betslip's room via Supabase Realtime
5. IF the betslip_id does not correspond to an existing betslip, THEN THE Betslip_Service SHALL return a 404 error
6. IF the emoji value is empty or exceeds 32 characters, THEN THE Betslip_Service SHALL reject the request with a validation error

### Requirement 8: Betslip Status Update

**User Story:** As a user, I want to update the status of my betslip (Won, Lost, Void, Partial), so that my followers can see the outcome.

#### Acceptance Criteria

1. WHEN a betslip owner submits a status update with a valid status value, THE Betslip_Service SHALL update the betslip status to the provided value and persist the change within 2 seconds
2. IF the requesting user is not the betslip owner, THEN THE Betslip_Service SHALL reject the request with a 403 error and leave the betslip status unchanged
3. IF the provided status is not one of "Pending", "Won", "Lost", "Void", or "Partial", THEN THE Betslip_Service SHALL reject the request with a validation error indicating the allowed status values
4. WHEN a betslip status is updated to "Won" and a stake is present, THE Betslip_Service SHALL compute and store the payout as stake multiplied by odds, rounded to 2 decimal places
5. IF the betslip ID provided in the status update request does not correspond to an existing betslip, THEN THE Betslip_Service SHALL reject the request with a 404 error
6. IF the betslip status is updated to "Won" and no stake is present, THEN THE Betslip_Service SHALL update the status to "Won" without computing a payout value

### Requirement 9: Pick Unlock (Purchase)

**User Story:** As a user, I want to unlock a premium pick by paying from my wallet, so that I can view the full selections.

#### Acceptance Criteria

1. WHEN a user requests to unlock a betslip, THE Wallet_Service SHALL verify the user's wallet_balance is greater than or equal to the betslip price
2. IF the user's wallet_balance is insufficient, THEN THE Wallet_Service SHALL return a 402 error with a message indicating the current balance and the required price
3. WHEN a pick is unlocked, THE Wallet_Service SHALL deduct the price from the buyer's wallet_balance and insert a PURCHASE transaction with status COMPLETED and the betslip_id as reference_id
4. WHEN a pick is unlocked, THE Wallet_Service SHALL credit 85% of the price to the tipster's wallet_balance and insert an EARNING transaction with status COMPLETED and the betslip_id as reference_id
5. WHEN a pick is unlocked, THE Wallet_Service SHALL insert an unlocked_picks record linking the buyer to the betslip
6. THE Wallet_Service SHALL execute the buyer deduction, tipster credit, and record insertions within a single database transaction to ensure atomicity
7. IF the user has already unlocked the betslip, THEN THE Wallet_Service SHALL return a 409 conflict error
8. IF the betslip_id, price, or tipster_id is missing from the request, THEN THE Wallet_Service SHALL return a 400 validation error
9. IF the requesting user's id equals the tipster_id, THEN THE Wallet_Service SHALL return a 400 error indicating a user cannot purchase their own pick
10. IF the betslip does not exist or is not marked as is_for_sale, THEN THE Wallet_Service SHALL return a 404 error

### Requirement 10: Wallet Top-Up via Stripe

**User Story:** As a user, I want to add funds to my wallet using a credit card, so that I can purchase premium picks.

#### Acceptance Criteria

1. WHEN an authenticated user requests a wallet top-up with an amount between 10 and 10000 (inclusive, in USD), THE Wallet_Service SHALL create a Stripe Checkout session with the specified amount converted to cents
2. IF the amount is less than 10 or greater than 10000, THEN THE Wallet_Service SHALL reject the request with a validation error indicating the allowed range
3. THE Wallet_Service SHALL include the user's id and transaction type "TOP_UP" in the Stripe session metadata
4. WHEN the Stripe Checkout session is created, THE Wallet_Service SHALL return the session URL for client-side redirect
5. IF the Stripe secret key is not configured or is a placeholder value, THEN THE Wallet_Service SHALL return a 503 error indicating payments are unavailable
6. IF the user is not authenticated, THEN THE Wallet_Service SHALL reject the top-up request with a 401 unauthorized error
7. IF the Stripe API returns an error during session creation, THEN THE Wallet_Service SHALL return a 500 error and SHALL NOT create any transaction record

### Requirement 11: Stripe Webhook Processing

**User Story:** As the system, I want to process Stripe webhook events, so that wallet balances are updated after successful payments.

#### Acceptance Criteria

1. WHEN a checkout.session.completed event is received with metadata type "TOP_UP", THE Wallet_Service SHALL increment the user's wallet_balance by the session's amount_total converted from cents to whole currency units (divided by 100)
2. IF the STRIPE_WEBHOOK_SECRET environment variable is configured, THEN THE Wallet_Service SHALL verify the Stripe webhook signature using that secret before processing the event
3. WHEN a top-up is processed, THE Wallet_Service SHALL insert a transaction record with status COMPLETED, the user_id from session metadata, the converted amount, type TOP_UP, and the stripe_session_id
4. IF the webhook signature verification fails, THEN THE Wallet_Service SHALL reject the request with HTTP 400 and not modify any wallet balance or transaction data
5. THE Wallet_Service SHALL use a service-role Supabase client to bypass RLS when writing transaction records from the webhook handler
6. THE Wallet_Service SHALL use an atomic increment operation (database RPC) to update wallet_balance to prevent race conditions from concurrent webhook deliveries
7. IF a transaction record with the same stripe_session_id already exists, THEN THE Wallet_Service SHALL skip processing and return HTTP 200 to ensure idempotent handling of duplicate webhook deliveries
8. IF the session metadata is missing a userId or the amount_total is null or zero, THEN THE Wallet_Service SHALL skip the balance update, not insert a transaction record, and return HTTP 200

### Requirement 12: Wallet Balance and Transaction History

**User Story:** As a user, I want to view my wallet balance and transaction history, so that I can track my spending and earnings.

#### Acceptance Criteria

1. WHEN an authenticated user requests their wallet data, THE Wallet_Service SHALL return the current wallet_balance from the user's profile
2. IF a user requests wallet data without a valid authentication session, THEN THE Wallet_Service SHALL reject the request with an unauthorized error indication
3. WHEN an authenticated user requests their transaction history, THE Wallet_Service SHALL return transactions ordered by created_at descending with cursor-based pagination using a default page size of 20 and a maximum page size of 100
4. THE Wallet_Service SHALL include the transaction type (TOP_UP, PURCHASE, or EARNING), amount, status, and created_at for each transaction in the response
5. WHEN a transaction has a reference_id, THE Wallet_Service SHALL include the associated betslip's basic info (sportsbook, bet_type, odds)
6. IF a transaction has a reference_id but the associated betslip is no longer available, THEN THE Wallet_Service SHALL return the transaction with the reference_id field present and the betslip info omitted

### Requirement 13: Follow and Unfollow

**User Story:** As a user, I want to follow and unfollow other users, so that I can curate my feed with picks from people I trust.

#### Acceptance Criteria

1. WHEN an authenticated user sends a follow request with a valid following_id for a user they do not already follow, THE Social_Service SHALL insert a follows record linking the requesting user to the target user
2. WHEN an authenticated user sends a follow request with a following_id for a user they already follow, THE Social_Service SHALL delete the existing follows record (toggle behavior)
3. IF the following_id equals the requesting user's own id, THEN THE Social_Service SHALL reject the request with a 400 error indicating the user cannot follow themselves
4. WHEN a follow or unfollow operation completes successfully, THE Social_Service SHALL return a response containing: the current following state (boolean indicating whether the requesting user now follows the target), the target user's follower count, and the requesting user's total following count
5. IF the target user specified by following_id does not exist, THEN THE Social_Service SHALL return a 404 error
6. IF the request is made by an unauthenticated or guest user, THEN THE Social_Service SHALL reject the request with a 401 error indicating that guest users cannot follow profiles
7. IF the following_id is missing from the request body or is not a valid string, THEN THE Social_Service SHALL reject the request with a 400 error indicating the field is required

### Requirement 14: User Profile Retrieval

**User Story:** As a user, I want to view another user's profile with their stats, so that I can decide whether to follow them.

#### Acceptance Criteria

1. WHEN a user requests a profile by username or id, THE Social_Service SHALL return the profile record including username, display_name, avatar_url, bio, favourite_sports, country, is_verified, and created_at
2. WHEN a profile is requested, THE Social_Service SHALL compute and return the follower_count and following_count from the follows table
3. WHEN a profile is requested, THE Social_Service SHALL compute and return betting statistics: total_picks, win_rate (percentage of Won betslips out of resolved betslips where resolved means status is Won, Lost, or Void), and average_odds from the betslips table
4. IF the requested user has zero resolved betslips, THEN THE Social_Service SHALL return win_rate as 0 and average_odds as 0
5. WHEN an authenticated user requests another user's profile, THE Social_Service SHALL include a boolean indicating whether the requester follows that user
6. IF no profile exists matching the provided username or id, THEN THE Social_Service SHALL return a 404 error

### Requirement 15: Live Scores Retrieval

**User Story:** As a user, I want to see live sports scores in real-time, so that I can follow matches relevant to my bets.

#### Acceptance Criteria

1. WHEN a client requests live scores, THE Scores_Service SHALL return a JSON response with a success boolean and a data array of LiveMatch objects, each containing id, homeTeam, awayTeam, homeScore, awayScore, clock (optional), status (one of: Not Started, First Half, Halftime, Second Half, Finished, Postponed), league, and sport
2. THE Scores_Service SHALL include a Cache-Control header with a max-age of 10 seconds on successful responses to reduce upstream API load
3. WHEN a SPORTS_API_KEY environment variable is configured, THE Scores_Service SHALL fetch data from the external sports API provider and return at most 50 LiveMatch objects
4. WHEN no SPORTS_API_KEY is configured, THE Scores_Service SHALL return at least 3 simulated mock LiveMatch objects representing different sports for development purposes
5. IF the external sports API returns an HTTP error status or the request times out after 5 seconds, THEN THE Scores_Service SHALL return a 500 status with a JSON body containing success as false and an error field indicating the nature of the failure
6. THE Scores_Service SHALL return the live scores response within 6 seconds under normal operating conditions

### Requirement 16: Live Scores Sport Filtering

**User Story:** As a user, I want to filter live scores by sport, so that I can focus on matches I care about.

#### Acceptance Criteria

1. WHEN a client provides a sport query parameter with a value of "Football", "Basketball", or "Tennis", THE Scores_Service SHALL return only matches where the sport field matches the provided value using a case-insensitive comparison
2. WHEN no sport filter is provided or the sport parameter value is "All", THE Scores_Service SHALL return all available matches across all sports
3. THE Scores_Service SHALL support the following sport filter values: "Football", "Basketball", "Tennis", and "All"
4. IF the sport query parameter contains a value not in the supported list, THEN THE Scores_Service SHALL return an empty matches array with a success response

### Requirement 17: Dashboard Analytics - User Performance

**User Story:** As a user, I want to see my betting performance metrics on the dashboard, so that I can track my progress.

#### Acceptance Criteria

1. WHEN an authenticated user requests their dashboard data, THE Analytics_Service SHALL compute and return total_income (sum of EARNING transaction amounts with status COMPLETED)
2. WHEN a user requests their dashboard data, THE Analytics_Service SHALL compute and return total_wagered (sum of stakes from all betslips that have a non-null stake value)
3. WHEN a user requests their dashboard data, THE Analytics_Service SHALL compute and return win_rate as the percentage of betslips with status "Won" divided by the total number of resolved betslips (Won + Lost + Void), rounded to one decimal place
4. WHEN a user requests their dashboard data, THE Analytics_Service SHALL compute and return total_picks_count, won_count, lost_count, and pending_count as integer values
5. WHEN a user requests their dashboard data, THE Analytics_Service SHALL compute and return average_odds as the arithmetic mean of odds across all betslips, rounded to 2 decimal places
6. IF the user has zero betslips, THEN THE Analytics_Service SHALL return win_rate as 0, average_odds as 0, and all counts as 0
7. IF the user is not authenticated, THEN THE Analytics_Service SHALL reject the request with a 401 error

### Requirement 18: Dashboard Analytics - Sport Breakdown

**User Story:** As a user, I want to see my performance broken down by sport category, so that I can identify my strengths.

#### Acceptance Criteria

1. WHEN a user navigates to the dashboard analytics view, THE Analytics_Service SHALL group the user's betslips by the sport_tag of their associated room
2. THE Analytics_Service SHALL calculate win_rate for each sport category as the number of betslips with status "Won" divided by the total number of betslips with a resolved status ("Won", "Lost", or "Partial"), expressed as a percentage rounded to one decimal place
3. THE Analytics_Service SHALL calculate total profit/loss for each sport category as the sum of (payout minus stake) for all resolved betslips that have both stake and payout values defined
4. THE Analytics_Service SHALL return for each sport category: the category name, total betslips count (including all statuses), win_rate, and total profit/loss
5. THE Analytics_Service SHALL order sport categories by total betslips count descending and return at most the top 5 categories; IF the user has fewer than 5 sport categories, THEN THE Analytics_Service SHALL return only the available categories
6. IF a betslip has no associated room_id, THEN THE Analytics_Service SHALL exclude that betslip from the sport category breakdown

### Requirement 19: Dashboard Analytics - Funds Activity

**User Story:** As a user, I want to see a time-series of my wallet activity, so that I can visualize my earnings and spending over time.

#### Acceptance Criteria

1. WHEN a user requests funds activity data, THE Analytics_Service SHALL return daily aggregated transaction amounts for each of the past 7 calendar days (based on UTC), including days with no transactions represented as zero-value data points
2. THE Analytics_Service SHALL separate the data into two series: income (sum of top-up and earning transactions) and spending (sum of purchase/unlock transactions, represented as positive values in the spending series)
3. THE Analytics_Service SHALL include for each data point a day label in abbreviated weekday format (e.g., "Mon", "Tue") and the total amount for that day rounded to 2 decimal places
4. IF the user has fewer than 7 days of transaction history, THEN THE Analytics_Service SHALL return data points for all 7 days with zero values for days preceding the user's first transaction

### Requirement 20: Dashboard Analytics - Recent Transactions

**User Story:** As a user, I want to see my most recent transactions on the dashboard, so that I have quick visibility into recent activity.

#### Acceptance Criteria

1. WHEN an authenticated user requests recent transactions, THE Analytics_Service SHALL return that user's 10 most recent transactions ordered by created_at descending
2. THE Analytics_Service SHALL include for each transaction: type, amount, created_at, and status
3. IF a transaction has type "PURCHASE" or "EARNING", THEN THE Analytics_Service SHALL include the associated betslip info containing sportsbook, bet_type, and odds
4. IF the user has no transactions, THEN THE Analytics_Service SHALL return an empty list

### Requirement 21: Real-Time Chat Messages

**User Story:** As a user, I want to send and receive chat messages in real-time within a room, so that I can discuss picks and matches with other members.

#### Acceptance Criteria

1. WHEN a user sends a message in a room, THE Room_Service SHALL insert a message record with room_id, user_id, content, and is_system set to false
2. WHEN a message is inserted, THE Room_Service SHALL broadcast the new message to all clients connected to that room via Supabase Realtime within 2 seconds of insertion
3. WHEN a user requests message history for a room, THE Room_Service SHALL return the 50 most recent messages ordered by created_at ascending, including the sender's profile data (username, display_name, avatar_url) with each message
4. WHEN a message is broadcast or returned in message history, THE Room_Service SHALL include the sender's profile data (username, display_name, avatar_url) with each message
5. IF the message content is empty (zero non-whitespace characters) or exceeds 1000 characters, THEN THE Room_Service SHALL reject the request with a validation error indicating the content constraint that was violated
6. IF a user attempts to send a message in a room they are not a member of, THEN THE Room_Service SHALL reject the request with an authorization error and SHALL NOT insert the message

### Requirement 22: Real-Time Betslip Updates

**User Story:** As a user, I want to see new betslips appear in real-time in a room, so that I stay up to date without refreshing.

#### Acceptance Criteria

1. WHEN a betslip is inserted into a room, THE Betslip_Service SHALL broadcast the complete betslip record (id, user_id, sportsbook, bet_type, odds, stake, payout, matches, description, status, is_for_sale, price, comment_count, created_at) to all clients connected to that room's Supabase Realtime channel within 2 seconds of insertion
2. WHEN a betslip status changes to any valid status (Pending, Won, Lost, Void, or Partial), THE Betslip_Service SHALL broadcast the betslip id, updated status, and updated payout value to all clients connected to that room's Supabase Realtime channel within 2 seconds of the update
3. WHEN a real-time betslip broadcast is sent (insert or status update), THE Betslip_Service SHALL include the betslip creator's profile data (username, display_name, avatar_url, is_verified) in the broadcast payload
4. IF the betslip creator's profile data cannot be retrieved during broadcast enrichment, THEN THE Betslip_Service SHALL still deliver the betslip broadcast with profile fields set to null

### Requirement 23: Explore Page Data

**User Story:** As a user, I want the explore page to show trending rooms and top tipsters, so that I can discover new communities.

#### Acceptance Criteria

1. WHEN a user requests explore data, THE Room_Service SHALL return trending rooms sorted by member_count descending, limited to the top 20 results
2. WHEN a user requests explore data, THE Social_Service SHALL return top tipsters (users who are creators of rooms with type "Tipster") sorted by follower count descending, limited to the top 10 results, including each tipster's username, displayName, avatarUrl, follower count, and winRate
3. WHEN the Room_Service returns explore results, THE Room_Service SHALL include for each room the is_live status and a trend indicator calculated as the percentage change in member_count over the past 7 days relative to the member_count 7 days prior
4. IF fewer than 20 trending rooms or fewer than 10 tipsters exist, THEN THE respective service SHALL return all available results without error
5. IF the Room_Service or Social_Service is unavailable when explore data is requested, THEN THE system SHALL return an error response indicating the service is temporarily unavailable within 5 seconds
