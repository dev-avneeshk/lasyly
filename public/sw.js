/**
 * Lasyly Service Worker — handles push notifications.
 *
 * Events handled:
 * - push: Display notification when a push message arrives
 * - notificationclick: Navigate to the relevant page when user taps
 */

self.addEventListener("push", (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: "Lasyly", body: event.data.text() }
  }

  const { title, body, icon, badge, url, tag } = payload

  event.waitUntil(
    self.registration.showNotification(title || "Lasyly", {
      body: body || "",
      icon: icon || "/lasyly_logo.png",
      badge: badge || "/lasyly_logo.png",
      tag: tag || "lasyly-default",
      data: { url: url || "/explore" },
      vibrate: [100, 50, 100],
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  const url = event.notification.data?.url || "/explore"

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes("lasyly.me") && "focus" in client) {
          client.focus()
          client.navigate(url)
          return
        }
      }
      // Otherwise open a new window
      return clients.openWindow(url)
    })
  )
})
