# Requirements Document

## Introduction

This feature introduces public, SEO-optimized pages for Lasyly's player analysis, daily props, and live scores content. Currently these pages live behind authentication in the `(app)` route group. The goal is to create lightweight, read-only public versions with proper metadata, structured data (JSON-LD), and programmatic SEO patterns to generate hundreds of indexable pages from existing scraped data — driving organic search traffic for queries like "Victor Wembanyama props today" or "NBA live scores."

## Glossary

- **Public_Page_Router**: The Next.js route group serving public, unauthenticated SEO pages (e.g., `(public)` or top-level routes outside `(app)`)
- **Player_Analysis_Page**: A read-only public page displaying a single player's prop analytics (hit rates, matchup grade, trend, streak dots)
- **Todays_Props_Page**: A programmatic SEO page listing all available player props for today's games, refreshed daily
- **Scores_Page**: A public page displaying live and recent scores for a specific sport or league
- **SEO_Metadata_Generator**: The module responsible for producing dynamic `<title>`, `<meta description>`, Open Graph tags, and JSON-LD structured data for public pages
- **Sitemap_Generator**: The existing `app/sitemap.ts` module that produces the XML sitemap
- **Robots_Config**: The existing `app/robots.ts` module that produces the robots.txt directives
- **Player_Slug**: A URL-safe identifier derived from a player's name (e.g., `victor-wembanyama`)
- **Sport_Slug**: A URL-safe identifier for a sport or league (e.g., `nba`, `nfl`, `premier-league`)

## Requirements

### Requirement 1: Public Player Analysis Pages

**User Story:** As a search engine user, I want to find player prop analysis pages on Lasyly through Google, so that I can view hit rates and matchup grades without needing an account.

#### Acceptance Criteria

1. WHEN a request is made to `/players/[playerSlug]`, THE Public_Page_Router SHALL render a read-only Player_Analysis_Page without requiring authentication, where `playerSlug` is a lowercase alphanumeric string with hyphens derived from the player's full name (e.g., `lebron-james`)
2. WHEN a Player_Analysis_Page is rendered, THE Player_Analysis_Page SHALL display the player name, team, sport, current prop line (numeric value with stat category), hit rate as a percentage for L5, L10, and season windows, matchup grade (letter grade A through F), trend direction (up, down, or neutral arrow), and a streak visualization showing the result of each of the last 10 games as individual indicators (over or under the line)
3. WHEN a Player_Analysis_Page is rendered, THE SEO_Metadata_Generator SHALL produce a `<title>` tag following the pattern `{Player Name} Props Today — Hit Rates & Matchup Grade | Lasyly` with a maximum length of 60 characters (truncating the player name if necessary)
4. WHEN a Player_Analysis_Page is rendered, THE SEO_Metadata_Generator SHALL produce a meta description between 120 and 160 characters summarizing the player's current prop line, hit rate percentage, and matchup grade
5. WHEN a Player_Analysis_Page is rendered, THE SEO_Metadata_Generator SHALL produce Open Graph tags including `og:title`, `og:description`, `og:type` (article), and `og:url`
6. WHEN a Player_Analysis_Page is rendered, THE SEO_Metadata_Generator SHALL produce JSON-LD structured data using the `SportsEvent` or `Article` schema type with player name, stat category, and analysis date
7. WHEN a Player_Analysis_Page is rendered, THE Player_Analysis_Page SHALL include a canonical URL in a `<link rel="canonical">` tag pointing to `https://lasyly.me/players/{playerSlug}`
8. THE Player_Analysis_Page SHALL be server-rendered (SSR or ISR) so that search engine crawlers receive complete HTML content including all player data elements from criterion 2 without requiring client-side JavaScript execution
9. WHEN a Player_Analysis_Page is rendered, THE Player_Analysis_Page SHALL include a visible call-to-action element linking to the signup page and a separate link to the full authenticated analysis page for that player
10. IF a player slug does not match any known player, THEN THE Public_Page_Router SHALL return a 404 HTTP status code with a not-found page that includes a link back to the site homepage
11. IF a player slug matches a known player but no current prop line data is available, THEN THE Player_Analysis_Page SHALL display the player name and team with a message indicating that no active prop lines are available, and SHALL omit hit rate, matchup grade, and streak visualization sections

### Requirement 2: Public Today's Props Page

**User Story:** As a sports bettor searching for today's player props, I want to find a comprehensive props listing page on Lasyly through search engines, so that I can quickly see all available props for today's games.

