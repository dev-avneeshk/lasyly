# Lasyly NBA Ranking Engine

## Overview

The Lasyly NBA Ranking Engine is a deterministic, algorithmically driven system that computes comprehensive player and team rankings based on advanced statistics, per-game metrics, and historical data.

The engine powers the `/rankings` route, providing 8 specialized player ranking categories (Overall, Offense, Defense, Scoring, Playmaking, Rebounding, Shooting, Two-Way) and Team Power Rankings.

## Core Concepts

### 1. Seasons & Projections
The engine operates on a target `season` (e.g., "2026-27").
- **Historical Rankings**: Uses stats from a completed season (e.g., "2025-26" stats to generate "2025-26" ranks).
- **Projected Rankings**: Uses stats from a completed season (e.g., "2025-26") combined with previous seasons (e.g., "2024-25", "2023-24") to project performance for the upcoming season ("2026-27").

### 2. Normalization & Scoring
To handle the skewed nature of NBA statistics (where top players are extreme outliers), the engine relies heavily on **Percentile Ranking** against the league population.

Component scores (Offense, Defense, etc.) are computed on a 0-100 scale using weighted averages of these percentile ranks.

Example:
```ts
const assistScore = percentileRank(player.ast, league.assistRate)
const playmakingScore = weightedAverage([
  { value: assistScore, weight: 0.6 },
  { value: assistPctScore, weight: 0.4 }
])
```

### 3. Idempotency & Versioning
Pipeline runs are idempotent. A single run generates a `ranking_version` (e.g., `2026-27-v1`). If a version is re-run, it updates the existing rows for that version rather than creating duplicates. The `nba_ranking_history` table maintains an immutable log of player/team movement across seasons.

## Database Schema

- `nba_player_team_history`: Maps players to teams for a given season. Used to resolve 2026-27 rosters.
- `nba_ranking_versions`: Tracks pipeline runs and their statuses (`draft` vs `published`).
- `nba_player_rankings`: Contains all computed component scores, tiers, explanations, and final ranks for players.
- `nba_team_rankings`: Contains power scores, projected wins, and roster breakdown for teams.
- `nba_ranking_history`: Immutable ledger tracking rank movement year-over-year.

## Pipeline Architecture

The orchestration lives in `lib/rankings/pipeline.ts`.

1. **Data Ingestion**: Loads data from `nba_player_season_stats` and `nba_team_stats`.
2. **Multi-Season Blending**: For projections, mathematically blends up to 3 years of historical data using exponential decay weights (e.g., 3:1:0.5).
3. **League Context**: Computes full arrays of league-wide metrics for percentile ranking.
4. **Component Scoring**: Individual modules (`offense.ts`, `defense.ts`, etc.) compute 0-100 scores.
5. **Aggregation**: Overall score is derived from component scores using configured weights.
6. **Tier Assignment & Explanation Generation**: Assigns a readable tier (e.g., "Superstar") and generates dynamic markdown explanations based on the player's statistical profile.
7. **Team Scoring**: Evaluates rosters by aggregating player talent scores (weighted by role), continuity, and team advanced stats.
8. **Commit**: Writes all records to Supabase.

## API Routes

- `GET /api/rankings`: Paginated list of player rankings.
- `GET /api/rankings/players/[id]`: Deep dive into a single player's component scores and history.
- `GET /api/rankings/teams`: Team power rankings list.
- `GET /api/rankings/teams/[team]`: Team deep dive, including roster breakdown.
- `POST /api/jobs/generate-rankings`: Triggers the pipeline execution (requires `x-rankings-secret`).

## Customizing Weights

Ranking weights are defined in `lib/rankings/config.ts`. You can modify the importance of different components. For example, to make Defense matter more in the Overall ranking:

```ts
// In config.ts
export const RANKING_WEIGHTS = {
  overall: {
    offense: 0.55, // decreased from 0.60
    defense: 0.35, // increased from 0.30
    availability: 0.10,
  }
}
```
After modifying weights, you must trigger a new pipeline run for the changes to take effect.
