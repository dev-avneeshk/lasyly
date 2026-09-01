# Design — Room Channels & Permissions

## Guiding principles
- Reuse the existing authorization backbone: `is_room_member(room_id, uid)`,
  `is_room_admin(room_id, uid)`, `room_is_public(room_id)`.
- Enforce all rules in RLS + `SECURITY DEFINER` RPCs. API routes stay thin
  (auth + validation + delegate), matching `members/role/route.ts`.
- Additive, backward-compatible migration. No message loss.

## 1. Data model

### 1.1 `room_channel_categories`
Sidebar grouping ("sub-groups"). Optional — channels can have no category.
```
id           uuid pk default gen_random_uuid()
room_id      uuid not null -> rooms(id) on delete cascade
name         text not null              -- "General", "Tips & Analysis"
position     int  not null default 0    -- sort order within room
created_at   timestamptz not null default now()
```

### 1.2 `room_channels`
```
id           uuid pk default gen_random_uuid()
room_id      uuid not null -> rooms(id) on delete cascade
category_id  uuid null     -> room_channel_categories(id) on delete set null
name         text not null              -- "general", "hot-tips"
topic        text null
icon         text null                  -- emoji
type         text not null default 'text' check (type in ('text'))
position     int  not null default 0
view_policy  text not null default 'everyone' check (view_policy in ('everyone','members','admins'))
post_policy  text not null default 'members'  check (post_policy in ('everyone','members','admins'))
is_default   bool not null default false      -- the room's fallback channel
created_at   timestamptz not null default now()
```
- `is_default` marks the "general" channel used as the fallback when a message
  arrives without a channel (rollout compatibility) and the one that can never
  be deleted.
- Index: `(room_id, position)`, and a partial unique index ensuring exactly one
  default per room: `unique (room_id) where is_default`.

### 1.3 `messages.channel_id` (new column)
```
alter table messages add column channel_id uuid references room_channels(id) on delete cascade;
```
- Backfilled to each room's default channel (see §4 migration).
- After backfill, set `not null` in the same migration (all rows populated).
- New index: `(channel_id, created_at desc)` to power per-channel pagination
  (replaces reliance on `(room_id, created_at)` for the feed).

### 1.4 `room_join_requests`
```
id           uuid pk default gen_random_uuid()
room_id      uuid not null -> rooms(id) on delete cascade
user_id      uuid not null -> auth.users(id) on delete cascade
status       text not null default 'pending' check (status in ('pending','approved','denied'))
requested_at timestamptz not null default now()
decided_by   uuid null -> auth.users(id) on delete set null
decided_at   timestamptz null
unique (room_id, user_id)          -- one request row per user per room
```
- Partial index `(room_id) where status = 'pending'` for the admin queue.

### 1.5 `rooms.join_mode` (new column)
```
alter table rooms add column join_mode text not null default 'open' check (join_mode in ('open','request'));
```
- Default `open` preserves current behavior for all existing rooms.

## 2. Helper functions (SECURITY DEFINER, STABLE, search_path='')

Reuse existing ones; add channel-scoped helpers to keep RLS non-recursive:

- `channel_room_id(p_channel_id uuid) -> uuid` — the owning room (STABLE).
- `can_view_channel(p_channel_id uuid, p_user_id uuid) -> bool`:
  - resolve room + `view_policy`.
  - `admins` → `is_room_admin(room, uid)`
  - `members` → `is_room_member(room, uid)`
  - `everyone` → `room_is_public(room) OR is_room_member(room, uid)`
- `can_post_channel(p_channel_id uuid, p_user_id uuid) -> bool`:
  - same shape using `post_policy`; `everyone`/`members` both require
    membership to POST (public rooms allow *viewing* by anyone but posting
    still requires membership), `admins` requires `is_room_admin`.
- Grant EXECUTE to `anon, authenticated, service_role` like the others.

## 3. RLS policies

### room_channel_categories / room_channels
- SELECT: `room_is_public(room_id) OR is_room_member(room_id, auth.uid())`
  (channel list visibility mirrors room visibility; per-channel *view* gating
  is applied to messages, and the sidebar greys out unviewable channels).
- INSERT / UPDATE / DELETE: `is_room_admin(room_id, auth.uid())`.
- Channel management primarily goes through RPCs (below) for extra invariants
  (last-channel protection, default flag), but RLS still guards direct access.

### messages (replace existing policies)
- SELECT: `can_view_channel(channel_id, auth.uid())`.
- INSERT: `auth.uid() = user_id AND can_post_channel(channel_id, auth.uid())
  AND is_system = false`.
