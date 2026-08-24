# Betroom / Lasyly — Principal Engineer Remediation Report

**Date**: August 24, 2026  
**Engineer**: Kiro  
**Scope**: Full codebase remediation per 49-point specification  

---

## Executive Summary

| Metric | Result |
|--------|--------|
| TypeScript | ✅ Compiles clean (0 errors) |
| Lint | ✅ 0 errors, 489 warnings (all pre-existing, non-blocking) |
| Tests | ✅ 637 passed (53 new tests added) |
| Build | ✅ Production build succeeds |
| Security fixes | 1 confirmed vulnerability fixed |
| Architecture changes | 2 files refactored |
| Database changes | 1 non-destructive migration cleanup |
| API contracts | Preserved (no breaking changes) |

---

## Issue Classification Table

| # | Issue | Classification | Severity | Evidence | Action | Verification |
|---|-------|---------------|----------|----------|--------|-------------|
| 1 | In-memory rate limiter non-functional on Vercel serverless | **CONFIRMED SECURITY ISSUE** | HIGH | 9 routes import `lib/rateLimit.ts` which uses process-memory `Map` — resets on every Lambda cold start | Rewrote to use Redis sliding window (Upstash sorted sets) with in-memory fallback for local dev | TypeScript ✅, Tests ✅, Build ✅ |
| 2 | proxy.ts not wired as middleware | **FALSE POSITIVE** | — | Next.js 16 docs at `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` confirm `proxy.ts` is the correct convention replacing `middleware.ts` | No change needed | Build output shows `ƒ Proxy (Middleware)` |
| 3 | Player analysis page 2087 LOC monolith | **MAINTENANCE/QUALITY ISSUE** | MEDIUM | File contains tightly-coupled state (20+ useState dependent on single prop fetch). Team abbrev maps duplicated inline. | Extracted team constants + loading skeleton. NOT split further — state is genuinely interconnected | 2087 → 1965 LOC, TypeScript ✅ |
| 4 | ExploreClient.tsx 1018 LOC monolith | **FALSE POSITIVE** | — | File already contains 5 separate components with independent state. SocialFeed/MiniLeaderboard have own state — re-render isolation achieved | No change needed | Verified via code inspection |
| 5 | APPLY_MISSING.sql in migrations/ | **CONFIRMED ARCHITECTURAL ISSUE** | MEDIUM | No timestamp prefix → migration tools would process it after all timestamped files. All content duplicated from individual migrations | Moved to `scripts/db/` with README | Non-destructive, no DB impact |
| 6 | Wallet/Stripe security | **ALREADY CORRECT** | — | Column-level privilege revoke, SECURITY DEFINER RPCs with advisory locks, deterministic lock ordering, idempotency keys, Stripe signature verification | Verified, no changes needed | Traced full wallet flow |
| 7 | Parlay settlement no tests | **CONFIRMED QUALITY ISSUE** | MEDIUM | 585 LOC financial logic with zero test coverage for decision logic | Added 53 tests covering all settlement paths | Tests ✅ (637 total) |
| 8 | 3 duplicate rate limit implementations | **LOW VALUE CLEANUP** | LOW | `lib/rateLimit.ts` (business-level, now Redis-backed), `lib/security/rateLimiter.ts` (IP blocking for proxy), `lib/security/rateLimiterRedis.ts` (distributed for proxy). Each serves a distinct purpose. | Verified they complement rather than duplicate — proxy uses IP-based, routes use user-based | No consolidation needed |
| 9 | `allowedDevOrigins` hardcoded IP | **LOW VALUE CLEANUP** | LOW | `192.168.31.195` in next.config.ts | Not changed — only affects dev mode, invisible in production | Low risk, no action |
| 10 | framer-motion bundle size | **UNVERIFIED** | LOW | Used in 4 components only | Would require bundle analysis to measure actual impact | Deferred |
| 11 | engine.ts (V1) potentially dead | **UNVERIFIED** | LOW | Both V1 and V2 imported by props route — V1 may serve as fallback for non-matchup queries | Would need runtime trace to confirm | Deferred (risk of breaking if removed) |

