# Requirements — Room Channels & Permissions

## Overview

Turn rooms from a single shared message stream (with fake, hardcoded sidebar
channels) into a real Discord/Telegram-style server: admin-managed channels
organized into categories, a join-request approval flow for gated rooms, and
role-based per-channel posting/viewing permissions.

## Background / Problem

Today (verified against the codebase):

- The channel sidebar in `app/(app)/rooms/[roomId]/page.tsx` is a hardcoded
  `CHANNELS` constant. Selecting a channel only changes header text — **every
  channel shows the same messages** because `messages` are scoped by `room_id`
  only (no `channel_id`).
- The `locked: true` flag on some hardcoded channels does nothing.
- Joining a room is instant for any authenticated, non-banned user. There is
  **no approval flow**.
- Roles (`owner`/`moderator`/`member`), bans, mutes, kicks, and pins already
  exist and work via RLS + `SECURITY DEFINER` RPCs. We build on these.

## Roles (existing, reused)

- **owner** — the room creator. Full control.
- **moderator** — admin-lite. Can moderate; cannot change roles.
- **member** — regular participant.
- "admin" throughout means `role IN ('owner','moderator')`, matching
  `is_room_admin()`.

## Requirements

### R1 — Dynamic channels
1. A room has one or more **channels**. Each channel belongs to the room and
   optionally to a **category** (a named group used for sidebar organization —
   the "sub-groups" ask).
2. Channels have: name, optional topic/description, icon (emoji), a sort
   position, and a type (`text` for now; reserve room for future `scores`,
   `voice`, etc.).
3. Admins (owner/moderator) can **create, rename, set topic/icon, delete, and
   reorder** channels and categories.
4. Every message belongs to exactly one channel. Fetching, sending, and
   realtime are **scoped per channel**.
5. Deleting a channel deletes its messages (cascade). A room must always keep
   at least one channel (cannot delete the last one).
6. On migration, every existing room gets a default "general" channel, and all
   existing messages are assigned to it (no message loss).

### R2 — Per-channel permissions
1. Each channel has a **view policy** and a **post policy**, each one of:
   - `everyone` — any room member (or anyone, for public rooms, on view).
   - `members` — room members only.
   - `admins` — owner/moderator only.
2. Default for a new channel: view=`everyone`, post=`members`.
3. A "locked" channel = post policy `admins` (this replaces the dead `locked`
   flag). Non-admins see it read-only.
4. Posting into a channel the user isn't allowed to post in must be rejected at
   the API AND the database (RLS), not just hidden in the UI.
5. Viewing messages of a channel the user can't view must be blocked at the DB
   (RLS) too.

### R3 — Join-request approval flow
1. A room has a **join mode**: `open` (instant join, current behavior) or
   `request` (must be approved).
2. For `request` rooms, a non-member who tries to join creates a **pending
   join request** instead of becoming a member.
3. Admins can **approve** (creates the membership) or **deny** (removes the
   request) pending requests.
4. A user may have at most one pending request per room. Re-requesting while
   pending is a no-op. Banned users cannot request.
5. Approving is idempotent and race-safe (respects the existing
   `UNIQUE(room_id, user_id)` on `room_members`).
6. The requesting user can **cancel** their own pending request.
7. `open` rooms keep the exact current instant-join behavior — no regression.

### R4 — Admin UX
1. The existing `AdminPanel` gains: a **Channels** tab (CRUD + reorder + per-
   channel view/post policy) and a **Requests** tab (approve/deny pending join
   requests), alongside the current Members/Bans/Pins tabs.
2. Room settings gain a **join mode** toggle (open vs request), owner-only.
3. All admin actions are authorized server-side; the UI only reflects state.

### R5 — Non-functional
1. **Security**: all authorization enforced in RLS + `SECURITY DEFINER` RPCs,
   matching the existing pattern. No client-trusted permission checks.
