"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { ArrowUpRight, Flame, Info, Plus, TrendingUp, Users, LogIn, LogOut } from "lucide-react"
import ChatPanel from "@/components/room/ChatPanel"
import ScoresPanel from "@/components/room/ScoresPanel"
import BetslipCard from "@/components/room/BetslipCard"
import { createClient } from "@/lib/supabase/client"

import { Betslip } from "@/types"

type RoomData = {
  id: string
  name: string
  description: string | null
  type: string
  sport_tag: string | null
  banner_url: string | null
  creator_id: string
  is_live: boolean
  member_count: number
  created_at: string
}

const TREND_CARDS = [
  { label: "Room Heat", value: "+24%", detail: "mentions last hour", icon: Flame, color: "text-[var(--color-danger)]" },
  { label: "Top Market", value: "O2.5", detail: "trending pick", icon: TrendingUp, color: "text-[var(--color-secondary)]" },
  { label: "Sharp Move", value: "1.85", detail: "odds drifting", icon: ArrowUpRight, color: "text-[var(--color-warning)]" },
]

const SPORT_EMOJI: Record<string, string> = {
  Football: "⚽",
  Basketball: "🏀",
  Tennis: "🎾",
  Mixed: "🔥",
  Other: "🎯",
}

export default function RoomDashboard() {
  const params = useParams<{ roomId: string }>()
  const roomId = params.roomId
  const topRef = useRef<HTMLDivElement>(null)
  const supabase = useMemo(() => createClient(), [])

  const [room, setRoom] = useState<RoomData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMember, setIsMember] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [memberCount, setMemberCount] = useState(0)
  const [joining, setJoining] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [betslips, setBetslips] = useState<Betslip[]>([])

  useEffect(() => {
    const resetScroll = () => {
      const scroller = topRef.current?.closest("main")
      scroller?.scrollTo({ top: 0, left: 0, behavior: "auto" })
      window.scrollTo({ top: 0, left: 0, behavior: "auto" })
    }

    resetScroll()
    const frame = requestAnimationFrame(resetScroll)
    const shortTimer = window.setTimeout(resetScroll, 100)
    const restoreTimer = window.setTimeout(resetScroll, 350)

    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(shortTimer)
      window.clearTimeout(restoreTimer)
    }
  }, [roomId])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)

      // Fetch room detail from API
      const res = await fetch(`/api/rooms/${roomId}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to load room.")
        setLoading(false)
        return
      }

      setRoom(data)
      setMemberCount(data.member_count ?? 0)
      setIsMember(data.is_member ?? false)

      // Get actual user id for join/leave and owner check
      const supabaseUser = await supabase.auth.getUser()
      const currentUserId = supabaseUser.data.user?.id ?? null
      setUserId(currentUserId)
      setIsOwner(currentUserId === data.creator_id)

      // Fetch room betslips
      const { data: slips } = await supabase
        .from("betslips")
        .select(`
          *,
          profiles:user_id (id, username, display_name, avatar_url, is_verified)
        `)
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(10)

      if (slips) {
        setBetslips(slips.map((s) => {
          const profile = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles
          return {
            id: s.id,
            roomId: s.room_id,
            userId: s.user_id,
            user: {
              id: profile?.id ?? s.user_id,
              username: profile?.username ?? "user",
              displayName: profile?.display_name ?? "User",
              avatarUrl: profile?.avatar_url ?? `https://ui-avatars.com/api/?name=User&background=6C63FF&color=fff`,
              isVerified: profile?.is_verified ?? false,
              createdAt: s.created_at,
            },
            sportsbook: s.sportsbook,
            betType: s.bet_type,
            odds: s.odds,
            stake: s.stake,
            payout: s.payout,
            matches: s.matches ?? [],
            description: s.description,
            status: s.status,
            isForSale: s.is_for_sale,
            price: s.price,
            commentCount: s.comment_count ?? 0,
            createdAt: s.created_at,
          }
        }))
      }

      setLoading(false)
    }

    load()
  }, [supabase, roomId])

  const handleJoinLeave = async () => {
    if (!userId) return
    setJoining(true)

    try {
      const res = await fetch(`/api/rooms/${roomId}/join`, { method: "POST" })
      const data = await res.json()

      if (res.ok) {
        setIsMember(data.joined)
        setMemberCount(data.memberCount)
      }
    } catch {
      // silently fail
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="w-full max-w-[1600px] mx-auto px-4 pt-24 md:px-6 lg:px-8">
        <div className="animate-pulse space-y-4">
          <div className="h-40 rounded-lg bg-white/5" />
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="h-96 rounded-lg bg-white/5" />
            <div className="h-96 rounded-lg bg-white/5" />
            <div className="h-96 rounded-lg bg-white/5" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !room) {
    return (
      <div className="w-full max-w-[1600px] mx-auto px-4 pt-24 md:px-6 lg:px-8">
        <div className="rounded-lg border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 p-6 text-center">
          <p className="text-[var(--color-danger)] font-medium">{error || "Room not found."}</p>
        </div>
      </div>
    )
  }

  const sportEmoji = SPORT_EMOJI[room.sport_tag ?? "Other"] ?? "🎯"

  return (
    <div ref={topRef} className="w-full max-w-[1600px] mx-auto space-y-4 overflow-x-hidden px-4 pb-40 pt-24 md:px-6 md:pb-6 md:pt-24 lg:px-8 lg:pt-24">
      {/* Room Header */}
      <header className="scroll-mt-28 grid min-w-0 gap-4 rounded-lg border border-white/5 bg-[var(--color-surface)]/60 p-4 backdrop-blur-md xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-[var(--color-lime)]/20 to-[var(--color-lime)]/10 border border-[var(--color-lime)]/30 flex items-center justify-center shrink-0">
            <span className="text-xl">{sportEmoji}</span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="min-w-0 text-xl md:text-2xl font-bold text-white tracking-tight break-words">{room.name}</h1>
              {room.is_live && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--color-danger)]/10">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-danger)] animate-pulse" />
                  <span className="text-[10px] font-bold text-[var(--color-danger)] uppercase tracking-wider">Live</span>
                </div>
              )}
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/5 text-[var(--color-text-muted)] uppercase">{room.type}</span>
            </div>
            {room.description && (
              <p className="mb-3 max-w-4xl text-sm leading-6 text-[var(--color-text-muted)]">{room.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 text-xs sm:gap-3 sm:text-sm text-[var(--color-text-muted)]">
              {room.sport_tag && (
                <div className="px-2 py-0.5 rounded-md bg-white/5 font-medium text-white/70">
                  {room.sport_tag}
                </div>
              )}
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>{memberCount.toLocaleString()} members</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid min-w-0 gap-3 sm:grid-cols-[1fr_1fr_1fr] xl:w-[36rem] xl:items-center">
          <button className="min-h-10 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white font-medium transition-colors text-sm flex items-center justify-center gap-2">
            <Info className="w-4 h-4" />
            Room Info
          </button>
          {userId && (
            <button
              onClick={handleJoinLeave}
              disabled={joining}
              className={`min-h-10 px-4 py-2 rounded-lg font-bold transition-all text-sm flex items-center justify-center gap-2 ${
                isMember
                  ? "bg-white/5 hover:bg-[var(--color-danger)]/20 text-white hover:text-[var(--color-danger)] border border-white/10"
                  : "bg-[var(--color-secondary)] hover:bg-[var(--color-secondary)]/90 text-white shadow-[0_0_15px_rgba(0,212,170,0.3)]"
              }`}
            >
              {joining ? "..." : isMember ? <><LogOut className="w-4 h-4" /> Leave</> : <><LogIn className="w-4 h-4" /> Join</>}
            </button>
          )}
          <button className="min-h-10 px-4 py-2 rounded-lg bg-[var(--color-lime)] hover:bg-[var(--color-lime)]/90 text-black font-bold transition-all shadow-[0_0_15px_rgba(212,255,0,0.4)] text-sm flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" />
            Share Pick
          </button>
        </div>
      </header>

      {/* Main Split Content */}
      <div className="grid min-w-0 gap-4 md:gap-6 xl:grid-cols-[minmax(420px,480px)_minmax(0,1fr)_360px]">
        <section className="min-w-0 space-y-4">
          <div className="min-h-[620px]">
            <ScoresPanel roomId={roomId} isOwner={isOwner} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1">
            {TREND_CARDS.map((trend) => (
              <div key={trend.label} className="min-w-0 rounded-lg border border-white/5 bg-[var(--color-surface)]/45 px-4 py-3 backdrop-blur-md">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{trend.label}</span>
                  <trend.icon className={`h-4 w-4 shrink-0 ${trend.color}`} />
                </div>
                <div className="mt-2 flex items-end justify-between gap-3 min-w-0">
                  <span className="text-2xl font-black tracking-tight text-white">{trend.value}</span>
                  <span className="min-w-0 text-right text-xs text-[var(--color-text-muted)] break-words">{trend.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="min-w-0 h-[520px] sm:h-[600px] xl:h-[calc(100vh-22rem)] xl:min-h-[520px]">
          <ChatPanel roomId={roomId} />
        </section>

        <section className="min-w-0 rounded-lg border border-white/5 bg-[var(--color-surface)]/40 backdrop-blur-md overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 bg-[var(--color-surface)]/80 flex justify-between items-center">
            <h2 className="font-bold text-white">Room Picks</h2>
            <span className="rounded-md bg-white/5 px-2 py-1 text-xs text-[var(--color-text-muted)]">{betslips.length} active</span>
          </div>
          <div className="space-y-4 p-4 xl:max-h-[calc(100vh-25.5rem)] xl:overflow-y-auto">
            {betslips.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-[var(--color-text-muted)]">No picks shared yet.</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">Be the first to share a betslip in this room.</p>
              </div>
            ) : (
              betslips.map((slip) => <BetslipCard key={slip.id} betslip={slip} />)
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
