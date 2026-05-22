# Design: Player Prop Analysis Page Redesign

## Overview

Replace the current `app/(app)/analysis/[playerId]/page.tsx` three-column layout (sidebar + center + right panel) with a full-width, information-dense dashboard grid. The new design uses the project's existing theme variables and `recharts` for charting.

## Architecture

### Page Structure

The page is a single full-width scrollable layout with 4 horizontal rows:

```
┌─────────────────────────────────────────────────────────────────┐
│ Row 1: PlayerProfile (3col) | InjuryReport (6col) | Matchup (3col) │
├─────────────────────────────────────────────────────────────────┤
│ Row 2: StatSelector (horizontal scrollable pill buttons)         │
├─────────────────────────────────────────────────────────────────┤
│ Row 3: PerformanceChart (9col) | FilteredAverages (3col)        │
├─────────────────────────────────────────────────────────────────┤
│ Row 4: PtsVsTeam (3col) | DefenseChart (6col) | PosPoints (1col) | MatchupFactors (2col) │
└─────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

All new components live in `components/analysis/player-dashboard/`:

| Component | File | Description |
|-----------|------|-------------|
| `PlayerDashboard` | `PlayerDashboard.tsx` | Top-level orchestrator, fetches data, renders grid |
| `PlayerProfileCard` | `PlayerProfileCard.tsx` | Player photo, name, team logo, key stats (FG%, Position, MPG) |
| `InjuryReportPanel` | `InjuryReportPanel.tsx` | Table of injured players with impact metrics |
| `MatchupHeaderCard` | `MatchupHeaderCard.tsx` | Game date/time, team records, venue |
| `StatSelector` | `StatSelector.tsx` | Horizontal scrollable stat category buttons (PTS, AST, REB, combos) |
| `PerformanceChart` | `PerformanceChart.tsx` | Bar chart (stat values) + line overlay (minutes) + threshold line, using recharts |
| `FilteredAveragesPanel` | `FilteredAveragesPanel.tsx` | Table with L15/L5 averages and trend arrows |
| `PtsVsTeamChart` | `PtsVsTeamChart.tsx` | Small bar+line chart for player stats vs specific opponent |
| `DefenseChart` | `DefenseChart.tsx` | Opponent defense rating bar+rolling line chart |
| `PositionPointsPanel` | `PositionPointsPanel.tsx` | Compact table showing points allowed by position |
| `MatchupFactorsPanel` | `MatchupFactorsPanel.tsx` | Side-by-side team comparison table (Pace, Off Rtg, Def Rtg, Reb%) |

### Data Layer

For this iteration, all data is **mock/placeholder**. A single `lib/analysis/mock-data.ts` file exports typed mock objects:

```typescript
// Types for the dashboard
export interface PlayerDashboardData {
  player: PlayerProfile
  injuries: InjuryEntry[]
  matchup: MatchupInfo
  statCategories: StatCategory[]
  performance: PerformanceData
  filteredAverages: FilteredAverage[]
  vsTeamHistory: VsTeamGame[]
  opponentDefense: DefenseDataPoint[]
  positionPoints: PositionPointEntry[]
  matchupFactors: MatchupFactor[]
}
```

The page component (`page.tsx`) imports mock data and passes it down as props. No API calls needed for this phase.

### Theme Mapping

The HTML mockup uses a purple accent. We map to the project's existing theme:

| Mockup Token | Project Variable | Value |
|---|---|---|
| `accent-purple` | `--color-primary` | `#6C63FF` |
| `accent-purple-light` | `--color-lime` | `#D4FF00` (primary accent) |
| `dash-bg` | `--color-background` | `#0A0B0F` |
| `panel-bg` | `--color-surface` | `#111318` |
| `panel-border` | `--color-border` | `rgba(255,255,255,0.08)` |
| `text-primary` | `--color-text-primary` | `#F0F2FF` |
| `text-secondary` | `--color-text-muted` | `#6B7280` |
| `status-red` | `--color-danger` | `#FF4B4B` |
| `status-green` | `--color-success` | `#22C55E` |
| `chart-bar` | `--color-lime` | `#D4FF00` |
| `chart-line` | `--color-warning` | `#F59E0B` |

The "panel" utility class from the mockup maps to:
```css
/* Reusable panel style */
.dashboard-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
}
```

### Charting (recharts)

The `PerformanceChart` uses recharts `ComposedChart` with:
- `Bar` component for stat values (colored lime if over threshold, muted if under)
- `Line` component for minutes overlay
- `ReferenceLine` for the prop threshold (dashed)
- Custom tooltip showing game details

Smaller charts (`PtsVsTeamChart`, `DefenseChart`) use `ComposedChart` with similar patterns at reduced size.

### Responsive Behavior

- **Desktop (lg+)**: Full 12-column grid as described
- **Tablet (md)**: Rows stack into 2-column layouts
- **Mobile**: Single column, all panels stack vertically. StatSelector remains horizontally scrollable.

### Navigation

- Back button in top-left navigates to `/analysis`
- No sidebar — the page is accessed by clicking a prop card from the analysis list page
- StatSelector buttons switch the active stat category (local state, re-renders chart with different data)

### File Changes Summary

| Action | Path |
|--------|------|
| Create | `components/analysis/player-dashboard/PlayerDashboard.tsx` |
| Create | `components/analysis/player-dashboard/PlayerProfileCard.tsx` |
| Create | `components/analysis/player-dashboard/InjuryReportPanel.tsx` |
| Create | `components/analysis/player-dashboard/MatchupHeaderCard.tsx` |
| Create | `components/analysis/player-dashboard/StatSelector.tsx` |
| Create | `components/analysis/player-dashboard/PerformanceChart.tsx` |
| Create | `components/analysis/player-dashboard/FilteredAveragesPanel.tsx` |
| Create | `components/analysis/player-dashboard/PtsVsTeamChart.tsx` |
| Create | `components/analysis/player-dashboard/DefenseChart.tsx` |
| Create | `components/analysis/player-dashboard/PositionPointsPanel.tsx` |
| Create | `components/analysis/player-dashboard/MatchupFactorsPanel.tsx` |
| Create | `lib/analysis/mock-data.ts` |
| Create | `lib/analysis/types.ts` |
| Replace | `app/(app)/analysis/[playerId]/page.tsx` |
