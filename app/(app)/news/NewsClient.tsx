"use client"

import { useState } from "react"
import NewsFeed from "@/components/explore/NewsFeed"
import type { NewsItem } from "@/types/news"

const CATEGORIES = ["Latest", "Football", "NBA", "NFL", "UFC", "Tennis", "F1", "Cricket"] as const

type NewsClientProps = {
  initialItems: NewsItem[]
}

/**
 * Client wrapper that owns category-tab state. The server already provided
 * initial items for "Latest" so first paint contains real content; switching
 * categories triggers a refetch through `<NewsFeed>`.
 */
export default function NewsClient({ initialItems }: NewsClientProps) {
  const [activeCategory, setActiveCategory] = useState<string>("Latest")
  const apiCategory = activeCategory === "Latest" ? null : activeCategory

  return (
    <>
      {/* Category nav */}
      <nav className="flex items-center px-7 py-3 border-b border-white/10 gap-0 overflow-x-auto scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className="whitespace-nowrap transition-colors"
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: "13px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              padding: "0 16px",
              color: activeCategory === cat ? "var(--color-lime)" : "#888",
            }}
          >
            {cat}
          </button>
        ))}
      </nav>

      {/* News Feed (SSR-hydrated for the default "Latest" category) */}
      <NewsFeed category={apiCategory} initialItems={initialItems} />
    </>
  )
}
