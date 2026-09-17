"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"

/**
 * Global search field in the top bar. Submitting sends the query to the Props
 * page, which already supports an `initialSearch` param. ⌘K / Ctrl+K focuses it.
 */
export default function TopBarSearch() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [shortcut, setShortcut] = useState("Ctrl K")

  useEffect(() => {
    // Rendered after mount so the server HTML doesn't lock in the wrong platform key.
    if (typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) {
      setShortcut("⌘ K")
    }
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        const q = query.trim()
        if (!q) return
        router.push(`/analysis?search=${encodeURIComponent(q)}`)
      }}
      className="relative hidden lg:block w-[300px] xl:w-[360px]"
    >
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        type="search"
        aria-label="Search players, teams, or stats"
        placeholder="Search players, teams, or stats..."
        autoComplete="off"
        className="w-full h-10 pl-9 pr-16 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-lime)]/60 focus:ring-1 focus:ring-[var(--color-lime)]/30 transition-colors [&::-webkit-search-cancel-button]:appearance-none"
      />
      <kbd
        aria-hidden
        className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[10px] font-semibold text-[var(--color-text-muted)] tracking-wide"
        suppressHydrationWarning
      >
        {shortcut}
      </kbd>
    </form>
  )
}
