# Lasyly — Product Document

## What is Lasyly?

Lasyly is a real-time social platform built for sports bettors. It combines community-driven betting rooms, advanced prop analytics, live scores, curated sports news, and a wallet-powered marketplace into a single dark-themed mobile-first web app.

Think of it as **PrizePicks analytics + Discord-style rooms + a tipster marketplace** — all in one place.

---

## Who is it for?

- **Recreational sports bettors** who want data-backed insights before placing props
- **Serious handicappers** looking for advanced analytics (hit rates, matchup grades, correlations, line movement)
- **Tipsters** who want to monetize their picks by selling them to followers
- **Sports fans** who want a social space to discuss games, share betslips, and track live scores together

---

## Core Features

### 1. Rooms

Topic-based community spaces where users share picks and chat in real-time.

- **Public rooms** — open to anyone, organized by sport or topic
- **Private rooms** — invite-only groups for friends or small communities
- **Tipster rooms** — premium rooms where top bettors sell picks to subscribers
- Real-time chat powered by Supabase Realtime
- Betslip sharing with reactions and comments
- Sport tags (Football, Basketball, Tennis, Mixed, Other)
- Member counts, live indicators, and role-based access (owner, member)

### 2. Props & Analytics (Analysis Page)

A PrizePicks/PropShark-style card interface for researching player props before betting.

- **Player prop cards** with computed lines derived from real scraped data
- **Hit rate indicators** — L5, L10, L15, L20, and season-long hit percentages
- **Matchup grades** (A through F) based on opposing team defensive stats
- **Confidence scores** (1–5 stars) combining hit rate, matchup, and trend signals
- **Trend arrows** showing whether a player is trending over or under
- **Streak dots** visualizing recent game-by-game performance
- **Correlations** — find props that historically hit together
- **Line movement tracking** — see how prop lines shift over time
- **AI-generated writeups** summarizing the case for/against a prop
- **Parlay builder** — combine multiple props into a correlated parlay
- **Advanced filters** — home/away splits, opposing team, confidence threshold, hit rate range
- **Today's games strip** — quick navigation to props for games happening now
- Supports NBA, Tennis, Football (Soccer), NFL, and NHL

### 3. Bet Tracker

A personal ledger for logging and analyzing your betting history.

- Log picks with player, stat, line, direction, odds, and stake
- Track status: pending → won / lost / push
- Performance stats: win rate, ROI, net profit
- Best signals analysis — which confidence/grade combos perform best for you
- Filterable by sport, date range, and status

### 4. Live Scores

A SofaScore-style live scores experience covering 10+ sports.

- **Sports covered:** Soccer, Basketball, American Football, Tennis, Hockey, Baseball, F1, MMA, Golf, Cricket
- **League filters:** Premier League, NBA, NFL, MLS, MLB, NHL, ATP, WTA, UFC, Formula 1, and more
- Date navigation (past, today, future)
- Team logos and colors from ESPN
- Match states: live (with animated indicators), upcoming, finished
- Adaptive polling — faster updates for live matches, pauses when tab is hidden
- Match detail modals with extended stats
- YouTube highlights integration
- Historical match cache in Supabase for instant loading of past dates

### 5. News (Lasyly Daily)

A newspaper-style sports news feed aggregated from ESPN and other sources.

- Categories: Latest, Football, NBA, NFL, UFC, Tennis, F1, Cricket
- Scraped and stored in Supabase for fast delivery
- Clean editorial layout with category filtering

### 6. Wallet & Payments

A Stripe-backed credits system for the tipster marketplace.

- Top up wallet via Stripe Checkout ($10, $50, $100 presets or custom)
- Purchase premium picks from tipsters using wallet credits
- Tipster earnings with 85/15 revenue split (tipster keeps 85%)
- Full transaction history (top-ups, purchases, earnings)
- Balance tracking with earned/spent breakdowns

### 7. Dashboard

A personal analytics hub showing your betting performance at a glance.

- Total income, total wagered, win rate
- Won / Lost / Pending breakdown
- Average odds across all picks
- Sport breakdown gauge chart
- Win rate by sport with progress bars
- Funds activity chart (income vs. spending over time)
- Recent transactions list

### 8. Social & Profiles

- Follow/unfollow other bettors and tipsters
- Social feed of betslips from people you follow
- Profile pages with stats, pick history, and follower counts
- Leaderboard of top performers
- Betslip reactions (fire, thumbs up, etc.)

### 9. Explore

A discovery page for finding rooms, live matches, and trending content.

- Browse public and tipster rooms by sport
- Search rooms by name or description
- See live match cards alongside room recommendations
- Trending rooms and popular tipsters

---

## Data Pipeline

Lasyly's analytics are powered by real scraped data — not third-party API subscriptions.

| Sport | Source | Data Collected |
|-------|--------|----------------|
| **NBA** | basketball-reference.com | Game schedules, box scores, all player stats (pts, reb, ast, 3pm, etc.), team defense ratings |
| **Tennis** | tennisabstract.com | Tournament matches, serve stats, return stats, raw win/loss by surface and year |
| **Football** | fbref.com | Match schedules, player stats, league standings for top 5 European leagues |
| **Live Scores** | ESPN public API | Real-time scores, team logos, colors, venues across all major sports |
| **News** | ESPN | Sports news articles scraped and cached in Supabase |

Scrapers run on GitHub Actions workflows on configurable schedules. All prop lines and analytics are computed from this historical data — no paid odds feeds required.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Animation | Framer Motion 12 |
| Database & Auth | Supabase (Postgres + Row Level Security + Realtime) |
| Payments | Stripe (Checkout Sessions + Webhooks) |
| UI Primitives | Radix UI |
| Icons | Lucide React |
| Scrapers | Python (Scrapling library) |
| CI/CD | GitHub Actions |
| Testing | Vitest |

---

## Design Philosophy

- **Dark theme** — a premium, immersive feel suited for sports/betting content
- **Mobile-first** — cards stack vertically, bottom navigation on mobile, sidebar on desktop
- **Data-dense but scannable** — hit rate bars, streak dots, and grade badges communicate at a glance
- **Real-time** — chat, scores, and reactions update live without page refreshes
- **Zero external odds dependencies** — all prop lines are derived from scraped historical performance data

---

## How It Makes Money

1. **Tipster marketplace** — tipsters sell premium picks; Lasyly takes a 15% platform fee
2. **Wallet top-ups** — users add credits via Stripe to purchase picks
3. **Future:** Premium tiers, room subscriptions, and sponsored content (not yet implemented)

---

## Current Status

Lasyly has a polished UI with most pages functional. Core backend services (rooms, chat, wallet, auth, scrapers, analytics) are wired to Supabase. The platform is in pre-launch phase with ongoing work on:

- Replacing remaining mock data with live queries
- Security hardening (rate limiting, CSP headers, input validation)
- Expanding scraper coverage (football standings, more tennis tournaments)
- Performance optimization and caching
- Social feed pagination and real-time reactions
