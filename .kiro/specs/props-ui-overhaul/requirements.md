# Requirements: Props UI Overhaul

## Overview

Overhaul the analysis/props page from a data table into a PrizePicks/PropShark-style card-based interface showing real scraped NBA and Tennis data with visual analytics indicators.

---

## Requirement 1: Sport Tabs

### Acceptance Criteria

1.1. The page displays sport tabs for "NBA" and "Tennis" at the top of the content area.
1.2. Clicking a sport tab switches the displayed props to that sport's data.
1.3. The active sport tab is visually highlighted with the lime accent color and underline.
1.4. Switching sports resets the stat filter to the default for that sport (pts for NBA, aces for Tennis).
1.5. Only sports with real data (NBA, Tennis) are shown — no placeholder tabs for unsupported sports.

---

## Requirement 2: Today's Games Strip

### Acceptance Criteria

2.1. A horizontally scrollable strip of today's games appears below the sport tabs.
2.2. Each game card shows the two teams (NBA) or two players (Tennis) and the scheduled time.
2.3. If no games are scheduled today, the strip displays "No games scheduled today" message.
2.4. The games strip fetches data from the new `/api/props/games` endpoint.
2.5. Completed games show the final score; scheduled games show the start time.

---

## Requirement 3: Stat Category Filters

### Acceptance Criteria

3.1. A horizontal row of pill-shaped filter buttons appears below the games strip.
3.2. NBA stat filters include: Points, Rebounds, Assists, 3-Pointers, Steals, Blocks, PRA (combo).
3.3. Tennis stat filters include: Aces, First Serve %, Win %.
3.4. Selecting a stat filter re-fetches props for that stat category.
3.5. The active stat filter is visually highlighted.
3.6. Stat filters update when the sport tab changes (NBA filters for NBA, Tennis filters for Tennis).

---

## Requirement 4: Player Search

### Acceptance Criteria

4.1. A search input allows filtering props by player name.
4.2. Search is debounced by 300ms to avoid excessive API calls.
4.3. Search with fewer than 2 characters shows all props (no filter applied).
4.4. Search results update the prop card grid in real-time without full page reload.
4.5. A clear button appears in the search input when text is present.

---

## Requirement 5: Prop Card Display

### Acceptance Criteria

5.1. Each player prop is displayed as a card (not a table row).
5.2. Each card shows: player name, team, stat category label, and prop line value.
5.3. Each card displays a mini bar chart showing the last 5-10 game performance values relative to the prop line.
5.4. Bars that exceed the prop line are colored with the lime accent; bars below are dimmed.
5.5. Each card shows a hit rate badge (e.g., "4/5 over") indicating how often the player exceeded the prop line in recent games.
5.6. Each card shows a trend indicator (up/down/neutral arrow) with percentage change.
5.7. Each card shows the upcoming matchup (opponent name).
5.8. Player avatar shows initials fallback when no image URL is available.

---

## Requirement 6: Prop Line Computation

### Acceptance Criteria

6.1. NBA prop lines are computed as the median of the player's last 10 games for the selected stat.
6.2. Prop lines are rounded to the nearest 0.5.
6.3. Players with fewer than 3 games in the database are excluded from results.
6.4. Tennis prop lines are derived from the player's per-match averages (e.g., aces_per_match).
6.5. The L5 average displayed on the card is the arithmetic mean of the last 5 games.
6.6. The L10 average is the arithmetic mean of the last 10 games.

---

## Requirement 7: Hit Rate and Streak Calculation

### Acceptance Criteria

7.1. Hit rate counts how many of the last 5 games the player went over (>=) the prop line.
7.2. Hit rate is displayed as "{over}/{total} over" format (e.g., "4/5 over").
7.3. Streak dots show the last 5 games as colored indicators (lime = over, dim = under).
7.4. The trend is "up" when the average of the last 2 games exceeds the previous 3 games' average by more than 10%.
7.5. The trend is "down" when the average of the last 2 games is below the previous 3 games' average by more than 10%.
7.6. The trend percentage is calculated as ((recent2Avg - prev3Avg) / prev3Avg) * 100.

---

## Requirement 8: Responsive Layout

### Acceptance Criteria

8.1. On mobile (< 768px), prop cards display in a single column.
8.2. On tablet (768px - 1023px), prop cards display in a 2-column grid.
8.3. On desktop (>= 1024px), prop cards display in a 3-column grid.
8.4. The games strip is horizontally scrollable on all screen sizes.
8.5. Stat filter pills are horizontally scrollable on mobile.
8.6. All interactive elements have minimum 44px touch targets on mobile.

---

## Requirement 9: API Enhancement - Props Endpoint

### Acceptance Criteria

9.1. The `/api/props` endpoint accepts `sport`, `stat`, `search`, and `limit` query parameters.
9.2. The response includes `props` array and `meta` object with sport, stat, total count, and timestamp.
9.3. Each prop in the response includes `lastGames` array with per-game values, dates, and opponents.
9.4. Props are sorted by hit rate descending (best picks first), with L5 average as tiebreaker.
9.5. Default limit is 30 props; maximum is 100.
9.6. Results are cached for 60 seconds.
9.7. Invalid stat parameters default to "pts" (NBA) or "aces" (Tennis).

---

## Requirement 10: API - Games Endpoint

### Acceptance Criteria

10.1. A new `/api/props/games` endpoint returns today's games for the specified sport.
10.2. The endpoint accepts a `sport` query parameter ("NBA" or "Tennis").
10.3. NBA games are queried from `nba_games` where `game_date` equals today.
10.4. Tennis games are queried from `tennis_matches` where `status` is "upcoming".
10.5. The response includes a `games` array and `meta` object with sport and date.
10.6. Results are cached for 30 seconds.

---

## Requirement 11: Loading and Error States

### Acceptance Criteria

11.1. While props are loading, skeleton card placeholders are shown matching the card layout.
11.2. While games are loading, skeleton placeholders are shown in the games strip.
11.3. If the API returns an error, a retry button is displayed with "Unable to load props" message.
11.4. If no props match the current filters/search, an empty state message is shown.
11.5. Sport/stat filter changes show a brief loading state before new data appears.

---

## Requirement 12: Dark Theme Consistency

### Acceptance Criteria

12.1. All new components use existing CSS variables (--color-background, --color-surface, --color-lime, --color-border, --color-text-muted).
12.2. Cards use the surface color with subtle border, matching existing app panels.
12.3. The lime accent color (--color-lime) is used for active states, over-line indicators, and highlights.
12.4. No hardcoded color values — all colors reference CSS variables.
