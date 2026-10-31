"use client"

import { useEffect, useState } from "react"

/**
 * Tip-off in the viewer's own time zone. The server renders the UTC time so the markup is stable; the
 * client swaps in the local time after mount.
 */
export function LocalTipoff({ iso, withDate = false }: { iso: string | null; withDate?: boolean }) {
  const [text, setText] = useState(() => format(iso, withDate, "UTC"))
  useEffect(() => {
    setText(format(iso, withDate))
  }, [iso, withDate])
  return <span suppressHydrationWarning>{text}</span>
}

function format(iso: string | null, withDate: boolean, timeZone?: string): string {
  if (!iso) return "Time TBD"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "Time TBD"
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone, timeZoneName: "short" })
  if (!withDate) return time
  const day = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone })
  return `${day}, ${time}`
}
