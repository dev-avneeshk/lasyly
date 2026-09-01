"use client"

import { memo } from "react"
import { X, Sparkles, Check } from "lucide-react"

type UpgradeModalProps = {
  open: boolean
  /** What the user hit the wall on, for a tailored headline. */
  limit?: "channels" | "subchannels" | null
  onClose: () => void
}

const PERKS = [
  "Unlimited channels & sub-channels",
  "Private invite-only channels",
  "Priority support",
]

/**
 * Compact "Upgrade to Pro" dialog shown when a free-tier limit is hit (API
 * returns 402). Billing is not wired yet — the CTA is intentionally disabled
 * ("coming soon"). Kept small so it never dominates the layout.
 */
function UpgradeModalBase({ open, limit, onClose }: UpgradeModalProps) {
  if (!open) return null

  const headline =
    limit === "channels"
      ? "You've reached 2 channels"
      : limit === "subchannels"
        ? "You've reached 2 sub-channels"
        : "Upgrade to Pro"

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[360px] rounded-2xl bg-[#141414] border border-white/[0.08] shadow-2xl overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="px-6 pt-7 pb-6">
          <div className="w-11 h-11 rounded-xl bg-[#B8FF4F]/15 flex items-center justify-center mb-4">
            <Sparkles className="w-5 h-5 text-[#B8FF4F]" />
          </div>
          <h3 className="text-[17px] font-semibold text-white/90 leading-tight">{headline}</h3>
          <p className="text-[13px] text-white/40 mt-1.5 leading-relaxed">
            Free rooms include 2 channels with 2 sub-channels each. Go Pro to unlock more.
          </p>

          <div className="mt-5 flex flex-col gap-2.5">
            {PERKS.map((p) => (
              <div key={p} className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-full bg-[#B8FF4F]/20 flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 text-[#B8FF4F]" />
                </span>
                <span className="text-[13px] text-white/60">{p}</span>
              </div>
            ))}
          </div>

          <button
            disabled
            title="Pro is coming soon"
            className="mt-6 w-full py-2.5 rounded-xl bg-[#B8FF4F] text-black text-[13px] font-semibold opacity-60 cursor-not-allowed"
          >
            Upgrade — coming soon
          </button>
          <button
            onClick={onClose}
            className="mt-2 w-full py-2 rounded-xl text-[12px] text-white/40 hover:text-white/70 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}

export const UpgradeModal = memo(UpgradeModalBase)
