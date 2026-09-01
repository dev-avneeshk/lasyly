"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Hash, Lock, Clock, Check } from "lucide-react"

/**
 * Public/private channel join landing page: /g/<slug>?k=<token>
 *
 * Resolves the invite via the `channels/join` API. For public links no token
 * is needed; private links must carry a valid `k` token. On success the user
 * is routed into the room, or shown a "pending approval" state for
 * request-mode private channels.
 */
export default function ChannelJoinPage() {
  const params = useParams<{ slug: string }>()
  const search = useSearchParams()
  const router = useRouter()
  const slug = params.slug
  const token = search.get("k")

  const [state, setState] = useState<"idle" | "joining" | "requested" | "error">("idle")
  const [error, setError] = useState<string | null>(null)

  const join = useCallback(async () => {
    setState("joining")
    setError(null)
    try {
      const res = await fetch("/api/channels/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, token: token ?? undefined }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.status === 401) {
        // Not signed in — send to login, then back here.
        router.push(`/login?redirect=/g/${slug}${token ? `?k=${token}` : ""}`)
        return
      }
      if (!res.ok) {
        setState("error")
        setError(body.error || "This link is invalid or has expired.")
        return
      }
      if (body.requested) {
        setState("requested")
        return
      }
      if (body.roomId) {
        router.push(`/rooms/${body.roomId}`)
      }
    } catch {
      setState("error")
      setError("Something went wrong. Please try again.")
    }
  }, [slug, token, router])

  // Auto-attempt on load for a smooth one-tap join.
  useEffect(() => { join() }, [join])

  return (
    <div className="min-h-[calc(100dvh-64px)] bg-[#0A0A0A] flex items-center justify-center p-4">
      <div className="w-full max-w-[380px] rounded-2xl bg-[#141414] border border-white/[0.08] p-7 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#B8FF4F]/15 flex items-center justify-center mx-auto mb-4">
          {token ? <Lock className="w-6 h-6 text-[#B8FF4F]" /> : <Hash className="w-6 h-6 text-[#B8FF4F]" />}
        </div>

        {state === "joining" && (
          <>
            <h1 className="text-[17px] font-semibold text-white/90">Joining channel…</h1>
            <div className="mt-4 w-5 h-5 border-2 border-[#B8FF4F]/30 border-t-[#B8FF4F] rounded-full animate-spin mx-auto" />
          </>
        )}

        {state === "requested" && (
          <>
            <div className="w-8 h-8 rounded-full bg-[#FBBF24]/15 flex items-center justify-center mx-auto mb-2">
              <Clock className="w-4 h-4 text-[#FBBF24]" />
            </div>
            <h1 className="text-[17px] font-semibold text-white/90">Request sent</h1>
            <p className="text-[13px] text-white/40 mt-1.5">
              An admin needs to approve you. You&apos;ll get access once they do.
            </p>
            <button onClick={() => router.push("/rooms")} className="mt-5 px-4 py-2 rounded-lg bg-white/[0.06] text-white/70 text-[13px] font-medium hover:bg-white/[0.1] transition-colors">
              Back to rooms
            </button>
          </>
        )}

        {state === "error" && (
          <>
            <h1 className="text-[17px] font-semibold text-white/90">Can&apos;t join</h1>
            <p className="text-[13px] text-[#F87171] mt-1.5">{error}</p>
            <button onClick={() => router.push("/rooms")} className="mt-5 px-4 py-2 rounded-lg bg-white/[0.06] text-white/70 text-[13px] font-medium hover:bg-white/[0.1] transition-colors">
              Browse rooms
            </button>
          </>
        )}

        {state === "idle" && (
          <button onClick={join} className="mt-2 px-5 py-2.5 rounded-xl bg-[#B8FF4F] text-black text-[13px] font-semibold inline-flex items-center gap-2">
            <Check className="w-4 h-4" /> Join channel
          </button>
        )}
      </div>
    </div>
  )
}
