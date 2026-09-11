"use client"

import { useEffect, useRef, useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { X, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────

export type ConfirmField =
  | {
      kind: "text"
      /** Placeholder shown in the input. */
      placeholder?: string
      /** Optional prefilled value. */
      defaultValue?: string
      /** When true, the confirm button stays enabled even if the field is empty. */
      optional?: boolean
      maxLength?: number
    }
  | {
      kind: "options"
      options: { value: string; label: string }[]
      defaultValue?: string
    }

export type ConfirmDialogProps = {
  open: boolean
  title: string
  /** Body copy. Rendered as-is (string or node). */
  description?: React.ReactNode
  /** Label for the confirm button. Defaults to "Confirm". */
  confirmLabel?: string
  cancelLabel?: string
  /** Red styling + warning icon for irreversible actions. */
  destructive?: boolean
  /** Optional single input collected before confirming (replaces window.prompt). */
  field?: ConfirmField
  /** Disable the confirm button + show a spinner while an action runs. */
  loading?: boolean
  /**
   * Called with the field value (or undefined when there's no field) when the
   * user confirms.
   */
  onConfirm: (value?: string) => void
  onCancel: () => void
}

/**
 * In-app replacement for window.confirm / window.prompt. Built on Radix Dialog
 * so it gets accessible focus trapping, focus restoration on close, scroll
 * locking, Escape handling, and proper aria wiring for free — rather than
 * hand-rolling those. Supports an optional text input or preset-option
 * selector for cases that previously used prompt().
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  field,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [value, setValue] = useState("")
  const fieldRef = useRef<HTMLInputElement>(null)

  // Reset the field value each time the dialog opens.
  useEffect(() => {
    if (!open) return
    if (field?.kind === "text") setValue(field.defaultValue ?? "")
    else if (field?.kind === "options") setValue(field.defaultValue ?? field.options[0]?.value ?? "")
    else setValue("")
  }, [open, field])

  const isTextRequired = field?.kind === "text" && !field.optional
  const confirmDisabled = loading || (isTextRequired && value.trim().length === 0)

  const doConfirm = () => {
    if (confirmDisabled) return
    onConfirm(field ? value.trim() || undefined : undefined)
  }

  const accent = destructive ? "#F87171" : "#B8FF4F"

  // Radix drives open state; route any close (Escape, overlay, X) through
  // onCancel unless an action is mid-flight.
  const handleOpenChange = (next: boolean) => {
    if (!next && !loading) onCancel()
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out duration-150" />
        <Dialog.Content
          onOpenAutoFocus={(e) => {
            // Prefer focusing the input when present; otherwise let Radix focus
            // the first focusable element (the confirm button).
            if (field?.kind === "text") {
              e.preventDefault()
              fieldRef.current?.focus()
            }
          }}
          className="fixed left-1/2 top-1/2 z-[110] w-full max-w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-[#141414] border border-white/[0.08] shadow-2xl overflow-hidden data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 duration-150"
        >
          <Dialog.Close asChild>
            <button
              disabled={loading}
              className="absolute top-3 right-3 w-7 h-7 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] flex items-center justify-center transition-colors disabled:opacity-40"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </Dialog.Close>

          <div className="px-6 pt-7 pb-6">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
              style={{ background: `${accent}1F` }}
            >
              <AlertTriangle className="w-5 h-5" style={{ color: accent }} />
            </div>

            <Dialog.Title className="text-[17px] font-semibold text-white/90 leading-tight pr-6">
              {title}
            </Dialog.Title>
            {description ? (
              <Dialog.Description className="text-[13px] text-white/45 mt-1.5 leading-relaxed">
                {description}
              </Dialog.Description>
            ) : (
              // Radix warns without a description; provide a hidden one.
              <Dialog.Description className="sr-only">{title}</Dialog.Description>
            )}

            {field?.kind === "text" && (
              <input
                ref={fieldRef}
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doConfirm()}
                placeholder={field.placeholder}
                maxLength={field.maxLength ?? 200}
                className="mt-4 w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5 py-2.5 text-[13px] text-white/90 placeholder:text-white/25 focus:outline-none focus:border-[rgba(184,255,79,0.3)] transition-colors"
              />
            )}

            {field?.kind === "options" && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {field.options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setValue(opt.value)}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-[13px] font-medium transition-colors",
                      value === opt.value
                        ? "border-[#B8FF4F]/40 bg-[#B8FF4F]/10 text-[#B8FF4F]"
                        : "border-white/[0.08] bg-white/[0.02] text-white/50 hover:text-white/80 hover:border-white/[0.15]"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-6 flex gap-2.5">
              <button
                onClick={() => !loading && onCancel()}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.05] text-[13px] font-medium text-white/60 hover:bg-white/[0.08] hover:text-white/90 transition-colors disabled:opacity-40"
              >
                {cancelLabel}
              </button>
              <button
                onClick={doConfirm}
                disabled={confirmDisabled}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                  destructive
                    ? "bg-[#F87171] text-white hover:bg-[#f45a5a]"
                    : "bg-[#B8FF4F] text-black hover:bg-[#a9f53a]"
                )}
              >
                {loading && (
                  <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                )}
                {confirmLabel}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