- DELETE: unchanged — `user_id = auth.uid() OR is_room_admin(room_id, …)`.
- These supersede the room-scoped `messages_select_visible` /
  `messages_insert_member` policies. `can_view_channel`/`can_post_channel`
  already fold in room membership/public checks, so no regression for the
  default `everyone/members` channel.

### room_join_requests
- SELECT: `user_id = auth.uid() OR is_room_admin(room_id, auth.uid())`.
- INSERT: `auth.uid() = user_id AND status = 'pending'` — but creation goes
  through an RPC that also enforces join_mode + ban check.
- UPDATE/DELETE: admins only (approve/deny), or the user deleting their own
  pending row (cancel).

## 4. Migration & backfill (single file, atomic)

`supabase/migrations/YYYYMMDD_room_channels_permissions.sql`, in `BEGIN;…COMMIT;`:
1. Create the four objects/columns above (guarded with `IF NOT EXISTS`).
2. **Backfill categories/channels**: for every existing room, insert one
   `room_channels` row `{name:'general', icon:'💬', is_default:true}`.
3. **Backfill messages**: `UPDATE messages SET channel_id = <that room's default
   channel>` for all rows where `channel_id IS NULL` (join on room_id).
4. `ALTER TABLE messages ALTER COLUMN channel_id SET NOT NULL;` (safe — all rows
   now populated).
5. Replace message RLS policies (`DROP POLICY IF EXISTS` then `CREATE POLICY`).
6. Add indexes.
7. Helper functions + their GRANTs first (before policies that reference them).

Rollout compatibility: the messages API keeps accepting requests without a
`channelId` during rollout and resolves to the room's default channel, so a
deploy-before-migrate or migrate-before-deploy ordering can't break sends.

## 5. Management RPCs (SECURITY DEFINER)

To hold invariants RLS can't easily express:
- `room_create_channel(p_room_id, p_name, p_category_id, p_icon, p_topic,
  p_view_policy, p_post_policy) -> jsonb` — admin-only; returns new channel.
- `room_update_channel(p_channel_id, …nullable fields…) -> jsonb` — admin-only.
- `room_delete_channel(p_channel_id) -> jsonb` — admin-only; **rejects if it's
  the last channel or the default channel**; logs to `room_audit_log`.
- `room_reorder_channels(p_room_id, p_ordered_ids uuid[]) -> jsonb` — admin.
- `room_request_join(p_room_id) -> jsonb` — auth; ban check; if
  `join_mode='open'` inserts membership directly (same as today) and returns
  `{joined:true}`; if `'request'` upserts a pending request and returns
  `{requested:true}`.
- `room_decide_join_request(p_request_id, p_approve bool) -> jsonb` — admin;
  approve → insert `room_members` (member) idempotently + mark approved; deny →
  mark denied; audit-logged.
All follow the existing RPC style: `auth.uid()` checks inside, return
`{success…}` or `{error}`, `REVOKE ALL … FROM PUBLIC; GRANT EXECUTE … TO
authenticated`.

## 6. API routes (thin, `withSecurity`)

- `GET  /api/rooms/[roomId]/channels` — list channels + categories (PUBLIC_SHORT
  cache; RLS filters).
- `POST /api/rooms/[roomId]/channels` — create (→ `room_create_channel`).
- `PATCH  /api/rooms/[roomId]/channels/[channelId]` — update (→ update RPC).
- `DELETE /api/rooms/[roomId]/channels/[channelId]` — delete (→ delete RPC).
- `POST /api/rooms/[roomId]/channels/reorder` — reorder.
- `GET  /api/rooms/[roomId]/requests` — pending requests (admin; RLS-gated).
- `POST /api/rooms/[roomId]/requests/[requestId]` — `{approve:boolean}`.
- `DELETE /api/rooms/[roomId]/requests/mine` — cancel own request.
- **Modify** `join/route.ts` → delegate to `room_request_join`; return either
  `{joined}` or `{requested}`.
- **Modify** `messages/route.ts`:
  - GET accepts `?channelId=` (falls back to room default); cache key becomes
    `room:messages:<channelId>:<limit>`.
  - POST accepts `{ content, channelId? }`; resolves default; the DB RLS +
    `can_post_channel` enforce posting rights; cache-bust the channel key.

## 7. UI

