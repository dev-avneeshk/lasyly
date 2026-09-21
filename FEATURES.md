# Lasyly — Features

A real-time, social, **play-money** sports platform. Everything runs on a virtual **Coins** economy (no real-money wagering). Below is everything the platform does.

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Framer Motion · Supabase (Postgres + RLS + Realtime) · Upstash Redis · Stripe · Sentry.

---

## Social & community
- Rooms — public, private, and tipster rooms, organized by sport
- Sub-channels inside rooms, with invites
- Real-time chat (broadcast-based delivery)
- Message reactions and message deletion
- Room moderation — kick, ban, mute, roles, pins, join requests
- Betslip sharing with reactions and comments
- Social feed — posts, likes, comments
- Follow / unfollow + a "following" feed
- Profiles — public (`/l/[username]`) and personal
- Tipsters directory
- Explore page — rooms, live matches, and trending content
- Leaderboard of top performers
- In-app notifications
- Web push notifications

## Accounts & auth
- Email/password signup and login (Supabase)
- Onboarding flow (username, display name)
- Guest sessions (signed guest cookie)
- Route protection via middleware
- Signup bonus (200 Coins)

## Coins economy & wallet
- Coins wallet with balance tracking
- Full transaction ledger (signup bonus, top-up, purchase, earnings, arena, weekly bonus)
- Stripe wallet top-ups (Checkout + webhooks)
- XP and levels progression system
- Weekly level-scaled coin bonus
- Premium pick unlocks (spend coins)

## Arena games (NBA — auction/draft)
- Auction/draft game engine (budget, roster, simulation, box scores)
- CPU opponents with a difficulty ladder
- Matchmaking and 1v1 play
- Coin staking — CPU entry cost + win reward
- 1v1 staking — winner takes the pot minus a 10% commission
- Refunds for abandoned staked games
- CPU-vs-CPU balancing simulation

## NFL mode
- NFL auction/draft engine, roster, and simulation
- NFL player grades
- NFL auction, roster, and results pages
- NFL player pages and stats
- NFL rankings + advanced analytics

## Prop analytics
- Prop cards with hit rates (last 5 / 10 / 15 / 20 games + season)
- Matchup grades (A–F) from opponent defense
- Confidence scores
- Trend arrows and streak indicators
- Model-implied odds / pricing
- Prop correlations
- Parlay builder
- Line movement and history
- Player, team, defense, and head-to-head stats
- Player profiles (coverage varies by sport)
- AI-generated writeups
- Prop voting
- Analysis pages (per player)
- Advanced filters — home/away, opponent, confidence, hit-rate ranges, today's games

## Player rankings
- NBA ranking engine (LPI v2)
- NFL ranking engine
- Team and player ranking pages
- Player of the Week
- Automated rankings generation
- Rankings admin page
- Player headshot resolver

## Live scores & news
- Live scores across 10+ sports (soccer, NBA, NFL, tennis, NHL, MLB, F1, UFC, golf, cricket)
- Adaptive polling (faster when live, pauses when tab hidden)
- Date navigation (past / today / future)
- Team logos and colors (ESPN)
- Match detail + summary view
- Score search and history
- YouTube highlights
- Curated sports news (scraped and stored in-house)
- Injuries feed

## Parlays
- Parlay creation and validation
- Parlay settlement and computations
- Automated parlay resolution/settlement
- Parlay feed

## Quizzes
- NBA and NFL quiz banks (1000+ questions each)
- Attempt and submit flow with grading
- Quiz pages

## Bets tracker & marketplace
- Personal bet tracker — win rate, ROI, net profit
- Bet CSV export
- Pick marketplace
- Games store
- Achievements

## Marketing, SEO & content
- Landing page
- Feature, compare, and tipsters marketing pages
- SEO landing pages (players, props-today, scores by sport)
- Blog — DB-backed and static posts, with RSS feed
- Sitemap, robots.txt, OpenGraph images
- IndexNow instant indexing
- Legal pages — privacy, terms, data sources
- Cookie consent

## Data & scraping
- In-house scrapers (NBA, NFL, tennis, soccer, live scores, news) run on schedules
- Data stored in Supabase; analytics computed from historical stats

## Infrastructure & ops
- Rate limiting (Redis-backed sliding window + in-memory fallback)
- Redis caching (cache-aside)
- Row Level Security across tables
- Background job queue
- Cron jobs (chat cleanup, retention, weekly coins, correlations, parlay resolution)
- Health check + keep-warm
- Error tracking (Sentry)
- Analytics + speed insights (Vercel)
- Data retention / cleanup
- Security audit workflow
- Load tests (k6 — smoke, load, stress, spike, soak, auth, abuse)
- Hot-path database indexes