#### Acceptance Criteria

1. WHEN a request is made to `/props/today`, THE Public_Page_Router SHALL render the Todays_Props_Page without requiring authentication
2. THE Todays_Props_Page SHALL display a list of all player props available for today's scheduled games (determined by US Eastern Time date boundary), grouped by sport and then by game, with sports ordered alphabetically and games ordered by scheduled start time ascending
3. WHEN the Todays_Props_Page is rendered, THE SEO_Metadata_Generator SHALL produce a `<title>` tag following the pattern `Today's Player Props — {Month D, YYYY} | Hit Rates & Picks | Lasyly` where the date reflects the current US Eastern Time date
4. WHEN the Todays_Props_Page is rendered, THE SEO_Metadata_Generator SHALL produce a meta description of no more than 160 characters listing the number of props available and the sports covered
5. WHEN the Todays_Props_Page is rendered, THE SEO_Metadata_Generator SHALL produce JSON-LD structured data using the `ItemList` schema type listing each prop as a `ListItem`
6. THE Todays_Props_Page SHALL revalidate at least every 60 minutes to reflect new game data and updated prop lines
7. THE Todays_Props_Page SHALL include links to individual Player_Analysis_Pages for each listed player
8. THE Todays_Props_Page SHALL display each prop's player name, stat category, prop line, L10 hit rate percentage, and matchup grade (A through F)
9. WHEN no games are scheduled for today, THE Todays_Props_Page SHALL display a message indicating no props are available and provide links to the next 3 upcoming dates that have scheduled games
10. IF the total number of props for today exceeds 200, THEN THE Todays_Props_Page SHALL display the first 200 props and provide a mechanism to load additional props
11. WHEN the Todays_Props_Page is rendered, THE Todays_Props_Page SHALL load within 3 seconds on a standard 4G connection to support search engine crawlability and user experience

### Requirement 3: Public Live Scores Pages by Sport

**User Story:** As a sports fan searching for live scores, I want to find Lasyly's scores pages through search engines, so that I can view real-time scores for my sport without needing an account.

#### Acceptance Criteria

1. WHEN a request is made to `/scores/[sportSlug]`, THE Public_Page_Router SHALL render a Scores_Page for the specified sport without requiring authentication
2. WHEN a Scores_Page is rendered, THE Scores_Page SHALL display today's matches (determined by UTC date) for the specified sport including team names, current scores, match status (live, upcoming, finished), and start times in the user's local timezone
3. WHEN a Scores_Page is rendered, THE SEO_Metadata_Generator SHALL produce a `<title>` tag following the pattern `{Sport} Live Scores Today — {MMM D, YYYY} | Lasyly` where the date is the current UTC date
4. WHEN a Scores_Page is rendered, THE SEO_Metadata_Generator SHALL produce a meta description of no more than 160 characters listing the number of matches and their statuses for the specified sport
5. WHEN a Scores_Page is rendered, THE SEO_Metadata_Generator SHALL produce JSON-LD structured data using the `SportsEvent` schema type for each match, including the `name`, `startDate`, `homeTeam`, `awayTeam`, `location`, and `eventStatus` fields
6. THE Scores_Page SHALL support the following sport slugs: `nba`, `nfl`, `nhl`, `mlb`, `premier-league`, `champions-league`, `mls`, `atp`, `wta`, `ufc`, `f1`, `cricket`
7. WHILE live matches are in progress for the specified sport, THE Scores_Page SHALL revalidate at least every 30 seconds
8. THE Scores_Page SHALL include a canonical URL pointing to `https://lasyly.me/scores/{sportSlug}`
9. IF a sport slug does not match any supported sport, THEN THE Public_Page_Router SHALL return a 404 response with a server-rendered page indicating the sport was not found
10. THE Scores_Page SHALL be server-rendered so that search engine crawlers receive fully rendered HTML containing match data elements (team names, scores, and statuses) in the initial response body without requiring client-side JavaScript execution
11. IF no matches exist for the specified sport on the current UTC date, THEN THE Scores_Page SHALL display a message indicating no matches are scheduled and still render valid SEO metadata with a match count of zero

### Requirement 4: Robots.txt Configuration Update

**User Story:** As the site owner, I want search engine crawlers to discover and index the new public pages, so that they appear in search results.

#### Acceptance Criteria

