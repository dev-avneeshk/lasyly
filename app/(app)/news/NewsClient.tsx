"use client"

import { useState, createContext, useContext } from "react"
import NewsFeed from "@/components/explore/NewsFeed"
import type { NewsItem } from "@/types/news"

const CATEGORIES = ["Latest", "Football", "NBA", "NFL", "UFC", "Tennis", "F1", "Cricket"] as const

export const NewsThemeContext = createContext<{ theme: "light" | "dark"; grayscale: boolean }>({ theme: "dark", grayscale: false })
export function useNewsTheme() { return useContext(NewsThemeContext).theme }
export function useNewsGrayscale() { return useContext(NewsThemeContext).grayscale }

type NewsClientProps = { initialItems: NewsItem[] }

export default function NewsClient({ initialItems }: NewsClientProps) {
  const [activeCategory, setActiveCategory] = useState<string>("Latest")
  const [theme, setTheme] = useState<"light" | "dark">("dark")
  const [grayscale, setGrayscale] = useState(false)
  const apiCategory = activeCategory === "Latest" ? null : activeCategory

  const isDark = theme === "dark"
  const bg = isDark ? "#0a0b0f" : "#f5f0e8"
  const border = isDark ? "rgba(255,255,255,0.1)" : "#d4c9b0"
  const textPrimary = isDark ? "#ffffff" : "#1a1a1a"
  const textMuted = isDark ? "#999" : "#6b5e4f"
  const activeTabBg = isDark ? "rgba(212,255,0,0.12)" : "rgba(26,26,26,0.08)"
  const activeTabColor = isDark ? "#D4FF00" : "#1a1a1a"

  return (
    <NewsThemeContext.Provider value={{ theme, grayscale }}>
      <div style={{ background: bg }}>
        {/* Category nav + theme toggle */}
        <nav className="flex items-center px-4 md:px-7 py-3.5 gap-1 overflow-x-auto scrollbar-hide" style={{ borderBottom: `1px solid ${border}` }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="whitespace-nowrap transition-colors rounded-full shrink-0"
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: "13px",
                fontWeight: 600,
                letterSpacing: "0.3px",
                padding: "6px 14px",
                color: activeCategory === cat ? activeTabColor : textMuted,
                background: activeCategory === cat ? activeTabBg : "transparent",
              }}
            >
              {cat}
            </button>
          ))}

          {/* Grayscale toggle */}
          <button
            onClick={() => setGrayscale(!grayscale)}
            className="ml-auto shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: grayscale ? (isDark ? "rgba(212,255,0,0.15)" : "rgba(0,0,0,0.1)") : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"), color: grayscale ? activeTabColor : textMuted }}
            aria-label={`${grayscale ? "Disable" : "Enable"} black & white images`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0 0 20z"/>
            </svg>
          </button>

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="ml-auto shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", color: textPrimary }}
            aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
          >
            {isDark ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
        </nav>

        <NewsFeed category={apiCategory} initialItems={initialItems} />
      </div>
    </NewsThemeContext.Provider>
  )
}
