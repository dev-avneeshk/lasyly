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

/**
 * Send a push notification to multiple users.
 * Used for broadcast events (game start, settlement results).
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<{ totalSent: number; totalFailed: number }> {
  let totalSent = 0
  let totalFailed = 0

  // Process in parallel batches of 10 to avoid overwhelming the push service
  const batchSize = 10
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize)
    const results = await Promise.allSettled(
      batch.map((userId) => sendPushToUser(userId, payload))
    )
    for (const result of results) {
      if (result.status === "fulfilled") {
        totalSent += result.value.sent
        totalFailed += result.value.failed
      } else {
        totalFailed++
      }
    }
  }

  return { totalSent, totalFailed }
}
