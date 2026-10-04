# Lasyly — Product Overview & MVP

> One document covering what Lasyly is, who it's for, what it does, what makes it
> different, and the current state of the MVP. For the deeper marketing pitch see
> `PITCH.md`; for the full feature inventory see `../../FEATURES.md`.

---

## 1. What Lasyly is

**Lasyly is a real-time social platform for sports fans — prop analytics, community
rooms, live scores, curated news, and independent creator analysis, in one free app.**

The mental model: **PrizePicks-style analytics + Discord-style rooms + a creator
marketplace**, unified into one dark-themed, mobile-first web app.

**Important — what Lasyly is NOT.** Lasyly is an analytics and community platform,
**not a sportsbook or gambling operator.** We do not accept, hold, match, or settle
wagers, we do not set odds, and we do not pay out winnings. Everything inside the app
runs on a virtual, **play-money "Coins" economy** — there is no real-money wagering.
All analytics are provided for informational purposes only. This framing is
intentional and legally load-bearing; keep it consistent everywhere.

---

## 2. The problem we solve

Sports fans and bettors juggle 4–6 disconnected tools to make one informed decision:

- **Scattered tools** — analytics on one site, community on Discord, scores on another
  app, news in a browser tab.
- **Gut-feel decisions** — most picks are made without any historical performance data.
- **No accountability** — anonymous tipsters post picks with no verifiable record.
- **Pay-to-win analytics** — premium research tools cost $30–100/month.
- **Siloed community** — betting groups live on Discord, disconnected from data and scores.
- **No home for creators** — skilled analysts have no proper platform to build an audience.

Lasyly brings the data layer, the social layer, and the creator layer into one place.

---

## 3. Who it's for

- **Recreational fans** who want data-backed insight without doing full-time analysis.
- **Serious researchers** who want depth: hit rates, matchup grades, correlations, line movement.
- **Creators / analysts** who want to build an audience and (where available) monetize their content.
- **Sports fans** who want a social space to discuss games, follow scores, and read news.

---

## 4. What our specialization is

Three things set Lasyly apart from generic scores apps or analytics tools:

### a. In-house data pipeline (no paid odds feeds)
We scrape, store, and compute all analytics ourselves from publicly available historical
statistics. There are no recurring third-party odds-feed costs, which is why research that
costs $50+/month elsewhere is free here — and infinitely extensible to new sports.

| Sport | Source | Data collected |
|---|---|---|
| NBA | basketball-reference.com | Schedules, box scores, full player stats, team defense ratings |
| NFL | scraped stats sources | Player stats, grades, rankings inputs |
| Tennis | tennisabstract.com + tennisexplorer.com | Matches, serve/return stats, surface splits, bios/rankings |
| Football (soccer) | fbref.com | Player stats and standings across the top-5 European leagues |
| Live scores | ESPN public API | Real-time scores, logos, colors, venues across all major sports |
| News | ESPN | Sports news scraped and cached |

Scrapers run on GitHub Actions on scheduled workflows; analytics are computed from the
stored history and prop lines are derived from player averages and trends.

### b. Derived prop analytics
Hit rates (L5/L10/L15/L20 + season), A–F matchup grades from opponent defense, 1–5 star
confidence scores, trend arrows, streak dots, prop correlations, model-implied reference
pricing, and line-movement history — all computed in-house, presented to be scannable at a glance.

### c. Real-time social + play-money games
Discord-style rooms with live chat and betslip sharing, plus an **Arena** of skill/strategy
games (NBA & NFL auction-draft simulations) played entirely with virtual Coins. This is the
community and engagement layer that pure analytics tools lack.

---

## 5. Core product areas (MVP feature set)

### Social & community
Public / private / creator rooms organized by sport, with sub-channels and invites;
real-time chat; message reactions and deletion; moderation (kick, ban, mute, roles, pins,
join requests); betslip sharing with reactions and comments; a social feed (posts, likes,
comments); follow/unfollow with a "following" feed; public (`/l/[username]`) and personal
profiles; creators directory; explore page; leaderboard; in-app and web-push notifications.

### Accounts & auth
Email/password (Supabase) signup and login; onboarding (username, display name); guest
sessions via signed cookie; route protection via middleware; a 200-Coin signup bonus.

### Coins economy & wallet (play-money)
Coins wallet with balance tracking; full transaction ledger (signup bonus, top-up,
purchase, earnings, arena, weekly bonus); Stripe top-ups for Coins; XP and levels
progression; a weekly level-scaled Coin bonus; premium content unlocks spent in Coins.

