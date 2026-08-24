"use client"
import { useState, useEffect } from "react"
import { Bell, BellOff, X } from "lucide-react"

/**
 * Push notification opt-in prompt.
 * Shows a dismissible banner inviting users to enable push notifications.
 * Handles: permission request → service worker registration → subscription → API save.
 */
export function PushPrompt() {
  const [visible, setVisible] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Don't show if:
    // - Browser doesn't support push
    // - User already granted/denied permission
    // - User dismissed the prompt before (localStorage flag)
    if (typeof window === "undefined") return
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return
    if (Notification.permission !== "default") return
    if (localStorage.getItem("lasyly_push_dismissed")) return

    // Show after a brief delay (don't overwhelm on first load)
    const timer = setTimeout(() => setVisible(true), 5000)
    return () => clearTimeout(timer)
  }, [])

  async function subscribe() {
    setLoading(true)
    try {
      // 1. Get VAPID public key from server
      const keyRes = await fetch("/api/notifications/push")
      if (!keyRes.ok) throw new Error("Push not configured")
      const { vapidPublicKey } = await keyRes.json()

      // 2. Request permission
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setVisible(false)
        return
      }

      // 3. Register service worker
      const registration = await navigator.serviceWorker.register("/sw.js")
      await navigator.serviceWorker.ready

      // 4. Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      })

      // 5. Save subscription to backend
      const subJson = subscription.toJSON()
      const saveRes = await fetch("/api/notifications/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
        }),
      })

      if (saveRes.ok) {
        setSubscribed(true)
        setTimeout(() => setVisible(false), 2000)
      }
    } catch (err) {
      console.error("Push subscription failed:", err)
    } finally {
      setLoading(false)
    }
  }

  function dismiss() {
    localStorage.setItem("lasyly_push_dismissed", "1")
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 animate-in slide-in-from-bottom-4">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 shadow-2xl">
        {subscribed ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--color-lime)]/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-[var(--color-lime)]" />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              Notifications enabled! You&apos;ll get alerts for prop hits and game starts.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--color-lime)]/10 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-[var(--color-lime)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
                Never miss a prop hit
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mb-3">
                Get notified when your logged picks hit, games start, and rooms are active.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={subscribe}
                  disabled={loading}
                  className="px-4 py-1.5 rounded-lg bg-[var(--color-lime)] text-black text-xs font-bold hover:bg-[var(--color-lime)]/90 transition-colors disabled:opacity-50"
                >
                  {loading ? "Enabling..." : "Enable"}
                </button>
                <button
                  onClick={dismiss}
                  className="px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-muted)] hover:text-white transition-colors"
                >
                  Not now
                </button>
              </div>
            </div>
            <button onClick={dismiss} className="text-[var(--color-text-muted)] hover:text-white shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Utility ────────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
