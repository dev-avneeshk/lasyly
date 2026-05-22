# 🎰 Lasyly

> **The social platform for sports bettors.** Share picks, join live rooms, track real-time scores, and win together.

Lasyly is a real-time social platform where sports bettors can join topic-based "rooms," share betslips with reactions and comments, follow top tipsters, track live scores, and unlock premium picks via an integrated wallet system.

---

## 🚀 Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS v4 |
| **Animation** | Framer Motion 12 |
| **Database & Auth** | Supabase (Postgres + RLS + Realtime) |
| **Payments** | Stripe (Checkout + Webhooks) |
| **Icons** | Lucide React |
| **UI Primitives** | Radix UI |

---

## 📁 Project Structure

```
lasyly/
├── app/
│   ├── (auth)/           # Login, Signup pages (public routes)
│   ├── (app)/            # Protected app shell
│   │   ├── home/         # Social feed
│   │   ├── explore/      # Room discovery
│   │   ├── rooms/        # Room list + [roomId] detail
│   │   ├── wallet/       # Wallet & transaction history
│   │   └── profile/      # User profile & stats
│   └── api/
│       ├── scores/       # Live scores polling endpoint
│       ├── picks/        # Betslip purchase API
│       ├── wallet/       # Wallet top-up Stripe session
│       └── webhooks/     # Stripe webhook handler
├── components/
│   ├── layout/           # Sidebar, MobileNav
│   ├── room/             # BetslipCard, ChatPanel, ScoresPanel
│   └── ui/               # Button, Input primitives
├── lib/
│   ├── mockData.ts       # Dev-time mock data
│   ├── utils.ts          # cn() helper
│   ├── services/
│   │   └── sportsApi.ts  # Live scores service (mock → real API)
│   └── supabase/
│       ├── client.ts     # Browser Supabase client
│       └── server.ts     # Server-side Supabase client
├── types/
│   └── index.ts          # Shared TypeScript types
├── middleware.ts          # Auth-gated route protection
├── schema.sql            # Core DB schema (v1)
└── schema_v2.sql         # Wallet & payments schema (v2)
```

---

## ⚙️ Local Development

### Prerequisites
- Node.js 20+
- A Supabase project (free tier works)
- A Stripe account (test mode)

### 1. Clone & Install

```bash
git clone https://github.com/your-username/lasyly.git
cd lasyly
npm install
```

### 2. Configure Environment

Create `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Optional: Real sports data
SPORTS_API_KEY=your-api-football-key
```

### 3. Set Up Database

Run `schema.sql` then `schema_v2.sql` in your Supabase SQL editor.

### 4. Run Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 🗄️ Database Schema

### Core Tables (schema.sql)
- **`profiles`** — extends `auth.users`, stores username, bio, sports, verification status
- **`rooms`** — Public / Private / Tipster rooms with sport tags and live status
- **`messages`** — Real-time chat messages per room (Supabase Realtime enabled)

### Wallet & Payments (schema_v2.sql)
- **`transactions`** — TOP_UP, PURCHASE, EARNING, WITHDRAWAL ledger (Stripe-backed)
- **`unlocked_picks`** — tracks which betslips a user has paid to unlock
- `wallet_balance` column added to `profiles`

> All tables use Row Level Security (RLS). Transactions are written exclusively by server-side webhook handlers.

---

## 🔐 Auth & Route Protection

`middleware.ts` guards all `/home`, `/explore`, `/rooms`, `/profile` routes. Unauthenticated users are redirected to `/login`. Authenticated users accessing `/login` or `/signup` are redirected to `/home`.

---

## 🏗️ Feature Status

| Feature | Status |
|---|---|
| Auth (Login / Signup) | ✅ UI Built (Supabase integration needed) |
| Home Feed | ✅ Mock data wired |
| Explore Rooms | ✅ UI complete, filter working |
| Room Detail + Chat | ✅ UI scaffolded (Realtime pending) |
| Live Scores Panel | ✅ Mock polling (real API ready to plug in) |
| Profile Page | ✅ UI complete (real data pending) |
| Wallet Page | ✅ UI complete (Stripe flow pending) |
| Betslip Card | ✅ Component built with reactions |
| Supabase Auth wire-up | 🔧 In progress |
| Real-time Chat (Supabase) | 🔧 Planned |
| Stripe Checkout + Webhook | 🔧 Planned |
| Betslips table + DB | 🔧 Planned |
| Notifications | 🔧 Planned |
| Mobile Nav | 🔧 Planned |
| Public Landing Page | 🔧 Planned |

---

## 🌐 Key Routes

| Route | Description |
|---|---|
| `/` | Redirects to `/home` (or `/login` if unauthenticated) |
| `/login` | Login page |
| `/signup` | Registration page |
| `/home` | Social betslip feed |
| `/explore` | Room discovery with sport filters |
| `/rooms` | User's joined rooms |
| `/rooms/[roomId]` | Room detail: chat, betslips, live scores |
| `/wallet` | Balance, top-up, transaction history |
| `/profile` | User stats, picks history |

---

## 🔌 API Routes

| Route | Method | Description |
|---|---|---|
| `/api/scores` | GET | Returns live match scores (mock or API-Football) |
| `/api/picks` | POST | Initiates a pick unlock purchase |
| `/api/wallet` | POST | Creates Stripe Checkout session for wallet top-up |
| `/api/webhooks` | POST | Stripe webhook handler (updates wallet balance) |

---

## 📦 Alternate Architecture Options

See [ROADMAP.md](./ROADMAP.md) for alternate solutions considered and the full build plan.

---

## 📄 License

Private — all rights reserved.
