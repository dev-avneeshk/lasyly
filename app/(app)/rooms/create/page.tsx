"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Lock, Globe, Zap, Check, Hash } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

const ROOM_TYPES = [
  { value: "Public" as const, label: "Public", description: "Anyone can find and join this room", icon: Globe },
  { value: "Private" as const, label: "Private", description: "Only people with an invite can join", icon: Lock },
  { value: "Tipster" as const, label: "Tipster", description: "Premium room for selling picks", icon: Zap },
]

const SPORT_OPTIONS = [
  { value: "Football", emoji: "⚽" },
  { value: "Basketball", emoji: "🏀" },
  { value: "Tennis", emoji: "🎾" },
  { value: "Mixed", emoji: "🔥" },
  { value: "Other", emoji: "🎯" },
]

export default function CreateRoomPage() {
  const router = useRouter()
  const [type, setType] = useState<"Public" | "Private" | "Tipster">("Public")
  const [sportTag, setSportTag] = useState("Football")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const description = formData.get("description") as string

    try {
      const res = await fetch("/api/rooms/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, sport_tag: sportTag, type }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Something went wrong.")
        setIsLoading(false)
        return
      }

      router.push(`/rooms/${data.id}`)
    } catch {
      setError("Failed to create room. Please try again.")
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100dvh-64px)] bg-[#313338] flex items-start justify-center py-8 px-4">
      <div className="w-full max-w-md">
        {/* Back */}
        <Link
          href="/rooms"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#949ba4] hover:text-[#dbdee1] mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Rooms
        </Link>

        {/* Card */}
        <div className="bg-[#2b2d31] rounded-lg p-6">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-full bg-[#5865f2] flex items-center justify-center mx-auto mb-3">
              <Hash className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-bold text-[#f2f3f5]">Create Your Room</h1>
            <p className="text-[13px] text-[#949ba4] mt-1">
              Your room is where you and your friends hang out. Make yours and start chatting.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded bg-[#ed4245]/10 border border-[#ed4245]/20 px-3 py-2 text-[13px] text-[#ed4245]">
                {error}
              </div>
            )}

            {/* Room Name */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-[#b5bac1] mb-2 block">
                Room Name <span className="text-[#ed4245]">*</span>
              </label>
              <input
                name="name"
                type="text"
                required
                maxLength={40}
                placeholder="e.g. Premier League Picks"
                className="w-full h-10 px-3 rounded bg-[#1e1f22] text-[14px] text-[#dbdee1] placeholder:text-[#6d6f78] focus:outline-none focus:ring-2 focus:ring-[#5865f2]/50 border-none"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-[#b5bac1] mb-2 block">
                Description <span className="text-[#ed4245]">*</span>
              </label>
              <textarea
                name="description"
                required
                maxLength={200}
                placeholder="What's this room about?"
                className="w-full h-20 px-3 py-2 rounded bg-[#1e1f22] text-[14px] text-[#dbdee1] placeholder:text-[#6d6f78] focus:outline-none focus:ring-2 focus:ring-[#5865f2]/50 border-none resize-none"
              />
            </div>

            {/* Sport */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-[#b5bac1] mb-2 block">
                Sport
              </label>
              <div className="flex flex-wrap gap-2">
                {SPORT_OPTIONS.map((sport) => (
                  <button
                    key={sport.value}
                    type="button"
                    onClick={() => setSportTag(sport.value)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded text-[13px] font-medium transition-colors",
                      sportTag === sport.value
                        ? "bg-[#5865f2] text-white"
                        : "bg-[#1e1f22] text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#35373c]"
                    )}
                  >
                    <span>{sport.emoji}</span>
                    {sport.value}
                  </button>
                ))}
              </div>
            </div>

            {/* Room Type */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-[#b5bac1] mb-2 block">
                Room Type
              </label>
              <div className="space-y-2">
                {ROOM_TYPES.map((option) => {
                  const Icon = option.icon
                  const isSelected = type === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setType(option.value)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded text-left transition-colors border",
                        isSelected
                          ? "bg-[#404249] border-[#5865f2]"
                          : "bg-[#1e1f22] border-transparent hover:bg-[#35373c]"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                        isSelected ? "bg-[#5865f2]" : "bg-[#35373c]"
                      )}>
                        <Icon className={cn("w-5 h-5", isSelected ? "text-white" : "text-[#949ba4]")} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium text-[#f2f3f5]">{option.label}</p>
                        <p className="text-[12px] text-[#949ba4]">{option.description}</p>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-[#5865f2] flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 rounded bg-[#5865f2] text-white text-[14px] font-medium hover:bg-[#4752c4] transition-colors disabled:opacity-50"
            >
              {isLoading ? "Creating..." : "Create Room"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