### Prop analytics
Prop cards with hit rates and matchup grades; confidence scores; trend arrows and streaks;
model-implied reference odds; correlations; parlay builder; line movement and history;
player / team / defense / head-to-head stats; AI-generated writeups; prop voting; per-player
analysis pages; advanced filters (home/away, opponent, confidence, hit-rate range, today's games).

### Arena games
NBA and NFL auction/draft engines (budget, roster, simulation, box scores); CPU opponents
with a difficulty ladder; matchmaking and 1v1 play; Coin staking (CPU entry + win reward,
1v1 winner-takes-pot minus commission); refunds for abandoned staked games. Play-money only.

### Player rankings
NBA ranking engine (LPI v2) and NFL ranking engine; team and player ranking pages; Player
of the Week; automated rankings generation; a rankings admin page; headshot resolver.

### Live scores & news
Live scores across 10+ sports (soccer, NBA, NFL, tennis, NHL, MLB, F1, UFC, golf, cricket);
adaptive polling; date navigation; ESPN logos/colors; match detail views; score search and
history; YouTube highlights; curated in-house news feed; injuries feed.

### Parlays, quizzes, tracker & marketplace
Parlay creation, validation, and automated settlement plus a parlay feed; NBA/NFL quiz banks
(1000+ questions each) with attempt/submit grading; a personal bet tracker (win rate, ROI,
net profit) with CSV export; pick marketplace; games store; achievements.

### Marketing, SEO & content
Landing page; feature/compare/creator marketing pages; SEO landing pages (players,
props-today, scores by sport); DB-backed and static blog with RSS; sitemap, robots.txt,
OpenGraph images; IndexNow instant indexing; legal pages (privacy, terms, data sources);
cookie consent.

### Infrastructure & ops
Redis-backed rate limiting (with in-memory fallback); Redis cache-aside caching; Row Level
Security across tables; background job queue; cron jobs (chat cleanup, retention, weekly
coins, correlations, parlay resolution); health check + keep-warm; Sentry error tracking;
Vercel analytics/speed insights; data retention/cleanup; a security-audit workflow; k6 load
tests; hot-path database indexes.

---

## 6. Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, TypeScript 5, Tailwind CSS v4, Framer Motion 12, Radix UI, Lucide icons |
| Database & auth | Supabase (Postgres + Row Level Security + Realtime) |
| Cache & rate limit | Upstash Redis |
| Payments | Stripe (Checkout + webhooks) — for Coin top-ups, not wagering |
| Scrapers | Python |
| CI/CD | GitHub Actions |
| Observability | Sentry, Vercel Analytics / Speed Insights |
| Testing | Vitest, k6 (load) |

---

## 7. Design philosophy

- **Dark theme** — a premium, immersive feel suited to sports content.
- **Mobile-first** — cards stack vertically, bottom nav on mobile, sidebar on desktop.
- **Data-dense but scannable** — hit-rate bars, streak dots, and grade badges read at a glance.
- **Real-time** — chat, scores, and reactions update live without refreshes.
- **Zero external odds dependencies** — every prop line is derived from scraped history.

---

## 8. How Lasyly relates to money

Lasyly is free to use for its core: prop analytics, rooms, live scores, the pick tracker,
and news. The internal economy is **play-money Coins**. Stripe is used only to top up Coins,
not to place or settle bets. Where creator monetization is available, members pay for access
to a creator's content and community — not to place any wager — and availability varies by
region. Lasyly does not hold betting funds, set odds, or pay winnings.

---

## 9. Current status (MVP)

Lasyly is in a pre-launch / hardening phase with a polished, largely functional product.
Core services (rooms, chat, wallet/coins, auth, scrapers, analytics, arena) are wired to
Supabase.

**Working**

- Rooms, real-time chat, betslip sharing with reactions
- Prop analytics (hit rates, matchup grades, confidence, correlations)
- Live scores across 10+ sports
- Arena games (NBA + NFL) on the Coins economy
- Player rankings, Player of the Week
- Wallet/Coins with Stripe top-ups
- Sports news + injuries feed
- Social features (follow, feed, profiles, leaderboard)
- Bet tracker with ROI, quizzes, parlays

**In progress**

- Replacing remaining mock data with live queries
- Security hardening (rate limiting, CSP, input validation)
- Expanding scraper coverage
- Performance optimization and caching
- Legal copy alignment (non-wagering / non-sportsbook framing)

---

*Lasyly — sports research and community, the lazy way.*
