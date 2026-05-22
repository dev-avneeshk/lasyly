"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Lock, Globe } from "lucide-react"
import Link from "next/link"

export default function CreateRoomPage() {
  const router = useRouter()
  const [type, setType] = useState<"Public" | "Private" | "Tipster">("Public")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const description = formData.get("description") as string
    const sport_tag = formData.get("sport_tag") as string

    try {
      const res = await fetch("/api/rooms/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, sport_tag, type }),
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
    <div className="max-w-2xl mx-auto p-4 md:p-8">
      <Link href="/rooms" className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-white mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to My Rooms
      </Link>

      <div className="bg-[var(--color-surface)]/60 backdrop-blur-md rounded-3xl border border-white/5 p-6 md:p-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Create a Room</h1>
          <p className="text-[var(--color-text-muted)]">Build your community. Share picks, track scores, and chat in real-time.</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/90">Room Name</label>
            <Input 
              name="name"
              type="text" 
              placeholder="e.g. Premier League Sharp Shooters" 
              required
              maxLength={40}
              className="bg-black/20 border-white/10 focus-visible:ring-[var(--color-lime)]/50 focus-visible:border-[var(--color-lime)] h-12"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/90">Description</label>
            <textarea 
              name="description"
              placeholder="What's this room about?" 
              required
              maxLength={200}
              className="w-full h-24 bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-lime)]/50 focus:border-[var(--color-lime)] transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/90">Sport Tag</label>
              <select name="sport_tag" className="w-full h-12 bg-black/20 border border-white/10 rounded-xl px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-lime)]/50 focus:border-[var(--color-lime)] transition-all appearance-none">
                <option value="Football">Football</option>
                <option value="Basketball">Basketball</option>
                <option value="Tennis">Tennis</option>
                <option value="Mixed">Mixed</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/90">Room Type</label>
              <div className="flex bg-black/20 border border-white/10 rounded-xl p-1 h-12">
                <button
                  type="button"
                  onClick={() => setType("Public")}
                  className={`flex-1 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all ${type === "Public" ? "bg-[var(--color-surface-elevated)] text-white shadow-sm" : "text-[var(--color-text-muted)] hover:text-white"}`}
                >
                  <Globe className="w-3.5 h-3.5" /> Public
                </button>
                <button
                  type="button"
                  onClick={() => setType("Private")}
                  className={`flex-1 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all ${type === "Private" ? "bg-[var(--color-surface-elevated)] text-white shadow-sm" : "text-[var(--color-text-muted)] hover:text-white"}`}
                >
                  <Lock className="w-3.5 h-3.5" /> Private
                </button>
                <button
                  type="button"
                  onClick={() => setType("Tipster")}
                  className={`flex-1 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all ${type === "Tipster" ? "bg-[var(--color-surface-elevated)] text-white shadow-sm" : "text-[var(--color-text-muted)] hover:text-white"}`}
                >
                  Tipster
                </button>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5">
            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full h-12 text-base font-semibold tracking-wide bg-[var(--color-lime)] text-black hover:bg-[var(--color-lime)]/90 transition-all border-none shadow-[0_0_15px_rgba(212,255,0,0.4)]"
            >
              {isLoading ? "Creating Room..." : "Create Room"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
