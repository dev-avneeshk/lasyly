"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Radio, Trophy, X } from "lucide-react"
import { LiveMatch } from "@/types"

type RoomMatch = {
  id: string
  match_id: string
  home_team: string
  away_team: string
  league: string | null
  sport: string | null
}

type ScoresPanelProps = {
  roomId?: string
  isOwner?: boolean
}

export default function ScoresPanel({ roomId, isOwner = false }: ScoresPanelProps) {
  const [allMatches, setAllMatches] = useState<LiveMatch[]>([])
  const [roomMatches, setRoomMatches] = useState<RoomMatch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [activeSport, setActiveSport] = useState("All")

  const sports = [
    { label: "All", symbol: "◎" },
    { label: "Football", symbol: "⚽" },
    { label: "Basketball", symbol: "🏀" },
    { label: "Tennis", symbol: "🎾" },
    { label: "American Football", symbol: "🏈" },
    { label: "Hockey", symbol: "🏒" },
    { label: "Baseball", symbol: "⚾" },
    { label: "F1", symbol: "🏎️" },
    { label: "MMA", symbol: "🥊" },
    { label: "Golf", symbol: "⛳" },
    { label: "Cricket", symbol: "🏏" },
  ]

  // Fetch live scores
  const fetchScores = useCallback(async () => {
    try {
      const res = await fetch("/api/scores")
      const json = await res.json()
      if (json.success) {
        setAllMatches(json.data)
        setIsLoading(false)
      }
    } catch {
      setIsLoading(false)
    }
  }, [])

  // Fetch room's pinned matches
  const fetchRoomMatches = useCallback(async () => {
    if (!roomId) return
    try {
      const res = await fetch(`/api/rooms/${roomId}/matches`)
      const data = await res.json()
      if (res.ok) {
        setRoomMatches(data.matches ?? [])
      }
    } catch {
      // silently fail
    }
  }, [roomId])

  useEffect(() => {
    fetchScores()
    fetchRoomMatches()

    // Poll scores only when tab is visible
    let interval: ReturnType<typeof setInterval> | null = null

    const startPolling = () => {
      if (interval) return
      interval = setInterval(fetchScores, 10000)
    }

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval)
        interval = null
      }
    }

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling()
      } else {
        fetchScores() // Refresh immediately when tab becomes visible
        startPolling()
      }
    }

    startPolling()
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      stopPolling()
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [fetchScores, fetchRoomMatches])

  // Filter matches: if room has pinned matches, show only those with live data
  const pinnedMatchIds = new Set(roomMatches.map((rm) => rm.match_id))
  const hasRoomMatches = roomMatches.length > 0

  let displayMatches: LiveMatch[]
  if (hasRoomMatches) {
    // Show pinned matches with live score data merged in
    displayMatches = roomMatches.map((rm) => {
      const live = allMatches.find((m) => m.id === rm.match_id)
      if (live) return live
      // If no live data yet, show as "Not Started"
      return {
        id: rm.match_id,
        homeTeam: rm.home_team,
        awayTeam: rm.away_team,
        homeScore: 0,
        awayScore: 0,
        status: "Not Started" as const,
        league: rm.league ?? "",
        sport: rm.sport ?? "Football",
      }
    })
  } else {
    displayMatches = allMatches
  }

  // Apply sport filter
  const filteredMatches = activeSport === "All"
    ? displayMatches
    : displayMatches.filter((m) => m.sport === activeSport)

  // Available matches for the picker (not already pinned)
  const availableForPicker = allMatches.filter((m) => !pinnedMatchIds.has(m.id))

  const handleAddMatch = async (match: LiveMatch) => {
    if (!roomId) return
    await fetch(`/api/rooms/${roomId}/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        match_id: match.id,
        home_team: match.homeTeam,
        away_team: match.awayTeam,
        league: match.league,
        sport: match.sport,
      }),
    })
    fetchRoomMatches()
    setShowPicker(false)
  }

  const handleRemoveMatch = async (matchId: string) => {
    if (!roomId) return
    await fetch(`/api/rooms/${roomId}/matches?match_id=${matchId}`, { method: "DELETE" })
    fetchRoomMatches()
  }

  function isLive(match: LiveMatch) {
    return match.status !== "Finished" && match.status !== "Not Started"
  }

  function getMatchTime(match: LiveMatch) {
    if (match.clock) return match.clock
    if (match.status === "Not Started") return "Upcoming"
    return match.status
  }

  return (
    <div className="flex min-h-full min-w-0 flex-col overflow-hidden rounded-[1.35rem] border border-[#7957ff]/35 bg-[#110035] text-white shadow-[0_18px_50px_rgba(41,14,116,0.35)]">
      {/* Header */}
      <div className="shrink-0 bg-[linear-gradient(180deg,#190547_0%,#120033_100%)] px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-2xl font-black text-white">
                {hasRoomMatches ? "Room Matches" : "Live Scores"}
              </h2>
              {filteredMatches.some(isLive) && (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-black text-[#140339]">
                  <span className="h-2 w-2 rounded-full bg-[#25d65f]" />
                  Live
                </span>
              )}
            </div>
            <p className="mt-1 text-xs font-medium text-white/45">
              {hasRoomMatches ? `${roomMatches.length} match${roomMatches.length !== 1 ? "es" : ""} pinned` : "Live odds and scores"}
            </p>
          </div>
          {isOwner && (
            <button
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[#7957ff] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#6a4de6] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add Match
            </button>
          )}
        </div>

        {/* Sport filter tabs */}
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
          {sports.map((sport) => {
            const isActive = activeSport === sport.label
            return (
              <button
                key={sport.label}
                type="button"
                onClick={() => setActiveSport(sport.label)}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-all ${
                  isActive
                    ? "border-transparent bg-[linear-gradient(135deg,#16d89b,#2ca8ff_55%,#7a5cff)] text-white shadow-[0_0_22px_rgba(44,168,255,0.42)]"
                    : "border-white/10 bg-white/10 text-white/65 hover:bg-white/15 hover:text-white"
                }`}
              >
                <span className="text-xl leading-none">{sport.symbol}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Match List */}
      <div className="space-y-3 bg-[#0c0028] p-4 flex-1 overflow-y-auto">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/10" />
          ))
        ) : filteredMatches.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-6 text-center text-sm text-white/55">
            {hasRoomMatches ? "No matches for this sport filter." : "No live matches available."}
            {isOwner && !hasRoomMatches && (
              <p className="mt-2 text-xs">Click &quot;Add Match&quot; to pin matches to this room.</p>
            )}
          </div>
        ) : (
          filteredMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              isOwner={isOwner}
              isPinned={pinnedMatchIds.has(match.id)}
              onRemove={() => handleRemoveMatch(match.id)}
            />
          ))
        )}
      </div>

      {/* Match Picker Modal */}
      {showPicker && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1c0758] rounded-2xl border border-[#7957ff]/50 w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-bold text-white">Select a Match</h3>
              <button onClick={() => setShowPicker(false)} className="text-white/60 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {availableForPicker.length === 0 ? (
                <p className="text-sm text-white/50 text-center py-6">No available matches to add.</p>
              ) : (
                availableForPicker.map((match) => (
                  <button
                    key={match.id}
                    onClick={() => handleAddMatch(match)}
                    className="w-full p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-white">{match.homeTeam} vs {match.awayTeam}</div>
                        <div className="text-xs text-white/50 mt-0.5">{match.league} · {match.sport}</div>
                      </div>
                      <div className="text-right">
                        {isLive(match) ? (
                          <span className="text-xs font-bold text-[#25d65f]">{match.homeScore} - {match.awayScore}</span>
                        ) : (
                          <span className="text-xs text-white/40">{getMatchTime(match)}</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MatchCard({ match, isOwner, isPinned, onRemove }: { match: LiveMatch; isOwner: boolean; isPinned: boolean; onRemove: () => void }) {
  const live = match.status !== "Finished" && match.status !== "Not Started"
  const clock = match.clock ?? (match.status === "Not Started" ? "Upcoming" : match.status)

  return (
    <article className="min-w-0 rounded-[1.15rem] bg-[#1b0753] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] relative group">
      {isOwner && isPinned && (
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/40"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-full bg-[linear-gradient(135deg,#16d89b,#2ca8ff_70%,#7a5cff)] px-2.5 py-0.5 text-xs font-black text-white">
            {match.sport}
          </span>
          <span className="min-w-0 truncate text-xs text-white/60">{match.league}</span>
        </div>
        {live ? (
          <Radio className="h-4 w-4 shrink-0 text-[#25d65f] animate-pulse" />
        ) : (
          <Trophy className="h-4 w-4 shrink-0 text-white/40" />
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 space-y-2 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white truncate">{match.homeTeam}</span>
            <span className={`text-sm font-black ${match.homeScore > match.awayScore ? "text-white" : "text-white/55"}`}>
              {match.homeScore}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white truncate">{match.awayTeam}</span>
            <span className={`text-sm font-black ${match.awayScore > match.homeScore ? "text-white" : "text-white/55"}`}>
              {match.awayScore}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span className={`text-[10px] font-black ${live ? "text-[#25d65f]" : "text-white/40"}`}>
            {clock}
          </span>
        </div>
      </div>
    </article>
  )
}
