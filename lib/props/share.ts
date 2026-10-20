/**
 * Sharing a prop card.
 *
 * This was written inline in PropCard and had three problems worth naming, since
 * they are the reason "Share doesn't work":
 *
 * 1. The shared link pointed at `/players/<slug>`, which 404s for any player
 *    without prop_line_history rows. It now uses the card's detail route.
 * 2. The image was fetched with `await` *before* calling `navigator.share()`. The
 *    Web Share API requires transient user activation, and on iOS Safari an
 *    intervening await consumes it — so the share sheet never opened and the
 *    promise rejected with NotAllowedError. That is now treated as a signal to
 *    fall back rather than as a dead end.
 * 3. Feedback was delivered by overwriting the button's innerHTML with a hand-
 *    written SVG string. This returns a result instead, so callers can use the
 *    toast they already have.
 *
 * Sport-agnostic: the share image route renders whatever sport is passed, so NFL,
 * NHL, Soccer and Tennis all work through this same path.
 */

import { EnhancedPropCardData } from "@/lib/analytics/types"
import { STAT_LABELS } from "@/lib/props/constants"
import { playerSlug, propDetailHref } from "@/components/analysis/playerHref"

export type ShareOutcome =
  /** The native share sheet completed. */
  | "shared"
  /** The user dismissed the share sheet. Not an error — say nothing. */
  | "cancelled"
  /** Text + link were copied to the clipboard instead. */
  | "copied"
  /** Nothing worked. */
  | "failed"

/** Public origin for shared links. */
function shareOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL
  if (configured) return configured.replace(/\/$/, "")
  if (typeof window !== "undefined") return window.location.origin
  return "https://www.lasyly.me"
}

/** Over-hit-rate as a whole percentage, or null when there is no sample. */
export function overHitRatePct(prop: EnhancedPropCardData): number | null {
  const total = prop.hitRate?.total ?? 0
  if (!total) return null
  // Guard on `total` only. The previous expression required `over` to be truthy
  // too, so a genuine 0-for-10 prop reported as "0" via the falsy branch and was
  // indistinguishable from missing data.
  return Math.round(((prop.hitRate?.over ?? 0) / total) * 100)
}

/**
 * Shareable URL for a prop: the same detail page the card opens.
 *
 * This used to point at the public /players/[playerSlug] page, but that page
 * only knows players present in prop_line_history, so most shared links 404'd
 * (e.g. every 2026-27 NBA prop). The detail route works for every card and
 * shows exactly the shared stat. It is behind the auth guard; the proxy keeps
 * the full path + query in `?redirect=`, so a recipient who signs in or taps
 * "Continue as guest" lands on the prop.
 */
export function propShareUrl(prop: EnhancedPropCardData): string {
  return `${shareOrigin()}${propDetailHref(prop)}`
}

/** The 1080x1080 branded card for this prop. */
function propShareImageUrl(prop: EnhancedPropCardData): string {
  const params = new URLSearchParams({
    player: prop.player,
    stat: prop.statCategory,
    line: String(prop.propLine),
    hitRate: String(overHitRatePct(prop) ?? 0),
    direction: prop.direction ?? "over",
    trend: prop.trend ?? "neutral",
    confidence: String(prop.confidence?.stars ?? 3),
    team: prop.team ?? "",
    sport: prop.sport ?? "NBA",
    grade: prop.matchupGrade ?? "",
  })
  return `/api/props/share-image?${params.toString()}`
}

function propShareText(prop: EnhancedPropCardData): string {
  const direction = (prop.direction ?? "over").toUpperCase()
  const statLabel = STAT_LABELS[prop.statCategory] ?? prop.statCategory
  const pct = overHitRatePct(prop)
  const hitRatePart = pct === null ? "" : ` — ${pct}% hit rate 🔥`
  return `${prop.player} ${direction} ${prop.propLine} ${statLabel}${hitRatePart}\n\nFree prop analytics on Lasyly`
}

/** True when the rejection means the user closed the sheet themselves. */
function isUserCancellation(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}

/**
 * Try to build a shareable PNG of the card.
 *
 * Returns null whenever the image can't be used — a failed render, a browser
 * that won't share files, or no `canShare` support at all. Callers must treat a
 * null as "share the text only", never as a failure.
 */
async function buildShareImage(prop: EnhancedPropCardData): Promise<File | null> {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") {
    return null
  }
  try {
    const res = await fetch(propShareImageUrl(prop))
    if (!res.ok) return null
    const blob = await res.blob()
    const file = new File([blob], `${playerSlug(prop.player)}-prop.png`, {
      type: "image/png",
    })
    return navigator.canShare({ files: [file] }) ? file : null
  } catch {
    return null
  }
}

/**
 * Share a prop card, degrading gracefully: native share with image → native
 * share text-only → clipboard.
 *
 * Never throws; the outcome is returned so the caller can decide what to say.
 */
export async function shareProp(prop: EnhancedPropCardData): Promise<ShareOutcome> {
  const text = propShareText(prop)
  const url = propShareUrl(prop)

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    const file = await buildShareImage(prop)

    if (file) {
      try {
        await navigator.share({ text, url, files: [file] })
        return "shared"
      } catch (error) {
        if (isUserCancellation(error)) return "cancelled"
        // Otherwise fall through — commonly NotAllowedError because awaiting the
        // image above spent the user activation, or a target that rejects files.
      }
    }

    try {
      await navigator.share({ text, url })
      return "shared"
    } catch (error) {
      if (isUserCancellation(error)) return "cancelled"
      // Fall through to the clipboard.
    }
  }

  try {
    await navigator.clipboard.writeText(`${text}\n${url}`)
    return "copied"
  } catch {
    return "failed"
  }
}
