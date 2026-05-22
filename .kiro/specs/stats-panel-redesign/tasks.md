# Tasks: Player Prop Analysis Page Redesign

## Task 1: Create types and mock data layer
- [ ] Create `lib/analysis/types.ts` with all TypeScript interfaces: `PlayerProfile`, `InjuryEntry`, `MatchupInfo`, `StatCategory`, `PerformanceData`, `PerformanceGame`, `FilteredAverage`, `VsTeamGame`, `DefenseDataPoint`, `PositionPointEntry`, `MatchupFactor`, and the top-level `PlayerDashboardData`
- [ ] Create `lib/analysis/mock-data.ts` exporting a complete `PlayerDashboardData` object with realistic NBA data (Kevin Durant as example player, Houston Rockets vs Miami Heat matchup)
- [ ] Mock data should include: 15 game performance entries, 4 injury entries, 9 stat categories with prop lines, 10 filtered average metrics, 2 vs-team games, 10 defense data points, 4 position entries, and 4 matchup factor rows

## Task 2: Create PlayerProfileCard component
- [ ] Create `components/analysis/player-dashboard/PlayerProfileCard.tsx`
- [ ] Implement angled background accent using the project's `--color-primary` variable
- [ ] Display player name, team logo placeholder (styled circle with team abbreviation), player image placeholder
- [ ] Show bottom stats row: FG%, Position, MPG
- [ ] Use project theme variables (`--color-surface`, `--color-border`, `--color-text-primary`, `--color-text-muted`)

## Task 3: Create InjuryReportPanel component
- [ ] Create `components/analysis/player-dashboard/InjuryReportPanel.tsx`
- [ ] Implement table with columns: Player, Status, Impact, Min Impact, # Games, Last X
- [ ] Status column shows colored dot (red for Out) + status text
- [ ] Impact values colored green (positive) or red (negative)
- [ ] Include team selector dropdown in header
- [ ] Style with project theme variables

## Task 4: Create MatchupHeaderCard component
- [ ] Create `components/analysis/player-dashboard/MatchupHeaderCard.tsx`
- [ ] Display game date and time prominently
- [ ] Show both teams with logo placeholders and records (W-L)
- [ ] Display venue name at bottom
- [ ] Use gradient background with subtle pattern overlay
- [ ] Style with project theme variables, use `--color-primary` for accent elements

## Task 5: Create StatSelector component
- [ ] Create `components/analysis/player-dashboard/StatSelector.tsx`
- [ ] Horizontal scrollable row of pill buttons for stat categories (PTS, AST, REB, PTS+AST, PTS+REB, AST+REB, PTS+AST+REB, BLK, STL)
- [ ] Active button shows prop line value and uses `--color-lime` accent with glow effect
- [ ] Inactive buttons show muted text
- [ ] Accept `categories`, `activeCategory`, and `onSelect` props
- [ ] Hide scrollbar but allow horizontal scroll on mobile

## Task 6: Create PerformanceChart component with recharts
- [ ] Create `components/analysis/player-dashboard/PerformanceChart.tsx`
- [ ] Use recharts `ComposedChart` with `Bar` (stat values) and `Line` (minutes)
- [ ] Bars colored `--color-lime` when over threshold, muted gray when under
- [ ] Add dashed `ReferenceLine` for prop threshold
- [ ] Include header with time range toggle buttons (L5, L10, L15, L30, 2025, 2024)
- [ ] Show legend (Points bar, Minutes line, Threshold)
- [ ] Display hit rate counter (e.g., "8/15")
- [ ] X-axis labels show opponent abbreviation and date
- [ ] Include threshold adjustment controls (up/down arrows with current value)

## Task 7: Create FilteredAveragesPanel component
- [ ] Create `components/analysis/player-dashboard/FilteredAveragesPanel.tsx`
- [ ] Table with columns: Metric, L15 value, L5 value with trend indicator
- [ ] Trend indicators: green up arrow with percentage for increases, red down arrow for decreases
- [ ] Metrics include: PTS, MIN, FG%, FG3%, FT%, OREB, DREB, TOUCHES, 2nd AST, PASSES
- [ ] Compact text sizing, scrollable if content overflows

## Task 8: Create bottom row panels (PtsVsTeam, Defense, PositionPoints, MatchupFactors)
- [ ] Create `components/analysis/player-dashboard/PtsVsTeamChart.tsx` — small bar+line chart showing player's stats in previous matchups vs the opponent
- [ ] Create `components/analysis/player-dashboard/DefenseChart.tsx` — bar chart of opponent's defensive rating over recent games with rolling average line, using recharts
- [ ] Create `components/analysis/player-dashboard/PositionPointsPanel.tsx` — compact 2-column table (Position, Points allowed with rank)
- [ ] Create `components/analysis/player-dashboard/MatchupFactorsPanel.tsx` — comparison table with Pace, Off Rtg, Def Rtg, Reb% for both teams

## Task 9: Create PlayerDashboard orchestrator and replace page
- [ ] Create `components/analysis/player-dashboard/PlayerDashboard.tsx` that imports all sub-components and arranges them in the 12-column grid layout
- [ ] Row 1: PlayerProfileCard (3col) | InjuryReportPanel (6col) | MatchupHeaderCard (3col) — fixed height ~280px on desktop
- [ ] Row 2: StatSelector (full width)
- [ ] Row 3: PerformanceChart (9col) | FilteredAveragesPanel (3col) — fixed height ~450px on desktop
- [ ] Row 4: PtsVsTeamChart (3col) | DefenseChart (6col) | PositionPointsPanel (1col) | MatchupFactorsPanel (2col) — fixed height ~180px on desktop
- [ ] Replace `app/(app)/analysis/[playerId]/page.tsx` to render a back button + PlayerDashboard with mock data
- [ ] Ensure responsive stacking on mobile (single column) and tablet (2 columns)
- [ ] Page should have padding, gap between rows, and scroll vertically on overflow