1. THE Robots_Config SHALL include `/players/` in the allow list for all user-agent rules (including wildcard and any bot-specific rules)
2. THE Robots_Config SHALL include `/props/` in the allow list for all user-agent rules (including wildcard and any bot-specific rules)
3. THE Robots_Config SHALL include `/scores/` in the allow list for all user-agent rules (including wildcard and any bot-specific rules)
4. THE Robots_Config SHALL include `/dashboard/`, `/wallet/`, `/profile/`, `/bets/`, `/rooms/`, and `/api/` in the disallow list for all user-agent rules
5. THE Robots_Config SHALL remove `/analysis/` from the disallow list and SHALL NOT include `/analysis/` in either the allow or disallow lists
6. THE Robots_Config SHALL include a sitemap directive pointing to `{baseUrl}/sitemap.xml` where baseUrl is resolved from the NEXT_PUBLIC_SITE_URL environment variable with a fallback to `https://lasyly.me`
7. WHEN the robots.txt is requested, THE Robots_Config SHALL serve a valid robots.txt response containing all allow, disallow, and sitemap directives within 500 milliseconds

### Requirement 5: Dynamic Sitemap Update

**User Story:** As the site owner, I want the sitemap to include all public player pages, the today's props page, and sport-specific scores pages, so that search engines can efficiently discover and index all public content.

#### Acceptance Criteria

1. THE Sitemap_Generator SHALL include an entry for each player that has at least one prop line recorded in the database, using the URL pattern `https://lasyly.me/players/{playerSlug}`
2. THE Sitemap_Generator SHALL set the `changeFrequency` for player pages to `daily` and the `priority` to `0.7`
3. THE Sitemap_Generator SHALL include an entry for `https://lasyly.me/props/today` with `changeFrequency` set to `daily`, `priority` set to `0.9`, and `lastModified` set to the current date
4. THE Sitemap_Generator SHALL include an entry for each supported sport scores page as defined in the Scores_Page requirement (`nba`, `nfl`, `nhl`, `mlb`, `premier-league`, `champions-league`, `mls`, `atp`, `wta`, `ufc`, `f1`, `cricket`) using the URL pattern `https://lasyly.me/scores/{sportSlug}` with `changeFrequency` set to `hourly`, `priority` set to `0.8`, and `lastModified` set to the current date
5. THE Sitemap_Generator SHALL set the `lastModified` date for player pages to the most recent game date for that player, or the date the player's prop data was first recorded if no game date exists
6. THE Sitemap_Generator SHALL regenerate at least every 60 minutes to reflect new players and updated data
7. IF the database is unreachable during sitemap generation, THEN THE Sitemap_Generator SHALL serve the previously generated sitemap entries for player pages and omit only the dynamic player entries if no prior cache exists

### Requirement 6: Lightweight Page Performance

**User Story:** As a site visitor arriving from search, I want public pages to load quickly, so that I get a good experience and Google ranks the pages favorably.

#### Acceptance Criteria

1. THE Player_Analysis_Page SHALL render without loading the full authenticated app shell (no sidebar, no bottom navigation, no real-time subscriptions)
2. THE Todays_Props_Page SHALL render without loading the full authenticated app shell (no sidebar, no bottom navigation, no real-time subscriptions)
3. THE Scores_Page SHALL render without loading the full authenticated app shell (no sidebar, no bottom navigation, no real-time subscriptions)
4. THE Player_Analysis_Page SHALL use the existing `(marketing)` route group layout containing the site header (logo, nav links, sign-in link, and sign-up CTA) and site footer
5. THE Todays_Props_Page SHALL use the existing `(marketing)` route group layout containing the site header and site footer
6. THE Scores_Page SHALL use the existing `(marketing)` route group layout containing the site header and site footer
7. WHILE a public page is being rendered, THE Public_Page_Router SHALL use server components for all read-only data display sections (stats tables, score listings, player info) and limit client components to interactive elements only (filters, toggles, navigation menus)
8. THE Player_Analysis_Page, Todays_Props_Page, and Scores_Page SHALL each achieve a Largest Contentful Paint (LCP) of 2500 milliseconds or less and a Total Blocking Time (TBT) of 200 milliseconds or less as measured by Lighthouse in mobile simulation mode
9. IF a data fetch fails during server-side rendering of a public page, THEN THE Public_Page_Router SHALL render the page layout with an inline message indicating the data is temporarily unavailable, without returning an error status code to the browser
