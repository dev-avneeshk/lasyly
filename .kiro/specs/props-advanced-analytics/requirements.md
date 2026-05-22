# Requirements Document

## Introduction

This spec defines the advanced analytics layer for the props/analysis page, building on top of the base card UI established in the `props-ui-overhaul` spec. It adds multi-window hit rate visualization, matchup grading, confidence scoring, advanced filtering, player correlations, parlay building, bet tracking, line movement alerts, community sentiment, and AI-generated analysis writeups. These features are inspired by PropShark and Props.Cash and aim to give users deeper statistical insight for prop betting decisions.

## Glossary

- **Analytics_Engine**: The server-side computation module that calculates hit rates, matchup grades, confidence scores, and correlations from raw game data stored in Supabase.
- **Hit_Rate_Bar**: A visual progress bar component showing the percentage of games a player exceeded the prop line within a specific sample window.
- **Matchup_Grade**: A letter grade (A through F) representing how favorable the opposing defense is for a specific stat category.
- **Confidence_Score**: A composite 1-to-5 star rating that weights recency, matchup grade, sample size, and hit rate into a single pick quality indicator.
- **Correlation_Engine**: The computation module that identifies statistical relationships between player props that tend to hit together.
- **Parlay_Builder**: A UI component and computation layer that allows users to combine multiple props and view combined hit rates with correlation warnings.
- **Bet_Tracker**: A user-facing module for logging picks, tracking win/loss records, and computing ROI metrics.
- **Line_Movement_Monitor**: A background process that tracks prop line changes over time and generates alerts for significant moves.
- **Sentiment_System**: A voting and aggregation system where users indicate over/under leans on props and the crowd consensus is displayed.
- **AI_Analyst**: A module that generates per-prop natural language explanations covering recent form, matchup quality, injury context, and line value.
- **Prop_Card**: The existing card component from props-ui-overhaul that displays a single player prop with visual indicators.
- **Window**: A sample size of recent games used for hit rate calculation (L5, L10, L15, L20, Season, or vs Opponent).

## Requirements

### Requirement 1: Multi-Window Hit Rate Bars

**User Story:** As a bettor, I want to see hit rates across multiple sample windows (L5, L10, L15, L20, Season, vs Opponent), so that I can assess consistency across different timeframes.

#### Acceptance Criteria

1. WHEN a Prop_Card is displayed, THE Analytics_Engine SHALL compute hit rates for L5, L10, L15, L20, Season, and vs Opponent windows, where "Season" includes all games from the current NBA season (October through June) or current Tennis season calendar year, and a game counts as "over" when the player's stat value is greater than or equal to the prop line.
2. WHEN hit rate data is available for a prop, THE Prop_Card SHALL render a horizontal Hit_Rate_Bar for each window in the fixed display order: L5, L10, L15, L20, Season, vs Opponent (left to right or top to bottom), showing the hit rate as an integer percentage (0–100%) of games over the prop line.
3. THE Hit_Rate_Bar SHALL use discrete color bands to indicate hit rate strength: red for 0–30%, yellow for 31–60%, and green for 61–100%, where boundary values (exactly 30% and 60%) belong to the lower band.
4. IF a window has fewer than 3 games of data, THEN THE Hit_Rate_Bar SHALL display a "N/A" indicator instead of a percentage bar.
5. WHEN the user hovers or taps a Hit_Rate_Bar, THE Prop_Card SHALL display a tooltip showing the exact count in "{over}/{total} over" format (e.g., "7/10 over"), and the tooltip SHALL remain visible until the user moves the cursor away or taps elsewhere.
6. THE Analytics_Engine SHALL compute the vs Opponent window using only games where the player faced the upcoming opponent as determined by the next scheduled game in the games data source, with no limit on how far back historical matchups are included.
7. IF the player has no upcoming scheduled game or has never faced the upcoming opponent, THEN THE Hit_Rate_Bar for the vs Opponent window SHALL display a "N/A" indicator.

---

### Requirement 2: Matchup Grades

**User Story:** As a bettor, I want to see a letter grade indicating how favorable the defensive matchup is for a specific stat, so that I can quickly identify exploitable matchups.

