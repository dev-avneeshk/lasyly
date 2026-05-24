# Lasyly — Pitch Deck

---

## The Elevator Pitch

**Lasyly is where sports bettors actually win together.**

It's a real-time social platform that combines data-backed prop analytics, Discord-style betting rooms, live scores, curated sports news, and a tipster marketplace — all in one dark-themed, mobile-first app.

Think **PrizePicks analytics + Discord rooms + a tipster marketplace**, built for the way people actually bet.

---

## The Problem

Sports betting is a $100B+ industry, but the experience is still broken.

Bettors juggle 4–6 different apps just to make one informed decision. Analytics on one site. Community on Discord. Scores on another app. News in a browser tab. Picks from a random Twitter account with no accountability.

Here's what's actually wrong:

| Pain Point | Reality |
|---|---|
| **Scattered tools** | Bettors hop between PropShark, ESPN, Discord, and Twitter just to place one bet |
| **Gut-feel betting** | Most picks are made without any historical performance data |
| **No accountability** | Tipsters post picks with no verifiable track record |
| **Pay-to-win analytics** | Premium tools like Action Network cost $30–100/month |
| **Siloed community** | Betting groups live on Discord, completely disconnected from data and scores |
| **Tipsters can't monetize** | Skilled handicappers have no proper platform to sell their expertise |

**Nobody has solved this. We did.**

---

## The Solution — Lasyly

One platform. Every tool a bettor needs.

```
Data-backed analytics + Real-time community + Monetization + Live scores + News
```

No more switching apps. No more paying for scattered subscriptions. No more betting blind.

---

## Who Uses Lasyly

### 🎲 Recreational Bettors
Casual fans who want to make smarter bets without becoming full-time analysts. They want the insights — not the work.

### 📊 Serious Handicappers
Power users who run hit rates, correlations, matchup grades, and line movement. They want depth, not dumbed-down tools.

### 💼 Tipsters & Experts
Skilled bettors who want to turn their edge into income. They need a platform with built-in audience, payments, and reputation tools.

### ⚽ Sports Fans
People who aren't hardcore bettors but love following games, reading news, and chatting with like-minded fans.

---

## Core Features

### 1. Rooms — The Betting Community Layer

Topic-based community spaces where real picks get shared, discussed, and acted on in real-time.

- **Public Rooms** — open to anyone, organized by sport
- **Private Rooms** — invite-only for friend groups or closed communities
- **Tipster Rooms** — premium gated rooms where expert bettors sell their picks
- Real-time chat via Supabase Realtime (no refreshes, no lag)
- **Betslip sharing with reactions** — fire 🔥, thumbs up 👍, money bag 💰
- Live member indicators and role-based access
- Sport tags for easy discovery

### 2. Props & Analytics — The Research Layer

A PropShark/PrizePicks-style interface powered by real scraped historical data.

- **Hit rate indicators** — L5, L10, L15, L20, season-long percentages
- **Matchup grades (A–F)** — based on opposing team's defensive stats
- **Confidence scores (1–5 stars)** — algorithmic signal combining hit rate, matchup, and trends
- **Trend arrows** — is the player going over or under lately?
- **Streak dots** — game-by-game visual performance history
- **Correlations** — find props that hit together for smarter parlays
- **Line movement tracking** — see how lines shift before game time
- **AI-generated writeups** — plain English summaries for and against each prop
- **Parlay builder** — build correlated parlays from real historical data
- Advanced filters: home/away splits, opposing team, confidence threshold, hit rate range
- Sports covered: NBA, NFL, Tennis, Football (Soccer), NHL

### 3. Bet Tracker — The Performance Layer

Log picks, measure your edge, and learn from what works.

- Track player, stat, line, direction, odds, and stake
- Status lifecycle: pending → won / lost / push
- Performance metrics: win rate, ROI, net profit
- Best signals analysis — which confidence/grade combos actually hit for you
- Filter by sport, date range, status

### 4. Live Scores — The Real-Time Layer

SofaScore-style live experience across 10+ sports.

- Soccer, NBA, NFL, Tennis, NHL, MLB, F1, UFC, Golf, Cricket
- Date navigation (past, today, future)
- ESPN team logos and colors
- Live match indicators with adaptive polling (faster when live, pauses when hidden)
- Match detail modals with extended stats
- YouTube highlights integration
- Historical match cache for instant loading of past dates

### 5. News (Lasyly Daily) — The Information Layer

Aggregated sports news from ESPN, delivered clean and fast.

- Categories: Latest, Football, NBA, NFL, UFC, Tennis, F1, Cricket
- Scraped, stored, and served from our database — zero third-party latency
- Editorial newspaper layout

### 6. Wallet & Tipster Marketplace — The Money Layer

Stripe-backed credits that power the entire pick economy.

**For buyers:**
- Top up via Stripe ($10, $50, $100 or custom)
- Purchase premium picks from vetted tipsters
- Full transaction history and balance tracking

**For tipsters:**
- Set your price. Share your picks. Get paid.
- 85/15 revenue split — tipsters keep 85%
- Track earnings, build following, show verified stats

### 7. Dashboard — The Insights Layer

Your personal analytics hub.

- Total income, total wagered, overall win rate
- Won / Lost / Pending breakdown
- Sport breakdown gauge chart
- Win rate by sport with progress bars
- Funds activity chart over time
- Recent transaction list

---

## Why Share Your Betslip on Lasyly?

This is the feature that makes Lasyly social — and it's the one that changes how people bet.

**Why it matters:**

