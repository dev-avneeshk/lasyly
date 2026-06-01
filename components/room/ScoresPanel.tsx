"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, X, Trophy } from "lucide-react"
import { LiveMatch } from "@/types"
import { cn } from "@/lib/utils"

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

const SPORTS = [
  { label: "All", emoji: "◎" },
  { label: "Football", emoji: "⚽" },
  { label: "Basketball", emoji: "🏀" },
  { label: "Tennis", emoji: "🎾" },
  { label: "American Football", emoji: "🏈" },
  { label: "Hockey", emoji: "🏒" },
]

export default function ScoresPanel({ roomId, isOwner = false }: ScoresPanelProps) {
  const [allMatches, setAllMatches] = useState<LiveMatch[]>([])
  const [roomMatches, setRoomMatches] = useState<RoomMatch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [activeSport, setActiveSport] = useState("All")

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
        fetchScores()
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

  const pinnedMatchIds = new Set(roomMatches.map((rm) => rm.match_id))
  const hasRoomMatches = roomMatches.length > 0

  let displayMatches: LiveMatch[]
  if (hasRoomMatches) {
    displayMatches = roomMatches.map((rm) => {
      const live = allMatches.find((m) => m.id === rm.match_id)
      if (live) return live
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

  const filteredMatches = activeSport === "All"
    ? displayMatches
    : displayMatches.filter((m) => m.sport === activeSport)

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
    if (match.status === "Not Started") {
      return match.startTime
        ? new Date(match.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
        : "Upcoming"
    }
    if (match.clock) return match.clock
    return match.status
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[14px] font-bold text-[#f2f3f5]">
          {hasRoomMatches ? "📌 Pinned Matches" : "🏆 Live Scoreboard"}
        </h2>
        {isOwner && (
          <button
            onClick={() => setShowPicker(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#5865f2] text-[11px] font-medium text-white hover:bg-[#4752c4] transition-colors"
          >
            <Plus className="h-3 w-3" />
            Pin Match
          </button>
        )}
      </div>

      {/* Sport filter */}
      <div className="flex gap-1 flex-wrap mb-4">
        {SPORTS.map((sport) => (
          <button
            key={sport.label}
            type="button"
            onClick={() => setActiveSport(sport.label)}
            className={cn(
              "px-2.5 py-1 rounded text-[11px] font-medium transition-colors",
              activeSport === sport.label
                ? "bg-[#5865f2] text-white"
                : "bg-[#2b2d31] text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#35373c]"
            )}
          >
            {sport.emoji} {sport.label !== "All" ? sport.label : ""}
          </button>
        ))}
      </div>

      {/* Match List */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="w-5 h-5 border-2 border-[#5865f2]/30 border-t-[#5865f2] rounded-full animate-spin mx-auto" />
            <p className="text-[12px] text-[#949ba4] mt-2">Loading scores...</p>
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="text-center py-8">
            <Trophy className="w-8 h-8 text-[#949ba4] mx-auto mb-2 opacity-50" />
            <p className="text-[13px] text-[#949ba4]">
              {hasRoomMatches ? "No matches for this filter." : "No live matches right now."}
            </p>
            <p className="text-[11px] text-[#949ba4]/60 mt-1">Check back during game time.</p>
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
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#313338] rounded-lg border border-[#1e1f22] w-full max-w-md max-h-[70vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="px-4 py-3 border-b border-[#1e1f22] flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-[#f2f3f5]">Pin a Match</h3>
              <button
                onClick={() => setShowPicker(false)}
                className="w-7 h-7 rounded flex items-center justify-center hover:bg-[#35373c] transition-colors"
              >
                <X className="w-4 h-4 text-[#b5bac1]" />
              </button>
            </div>
            <div className="p-3 overflow-y-auto flex-1 space-y-1.5">
              {availableForPicker.length === 0 ? (
                <p className="text-[13px] text-[#949ba4] text-center py-8">No available matches to pin.</p>
              ) : (
                availableForPicker.map((match) => (
                  <button
                    key={match.id}
                    onClick={() => handleAddMatch(match)}
                    className="w-full p-3 rounded bg-[#2b2d31] hover:bg-[#35373c] transition-colors text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[13px] font-medium text-[#f2f3f5]">
                          {match.homeTeam} vs {match.awayTeam}
                        </div>
                        <div className="text-[11px] text-[#949ba4] mt-0.5">
                          {match.league} · {match.sport}
                        </div>
                      </div>
                      {isLive(match) ? (
                        <span className="text-[12px] font-bold text-[#57f287]">
                          {match.homeScore} - {match.awayScore}
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#949ba4]">{getMatchTime(match)}</span>
                      )}
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

function MatchCard({
  match,
  isOwner,
  isPinned,
  onRemove,
}: {
  match: LiveMatch
  isOwner: boolean
  isPinned: boolean
  onRemove: () => void
}) {
  const live = match.status !== "Finished" && match.status !== "Not Started"
  const clock = match.status === "Not Started"
    ? (match.startTime ? new Date(match.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Upcoming")
    : (match.clock ?? match.status)

  return (
    <div className="rounded-lg bg-[#2b2d31] p-3 relative group hover:bg-[#35373c] transition-colors">
      {isOwner && isPinned && (
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 w-5 h-5 rounded bg-[#ed4245]/20 text-[#ed4245] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#ed4245]/30"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      {/* League + Status */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium text-[#949ba4] truncate">
          {match.league}
        </span>
        {live ? (
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ed4245] animate-pulse" />
            <span className="text-[10px] font-bold text-[#ed4245]">{clock}</span>
          </div>
        ) : (
          <span className="text-[10px] text-[#949ba4]">{clock}</span>
        )}
      </div>

      {/* Teams */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className={cn(
            "text-[13px] font-medium truncate pr-2",
            match.homeScore > match.awayScore ? "text-[#f2f3f5]" : "text-[#949ba4]"
          )}>
            {match.homeTeam}
          </span>
          <span className={cn(
            "text-[14px] font-bold tabular-nums",
            match.homeScore > match.awayScore ? "text-[#f2f3f5]" : "text-[#949ba4]"
          )}>
            {match.homeScore}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className={cn(
            "text-[13px] font-medium truncate pr-2",
            match.awayScore > match.homeScore ? "text-[#f2f3f5]" : "text-[#949ba4]"
          )}>
            {match.awayTeam}
          </span>
          <span className={cn(
            "text-[14px] font-bold tabular-nums",
            match.awayScore > match.homeScore ? "text-[#f2f3f5]" : "text-[#949ba4]"
          )}>
            {match.awayScore}
          </span>
        </div>
      </div>
    </div>
  )
}