#### Acceptance Criteria

1. WHEN an NBA prop is displayed, THE Analytics_Engine SHALL compute a Matchup_Grade by ranking the opposing team's points allowed per game in the prop's stat category over their last 10 games against all other NBA teams in the dataset for that same stat category, where a higher rank in points allowed indicates a more favorable matchup for the offensive player.
2. WHEN a Tennis prop is displayed, THE Analytics_Engine SHALL compute a Matchup_Grade by ranking the opponent's stat conceded in the prop's stat category (e.g., aces faced, break points conceded) across all opponents in the dataset for that stat category, where a higher rank in stats conceded indicates a more favorable matchup.
3. THE Matchup_Grade SHALL be one of: A (top 20% percentile rank, most favorable), B (21st–40th percentile), C (41st–60th percentile), D (61st–80th percentile), or F (bottom 20% percentile rank, least favorable), where percentile rank is computed relative to all teams or players in the current dataset for the given stat category.
4. THE Prop_Card SHALL display the Matchup_Grade as a colored letter badge adjacent to the matchup opponent name.
5. THE Matchup_Grade badge SHALL use green for A/B grades, yellow for C grade, and red for D/F grades.
6. IF the opponent has fewer than 3 games of defensive data available for the relevant stat category, THEN THE Prop_Card SHALL omit the Matchup_Grade badge rather than displaying a grade based on insufficient data.
7. IF the dataset contains fewer than 5 teams or players for the stat category (making percentile ranking unreliable), THEN THE Analytics_Engine SHALL omit the Matchup_Grade for all props in that stat category.

---

### Requirement 3: Confidence Score

**User Story:** As a bettor, I want a single composite confidence rating for each prop, so that I can quickly identify the strongest picks without manually weighing multiple factors.

#### Acceptance Criteria

1. THE Analytics_Engine SHALL compute a Confidence_Score for each prop by weighting: L5 hit rate (30%), L10 hit rate (20%), Matchup_Grade (25%), and sample size factor (25%), where the weighted sum maps to stars as follows: 0.0–0.39 = 1 star, 0.40–0.54 = 2 stars, 0.55–0.69 = 3 stars, 0.70–0.84 = 4 stars, 0.85–1.0 = 5 stars.
2. THE Analytics_Engine SHALL normalize each factor to a 0.0–1.0 scale before applying weights: L5 hit rate = (games over line in last 5) / 5, L10 hit rate = (games over line in last 10) / 10, Matchup_Grade = A:1.0 B:0.75 C:0.5 D:0.25 F:0.0, sample size factor = min(games played, 10) / 10.
3. THE Prop_Card SHALL display the Confidence_Score as filled star icons (1–5) positioned between the player name and the hit rate bar within the card layout.
4. WHEN the L5 hit rate is 80% or higher and the Matchup_Grade is A or B, THE Analytics_Engine SHALL assign a minimum Confidence_Score of 4 stars, overriding the weighted formula result if it would produce fewer than 4 stars.
5. WHEN the sample size is fewer than 5 games, THE Analytics_Engine SHALL cap the Confidence_Score at 3 stars regardless of other factors.
6. IF both the minimum-4-star rule (criterion 4) and the 3-star cap (criterion 5) apply simultaneously, THEN THE Analytics_Engine SHALL apply the 3-star cap, resulting in a Confidence_Score of 3 stars.
7. WHEN the user taps the Confidence_Score stars, THE Prop_Card SHALL display a tooltip overlay showing each factor's label, its normalized value as a percentage, and its weighted contribution to the final score, and SHALL dismiss the tooltip when the user taps outside it or taps the stars again.
8. IF a player has fewer than 3 games of data, THEN THE Analytics_Engine SHALL not display a Confidence_Score for that prop and the Prop_Card SHALL show a "Not enough data" label in place of the stars.

---

### Requirement 4: Advanced Filters

**User Story:** As a bettor, I want advanced filtering options beyond basic stat/sport filters, so that I can narrow props to specific situations and confidence levels.

#### Acceptance Criteria