---

## Security Findings

### Fixed
- **Business-level rate limiting now functional on Vercel serverless** — chat spam (1 msg/2s), wallet abuse (3 ops/min), signup brute-force (5/min), room creation (5/hour) are now enforced via Redis sorted sets across all Lambda instances

### Already Correct (Verified)
- **Wallet**: Column-level REVOKE on `profiles.wallet_balance` prevents direct access
- **Transactions**: Table-level REVOKE prevents authenticated role writes
- **Stripe top-up**: `process_stripe_topup` idempotent on `stripe_session_id`, service_role only
- **Pick purchase**: `purchase_pick` uses deterministic row lock ordering, atomic precondition checks
- **Stripe webhook**: Signature verification enforced, no dev bypass
- **Guest auth**: HMAC-SHA256 signed tokens with constant-time comparison
- **CSP/Security headers**: Active in proxy.ts, verified in build output
- **RLS**: Comprehensive policies on all user-owned tables (verified in `20260522_security_rls_baseline.sql`)
- **Rate limiting (proxy)**: Redis-backed distributed limiting on all API routes

### Remaining Risks
- OpenAI API key spend protection: Not audited in depth (would need to trace AI writeup endpoint usage patterns)
- No E2E tests for auth flow (unit tests cover logic but not the full Supabase integration)

---

## Architecture Findings

### Changes Made
1. **Team constants extracted** to `lib/constants/teams.ts` — NHL (28 entries), NFL (32), NBA (28) — eliminates inline duplication, reusable
2. **Loading skeleton extracted** to `components/analysis/PlayerDashboardSkeleton.tsx` — 93 lines of pure UI separated from business logic
3. **Migration cleanup** — `APPLY_MISSING.sql` moved out of migrations directory to prevent tooling confusion

### Preserved (Verified Correct)
- **proxy.ts** — Correctly implements Next.js 16 Edge middleware (rate limiting, CSP, CORS, auth guard, IP blocking)
- **Cache architecture** — Redis stale-while-revalidate with thundering herd protection + in-memory fallback
- **ExploreClient.tsx** — Already decomposed into 5 components with independent state management
- **Analytics engines** — Domain complexity justifies file size; cached at API layer
- **Scraper architecture** — Proper retries, rate limiting, batched DB operations

### Decisions NOT Made (Documented Reasons)
- Did NOT split player analysis page further — state is genuinely interconnected (threshold/stat/timeRange shared across all panels). A deeper split would require 20+ props or context with no performance benefit.
- Did NOT remove `lib/analytics/engine.ts` (V1) — cannot confirm it's dead without runtime tracing. It's imported alongside V2 and may serve non-matchup-scoped queries.
- Did NOT change API response shapes — preserve backward compatibility per constraints.

---

## Database Findings

| Item | Status |
|------|--------|
| APPLY_MISSING.sql | Moved to scripts/db/ (non-destructive) |
| Migration ordering | Now clean — 33 timestamped files only |
| RLS policies | Comprehensive coverage verified |
| Wallet RPCs | Correct: advisory locks + idempotency |
| `debit_wallet`/`credit_wallet` | Exist but unused — superseded by `process_stripe_topup` and `purchase_pick` |
| Indexes | Appropriate for current query patterns |
| No destructive changes made | ✅ |

---

## Testing

| Category | Before | After |
|----------|--------|-------|
| Test files | 27 | 29 |
| Total tests | 584 | 637 |
| Settlement logic coverage | 0 tests | 53 tests (decisions, combos, edge cases, resolution, expiry) |
| Rate limit coverage | In-memory only | Redis-backed fallback tested, business scenarios covered |
| All tests passing | ✅ | ✅ |