2. **Performance**: reuse the existing message pagination, per-room Redis cache
   (now per-channel), and memoized message rendering. No unbounded fetches.
   Follow the caching guidance in AGENTS.md (cache-aside with TTL).
3. **Backwards compatibility**: existing rooms/messages keep working through
   the migration; the message API stays backward compatible (channel optional,
   defaulting to the room's general channel) during rollout.
4. **Consistency**: migrations follow the repo convention
   (`YYYYMMDD_snake_case.sql`, wrapped in `BEGIN; … COMMIT;`, helper functions
   first, `DROP POLICY IF EXISTS` then `CREATE POLICY`, policies named
   `<table>_<cmd>_<scope>`), and reuse `is_room_member`/`is_room_admin`/
   `room_is_public`.

## Out of scope (this iteration)
- Voice channels, threads, DMs, per-user (not role) permission overrides.
- Realtime migration to `postgres_changes` (kept as broadcast; separate task).
- Notification/unread counts per channel.

## Acceptance criteria
- Two channels in a room show two independent message streams.
- A non-admin cannot post in an `admins`-post channel (blocked by API and RLS).
- A `request`-mode room queues joins; an admin approve turns a request into a
  membership; deny removes it; the user can cancel their own request.
- Existing rooms/messages are intact post-migration (all under "general").
- `tsc`, lint, tests, and `next build` all pass.


---

## ADDENDUM — Final scope (supersedes conflicting items above)

### Structure & naming (two levels)
- **Channel** (level 1) = a group/category. Contains sub-channels. No chat
  directly in a channel.
- **Sub-channel** (level 2) = where messages actually live (the chat stream).
- So the hierarchy is Room → Channels → Sub-channels → Messages.

### R6 — Free-tier limits + paywall (UI only for now)
1. A free user (room owner) may create at most **2 channels per room**, and at
   most **2 sub-channels per channel**.
2. Exceeding either limit is **blocked server-side** (API + a DB-enforced count
   check) with a `LIMIT_REACHED` response.
3. The UI shows an **"Upgrade to Pro" popup/modal** when a limit is hit. The
   modal is a compact, non-intrusive dialog (not a whole page). Billing does
   **not** actually charge — the upgrade button is a placeholder ("coming
   soon"). No Stripe wiring in this iteration.
4. A `pro` flag on the user profile (default false) governs whether limits
   apply. Nothing flips it to true yet (manual/DB only), so everyone is free
   tier for now — the gate is real, the payment is stubbed.

### R7 — Public vs private sub-channels + links
1. Each **sub-channel** is `public` or `private` (independent of the room type).
2. **Public** sub-channel → a short shareable slug link `/(g)/<code>` on the
   current app domain (short domain like `lasyly.me/g/…` can be mapped later
   via DNS; code builds the route). Anyone with the link can open and join.
3. **Private** sub-channel → a **secret invite token** (long, random,
   unguessable — Telegram-style; not literally encrypted content). Link form:
   `/(g)/<code>?k=<token>`. Only people who have the token can join.
   - Token is **revocable / regeneratable** by admins (old link stops working).
   - Private sub-channel + join policy: admin picks **`open`** (anyone with the
     valid link joins instantly) or **`request`** (link holders must be
     approved by an admin).
4. Slug codes are unique, URL-safe, short (~8 chars). Tokens are ~32 chars.

### R8 — Betslip sharing in chat
1. Users can **share a betslip/parlay into a sub-channel**. It renders as a
   compact **bet card** in the message stream (reusing the existing betslip
   data + card styling), not plain text.
2. Implemented as a message with a `kind='betslip'` + a `betslip_id` reference
   (regular messages are `kind='text'`).

### R9 — UI quality
1. High-quality, polished UI: clean sidebar with collapsible channels and
   nested sub-channels, lock/globe/key icons indicating public/private/admin-
   only, smooth channel switching, tasteful modals. Compact — must not eat
   layout space. Match the existing dark `#0A0A0A`/lime `#B8FF4F` theme.