1. WHILE the sport is set to NBA, THE Analysis_Page SHALL provide a "Without Player" text input filter that accepts a teammate name (1 to 50 characters) and restricts hit rate calculations to only games where that teammate did not appear in the box score.
2. THE Analysis_Page SHALL provide a Home/Away toggle filter with three states (All, Home, Away) defaulting to All, that restricts L10 hit rate calculations to home-only or away-only games when selected.
3. THE Analysis_Page SHALL provide an Opposing Team dropdown filter populated with all teams present in the current sport's dataset, that restricts displayed props to players whose upcoming matchup is against the selected team.
4. THE Analysis_Page SHALL provide a minimum Confidence_Score slider filter with integer steps from 1 to 5 stars, defaulting to 1, that hides props with a Confidence_Score below the selected threshold.
5. THE Analysis_Page SHALL provide an Over/Under toggle defaulting to Over, where Over shows the percentage of games the player's stat value was greater than or equal to the prop line, and Under shows the percentage of games the stat value was strictly less than the prop line.
6. THE Analysis_Page SHALL provide a hit rate range filter with minimum and maximum percentage inputs bounded from 0 to 100 in increments of 5, defaulting to 0-100, that shows only props whose L10 hit rate falls within the specified inclusive range.
7. WHEN multiple advanced filters are active simultaneously, THE Analytics_Engine SHALL apply all filters as a logical AND combination and return only props satisfying every active filter condition.
8. THE Analysis_Page SHALL display a numeric count of active filters (filters whose value differs from their default) adjacent to the filter panel header, and provide a "Clear All" button that resets all advanced filters to their default values in a single action.
9. IF the combination of active filters produces zero matching props, THEN THE Analysis_Page SHALL display an empty state message indicating no props match the current filters and suggesting the user adjust or clear filters.
10. WHEN any advanced filter value changes, THE Analysis_Page SHALL display updated results within 2 seconds of the filter interaction completing.

---

### Requirement 5: Player Correlations

**User Story:** As a bettor, I want to see which player props statistically tend to hit together, so that I can build informed parlays with correlated legs.

#### Acceptance Criteria

1. THE Correlation_Engine SHALL compute pairwise Pearson correlation coefficients between player props (defined as a unique player-stat combination) that share at least 10 overlapping games, using the numeric stat values from those overlapping games.
2. WHEN a prop has correlations with a coefficient above 0.5, THE Prop_Card SHALL display a "Correlates with" section listing the top 3 correlated props ordered by coefficient descending, showing for each entry the player name, stat category, and correlation coefficient rounded to 2 decimal places.
3. THE Correlation_Engine SHALL update correlation data daily during the data scraping cycle.
4. WHEN the user taps a correlated prop link and the target prop's card is present on the current page, THE Analysis_Page SHALL scroll the viewport to that prop's card and apply a visible highlight for 2 seconds.
5. THE Correlation_Engine SHALL only compute correlations between props within the same sport.
6. IF fewer than 10 overlapping games exist between two props, THEN THE Correlation_Engine SHALL omit that pair from correlation results.
7. IF the target prop's card is not present on the current page when the user taps a correlated prop link (due to active filters or a different sport tab), THEN THE Analysis_Page SHALL switch filters to display the target prop's sport and stat category before scrolling to the card.
8. IF the Correlation_Engine fails to compute or retrieve correlation data for a prop, THEN THE Prop_Card SHALL omit the "Correlates with" section for that prop without displaying an error.
9. THE Correlation_Engine SHALL compute correlations for a maximum of 500 unique player-stat combinations per sport per computation cycle.

---

### Requirement 6: Parlay Builder

**User Story:** As a bettor, I want to select multiple props and see their combined hit rate and correlation warnings, so that I can build smarter parlays.

#### Acceptance Criteria

