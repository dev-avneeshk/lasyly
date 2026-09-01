# Tasks — Room Channels & Permissions

Implement in order. Each numbered task should end green (tsc + lint + tests +
build where applicable).

## Phase 1 — Database
- [ ] 1. Migration `YYYYMMDD_room_channels_permissions.sql` (atomic `BEGIN;…COMMIT;`)
  - [ ] 1a. `room_channel_categories`, `room_channels` tables (+ indexes,
    partial-unique default-per-room).
  - [ ] 1b. `messages.channel_id` column (nullable initially).
  - [ ] 1c. `room_join_requests` table (+ pending partial index).
  - [ ] 1d. `rooms.join_mode` column (default `open`).
  - [ ] 1e. Helper fns `channel_room_id`, `can_view_channel`, `can_post_channel`
    (+ GRANTs), declared before policies.
  - [ ] 1f. Backfill: one default `general` channel per room; assign all
    existing messages to it; then `channel_id SET NOT NULL`.
  - [ ] 1g. Replace `messages` SELECT/INSERT RLS with channel-aware policies;
    add RLS for the new tables.
  - [ ] 1h. Management RPCs: create/update/delete/reorder channel,
    request_join, decide_join_request (audit-logged).
  - [ ] 1i. Indexes: `(room_id, position)`, `(channel_id, created_at desc)`,
    join-request pending index.
  - **NOTE:** Applying to production DB is a manual step (Supabase SQL Editor) —
    document in the PR. The base tables aren't in migrations, so this must be
    run by the operator.

## Phase 2 — API
- [ ] 2. `channels` routes: GET (list), POST (create).
- [ ] 3. `channels/[channelId]` routes: PATCH (update), DELETE (delete).
- [ ] 4. `channels/reorder` route: POST.
- [ ] 5. `requests` route: GET (list pending, admin).
- [ ] 6. `requests/[requestId]` route: POST `{approve}`; `requests/mine` DELETE.
- [ ] 7. Modify `join/route.ts` → `room_request_join` (returns joined|requested).
- [ ] 8. Modify `messages/route.ts` GET+POST to be channel-scoped (channelId,
  default fallback, per-channel cache key + invalidation, schema-missing
  graceful fallback).

## Phase 3 — UI
- [ ] 9. Room page: fetch real channels, group by category, channel switching,
  per-channel messages/realtime, read-only styling when no post rights.
- [ ] 10. AdminPanel: Channels tab (CRUD + reorder + policy selects), Requests
  tab (approve/deny), join-mode toggle (owner-only).

## Phase 4 — Verify
- [ ] 11. Pure-function tests: permission decision table + join-request state
  machine. Run tsc, eslint, vitest, next build. Clean up temp artifacts.

## Rollout
- Deploy code (backward compatible: falls back to room-scoped when channel
  schema absent) → apply migration in Supabase SQL Editor → verify channels
  appear and messages are scoped.