**For bettors sharing picks:**
- Build a verified track record that followers can trust
- Grow your reputation with every winning slip you post
- Get reactions and engagement — knowing your pick got 🔥🔥🔥 feels good
- Become a tipster: once your record speaks for itself, start charging for picks
- Accountability sharpens decision-making — if you're posting it publicly, you'll think harder before placing it

**For bettors reading picks:**
- See what successful bettors are actually playing — not just what they claim
- Filter by sport, tipster stats, and confidence level
- Follow people with proven records instead of anonymous Twitter accounts
- Discover angles you'd never have found solo

**For the community:**
- Shared betslips spark real conversation — game takes, injury reactions, line value debates
- Group energy around a parlay is an experience in itself
- When your room's 5-leg parlay hits, everyone knows

**The network effect:** Every shared betslip makes the platform smarter and more social. The more people share, the better everyone bets.

---

## Why Lasyly Is Better

### vs. PrizePicks / Underdog
Those are sportsbooks. We are the research layer *before* you place the bet — and the community *after* it settles.

### vs. Action Network / Pikkit
Pure tracker apps. No community, no analytics depth, no tipster economy, no real-time social layer. And they charge monthly.

### vs. PropShark / StatMuse
Analytics tools with zero social features. Good for research, dead after that.

### vs. Discord betting servers
Unstructured, unverifiable, no analytics, no embedded picks, no payments. Just vibes.

### Lasyly does all of it in one place — free.

| Feature | Lasyly | Action Network | Discord | PrizePicks |
|---|---|---|---|---|
| Prop analytics with hit rates | ✅ | Partial | ❌ | ❌ |
| Matchup grades | ✅ | ❌ | ❌ | ❌ |
| Real-time community rooms | ✅ | ❌ | ✅ | ❌ |
| Betslip sharing with reactions | ✅ | ❌ | ❌ | ❌ |
| Tipster monetization | ✅ | ❌ | ❌ | ❌ |
| Live scores (10+ sports) | ✅ | Partial | ❌ | ❌ |
| Bet tracker with ROI | ✅ | ✅ | ❌ | ❌ |
| Correlated parlay builder | ✅ | ❌ | ❌ | ❌ |
| Free to use | ✅ | Freemium | Free | ❌ |

---

## The Data Edge

Most analytics platforms pay $10K+/year for odds feed subscriptions. We built our own pipeline.

Lasyly scrapes, stores, and computes everything in-house:

| Sport | Source | Data |
|---|---|---|
| NBA | basketball-reference.com | Box scores, player stats, team defense ratings |
| Tennis | tennisabstract.com | Match history, serve/return stats, surface splits |
| Football (Soccer) | fbref.com | Player stats, standings across top 5 European leagues |
| Live Scores | ESPN public API | Real-time scores, logos, venues across all major sports |
| News | ESPN | Sports news scraped and cached |

Scrapers run automatically via GitHub Actions. No recurring data costs. Infinite extensibility.

**The result:** Prop analytics that would cost $50+/month elsewhere, available for free.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Animation | Framer Motion 12 |
| Database & Auth | Supabase (Postgres + RLS + Realtime) |
| Payments | Stripe (Checkout Sessions + Webhooks) |
| UI | Radix UI + Lucide Icons |
| Scrapers | Python (Scrapling) |
| CI/CD | GitHub Actions |
| Testing | Vitest |

**Built to scale.** Supabase Row Level Security enforces data isolation. Realtime channels handle concurrent room chat. Stripe webhooks process payments reliably.

---

## Business Model

### Revenue Stream 1 — Tipster Marketplace Commission
Every pick sold through the platform generates a 15% platform fee. Tipsters keep 85%.

As the community grows, more picks are sold, more money flows through the platform. This compounds naturally with user growth.

### Revenue Stream 2 — Wallet Top-Ups
Users load credits via Stripe to purchase picks. The wallet system is already live.

### Revenue Stream 3 — Premium Features (Planned)
- Premium subscription tiers with advanced analytics
- Room subscriptions for exclusive communities
- Sponsored content and partnership placements

---

## The Vision

Lasyly is building the infrastructure layer for sports betting culture.

Right now, betting communities exist but they're unmonetized, unstructured, and disconnected from data. We're connecting the data layer, the social layer, and the money layer into one compounding flywheel:

```
Better analytics → Better bets
Better bets → Better track records  
Better track records → More sharing
More sharing → More community  
More community → More tipster economy
More tipster economy → More revenue
More revenue → Better analytics
```

The endgame is a platform where the best sports bettors in the world build their audience, their reputation, and their income — and where everyone else bets smarter because of it.

---

## Current Status

Lasyly is in pre-launch with a polished, functional product.

| Feature | Status |
|---|---|
| Room creation and browsing | ✅ Live |
| Real-time chat | ✅ Live |
| Betslip sharing with reactions | ✅ Live |
| Live scores (10+ sports) | ✅ Live |
| Player prop analytics with hit rates and matchup grades | ✅ Live |
| Bet tracker with performance analytics | ✅ Live |
| Wallet system with Stripe | ✅ Live |
| Sports news aggregation | ✅ Live |
| Social features (follow, feed, profiles) | ✅ Live |
| Security hardening (rate limiting, CSP, input validation) | 🔧 In Progress |
| Expanding scraper coverage | 🔧 In Progress |
| Live query migration (replacing mock data) | 🔧 In Progress |
| Performance optimization and caching | 🔧 In Progress |

---

## Closing

The sports betting market is huge, the tools are fragmented, and the social layer barely exists.

Lasyly brings it all together — analytics, community, picks marketplace, live scores — in a single platform that's fast, beautiful, and built for the way people actually bet.

**The best bettors will build their reputation here. Everyone else will bet smarter because of them.**

---

*Lasyly — Where sports bettors win together.* 🏆