1. WHEN the user taps an "Add to Parlay" button on a Prop_Card, THE Parlay_Builder SHALL add that prop to the active parlay selection, provided the prop is not already selected and the parlay contains fewer than 10 legs.
2. IF the user taps "Add to Parlay" on a prop that is already in the active parlay selection, THEN THE Parlay_Builder SHALL ignore the action and not add a duplicate leg.
3. IF the active parlay already contains 10 legs and the user taps "Add to Parlay" on an additional prop, THEN THE Parlay_Builder SHALL reject the addition and display a message indicating the maximum of 10 legs has been reached.
4. THE Parlay_Builder SHALL display a persistent bottom sheet showing all selected props, the combined historical hit rate as a percentage rounded to one decimal place, and the total leg count.
5. THE Parlay_Builder SHALL compute the combined hit rate as the percentage of overlapping dates (dates where all selected props have game data) on which ALL selected props hit simultaneously, using a minimum of 5 overlapping dates; IF fewer than 5 overlapping dates exist, THEN THE Parlay_Builder SHALL display "Insufficient data" instead of a combined hit rate percentage.
6. WHEN two or more selected props have a correlation coefficient above 0.5, THE Parlay_Builder SHALL display a green "Correlated" flag next to those legs.
7. WHEN two or more selected props have a negative correlation coefficient below -0.3, THE Parlay_Builder SHALL display a red "Conflict" warning next to those legs.
8. THE Parlay_Builder SHALL identify and label the "Weak Link" as the leg with the lowest individual L10 hit rate; IF two or more legs share the same lowest L10 hit rate, THE Parlay_Builder SHALL label all tied legs as "Weak Link".
9. WHEN the user removes a prop from the parlay, THE Parlay_Builder SHALL recalculate the combined hit rate, update correlation flags, and re-evaluate the Weak Link label.
10. WHEN the user removes the last remaining prop from the parlay, THE Parlay_Builder SHALL hide the bottom sheet and clear the parlay state.
11. THE Parlay_Builder SHALL require a minimum of 2 legs before displaying the combined hit rate and correlation flags; WHILE only 1 leg is selected, THE Parlay_Builder SHALL display that leg's individual L10 hit rate instead of a combined hit rate.

---

### Requirement 7: Bet Tracking

**User Story:** As a bettor, I want to log my picks and track my win/loss record and ROI over time, so that I can identify which signals predict winners.

#### Acceptance Criteria

1. WHEN the user taps "Log Pick" on a Prop_Card, THE Bet_Tracker SHALL record the player name, stat category, prop line, selected direction (over/under), Confidence_Score, Matchup_Grade, odds (between -10000 and +10000), and stake amount (between 0.01 and 99999.99).
2. THE Bet_Tracker SHALL allow the user to mark any logged pick with status "Pending" as Won, Lost, or Push at any time after logging.
3. WHEN the user navigates to the Bet Tracker view, THE Bet_Tracker SHALL compute and display overall ROI as ((total_winnings - total_staked) / total_staked) * 100, where total_winnings is the sum of (stake * decimal odds) for all picks marked Won plus the sum of stake for all picks marked Push.
4. IF the user has zero total_staked (no resolved picks), THEN THE Bet_Tracker SHALL display ROI as 0%.
5. THE Bet_Tracker SHALL display win/loss record breakdowns filterable by sport, stat category, and confidence score range (1-star increments from 1 to 5), showing for each filter combination: total picks, wins, losses, pushes, win rate percentage, and net profit/loss.
6. THE Bet_Tracker SHALL display a "Best Signals" section showing the top 3 Confidence_Score and Matchup_Grade combinations by win rate, computed only from combinations with at least 5 resolved picks.
7. THE Bet_Tracker SHALL store all pick data in Supabase associated with the authenticated user's profile.
8. IF the user is not authenticated, THEN THE Bet_Tracker SHALL prompt the user to sign in before logging a pick.
9. IF the user submits a pick with odds outside the range -10000 to +10000 or stake outside the range 0.01 to 99999.99, THEN THE Bet_Tracker SHALL reject the entry with a validation error indicating the allowed range.

---

### Requirement 8: Line Movement

**User Story:** As a bettor, I want to see how prop lines change over time and receive alerts for significant moves, so that I can identify sharp money or value shifts.

#### Acceptance Criteria

