"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Search, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

interface PlayerResult {
  player: string
  team: string
  sport: string
  statCategory: string
  propLine: number
  headshotUrl?: string | null
  logoUrl?: string | null
}

// NBA team abbreviation to ESPN CDN slug
const NBA_TEAM_LOGO_MAP: Record<string, string> = {
  sas: "sa", phx: "phx", nyk: "ny", nop: "no", gsw: "gs", okc: "okc",
  lac: "lac", lal: "lal", mil: "mil", bos: "bos", den: "den", min: "min",
  cle: "cle", dal: "dal", mem: "mem", mia: "mia", atl: "atl", chi: "chi",
  hou: "hou", ind: "ind", orl: "orl", phi: "phi", por: "por", sac: "sac",
  tor: "tor", uta: "utah", was: "wsh", bkn: "bkn", cha: "cha", det: "det",
}

function getTeamLogoUrl(team: string, sport: string): string | null {
  if (sport === "NBA") {
    const abbr = team.toLowerCase()
    const slug = NBA_TEAM_LOGO_MAP[abbr] ?? abbr
    return `https://a.espncdn.com/i/teamlogos/nba/500/${slug}.png`
  }
  return null
}

interface PlayerSearchProps {
  sport: string
}

export function PlayerSearch({ sport }: PlayerSearchProps) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<PlayerResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setLoading(false)
      setOpen(false)
      return
    }

    setLoading(true)
    setOpen(true)

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/props?sport=${sport}&stat=all&search=${encodeURIComponent(query)}`)
        const data = await res.json()
        const props = data.props ?? []

        // Deduplicate by player name (keep first occurrence)
        const seen = new Set<string>()
        const unique: PlayerResult[] = []
        for (const p of props) {
          const key = p.player.toLowerCase()
          if (!seen.has(key)) {
            seen.add(key)
            unique.push({
              player: p.player,
              team: p.team,
              sport: p.sport ?? sport,
              statCategory: p.statCategory,
              propLine: p.propLine,
              headshotUrl: p.headshotUrl ?? null,
              logoUrl: p.logoUrl ?? null,
            })
          }
          if (unique.length >= 8) break
        }
        setResults(unique)
        setOpen(true)
      } catch {
        setResults([])
        setOpen(false)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query, sport])

  const handleSelect = useCallback((player: PlayerResult) => {
    const playerId = player.player.toLowerCase().replace(/[^a-z0-9]+/g, "-")
    const params = new URLSearchParams({
      stat: player.statCategory,
      team: player.team,
      sport: player.sport,
    })
    router.push(`/analysis/${playerId}?${params.toString()}`)
    setOpen(false)
    setQuery("")
  }, [router])

  return (
    <div ref={containerRef} className="relative w-full">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] w-4.5 h-4.5 pointer-events-none" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => { if (results.length > 0) setOpen(true) }}
        className={cn(
          "w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl",
          "pl-10 pr-10 py-3 text-base text-white",
          "placeholder:text-[var(--color-text-muted)]",
          "focus:border-[var(--color-lime)] focus:ring-1 focus:ring-[var(--color-lime)]/50",
          "transition-all outline-none"
        )}
        placeholder="Search player or team..."
        type="text"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {query && (
        <button
          onClick={() => { setQuery(""); setResults([]); setOpen(false) }}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-white p-1"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Dropdown results */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 z-[60] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden">
          {loading ? (
            <div className="p-4 text-center text-sm text-[var(--color-text-muted)]">Searching...</div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-sm text-[var(--color-text-muted)]">No players found</div>
          ) : (
            <div className="max-h-[360px] overflow-y-auto">
              {results.map((player, idx) => (
                <button
                  key={`${player.player}-${idx}`}
                  onClick={() => handleSelect(player)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 active:bg-white/10 transition-colors text-left border-b border-[var(--color-border)] last:border-b-0"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-[var(--color-surface-elevated)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden flex-shrink-0">
                    {(() => {
                      const imgUrl = player.headshotUrl || player.logoUrl || getTeamLogoUrl(player.team, player.sport)
                      return imgUrl ? (
                        <img
                          src={imgUrl}
                          alt=""
                          className="w-7 h-7 object-contain"
                        />
                      ) : (
                        <span className="text-xs font-bold text-[var(--color-lime)]">
                          {player.player.split(" ").map(n => n[0]).join("")}
                        </span>
                      )
                    })()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{player.player}</div>
                    <div className="text-[11px] text-[var(--color-text-muted)]">
                      {player.team} · {player.statCategory} {player.propLine}
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="text-[var(--color-lime)] text-sm font-bold">→</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
