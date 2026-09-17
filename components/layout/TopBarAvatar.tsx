"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { User } from "lucide-react"

type Me = {
  display_name: string | null
  username: string | null
  avatar_url: string | null
}

function initialsOf(me: Me): string {
  const source = me.display_name || me.username || ""
  const parts = source.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Top-bar profile avatar. Reads the signed-in profile once and links to the
 * profile page. Falls back to initials, then to a generic icon, so guests still
 * get a tappable target that leads to sign-in.
 */
export default function TopBarAvatar() {
  const [me, setMe] = useState<Me | null>(null)
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch("/api/profiles/me", { cache: "no-store" })
        if (!active || !res.ok) return
        const profile = (await res.json()) as Partial<Me>
        setMe({
          display_name: profile.display_name ?? null,
          username: profile.username ?? null,
          avatar_url: profile.avatar_url ?? null,
        })
      } catch {
        // Guests and network failures both fall through to the icon state.
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const initials = me ? initialsOf(me) : ""
  const showImage = !!me?.avatar_url && !imageFailed

  return (
    <Link
      href="/profile"
      aria-label={me?.display_name ? `Profile: ${me.display_name}` : "Profile"}
      title={me?.display_name ?? me?.username ?? "Profile"}
      className="shrink-0 w-9 h-9 rounded-full overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-elevated)] flex items-center justify-center hover:border-[var(--color-lime)]/50 transition-colors"
    >
      {showImage ? (
        // Avatars come from arbitrary provider CDNs, so a plain img avoids
        // maintaining a remotePatterns allowlist for every OAuth host.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={me!.avatar_url!}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : initials ? (
        <span className="text-[11px] font-bold text-[var(--color-lime)]">{initials}</span>
      ) : (
        <User className="w-4 h-4 text-[var(--color-text-muted)]" />
      )}
    </Link>
  )
}
