"use client"

import { useState, useCallback, useEffect } from "react"
import { X, Globe, Lock, Copy, RefreshCw, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Subchannel, PostPolicy, JoinPolicy, SubchannelVisibility } from "@/lib/types/channel"

type Mode =
  | { kind: "new-channel" }
  | { kind: "new-subchannel"; channelId: string }
  | { kind: "manage-subchannel"; sub: Subchannel }

type ChannelManagerProps = {
  roomId: string
  mode: Mode
  onClose: () => void
  onChanged: () => void
  /** Called with the limit type when the API returns 402 (show upgrade modal). */
  onLimitReached: (limit: "channels" | "subchannels") => void
}

const POST_POLICIES: { value: PostPolicy; label: string }[] = [
  { value: "everyone", label: "Everyone can post" },
  { value: "members", label: "Members can post" },
  { value: "admins", label: "Only admins can post" },
]

function Segmented<T extends string>({
  value, options, onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1 bg-[#0E0E0E] rounded-lg p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 py-1.5 px-2 rounded-md text-[12px] font-medium transition-all",
            value === o.value ? "bg-[#B8FF4F] text-black" : "text-white/50 hover:text-white/80"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function ChannelManager({ roomId, mode, onClose, onChanged, onLimitReached }: ChannelManagerProps) {
  const [name, setName] = useState(mode.kind === "manage-subchannel" ? mode.sub.name : "")
  const [visibility, setVisibility] = useState<SubchannelVisibility>(
    mode.kind === "manage-subchannel" ? mode.sub.visibility : "public"
  )
  const [postPolicy, setPostPolicy] = useState<PostPolicy>(
    mode.kind === "manage-subchannel" ? mode.sub.post_policy : "members"
  )
  const [joinPolicy, setJoinPolicy] = useState<JoinPolicy>(
    mode.kind === "manage-subchannel" ? mode.sub.join_policy : "open"
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const origin = typeof window !== "undefined" ? window.location.origin : ""

  const buildLink = useCallback(
    (slug: string, token: string | null) => (token ? `${origin}/g/${slug}?k=${token}` : `${origin}/g/${slug}`),
    [origin]
  )

  // For manage mode on a private channel, fetch the current invite link.
  useEffect(() => {
    if (mode.kind !== "manage-subchannel" || mode.sub.visibility !== "private") return
    fetch(`/api/rooms/${roomId}/subchannels/${mode.sub.id}/invite`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.slug) setInviteLink(buildLink(d.slug, d.token)) })
      .catch(() => {})
  }, [mode, roomId, buildLink])

  const copyLink = useCallback(() => {
    if (!inviteLink) return
    navigator.clipboard?.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [inviteLink])

  const handleLimit = useCallback((res: Response, body: { limit?: string }) => {
    if (res.status === 402) {
      onLimitReached((body.limit as "channels" | "subchannels") ?? "subchannels")
      onClose()
      return true
    }
    return false
  }, [onLimitReached, onClose])

  const submit = useCallback(async () => {
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      if (mode.kind === "new-channel") {
        const res = await fetch(`/api/rooms/${roomId}/channels`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        })
        const body = await res.json().catch(() => ({}))
        if (handleLimit(res, body)) return
        if (!res.ok) throw new Error(body.error || "Failed to create channel.")
        onChanged(); onClose()
      } else if (mode.kind === "new-subchannel") {
        const res = await fetch(`/api/rooms/${roomId}/channels/${mode.channelId}/subchannels`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, visibility, post_policy: postPolicy, join_policy: joinPolicy }),
        })
        const body = await res.json().catch(() => ({}))
        if (handleLimit(res, body)) return
        if (!res.ok) throw new Error(body.error || "Failed to create sub-channel.")
        if (body.slug) {
          setInviteLink(buildLink(body.slug, body.invite_token ?? null))
          onChanged()
          // Keep the modal open so the admin can copy the fresh link.
          return
        }
        onChanged(); onClose()
      } else {
        const res = await fetch(`/api/rooms/${roomId}/subchannels/${mode.sub.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, post_policy: postPolicy, join_policy: joinPolicy }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error || "Failed to update sub-channel.")
        onChanged(); onClose()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
    } finally {
      setBusy(false)
    }
  }, [busy, mode, roomId, name, visibility, postPolicy, joinPolicy, onChanged, onClose, buildLink, handleLimit])

  const rotate = useCallback(async () => {
    if (mode.kind !== "manage-subchannel") return
    const res = await fetch(`/api/rooms/${roomId}/subchannels/${mode.sub.id}/invite`, { method: "POST" })
    if (res.ok) {
      const d = await res.json()
      setInviteLink(buildLink(mode.sub.slug, d.token))
    }
  }, [mode, roomId, buildLink])

  const remove = useCallback(async () => {
    if (mode.kind !== "manage-subchannel") return
    const res = await fetch(`/api/rooms/${roomId}/subchannels/${mode.sub.id}`, { method: "DELETE" })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { setError(body.error || "Failed to delete."); return }
    onChanged(); onClose()
  }, [mode, roomId, onChanged, onClose])

  const title =
    mode.kind === "new-channel" ? "New channel"
      : mode.kind === "new-subchannel" ? "New sub-channel"
        : "Sub-channel settings"

  const showSubFields = mode.kind !== "new-channel"

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[400px] rounded-2xl bg-[#141414] border border-white/[0.08] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h3 className="text-[15px] font-semibold text-white/90">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 flex flex-col gap-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-white/30">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              autoFocus
              placeholder={mode.kind === "new-channel" ? "Tips & Analysis" : "hot-tips"}
              className="mt-1.5 w-full bg-[#0E0E0E] border border-white/[0.06] rounded-lg px-3 py-2.5 text-[14px] text-white/90 placeholder:text-white/20 focus:outline-none focus:border-[#B8FF4F]/30"
            />
          </div>

          {showSubFields && mode.kind === "new-subchannel" && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-white/30 mb-1.5 block">Visibility</label>
              <div className="flex gap-1 bg-[#0E0E0E] rounded-lg p-1">
                <button
                  onClick={() => setVisibility("public")}
                  className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[12px] font-medium transition-all",
                    visibility === "public" ? "bg-[#B8FF4F] text-black" : "text-white/50 hover:text-white/80")}
                >
                  <Globe className="w-3.5 h-3.5" /> Public
                </button>
                <button
                  onClick={() => setVisibility("private")}
                  className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[12px] font-medium transition-all",
                    visibility === "private" ? "bg-[#B8FF4F] text-black" : "text-white/50 hover:text-white/80")}
                >
                  <Lock className="w-3.5 h-3.5" /> Private
                </button>
              </div>
            </div>
          )}

          {showSubFields && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-white/30 mb-1.5 block">Who can post</label>
              <Segmented value={postPolicy} options={POST_POLICIES} onChange={setPostPolicy} />
            </div>
          )}

          {showSubFields && visibility === "private" && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-white/30 mb-1.5 block">Link joining</label>
              <Segmented
                value={joinPolicy}
                options={[{ value: "open", label: "Instant" }, { value: "request", label: "Approve first" }]}
                onChange={setJoinPolicy}
              />
            </div>
          )}

          {inviteLink && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-white/30 mb-1.5 block">
                {visibility === "private" ? "Private invite link" : "Share link"}
              </label>
              <div className="flex items-center gap-2 bg-[#0E0E0E] border border-white/[0.06] rounded-lg px-3 py-2">
                <span className="flex-1 truncate text-[12px] text-white/60 font-mono">{inviteLink}</span>
                <button onClick={copyLink} className="text-white/40 hover:text-[#B8FF4F] transition-colors" title="Copy">
                  <Copy className="w-3.5 h-3.5" />
                </button>
                {visibility === "private" && (
                  <button onClick={rotate} className="text-white/40 hover:text-[#FBBF24] transition-colors" title="Regenerate (revokes old link)">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {copied && <p className="text-[11px] text-[#B8FF4F] mt-1">Copied!</p>}
            </div>
          )}

          {error && <p className="text-[12px] text-[#F87171]">{error}</p>}

          <div className="flex items-center gap-2 pt-1">
            {mode.kind === "manage-subchannel" && !mode.sub.is_default && (
              <button
                onClick={remove}
                className="w-9 h-9 rounded-lg text-[#F87171]/70 hover:text-[#F87171] hover:bg-[#F87171]/10 flex items-center justify-center transition-colors"
                title="Delete sub-channel"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <div className="flex-1" />
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] text-white/50 hover:text-white/80 transition-colors">
              {inviteLink ? "Done" : "Cancel"}
            </button>
            {!(mode.kind === "new-subchannel" && inviteLink) && (
              <button
                onClick={submit}
                disabled={busy || name.trim().length === 0}
                className="px-4 py-2 rounded-lg bg-[#B8FF4F] text-black text-[13px] font-semibold disabled:opacity-40 transition-opacity"
              >
                {busy ? "..." : mode.kind === "manage-subchannel" ? "Save" : "Create"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
