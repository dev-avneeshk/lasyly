# What Lasyly Does

## Overview

**Lasyly is a real-time social platform for sports bettors** that combines community-driven betting rooms, advanced prop analytics, live scores, curated sports news, and a wallet-powered marketplace — all in one dark-themed, mobile-first web application.

Think of it as **PrizePicks analytics + Discord-style rooms + a tipster marketplace** rolled into one seamless experience.

---

## The Problem We Solve

Sports bettors today face several challenges:

1. **Scattered tools** — Analytics on one site, community on Discord, scores on another app, news elsewhere
2. **No data-backed insights** — Most betting is done on gut feeling without historical performance data
3. **Isolated betting** — No easy way to share picks, discuss strategy, or learn from successful bettors
4. **Expensive data subscriptions** — Premium analytics tools cost hundreds per month
5. **No monetization for skilled bettors** — Top handicappers have no platform to sell their expertise

**Lasyly solves all of this in one place.**

---

## What You Can Do on Lasyly

### 1. 🏠 Join Betting Rooms

Create or join topic-based community spaces where bettors share picks and chat in real-time.

**Room Types:**
- **Public Rooms** — Open to anyone, organized by sport (NBA, NFL, Tennis, etc.)
- **Private Rooms** — Invite-only groups for friends or small communities
- **Tipster Rooms** — Premium rooms where expert bettors sell their picks to subscribers

**Features:**
- Real-time chat powered by Supabase
- Share betslips with reactions (🔥, 👍, 💰) and comments
- See who's online with live member indicators
- Role-based access (room owner, members)
- Sport tags for easy filtering

### 2. 📊 Research Player Props with Advanced Analytics

A PrizePicks/PropShark-style interface for researching player props before placing bets.

**What You Get:**
- **Player prop cards** with computed lines derived from real scraped historical data
- **Hit rate indicators** — See how often a player hits over/under in their last 5, 10, 15, 20 games and season-long
- **Matchup grades (A-F)** — Grades based on opposing team's defensive stats
- **Confidence scores (1-5 stars)** — Combines hit rate, matchup quality, and recent trends
- **Trend arrows** — Visual indicators showing if a player is trending over or under
- **Streak dots** — Game-by-game performance visualization
- **Correlations** — Find props that historically hit together for smarter parlays
- **Line movement tracking** — See how prop lines shift over time
- **AI-generated writeups** — Get summaries explaining the case for/against each prop
- **Parlay builder** — Combine multiple correlated props into optimized parlays

**Advanced Filters:**
- Home/away splits
- Filter by opposing team
- Confidence threshold
- Hit rate ranges
- Today's games quick navigation

**Sports Covered:** NBA, Tennis, Football (Soccer), NFL, NHL

### 3. 📈 Track Your Betting Performance

A personal ledger for logging and analyzing your betting history.

**Track:**
- Player, stat type, line, direction (over/under), odds, stake
- Status: pending → won / lost / push
- Performance metrics: win rate, ROI, net profit
- Best signals analysis — which confidence/grade combinations perform best for you
- Filter by sport, date range, and status

### 4. ⚡ Follow Live Scores

A SofaScore-style live scores experience covering 10+ sports.

**Sports Covered:**
- Soccer (Premier League, La Liga, Serie A, Bundesliga, Ligue 1, MLS, Champions League)
- Basketball (NBA)
- American Football (NFL)
- Tennis (ATP, WTA)
- Hockey (NHL)
- Baseball (MLB)
- Formula 1
- MMA (UFC)
- Golf
- Cricket

**Features:**
- Date navigation (past, today, future)
- Team logos and colors from ESPN
- Live match indicators with real-time updates
- Adaptive polling — faster updates during live matches, pauses when tab is hidden
- Match detail modals with extended stats
- YouTube highlights integration
- Historical match cache for instant loading

### 5. 📰 Read Curated Sports News

A newspaper-style sports news feed aggregated from ESPN and other trusted sources.

**Categories:**
- Latest
- Football (Soccer)
- NBA
- NFL
- UFC
- Tennis
- Formula 1
- Cricket

All news is scraped, stored in our database, and delivered instantly with a clean editorial layout.

### 6. 💰 Buy and Sell Premium Picks

A Stripe-backed credits system that powers our tipster marketplace.

**For Buyers:**
- Top up your wallet via Stripe ($10, $50, $100 presets or custom amounts)
- Purchase premium picks from expert tipsters using wallet credits
- Full transaction history
- Balance tracking with earned/spent breakdowns

**For Tipsters:**
- Monetize your expertise by selling picks to followers
- 85/15 revenue split (you keep 85%)
- Track your earnings
- Build a following and reputation

### 7. 📊 View Your Dashboard

A personal analytics hub showing your betting performance at a glance.

**Metrics:**
- Total income and total wagered
- Overall win rate
- Won / Lost / Pending breakdown
- Average odds across all picks
- Sport breakdown gauge chart
- Win rate by sport with progress bars
- Funds activity chart (income vs. spending over time)
- Recent transactions list

### 8. 👥 Connect with Other Bettors

**Social Features:**
- Follow/unfollow other bettors and tipsters
- Social feed of betslips from people you follow
- Profile pages with stats, pick history, and follower counts
- Leaderboard of top performers
- React to betslips with emojis