1. THE Line_Movement_Monitor SHALL record the prop line value for each player-stat combination each time the scraper runs, storing the player identifier, stat category, line value, and a recorded-at timestamp.
2. WHEN a prop line moves by 10% or more relative to the earliest recorded value within the preceding 24-hour window, THE Line_Movement_Monitor SHALL mark that prop as having significant movement by setting a movement flag on the prop record.
3. IF the current prop line differs from the prop line recorded 24 hours ago by any non-zero amount, THEN THE Prop_Card SHALL display a line movement indicator consisting of a directional arrow (up or down) and the absolute change in line value rounded to one decimal place.
4. WHEN the user taps the line movement indicator, THE Prop_Card SHALL display a line chart showing one data point per scraper run over the past 7 days, with the x-axis representing time and the y-axis representing line value, displaying a maximum of 100 data points.
5. THE Line_Movement_Monitor SHALL persist historical line data including player identifier, stat category, line value, and recorded-at timestamp, and SHALL retain this data for at least 30 days.
6. IF no historical line data exists for a prop, THEN THE Prop_Card SHALL omit the line movement indicator.
7. WHEN a prop is marked as having significant movement, THE Line_Movement_Monitor SHALL generate an in-app notification to users who have that player in their followed props list, indicating the player name, stat category, direction of movement, and percentage change.

---

### Requirement 9: Community Sentiment

**User Story:** As a bettor, I want to see how other users lean on a prop (over vs under), so that I can gauge crowd consensus.

#### Acceptance Criteria

1. THE Sentiment_System SHALL display Over and Under vote buttons on each Prop_Card for authenticated users.
2. WHEN the user votes Over or Under on a prop, THE Sentiment_System SHALL record the vote and update the displayed percentages within 2 seconds, where percentages are calculated as (votes for direction / total votes) * 100 rounded to the nearest whole number.
3. THE Sentiment_System SHALL display the crowd lean as a percentage bar showing the Over percentage and Under percentage, where both values sum to 100%.
4. THE Sentiment_System SHALL allow each user to cast one vote per prop per UTC calendar day, permitting the user to switch their vote direction (Over to Under or Under to Over) within the same UTC day but not retract a vote entirely.
5. WHILE fewer than 5 total votes exist for a prop, THE Sentiment_System SHALL display "Not enough votes" instead of percentages.
6. THE Sentiment_System SHALL persist each vote with the user identifier, prop identifier, vote direction (Over or Under), and timestamp, such that votes are retained across sessions and page reloads.
7. IF the user is not authenticated, THEN THE Sentiment_System SHALL display vote percentages as read-only without vote buttons.
8. IF a vote submission fails due to a server or network error, THEN THE Sentiment_System SHALL display an error indication to the user and SHALL NOT update the displayed percentages or local vote state.

---

### Requirement 10: AI Analysis Writeups

**User Story:** As a bettor, I want AI-generated explanations for each prop covering recent form, matchup quality, and line value, so that I can make informed decisions without manual research.

#### Acceptance Criteria

1. WHEN the user expands a Prop_Card detail view, THE AI_Analyst SHALL display a generated text analysis of 3-5 sentences not exceeding 500 characters, within 3 seconds if served from cache or within 15 seconds if generating a new writeup.
2. THE AI_Analyst SHALL include commentary on: recent performance trend, matchup grade context, injury or absence information (when such data exists in the player's record), and line value assessment relative to the computed prop line.
3. THE AI_Analyst SHALL generate writeups using the player's statistical data (last 10 games), matchup grade, and hit rate windows (L5 and L10) as input context.
4. THE AI_Analyst SHALL cache generated writeups for 6 hours to avoid redundant generation.
5. IF the AI generation fails or does not return a response within 15 seconds, THEN THE Prop_Card SHALL display an "Analysis unavailable" placeholder with a retry button that allows the user up to 3 retry attempts before disabling the button and displaying a message indicating to try again later.
6. WHEN the prop line changes by more than 5% from the value used to generate the currently cached writeup, THE AI_Analyst SHALL invalidate the cached writeup and regenerate a new analysis using the updated prop line on the next user request.
7. IF the player has fewer than 3 games of statistical data available, THEN THE AI_Analyst SHALL not generate a writeup and THE Prop_Card SHALL display a message indicating insufficient data for analysis.
