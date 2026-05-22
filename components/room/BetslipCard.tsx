"use client"

import { Betslip } from "@/types"
import { MessageSquare, Share2, Flame, Copy, Lock, Unlock, TrendingUp, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"

interface BetslipCardProps {
  betslip: Betslip
}

const STATUS_CONFIG = {
  Won: {
    label: "WON",
    bg: "bg-[var(--color-success)]/10",
    text: "text-[var(--color-success)]",
    border: "border-[var(--color-success)]/25",
    glow: "rgba(34,197,94,0.15)",
    icon: CheckCircle2,
  },
  Lost: {
    label: "LOST",
    bg: "bg-[var(--color-danger)]/10",
    text: "text-[var(--color-danger)]",
    border: "border-[var(--color-danger)]/25",
    glow: "rgba(255,75,75,0.15)",
    icon: XCircle,
  },
  Pending: {
    label: "PENDING",
    bg: "bg-[var(--color-warning)]/10",
    text: "text-[var(--color-warning)]",
    border: "border-[var(--color-warning)]/25",
    glow: "rgba(245,158,11,0.1)",
    icon: Clock,
  },
  Void: {
    label: "VOID",
    bg: "bg-white/5",
    text: "text-[var(--color-text-muted)]",
    border: "border-white/10",
    glow: "rgba(255,255,255,0.05)",
    icon: Clock,
  },
  Partial: {
    label: "PARTIAL",
    bg: "bg-[var(--color-warning)]/10",
    text: "text-[var(--color-warning)]",
    border: "border-[var(--color-warning)]/25",
    glow: "rgba(245,158,11,0.1)",
    icon: Clock,
  },
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function BetslipCard({ betslip }: BetslipCardProps) {
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLocked, setIsLocked] = useState(betslip.isForSale === true)
  const [showMatches, setShowMatches] = useState(true)
  const [reacted, setReacted] = useState(false)

  const status = STATUS_CONFIG[betslip.status] ?? STATUS_CONFIG.Pending
  const StatusIcon = status.icon
  const impliedProb = `${Math.round((1 / betslip.odds) * 100)}%`
  const fireCount = betslip.reactions?.fire ?? 0

  const handleUnlock = async () => {
    setIsUnlocking(true)
    setError(null)
    try {
      const res = await fetch("/api/picks/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          betslipId: betslip.id,
          price: betslip.price,
          tipsterId: betslip.userId,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      setIsLocked(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to unlock this pick")
      setTimeout(() => setIsLocked(false), 500)
    } finally {
      setIsUnlocking(false)
    }
  }

  return (
    <div
      className="relative w-full rounded-2xl border border-white/8 overflow-hidden transition-all duration-300 hover:border-white/15 hover:-translate-y-0.5 hover:shadow-2xl group"
      style={{
        background: "linear-gradient(145deg, var(--color-surface) 0%, rgba(26,29,38,0.8) 100%)",
        boxShadow: `0 4px 32px ${status.glow}`,
      }}
    >
      {/* Status accent line at top */}
      <div
        className={cn("absolute top-0 left-0 right-0 h-[2px]", status.bg.replace("/10", ""))}
        style={{
          background:
            betslip.status === "Won"
              ? "linear-gradient(90deg, transparent, var(--color-success), transparent)"
              : betslip.status === "Lost"
              ? "linear-gradient(90deg, transparent, var(--color-danger), transparent)"
              : "linear-gradient(90deg, transparent, var(--color-warning), transparent)",
        }}
      />

      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar with gradient ring */}
          <div
            className="relative shrink-0 w-10 h-10 rounded-full p-[2px]"
            style={{
              background: "linear-gradient(135deg, var(--color-primary), var(--color-secondary))",
            }}
          >
            <img
              src={betslip.user.avatarUrl}
              alt={betslip.user.username}
              className="w-full h-full rounded-full object-cover border-2 border-[var(--color-surface)]"
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-white text-sm leading-tight">{betslip.user.displayName}</span>
              {betslip.user.isVerified && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[var(--color-primary)] shrink-0">
                  <span className="text-[8px] text-white font-black">✓</span>
                </span>
              )}
              {betslip.user.winRate && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[var(--color-secondary)]/15 text-[var(--color-secondary)] border border-[var(--color-secondary)]/20">
                  {betslip.user.winRate}% W
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-[var(--color-text-muted)]">@{betslip.user.username}</span>
              <span className="text-[var(--color-text-muted)] text-[10px]">·</span>
              <span className="text-[11px] text-[var(--color-text-muted)]">{timeAgo(betslip.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Status badge */}
        <div
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold tracking-wide shrink-0",
            status.bg,
            status.text,
            status.border
          )}
        >
          <StatusIcon className="w-3 h-3" />
          {status.label}
        </div>
      </div>

      {/* Bet Meta Row */}
      <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white/8 text-[var(--color-text-muted)] border border-white/8">
          {betslip.sportsbook}
        </span>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20">
          {betslip.betType}
        </span>
        {betslip.user.streak && betslip.user.streak >= 3 && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[var(--color-warning)]/10 text-[var(--color-warning)] border border-[var(--color-warning)]/20">
            🔥 {betslip.user.streak} streak
          </span>
        )}
      </div>

      {/* Odds + Stake hero section */}
      <div className="mx-4 mb-3 px-4 py-3 rounded-xl bg-black/20 border border-white/5 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-widest mb-0.5">Total Odds</p>
          <p className="text-2xl font-black text-white tracking-tight">{betslip.odds.toFixed(2)}x</p>
          <div className="flex items-center gap-1 mt-0.5">
            <TrendingUp className="w-3 h-3 text-[var(--color-secondary)]" />
            <span className="text-[11px] text-[var(--color-text-muted)]">{impliedProb} implied</span>
          </div>
        </div>
        <div className="h-10 w-px bg-white/10" />
        {betslip.stake != null && (
          <div className="text-right">
            <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-widest mb-0.5">Stake</p>
            <p className="text-xl font-black text-white">${betslip.stake.toLocaleString()}</p>
          </div>
        )}
        {betslip.payout != null && (
          <>
            <div className="h-10 w-px bg-white/10" />
            <div className="text-right">
              <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-widest mb-0.5">
                {betslip.status === "Won" ? "Payout" : "Potential"}
              </p>
              <p
                className={cn(
                  "text-xl font-black",
                  betslip.status === "Won" ? "text-[var(--color-success)]" : "text-white"
                )}
              >
                ${betslip.payout.toLocaleString()}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Description */}
      {betslip.description && (
        <p className="mx-4 mb-3 text-sm leading-relaxed text-white/70 bg-white/4 px-3 py-2.5 rounded-xl border border-white/5 italic">
          &ldquo;{betslip.description}&rdquo;
        </p>
      )}

      {/* Matches / Picks */}
      <div className="mx-4 mb-4">
        <button
          onClick={() => setShowMatches((p) => !p)}
          className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-2 hover:text-white transition-colors w-full"
        >
          {betslip.matches.length} Selection{betslip.matches.length > 1 ? "s" : ""}
          {showMatches ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
        </button>

        {showMatches && (
          <div className="space-y-1.5">
            {isLocked ? (
              <div className="relative overflow-hidden rounded-xl bg-black/30 border border-white/8 p-6 flex flex-col items-center justify-center text-center">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40 pointer-events-none" />
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 relative z-10"
                  style={{
                    background: "linear-gradient(135deg, var(--color-primary), #837cff)",
                    boxShadow: "0 0 24px rgba(108,99,255,0.4)",
                  }}
                >
                  <Lock className="w-5 h-5 text-white" />
                </div>
                <h4 className="font-black text-white relative z-10 mb-1 text-base">Premium Pick</h4>
                <p className="text-xs text-[var(--color-text-muted)] relative z-10 mb-4 max-w-[220px] leading-relaxed">
                  Unlock to view the full selections and copy to your sportsbook.
                </p>
                {error && <p className="text-xs text-[var(--color-danger)] mb-3 relative z-10">{error}</p>}
                <button
                  onClick={handleUnlock}
                  disabled={isUnlocking}
                  className="relative z-10 flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-bold shadow-[0_4px_20px_rgba(108,99,255,0.35)] hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
                  style={{
                    background: "linear-gradient(135deg, var(--color-primary), #837cff)",
                  }}
                >
                  {isUnlocking ? (
                    <span className="animate-pulse">Processing...</span>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4" />
                      Unlock for ${betslip.price?.toFixed(2)}
                    </>
                  )}
                </button>
              </div>
            ) : (
              betslip.matches.map((match, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-xl border border-white/6 bg-white/3 text-sm group/match hover:bg-white/6 transition-colors"
                >
                  <div className="mt-1.5 w-2 h-2 rounded-full bg-[var(--color-secondary)] shrink-0 shadow-[0_0_6px_rgba(0,212,170,0.6)]" />
                  <span className="text-white/85 leading-snug break-words min-w-0">{match}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="px-4 py-3 border-t border-white/5 bg-black/20 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setReacted((r) => !r)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
              reacted
                ? "text-[var(--color-danger)] bg-[var(--color-danger)]/15"
                : "text-[var(--color-text-muted)] hover:text-white hover:bg-white/8"
            )}
          >
            <Flame className={cn("w-4 h-4 transition-transform", reacted && "scale-125")} />
            <span>{reacted ? fireCount + 1 : fireCount}</span>
          </button>
          <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[var(--color-text-muted)] hover:text-white hover:bg-white/8 transition-all">
            <MessageSquare className="w-4 h-4" />
            <span>{betslip.commentCount ?? 0}</span>
          </button>
          <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[var(--color-text-muted)] hover:text-white hover:bg-white/8 transition-all">
            <Share2 className="w-4 h-4" />
          </button>
        </div>

        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border border-[var(--color-primary)]/30 text-[var(--color-primary)] bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)] hover:text-white hover:border-[var(--color-primary)] hover:shadow-[0_4px_16px_rgba(108,99,255,0.35)] active:scale-95">
          <Copy className="w-3.5 h-3.5" />
          Copy Slip
        </button>
      </div>
    </div>
  )
}
