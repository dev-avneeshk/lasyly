# Requirements Document

## Introduction

Full redesign of the Stats Panel component, replacing the existing collapsible-section layout with a modern dashboard-style UI. The new panel features a sticky player header, stat boxes with color-coded deltas, an SVG basketball court heatmap, a recharts-powered game history line chart with game boxes, and a horizontal stacked bar for shot distribution. The panel shell expands to 600px+ on desktop and renders as a full-screen modal on mobile. All data is sourced from the existing `GET /api/props/stats-reference` endpoint with client-side reshaping only.

## Glossary

- **Stats_Panel**: The slide-out panel component triggered by clicking a prop card on the analysis page, displaying player statistics in a dashboard layout
- **Player_Header**: The sticky top section of the Stats_Panel displaying player name, prop line, and team badge
- **Stat_Boxes_Row**: A horizontal row of stat summary cards (PTS, AST, REB, 3PM) with color-coded delta indicators
- **Shot_Zones**: An SVG basketball court heatmap visualization showing shooting percentages by court zone
- **Game_History**: A section containing a recharts line chart of the last 10 games and colored game boxes with per-game values
- **Shot_Distribution**: A horizontal stacked bar chart showing shot type percentages (3PT, JMP, LAY, DNK)
- **Prop_Line**: The betting line value for a player stat (e.g., "6.5 PTS")
- **Delta_Indicator**: A color-coded value showing the difference between a player stat and the league average (green for above, red for below)
- **Stats_Reference_API**: The existing endpoint `GET /api/props/stats-reference` returning rawStats, derivedStats, leagueAverages, and cheatSheet data

## Requirements

### Requirement 1: Panel Shell Layout

**User Story:** As a user, I want the stats panel to be wider and more spacious on desktop so that dashboard visualizations have room to render clearly.

#### Acceptance Criteria

1. WHEN the Stats_Panel opens on a viewport wider than 1024px, THE Stats_Panel SHALL render as a slide-out panel with a minimum width of 600px.
2. WHEN the Stats_Panel opens on a viewport of 1024px or narrower, THE Stats_Panel SHALL render as a full-screen modal covering the entire viewport.
3. THE Stats_Panel SHALL display a dark-themed background using the existing Tailwind CSS design tokens.
4. WHEN the user clicks the backdrop overlay or presses the Escape key, THE Stats_Panel SHALL close and return focus to the triggering prop card element.

### Requirement 2: Player Header

**User Story:** As a user, I want to always see which player and prop line I'm viewing so that I maintain context while scrolling through stats.

#### Acceptance Criteria

1. THE Player_Header SHALL display the player name in a large, prominent font size.
2. THE Player_Header SHALL display the Prop_Line value (e.g., "6.5 PTS") adjacent to the player name.
3. THE Player_Header SHALL display the team badge using the existing TeamLogo component.
4. WHILE the user scrolls the Stats_Panel content area, THE Player_Header SHALL remain fixed at the top of the panel (sticky positioning).
5. THE Player_Header SHALL use lime accent color for the Prop_Line value text.

### Requirement 3: Stat Boxes Row

**User Story:** As a user, I want to see key stat averages at a glance with visual indicators showing how the player compares to league average.

#### Acceptance Criteria

1. THE Stat_Boxes_Row SHALL display four stat cards: PTS, AST, REB, and 3PM.
2. WHEN the player average for a stat exceeds the league average, THE Stat_Boxes_Row SHALL display the Delta_Indicator in green.
3. WHEN the player average for a stat falls below the league average, THE Stat_Boxes_Row SHALL display the Delta_Indicator in red.
4. WHEN the player average equals the league average or no league average data exists, THE Stat_Boxes_Row SHALL display the Delta_Indicator in a neutral color.
5. THE Stat_Boxes_Row SHALL render each stat card with the stat value as the primary number and the delta as a secondary label below the value.
6. THE Stat_Boxes_Row SHALL use lucide-react icons to visually indicate the direction of the delta (up arrow for above, down arrow for below).

### Requirement 4: Shot Zones Heatmap

**User Story:** As a user, I want to see a basketball court heatmap showing where the player shoots from so that I can assess shot selection patterns.

#### Acceptance Criteria