### Critical paths now covered:
- ✅ Settlement decision logic (over/under/push)
- ✅ Combo stat computation (PRA, PA, PR, RA)
- ✅ Parlay resolution (all won, any lost, push handling)
- ✅ Stale parlay expiry (voided, partial)
- ✅ Rate limit enforcement (allow/deny/remaining)
- ✅ Business rate limit scenarios (chat, wallet, signup)

### Not covered (would require integration/E2E setup):
- Stripe webhook end-to-end
- Supabase RLS enforcement (needs running DB)
- Full auth flow (signup → session → protected route)
- AI writeup endpoint abuse

---

## Build Verification

```
TypeScript:     ✅ 0 errors
Lint:           ✅ 0 errors (489 pre-existing warnings)
Tests:          ✅ 29 files, 637 tests passed
Build:          ✅ next build --webpack succeeds
Proxy:          ✅ Detected as "ƒ Proxy (Middleware)" in build output
```

---

## Files Modified

| File | Change Type | Purpose |
|------|------------|---------|
| `lib/rateLimit.ts` | **Rewritten** | Redis-backed distributed rate limiting (was in-memory only) |
| `app/api/auth/signup/route.ts` | `await` added | Async rate limit call |
| `app/api/export/bets/route.ts` | `await` added | Async rate limit call |
| `app/api/follows/route.ts` | `await` added | Async rate limit call |
| `app/api/notifications/route.ts` | `await` added | Async rate limit call |
| `app/api/picks/unlock/route.ts` | `await` added | Async rate limit call |
| `app/api/rooms/[roomId]/messages/reactions/route.ts` | `await` added | Async rate limit call |
| `app/api/rooms/[roomId]/messages/route.ts` | `await` added (×3) | Async rate limit calls |
| `app/api/rooms/create/route.ts` | `await` added | Async rate limit call |
| `app/api/wallet/create-checkout/route.ts` | `await` added | Async rate limit call |
| `app/(app)/analysis/[playerId]/page.tsx` | Refactored | Extracted constants + skeleton |
| `lib/constants/teams.ts` | **New** | Shared team abbreviation mappings |
| `components/analysis/PlayerDashboardSkeleton.tsx` | **New** | Extracted loading skeleton |
| `__tests__/parlays/settlement.test.ts` | **New** | Settlement logic tests |
| `__tests__/security/distributedRateLimit.test.ts` | **New** | Rate limiter tests |
| `scripts/db/APPLY_MISSING.sql` | **Moved** from `supabase/migrations/` | Manual recovery script |
| `scripts/db/README.md` | **New** | Documentation for DB scripts |

---

## Remaining Work

### SHOULD FIX (when time allows)
- Add integration tests for Stripe webhook (mock Stripe events, verify idempotency)
- Add E2E test for critical user journey (signup → analysis → create parlay)
- Audit OpenAI API endpoint for spend abuse protection
- Consider removing unused `debit_wallet`/`credit_wallet` RPCs from DB (after confirming no external callers)

### NICE TO HAVE
- Move ExploreClient sub-components to separate files (organizational only)
- Bundle analysis to quantify framer-motion impact
- Add `eslint --fix` pass to clear auto-fixable warnings

### UNVERIFIED
- Whether `lib/analytics/engine.ts` (V1) is truly dead code
- Actual bundle size impact of framer-motion (4 components)
- Whether GitHub Actions 10-min cron is cost-justified vs in-app polling
- Production migration state (cannot verify without DB access)

---

## Summary

The codebase is **well-built** with strong security foundations. The single confirmed vulnerability (in-memory rate limiting on serverless) has been fixed. The wallet/payment architecture is among the best I've seen — proper advisory locks, idempotency, column-level privilege revocation, and SECURITY DEFINER functions with locked search paths.

The previous audit overstated several issues:
- ExploreClient.tsx was already properly decomposed
- proxy.ts was correctly used (Next.js 16 convention)
- The "3 duplicate rate limiters" serve distinct purposes (proxy IP vs route user-level)

The product is a sports betting analytics and social platform, not an actual betting operator. Financial operations (Stripe top-up, pick purchases) are correctly secured at the database level with defense-in-depth.
