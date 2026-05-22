"use client"

import { useState } from "react"
import { X, Plus, Trash2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type CreateBetslipModalProps = {
  onClose: () => void
  onCreated: () => void
  roomId?: string
}

const BET_TYPES = ["Single", "Accumulator", "System", "Lucky"] as const
const SPORTSBOOKS = ["Bet365", "DraftKings", "FanDuel", "Betway", "1xBet", "William Hill", "Paddy Power", "Other"]

export default function CreateBetslipModal({ onClose, onCreated, roomId }: CreateBetslipModalProps) {
  const [sportsbook, setSportsbook] = useState("")
  const [betType, setBetType] = useState<string>("Single")
  const [odds, setOdds] = useState("")
  const [stake, setStake] = useState("")
  const [description, setDescription] = useState("")
  const [matches, setMatches] = useState<string[]>([""])
  const [isForSale, setIsForSale] = useState(false)
  const [price, setPrice] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addMatch = () => {
    if (matches.length >= 20) return
    setMatches([...matches, ""])
  }

  const removeMatch = (index: number) => {
    if (matches.length <= 1) return
    setMatches(matches.filter((_, i) => i !== index))
  }

  const updateMatch = (index: number, value: string) => {
    const updated = [...matches]
    updated[index] = value
    setMatches(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const validMatches = matches.filter((m) => m.trim().length > 0)

    if (validMatches.length === 0) {
      setError("Add at least one match/selection.")
      setIsLoading(false)
      return
    }

    const payload: Record<string, unknown> = {
      sportsbook,
      bet_type: betType,
      odds: parseFloat(odds),
      matches: validMatches,
      description: description || undefined,
      stake: stake ? parseFloat(stake) : undefined,
      is_for_sale: isForSale,
      price: isForSale && price ? parseFloat(price) : undefined,
    }

    if (roomId) {
      payload.room_id = roomId
    }

    try {
      const res = await fetch("/api/betslips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to create betslip.")
        setIsLoading(false)
        return
      }

      onCreated()
      onClose()
    } catch {
      setError("Something went wrong. Please try again.")
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[var(--color-surface)] border border-white/10 rounded-3xl p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Share a Pick</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[var(--color-text-muted)] hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Sportsbook */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/90">Sportsbook</label>
            <select
              value={sportsbook}
              onChange={(e) => setSportsbook(e.target.value)}
              required
              className="w-full h-11 bg-black/20 border border-white/10 rounded-xl px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 transition-all appearance-none"
            >
              <option value="">Select sportsbook...</option>
              {SPORTSBOOKS.map((sb) => (
                <option key={sb} value={sb}>{sb}</option>
              ))}
            </select>
          </div>

          {/* Bet Type + Odds */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/90">Bet Type</label>
              <select
                value={betType}
                onChange={(e) => setBetType(e.target.value)}
                className="w-full h-11 bg-black/20 border border-white/10 rounded-xl px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 transition-all appearance-none"
              >
                {BET_TYPES.map((bt) => (
                  <option key={bt} value={bt}>{bt}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/90">Total Odds</label>
              <Input
                type="number"
                step="0.01"
                min="1.01"
                value={odds}
                onChange={(e) => setOdds(e.target.value)}
                placeholder="e.g. 2.50"
                required
                className="bg-black/20 border-white/10 h-11"
              />
            </div>
          </div>

          {/* Matches/Selections */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-white/90">Selections</label>
              <span className="text-xs text-[var(--color-text-muted)]">{matches.length}/20</span>
            </div>
            <div className="space-y-2">
              {matches.map((match, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    type="text"
                    value={match}
                    onChange={(e) => updateMatch(i, e.target.value)}
                    placeholder={`e.g. Man City vs Arsenal - Over 2.5`}
                    className="bg-black/20 border-white/10 h-10 flex-1"
                  />
                  {matches.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMatch(i)}
                      className="w-10 h-10 rounded-lg bg-[var(--color-danger)]/10 text-[var(--color-danger)] flex items-center justify-center hover:bg-[var(--color-danger)]/20 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {matches.length < 20 && (
              <button
                type="button"
                onClick={addMatch}
                className="flex items-center gap-2 text-sm text-[var(--color-primary)] hover:text-white transition-colors"
              >
                <Plus className="w-4 h-4" /> Add selection
              </button>
            )}
          </div>

          {/* Stake (optional) */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/90">Stake (optional)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              placeholder="$0.00"
              className="bg-black/20 border-white/10 h-11"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/90">Note (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Share your reasoning..."
              maxLength={500}
              className="w-full h-20 bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 transition-all resize-none"
            />
          </div>

          {/* Premium Pick Toggle */}
          <div className="p-4 rounded-xl border border-white/10 bg-black/20">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-[var(--color-primary)]" />
                <div>
                  <span className="text-sm font-medium text-white">Premium Pick</span>
                  <p className="text-xs text-[var(--color-text-muted)]">Lock selections behind a paywall</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isForSale}
                onChange={(e) => setIsForSale(e.target.checked)}
                className="w-5 h-5 rounded accent-[var(--color-primary)]"
              />
            </label>
            {isForSale && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <label className="text-xs font-medium text-white/70 mb-1 block">Price ($)</label>
                <Input
                  type="number"
                  step="0.50"
                  min="0.50"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. 5.00"
                  required={isForSale}
                  className="bg-black/30 border-white/10 h-10"
                />
              </div>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={isLoading || !sportsbook || !odds}
            className="w-full h-12 text-base font-semibold bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 transition-all border-none shadow-[0_0_15px_rgba(108,99,255,0.4)]"
          >
            {isLoading ? "Posting..." : "Share Pick"}
          </Button>
        </form>
      </div>
    </div>
  )
}