1. THE Shot_Zones SHALL render a custom SVG basketball half-court diagram with defined shooting zones (rim, short mid-range, long mid-range, three-point).
2. THE Shot_Zones SHALL color each zone based on shooting efficiency: hot zones in a warm color, cold zones in a cool color, and average zones in a neutral color.
3. THE Shot_Zones SHALL display the shooting percentage as text within each zone of the SVG.
4. THE Shot_Zones SHALL include a legend indicating the meaning of hot, cold, and average zone colors.
5. THE Shot_Zones SHALL derive zone data from the rawStats.shotDistribution fields returned by the Stats_Reference_API.
6. IF the Stats_Reference_API returns null for all shotDistribution fields, THEN THE Shot_Zones SHALL display a placeholder message indicating insufficient shot zone data.

### Requirement 5: Game History Section

**User Story:** As a user, I want to see a player's recent game performance as a trend line and individual game results so that I can identify streaks and consistency.

#### Acceptance Criteria

1. THE Game_History SHALL render a recharts LineChart displaying the player stat values for the last 10 games.
2. THE Game_History SHALL display a horizontal reference line on the chart at the Prop_Line value.
3. THE Game_History SHALL use the lime accent color for the data line and a dashed style for the Prop_Line reference line.
4. THE Game_History SHALL render colored game boxes below the chart, one per game, showing the actual stat value and the opponent team label.
5. WHEN a game value exceeds the Prop_Line, THE Game_History SHALL color that game box in green.
6. WHEN a game value falls below the Prop_Line, THE Game_History SHALL color that game box in red.
7. THE Game_History SHALL derive game-by-game data from the rawStats returned by the Stats_Reference_API, reshaped on the client side.
8. THE Game_History SHALL install and use the recharts library as a project dependency.

### Requirement 6: Shot Distribution Bar

**User Story:** As a user, I want to see the breakdown of shot types as a visual bar so that I can quickly understand the player's scoring profile.

#### Acceptance Criteria

1. THE Shot_Distribution SHALL render a horizontal stacked bar chart showing percentages for four shot types: 3PT, JMP (jumper/mid-range), LAY (layup/rim), and DNK (dunk).
2. THE Shot_Distribution SHALL assign a distinct color to each shot type segment within the bar.
3. THE Shot_Distribution SHALL display a legend below the bar mapping each color to the shot type label and percentage value.
4. THE Shot_Distribution SHALL derive shot type percentages from the rawStats.shotDistribution fields returned by the Stats_Reference_API.
5. IF the Stats_Reference_API returns null for all shotDistribution fields, THEN THE Shot_Distribution SHALL display a placeholder message indicating insufficient distribution data.

### Requirement 7: Data Integration

**User Story:** As a user, I want the new panel to load data from the existing API without requiring backend changes so that the feature ships quickly.

#### Acceptance Criteria

1. THE Stats_Panel SHALL fetch data from the existing `GET /api/props/stats-reference` endpoint using the player name and stat category as query parameters.
2. THE Stats_Panel SHALL reshape the API response on the client side to populate all dashboard sections without requiring backend modifications.
3. WHILE the Stats_Panel is fetching data, THE Stats_Panel SHALL display a loading skeleton animation.
4. IF the Stats_Reference_API returns an error or times out after 10 seconds, THEN THE Stats_Panel SHALL display an error state with a retry button.
5. WHEN the user clicks the retry button, THE Stats_Panel SHALL re-fetch data from the Stats_Reference_API.

### Requirement 8: Responsive Behavior and Theming

**User Story:** As a user, I want the panel to look consistent with the app's dark theme and work well on both desktop and mobile devices.

#### Acceptance Criteria

1. THE Stats_Panel SHALL use the existing dark theme design tokens with lime (#84cc16) as the accent color.
2. THE Stats_Panel SHALL use Tailwind CSS utility classes for all styling.
3. THE Stats_Panel SHALL use lucide-react for all iconography within the panel.
4. WHEN rendered on mobile (viewport 1024px or narrower), THE Stats_Panel SHALL stack all dashboard sections vertically in a single scrollable column.
5. WHEN rendered on desktop (viewport wider than 1024px), THE Stats_Panel SHALL arrange the Stat_Boxes_Row in a horizontal grid of four columns.

### Requirement 9: Removal of Legacy Layout

**User Story:** As a developer, I want the old collapsible-section layout removed so that the codebase does not carry dead UI code.

#### Acceptance Criteria

1. THE Stats_Panel SHALL replace the existing four collapsible sections (Raw Stats, Derived Stats, Source Table, Cheat Sheet) with the new dashboard layout.
2. THE Stats_Panel SHALL remove usage of the CollapsibleSection component from the panel implementation.
3. THE Stats_Panel SHALL preserve the existing panel open/close behavior, focus trap, and accessibility attributes (role="dialog", aria-modal, aria-labelledby).
