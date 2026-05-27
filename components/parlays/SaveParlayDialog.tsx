"use client"

import { useState, useCallback, useMemo } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { motion, AnimatePresence } from "framer-motion"
import { Globe, Lock, X, Loader2, DollarSign, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { computePayout } from "@/lib/parlays/computations"
import type {
  SaveParlayDialogProps,
  ParlayVisibility,
  SaveParlayPayload,
  ParlayLegInput,
} from "@/lib/types/parlay"

// ─── Constants ──────────────────────────────────────────────────────────────

const ODDS_MIN = -10000
const ODDS_MAX = 10000
const STAKE_MIN = 0.01
const STAKE_MAX = 99999.99
const NOTE_MAX_LENGTH = 280

// ─── Validation ─────────────────────────────────────────────────────────────

interface ValidationErrors {
  odds?: string
  stake?: string
  note?: string
}

function validateFields(
  odds: string,
  stake: string,
  note: string
): ValidationErrors {
  const errors: ValidationErrors = {}

  if (odds.trim() !== "") {
    const oddsNum = Number(odds)
    if (isNaN(oddsNum)) {
      errors.odds = "Odds must be a valid number"
    } else if (oddsNum < ODDS_MIN || oddsNum > ODDS_MAX) {
      errors.odds = `Odds must be between ${ODDS_MIN} and ${ODDS_MAX}`
    }
  }

  if (stake.trim() !== "") {
    const stakeNum = Number(stake)
    if (isNaN(stakeNum)) {
      errors.stake = "Stake must be a valid number"
    } else if (stakeNum < STAKE_MIN || stakeNum > STAKE_MAX) {
      errors.stake = `Stake must be between $${STAKE_MIN} and $${STAKE_MAX.toLocaleString()}`
    }
  }

  if (note.length > NOTE_MAX_LENGTH) {
    errors.note = `Note must be ${NOTE_MAX_LENGTH} characters or fewer`
  }

  return errors
}

// ─── Component ──────────────────────────────────────────────────────────────

export function SaveParlayDialog({
  legs,
  combinedHitRate,
  onSave,
  onClose,
  isSubmitting,
  error,
}: SaveParlayDialogProps) {
  const [visibility, setVisibility] = useState<ParlayVisibility>("public")
  const [odds, setOdds] = useState("")
  const [stake, setStake] = useState("")
  const [note, setNote] = useState("")
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})

  // Compute potential payout when both odds and stake are valid
  const potentialPayout = useMemo(() => {
    const oddsNum = Number(odds)
    const stakeNum = Number(stake)
    if (
      odds.trim() === "" ||
      stake.trim() === "" ||
      isNaN(oddsNum) ||
      isNaN(stakeNum) ||
      stakeNum <= 0
    ) {
      return null
    }
    return computePayout(stakeNum, oddsNum)
  }, [odds, stake])

  const handleSubmit = useCallback(async () => {
    // Run validation
    const errors = validateFields(odds, stake, note)
    setValidationErrors(errors)

    if (Object.keys(errors).length > 0) {
      return
    }

    const oddsValue = odds.trim() !== "" ? Number(odds) : null
    const stakeValue = stake.trim() !== "" ? Number(stake) : null
    const noteValue = note.trim() !== "" ? note.trim() : null

    const payload: SaveParlayPayload = {
      legs: legs.map(
        (leg): ParlayLegInput => ({
          player_name: leg.player_name,
          stat_category: leg.stat_category,
          prop_line: leg.prop_line,
          direction: leg.direction,
          l10_hit_rate: leg.l10_hit_rate ?? 0,
          sport: leg.sport,
        })
      ),
      visibility,
      odds: oddsValue,
      stake: stakeValue,
      custom_note: noteValue,
      combined_hit_rate: combinedHitRate,
    }

    await onSave(payload)
  }, [legs, visibility, odds, stake, note, combinedHitRate, onSave])

  const hasMinLegs = legs.length >= 2

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <AnimatePresence>
          <Dialog.Overlay asChild>
            <motion.div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
          </Dialog.Overlay>
        </AnimatePresence>

        <Dialog.Content asChild>
          <motion.div
            className="fixed inset-x-4 top-[50%] z-50 max-w-md mx-auto -translate-y-1/2 rounded-2xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] shadow-2xl p-6 focus:outline-none"
            initial={{ opacity: 0, scale: 0.95, y: "-48%" }}
            animate={{ opacity: 1, scale: 1, y: "-50%" }}
            exit={{ opacity: 0, scale: 0.95, y: "-48%" }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <Dialog.Title className="text-lg font-semibold text-white">
                Save Parlay
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Close dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            </div>

            {/* Leg summary */}
            <div className="mb-5 px-3 py-2 rounded-xl bg-white/5 border border-[var(--color-border)]/50">
              <p className="text-xs text-[var(--color-text-muted)]">
                {legs.length} leg{legs.length !== 1 ? "s" : ""} selected
                {combinedHitRate !== null && (
                  <span className="ml-2 text-[var(--color-lime)] font-semibold">
                    {combinedHitRate.toFixed(1)}% combined hit rate
                  </span>
                )}
              </p>
            </div>

            {/* Visibility toggle */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-2">
                Visibility
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setVisibility("public")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all",
                    visibility === "public"
                      ? "bg-[var(--color-lime)]/15 text-[var(--color-lime)] border border-[var(--color-lime)]/40"
                      : "bg-white/5 text-[var(--color-text-muted)] border border-[var(--color-border)] hover:bg-white/10"
                  )}
                >
                  <Globe className="w-4 h-4" />
                  Public
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility("private")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all",
                    visibility === "private"
                      ? "bg-[var(--color-lime)]/15 text-[var(--color-lime)] border border-[var(--color-lime)]/40"
                      : "bg-white/5 text-[var(--color-text-muted)] border border-[var(--color-border)] hover:bg-white/10"
                  )}
                >
                  <Lock className="w-4 h-4" />
                  Private
                </button>
              </div>
            </div>

            {/* Odds input */}
            <div className="mb-4">
              <label
                htmlFor="parlay-odds"
                className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5"
              >
                Odds <span className="text-[var(--color-text-muted)]/60">(optional)</span>
              </label>
              <input
                id="parlay-odds"
                type="text"
                inputMode="decimal"
                placeholder="e.g. +150 or 2.5"
                value={odds}
                onChange={(e) => {
                  setOdds(e.target.value)
                  if (validationErrors.odds) {
                    setValidationErrors((prev) => ({ ...prev, odds: undefined }))
                  }
                }}
                className={cn(
                  "w-full h-10 rounded-lg border px-3 py-2 text-sm text-white placeholder:text-[var(--color-text-muted)] bg-[var(--color-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-lime)]/50 focus:border-transparent transition-colors",
                  validationErrors.odds
                    ? "border-[var(--color-danger)]"
                    : "border-[var(--color-border)]"
                )}
              />
              {validationErrors.odds && (
                <p className="mt-1 text-xs text-[var(--color-danger)] flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {validationErrors.odds}
                </p>
              )}
            </div>

            {/* Stake input */}
            <div className="mb-4">
              <label
                htmlFor="parlay-stake"
                className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5"
              >
                Stake <span className="text-[var(--color-text-muted)]/60">(optional)</span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                <input
                  id="parlay-stake"
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 50.00"
                  value={stake}
                  onChange={(e) => {
                    setStake(e.target.value)
                    if (validationErrors.stake) {
                      setValidationErrors((prev) => ({ ...prev, stake: undefined }))
                    }
                  }}
                  className={cn(
                    "w-full h-10 rounded-lg border pl-9 pr-3 py-2 text-sm text-white placeholder:text-[var(--color-text-muted)] bg-[var(--color-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-lime)]/50 focus:border-transparent transition-colors",
                    validationErrors.stake
                      ? "border-[var(--color-danger)]"
                      : "border-[var(--color-border)]"
                  )}
                />
              </div>
              {validationErrors.stake && (
                <p className="mt-1 text-xs text-[var(--color-danger)] flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {validationErrors.stake}
                </p>
              )}
            </div>

            {/* Potential payout */}
            {potentialPayout !== null && potentialPayout > 0 && (
              <div className="mb-4 px-3 py-2 rounded-xl bg-[var(--color-lime)]/10 border border-[var(--color-lime)]/20">
                <p className="text-xs text-[var(--color-text-muted)]">
                  Potential Payout
                </p>
                <p className="text-sm font-semibold text-[var(--color-lime)]">
                  ${potentialPayout.toFixed(2)}
                </p>
              </div>
            )}

            {/* Custom note */}
            <div className="mb-5">
              <label
                htmlFor="parlay-note"
                className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5"
              >
                Note <span className="text-[var(--color-text-muted)]/60">(optional)</span>
              </label>
              <textarea
                id="parlay-note"
                placeholder="Add a note about this parlay..."
                value={note}
                onChange={(e) => {
                  setNote(e.target.value)
                  if (validationErrors.note) {
                    setValidationErrors((prev) => ({ ...prev, note: undefined }))
                  }
                }}
                maxLength={NOTE_MAX_LENGTH + 10}
                rows={3}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-sm text-white placeholder:text-[var(--color-text-muted)] bg-[var(--color-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-lime)]/50 focus:border-transparent transition-colors resize-none",
                  validationErrors.note
                    ? "border-[var(--color-danger)]"
                    : "border-[var(--color-border)]"
                )}
              />
              <div className="flex items-center justify-between mt-1">
                {validationErrors.note ? (
                  <p className="text-xs text-[var(--color-danger)] flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {validationErrors.note}
                  </p>
                ) : (
                  <span />
                )}
                <span
                  className={cn(
                    "text-xs",
                    note.length > NOTE_MAX_LENGTH
                      ? "text-[var(--color-danger)]"
                      : "text-[var(--color-text-muted)]"
                  )}
                >
                  {note.length}/{NOTE_MAX_LENGTH}
                </span>
              </div>
            </div>

            {/* API error message */}
            {error && (
              <div className="mb-4 px-3 py-2 rounded-xl bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20">
                <p className="text-xs text-[var(--color-danger)] flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </p>
              </div>
            )}

            {/* Submit button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !hasMinLegs}
              className={cn(
                "w-full py-3 rounded-xl font-semibold text-sm transition-all",
                "bg-[var(--color-lime)] text-black hover:brightness-110 active:scale-[0.98]",
                "disabled:opacity-50 disabled:pointer-events-none",
                "flex items-center justify-center gap-2"
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Parlay"
              )}
            </button>

            {!hasMinLegs && (
              <p className="mt-2 text-center text-xs text-[var(--color-text-muted)]">
                Add at least 2 legs to save a parlay
              </p>
            )}
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
