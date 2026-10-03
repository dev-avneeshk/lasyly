"use client"

import { useRef } from "react"

/**
 * Radix Dialog.Content props that return focus to whatever opened the dialog.
 * Radix only refocuses a Dialog.Trigger, and our dialogs are opened from
 * buttons elsewhere, so without this focus fell to <body> on close.
 */
export function useOpenerFocus() {
  const opener = useRef<HTMLElement | null>(null)
  return {
    onOpenAutoFocus: () => {
      opener.current = document.activeElement as HTMLElement | null
    },
    onCloseAutoFocus: (e: Event) => {
      e.preventDefault()
      opener.current?.focus()
    },
  }
}