### 9. 🔍 Discover New Rooms and Content

The Explore page helps you find rooms, live matches, and trending content.

**Discover:**
- Browse public and tipster rooms by sport
- Search rooms by name or description
- See live match cards alongside room recommendations
- Trending rooms and popular tipsters

---

## How Our Data Works

Unlike other platforms that rely on expensive third-party APIs, **Lasyly scrapes and computes all its own data**.

### Data Sources

| Sport | Source | Data Collected |
|-------|--------|----------------|
| **NBA** | basketball-reference.com | Game schedules, box scores, all player stats (points, rebounds, assists, 3-pointers, etc.), team defense ratings |
| **Tennis** | tennisabstract.com | Tournament matches, serve stats, return stats, win/loss records by surface and year |
| **Football** | fbref.com | Match schedules, player stats, league standings for top 5 European leagues |
| **Live Scores** | ESPN public API | Real-time scores, team logos, colors, venues across all major sports |
| **News** | ESPN | Sports news articles scraped and cached |

### How It Works

1. **Scrapers run automatically** on GitHub Actions workflows on configurable schedules
2. **Data is stored** in our Supabase PostgreSQL database
3. **Analytics are computed** from historical performance data
4. **Prop lines are derived** from player averages and trends
5. **No paid odds feeds required** — everything is calculated from scraped data

---

## Who Lasyly Is For

### 🎲 Recreational Sports Bettors
Want data-backed insights before placing props instead of betting on gut feeling.

### 📊 Serious Handicappers
Looking for advanced analytics like hit rates, matchup grades, correlations, and line movement.

### 💼 Tipsters & Experts
Want to monetize their picks by selling them to followers in a dedicated marketplace.

### ⚽ Sports Fans
Want a social space to discuss games, share betslips, track live scores, and connect with other fans.

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS v4 |
| **Animation** | Framer Motion 12 |
| **Database & Auth** | Supabase (Postgres + Row Level Security + Realtime) |
| **Payments** | Stripe (Checkout Sessions + Webhooks) |
| **UI Primitives** | Radix UI |
| **Icons** | Lucide React |
| **Scrapers** | Python (Scrapling library) |
| **CI/CD** | GitHub Actions |
| **Testing** | Vitest |

---

## Design Philosophy

### 🌙 Dark Theme
A premium, immersive feel perfectly suited for sports and betting content.

### 📱 Mobile-First
Cards stack vertically, bottom navigation on mobile, sidebar on desktop — optimized for on-the-go betting.

### 📊 Data-Dense but Scannable
Hit rate bars, streak dots, and grade badges communicate insights at a glance without overwhelming users.

### ⚡ Real-Time
Chat, scores, and reactions update live without page refreshes using Supabase Realtime.

### 🔓 Zero External Dependencies
All prop lines are derived from scraped historical performance data — no expensive odds feeds required.

---

## Revenue Model

### 1. Tipster Marketplace
Tipsters sell premium picks; Lasyly takes a 15% platform fee.

### 2. Wallet Top-Ups
Users add credits via Stripe to purchase picks.

### 3. Future Revenue Streams (Planned)
- Premium subscription tiers with advanced features
- Room subscriptions for exclusive communities
- Sponsored content and partnerships

---

## Current Status

Lasyly is in **pre-launch phase** with a polished UI and most core features functional.

**What's Working:**
- ✅ Room creation and browsing
- ✅ Real-time chat
- ✅ Live scores across 10+ sports
- ✅ Player prop analytics with hit rates and matchup grades
- ✅ Bet tracking and performance analytics
- ✅ Wallet system with Stripe integration
- ✅ Sports news aggregation
- ✅ Social features (follow, reactions, profiles)

**What's In Progress:**
- 🔧 Replacing remaining mock data with live queries
- 🔧 Security hardening (rate limiting, CSP headers, input validation)
- 🔧 Expanding scraper coverage (more leagues and tournaments)
- 🔧 Performance optimization and caching
- 🔧 Social feed pagination and real-time reactions

---

## Why Lasyly?

### For Bettors
- **All-in-one platform** — No more juggling multiple apps and websites
- **Data-backed decisions** — Make smarter bets with historical performance data
- **Community learning** — Learn from successful bettors and share strategies
- **Free analytics** — Get insights that would cost hundreds elsewhere

### For Tipsters
- **Monetization platform** — Turn your expertise into income
- **Built-in audience** — Reach bettors actively looking for premium picks
- **Fair revenue split** — Keep 85% of your earnings
- **Reputation building** — Build your brand with stats and follower counts

### For Everyone
- **Real-time updates** — Never miss a score change or breaking news
- **Beautiful design** — Dark theme, smooth animations, intuitive navigation
- **Mobile-optimized** — Bet on the go with a responsive, fast interface
- **Transparent data** — See exactly how analytics are calculated

---

## Get Started

1. **Sign up** and create your profile
2. **Join rooms** in your favorite sports
3. **Research props** with our analytics tools
4. **Share your picks** and get reactions from the community
5. **Track your performance** and improve over time
6. **Follow top tipsters** or become one yourself

---

**Lasyly — Where sports bettors win together.** 🎰
