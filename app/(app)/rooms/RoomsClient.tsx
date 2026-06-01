"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Plus, Users, Lock, Zap, Search, Loader2, X, Hash } from "lucide-react"
import { cn } from "@/lib/utils"

type Room = {
  id: string
  name: string
  description: string | null
  type: string
  sport_tag: string | null
  member_count: number
  is_live: boolean
  created_at: string
}

const SPORT_EMOJI: Record<string, string> = {
  Football: "⚽",
  Basketball: "🏀",
  Tennis: "🎾",
  Mixed: "🔥",
  Other: "🎯",
}

type Props = {
  isAuthenticated: boolean
}

export default function RoomsClient({ isAuthenticated }: Props) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [joinedRooms, setJoinedRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const fetchRooms = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.length >= 2) params.set("search", search)

      const res = await fetch(`/api/rooms/explore?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setRooms(data.rooms ?? [])
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [search])

  const fetchJoinedRooms = useCallback(async () => {
    try {
      const res = await fetch("/api/rooms/joined")
      if (res.ok) {
        const data = await res.json()
        setJoinedRooms(data.rooms ?? [])
      }
    } catch {
      // silently fail
    }
  }, [])

  useEffect(() => {
    fetchRooms()
    fetchJoinedRooms()
  }, [fetchRooms, fetchJoinedRooms])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRooms()
    }, 300)
    return () => clearTimeout(timer)
  }, [search, fetchRooms])

  const allRooms = [...joinedRooms, ...rooms.filter(r => !joinedRooms.some(jr => jr.id === r.id))]
  const joinedIds = new Set(joinedRooms.map(r => r.id))

  const displayRooms = search
    ? allRooms
    : allRooms

  return (
    <div className="h-[calc(100dvh-64px)] flex flex-col bg-[#0A0A0A]">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚡</span>
            <h1 className="text-xl font-semibold text-white/90" style={{ letterSpacing: "-0.02em" }}>Discover Rooms</h1>
          </div>
          {isAuthenticated && (
            <Link
              href="/rooms/create"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#B8FF4F] text-black text-[13px] font-semibold hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              Create Room
            </Link>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rooms"
            className="w-full h-10 pl-10 pr-10 rounded-xl bg-[#1A1A1A] text-[14px] text-white/90 placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-[rgba(184,255,79,0.2)] border border-white/[0.06] transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <X className="w-3 h-3 text-white/50" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* My Rooms */}
        {joinedRooms.length > 0 && !search && (
          <div className="px-6 pt-5 pb-2">
            <h2 className="text-[11px] font-bold uppercase tracking-wide text-white/25 mb-3">
              Your Rooms — {joinedRooms.length}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {joinedRooms.map((room) => (
                <RoomCard key={room.id} room={room} isJoined={true} />
              ))}
            </div>
          </div>
        )}

        {/* Explore */}
        <div className="px-6 pt-5 pb-6">
          {joinedRooms.length > 0 && !search && (
            <h2 className="text-[11px] font-bold uppercase tracking-wide text-white/25 mb-3">
              Explore Public Rooms
            </h2>
          )}

          {loading && (
            <div className="flex justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-[#B8FF4F]" />
            </div>
          )}

          {!loading && displayRooms.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#1A1A1A] border border-white/[0.06] flex items-center justify-center mb-4">
                <Hash className="w-7 h-7 text-white/25" />
              </div>
              <h3 className="text-[15px] font-semibold text-white/80 mb-1">No rooms found</h3>
              <p className="text-[13px] text-white/30">
                {search ? "Try a different search." : "Create a room to get started."}
              </p>
            </div>
          )}

          {!loading && displayRooms.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayRooms
                .filter(r => search || !joinedIds.has(r.id))
                .map((room) => (
                  <RoomCard key={room.id} room={room} isJoined={joinedIds.has(room.id)} />
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function RoomCard({ room, isJoined }: { room: Room; isJoined: boolean }) {
  const emoji = SPORT_EMOJI[room.sport_tag ?? "Other"] ?? "🎯"

  return (
    <Link
      href={`/rooms/${room.id}`}
      className="group block rounded-2xl bg-[#111111] hover:bg-[#1A1A1A] transition-all overflow-hidden border border-white/[0.06] hover:border-white/[0.1]"
    >
      {/* Banner area */}
      <div className="h-[120px] bg-gradient-to-br from-[#B8FF4F]/10 to-[#B8FF4F]/5 relative flex items-center justify-center">
        <span className="text-4xl">{emoji}</span>
        {room.is_live && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded bg-[#F87171] text-[10px] font-bold text-white">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </div>
        )}
        {room.type === "Tipster" && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded bg-[#FBBF24] text-[10px] font-bold text-black">
            <Zap className="w-3 h-3" />
            TIPSTER
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <h3 className="text-[14px] font-semibold text-white/90 truncate">{room.name}</h3>
          {room.type === "Private" && <Lock className="w-3 h-3 text-white/25 shrink-0" />}
        </div>
        <p className="text-[12px] text-white/40 line-clamp-2 leading-relaxed mb-3">
          {room.description || `A ${room.sport_tag ?? "general"} betting room`}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-[11px] text-white/30">
            <Users className="w-3.5 h-3.5" />
            <span>{room.member_count} member{room.member_count !== 1 ? "s" : ""}</span>
          </div>
          {isJoined && (
            <span className="text-[10px] font-bold text-[#34D399] bg-[#34D399]/10 px-2 py-0.5 rounded">
              JOINED
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