- `app/(app)/rooms/[roomId]/page.tsx`:
  - Replace hardcoded `CHANNELS` with channels fetched from
    `/channels`, grouped by category. `activeChannel` becomes a real
    `channelId`. Messages fetch/send/realtime keyed by channel.
  - Channel switch: refetch that channel's messages; realtime channel name
    becomes `room-chan-<channelId>`; greyed/read-only styling when the user
    can't view/post.
  - Keep the perf work already done (memoized `MessageRow`, isolated
    `ChatInput`, capped array, per-channel cache).
- `AdminPanel.tsx`: add **Channels** tab (list, create, rename/topic/icon,
  view/post policy selects, delete, drag-to-reorder) and **Requests** tab
  (approve/deny). Add a **join mode** toggle in room settings (owner-only).

## 8. Testing
- Unit: permission resolution (`can_view_channel`/`can_post_channel` decision
  table across everyone/members/admins × owner/mod/member/non-member) mirrored
  in a TS pure-function test, matching the existing `settlement.test.ts` style.
- Unit: join-request state machine (open→joined, request→pending→approved/
  denied/cancelled, re-request no-op, banned blocked).
- Verify tsc/lint/tests/build.

## 9. Risks & mitigations
- **Migration not applied** (recurring theme in this repo): the messages API
  resolves a default channel and tolerates a missing `channel_id` column by
  falling back to room-scoped behavior guarded by a schema check, so a
  deploy-without-migrate degrades to today's behavior instead of 500ing. The
  migration must still be applied for real channels to work (documented in
  tasks.md).
- **RLS recursion**: channel helpers call the existing room helpers (which read
  `room_members`/`rooms`), never `messages`, avoiding recursive policy
  evaluation.
- **Last-channel deletion**: enforced in `room_delete_channel` RPC, not RLS.


---

## ADDENDUM — Final data model (two-level channels, links, limits, betslips)

### Revised tables
- Rename concept: **`room_channels`** = level-1 channels (groups). Add
  **`room_subchannels`** = level-2 (where messages live). Messages get
  `subchannel_id` (not `channel_id`).

**`room_channels`** (level 1 / group): `id, room_id, name, icon, position,
created_at`. Free limit: ≤2 per room.

**`room_subchannels`** (level 2 / chat): `id, channel_id, room_id (denormalized
for RLS), name, topic, icon, position, visibility ('public'|'private'),
post_policy ('everyone'|'members'|'admins'), join_policy ('open'|'request'),
slug text unique, invite_token text null (private only), is_default bool,
created_at`. Free limit: ≤2 per channel.

**`messages`**: add `subchannel_id uuid -> room_subchannels(id) on delete
cascade`, `kind text default 'text' check (kind in ('text','betslip'))`,
`betslip_id uuid null`. Backfill: each room gets one default channel +
default public sub-channel; existing messages → that sub-channel.

**`profiles.is_pro`** bool default false — governs free-tier limits.

**`room_join_requests`**: as before but keyed to `subchannel_id` (private
request-mode joins), plus room-level requests keep working.

### Slugs & tokens
- `slug`: 8-char base62, unique across subchannels. Public link: `/g/<slug>`.
- `invite_token`: 32-char base62, only for private. Link: `/g/<slug>?k=<token>`.
- Regenerate token = update column to a fresh value (old link dies).
- Generated in the create/rotate RPCs via `gen_random_uuid()`-derived text.

### Limit enforcement
- `room_create_channel` RPC: counts existing channels; if ≥2 and owner not
  `is_pro` → return `{error:'LIMIT_REACHED', limit:'channels'}`.
- `room_create_subchannel` RPC: counts sub-channels in the channel; if ≥2 and
  not pro → `{error:'LIMIT_REACHED', limit:'subchannels'}`.
- API maps `LIMIT_REACHED` to HTTP 402 so the client shows the upgrade modal.

### Betslip messages
- POST messages accepts `{ kind:'text'|'betslip', content?, betslipId? }`.
  For betslip: validate the betslip belongs to the sender, store
  `kind='betslip', betslip_id=…`, content = short summary text fallback.
- GET messages joins the betslip (id, odds, stake, status, legs count) for
  `kind='betslip'` rows so the card renders without an extra call.

### Public join page `/g/<slug>`
- New route group `app/(public)/g/[slug]/page.tsx` (server component): resolves
  the sub-channel by slug; for private requires matching `?k=` token; shows a
  join/preview screen; joining routes through `room_request_join`-style RPC.

### Upgrade modal
- `components/room/UpgradeModal.tsx` — compact centered dialog, dark/lime theme,
  "Pro coming soon" + disabled CTA. Triggered on 402 `LIMIT_REACHED`.
