/**
 * Web Push notification sender.
 *
 * Sends push notifications to users who have subscribed via the service worker.
 * Uses the `web-push` library with VAPID authentication.
 *
 * Required environment variables:
 *   VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 *   VAPID_SUBJECT (mailto: URL)
 */
import webpush from "web-push"
import { createAdminClient } from "./supabase/admin"

// ─── VAPID Configuration ────────────────────────────────────────────────────

let _configured = false

function ensureConfigured() {
  if (_configured) return true

  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || "mailto:hello@lasyly.me"

  if (!publicKey || !privateKey) {
    return false
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  _configured = true
  return true
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
  icon?: string
}

interface PushSubscriptionRow {
  id: string
  user_id: string
  endpoint: string
  keys_p256dh: string
  keys_auth: string
}

// ─── Send to a single user ──────────────────────────────────────────────────

/**
 * Send a push notification to all of a user's subscribed devices.
 * Automatically removes expired/invalid subscriptions.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!ensureConfigured()) {
    return { sent: 0, failed: 0 }
  }

  const supabase = createAdminClient()

  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, keys_p256dh, keys_auth")
    .eq("user_id", userId)

  if (error || !subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0 }
  }

  let sent = 0
  let failed = 0
  const expiredIds: string[] = []

  for (const sub of subscriptions as PushSubscriptionRow[]) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys_p256dh,
            auth: sub.keys_auth,
          },
        },
        JSON.stringify(payload),
        { TTL: 86400 } // 24h
      )
      sent++
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode
      // 404 or 410 = subscription expired/unsubscribed
      if (statusCode === 404 || statusCode === 410) {
        expiredIds.push(sub.id)
      }
      failed++
    }
  }

  // Clean up expired subscriptions
  if (expiredIds.length > 0) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .in("id", expiredIds)
  }

  return { sent, failed }
}

// ─── Send to multiple users ─────────────────────────────────────────────────

/** Users per subscription lookup. Keeps the `IN (…)` list a sane size. */
const SUBSCRIPTION_FETCH_CHUNK = 500

/** Concurrent Web Push requests in flight. */
const SEND_CONCURRENCY = 20

/**
 * Send a push notification to multiple users.
 * Used for broadcast events (game start, settlement results).
 *
 * ── Fan-out cost ────────────────────────────────────────────────────────────
 * This used to call `sendPushToUser` once per user, and each of those runs its
 * own `SELECT … FROM push_subscriptions WHERE user_id = ?`. A broadcast to N
 * users was therefore N round-trips to Postgres before a single notification was
 * sent — 10,000 queries to notify 10,000 people, which is precisely the shape of
 * load a "game starting" broadcast produces during an event.
 *
 * Subscriptions are now fetched in chunked bulk queries (one per 500 users) and
 * the sends run against that in-memory set. Expired endpoints are still reaped,
 * in one delete rather than one per user.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<{ totalSent: number; totalFailed: number }> {
  if (!ensureConfigured() || userIds.length === 0) {
    return { totalSent: 0, totalFailed: 0 }
  }

  const supabase = createAdminClient()
  const uniqueIds = [...new Set(userIds)]

  // ── 1. Bulk-load every subscription for the target set ──────────────────────
  const subscriptions: PushSubscriptionRow[] = []
  for (let i = 0; i < uniqueIds.length; i += SUBSCRIPTION_FETCH_CHUNK) {
    const chunk = uniqueIds.slice(i, i + SUBSCRIPTION_FETCH_CHUNK)
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("id, user_id, endpoint, keys_p256dh, keys_auth")
      .in("user_id", chunk)

    if (error) {
      console.error("[push] subscription lookup failed:", error.message)
      continue
    }
    if (data) subscriptions.push(...(data as PushSubscriptionRow[]))
  }

  if (subscriptions.length === 0) {
    return { totalSent: 0, totalFailed: 0 }
  }

  // ── 2. Send with bounded concurrency ───────────────────────────────────────
  let totalSent = 0
  let totalFailed = 0
  const expiredIds: string[] = []
  const body = JSON.stringify(payload)

  for (let i = 0; i < subscriptions.length; i += SEND_CONCURRENCY) {
    const batch = subscriptions.slice(i, i + SEND_CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
            },
            body,
            { TTL: 86400 } // 24h
          )
          return true
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number }).statusCode
          // 404 / 410 = subscription expired or unsubscribed.
          if (statusCode === 404 || statusCode === 410) {
            expiredIds.push(sub.id)
          }
          return false
        }
      })
    )

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) totalSent++
      else totalFailed++
    }
  }

  // ── 3. Reap dead endpoints in one pass ─────────────────────────────────────
  // Without this, `push_subscriptions` accumulates unreachable rows forever and
  // every subsequent broadcast pays to load and attempt them again.
  if (expiredIds.length > 0) {
    for (let i = 0; i < expiredIds.length; i += SUBSCRIPTION_FETCH_CHUNK) {
      const chunk = expiredIds.slice(i, i + SUBSCRIPTION_FETCH_CHUNK)
      const { error } = await supabase.from("push_subscriptions").delete().in("id", chunk)
      if (error) console.error("[push] expired-subscription cleanup failed:", error.message)
    }
  }

  return { totalSent, totalFailed }
}
