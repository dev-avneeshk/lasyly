"use client"

import { useEffect, useState, useCallback } from "react"
import { ArrowRight } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import type { NewsItem } from "@/types/news"

interface NewsFeedProps {
  category?: string | null
  /**
   * Optional initial items rendered by the server. When provided, `NewsFeed`
   * skips its first network fetch so the user sees real content on first paint.
   */
  initialItems?: NewsItem[]
}

// Highlight colors rotating
const HIGHLIGHT_COLORS = ["#b8d4a0", "#f5c5a3", "#a0c4d4", "#d4a0c4"]

/**
 * Highlights 1-2 key phrases in a headline with colored backgrounds.
 * Picks proper nouns / capitalized multi-word phrases.
 */
function highlightHeadline(title: string, colorIdx: number): React.ReactNode {
  // Find capitalized phrases (2+ words starting with uppercase, or single proper nouns)
  const patterns = [
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g,  // Multi-word proper nouns: "Manchester City", "Josh Hart"
    /([A-Z][a-z]{3,})/g,                    // Single proper nouns 4+ chars
  ]

  // Try multi-word first
  const multiMatch = title.match(patterns[0])
  if (multiMatch && multiMatch.length > 0) {
    const phrase = multiMatch[0]
    const color = HIGHLIGHT_COLORS[colorIdx % HIGHLIGHT_COLORS.length]
    const idx = title.indexOf(phrase)
    if (idx >= 0) {
      return (
        <>
          {title.slice(0, idx)}
          <span style={{ background: color, padding: "0 4px", color: "#1a1a1a" }}>{phrase}</span>
          {title.slice(idx + phrase.length)}
        </>
      )
    }
  }

  // Fallback: highlight first proper noun
  const singleMatch = title.match(patterns[1])
  if (singleMatch && singleMatch.length > 0) {
    // Skip common words
    const skip = new Set(["The", "How", "What", "When", "Where", "Why", "This", "That", "After", "Before", "From", "With", "Into", "Over", "About", "Their", "Could", "Would", "Should", "Every", "Never", "More", "Most", "Some", "Will", "Take", "Make", "Give", "Here", "There"])
    const phrase = singleMatch.find((m) => !skip.has(m))
    if (phrase) {
      const color = HIGHLIGHT_COLORS[colorIdx % HIGHLIGHT_COLORS.length]
      const idx = title.indexOf(phrase)
      if (idx >= 0) {
        return (
          <>
            {title.slice(0, idx)}
            <span style={{ background: color, padding: "0 4px", color: "#1a1a1a" }}>{phrase}</span>
            {title.slice(idx + phrase.length)}
          </>
        )
      }
    }
  }

  return title
}

export default function NewsFeed({ category, initialItems }: NewsFeedProps) {
  const [items, setItems] = useState<NewsItem[]>(initialItems ?? [])
  const [loading, setLoading] = useState(!initialItems || initialItems.length === 0)
  const [selectedArticle, setSelectedArticle] = useState<NewsItem | null>(null)
  // Track whether we've already used the SSR-provided initialItems for the
  // current category, so a subsequent category change still triggers a fetch.
  const initialCategoryRef = useState(category ?? null)[0]

  const fetchNews = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (category) params.set("category", category)
      const res = await fetch(`/api/news/rss?${params.toString()}`)
      const data = await res.json()
      if (res.ok) setItems(data.items ?? [])
    } catch { /* silently fail */ }
    finally { setLoading(false) }
  }, [category])

  useEffect(() => {
    // If the server already gave us items for this exact category, don't refetch.
    if (initialItems && initialItems.length > 0 && (category ?? null) === initialCategoryRef) {
      setLoading(false)
      return
    }
    setLoading(true)
    fetchNews()
  }, [fetchNews, category, initialItems, initialCategoryRef])

  const fmtDate = (d: string) => {
    if (!d) return ""
    try { return formatDistanceToNow(new Date(d), { addSuffix: true }) } catch { return "" }
  }

  if (selectedArticle) {
    return (
      <ArticleDetail
        article={selectedArticle}
        onBack={() => setSelectedArticle(null)}
        fmtDate={fmtDate}
        relatedItems={items.filter((i) => i !== selectedArticle)}
        onSelect={(item) => setSelectedArticle(item)}
      />
    )
  }

  if (loading) {
    return <div className="h-[400px] animate-pulse bg-[#111]" />
  }

  if (items.length === 0) {
    return <p className="text-center py-10 text-[#666] text-sm" style={{ fontFamily: "var(--font-body-serif)" }}>No news available.</p>
  }

  const left1 = items[0]
  const left2 = items[1]
  const center = items[2]
  const right1 = items[3]
  const right2 = items[4]
  const right3 = items[5]
  const right4 = items[6]
  const right5 = items[7]
  const ticker = items.slice(0, 8)

  return (
    <div>
      {/* ══ TICKER BAR ══ */}
      <div className="overflow-hidden py-[10px] relative" style={{ background: "rgba(212, 255, 0, 0.1)", borderTop: "1px solid rgba(212, 255, 0, 0.2)", borderBottom: "1px solid rgba(212, 255, 0, 0.2)" }}>
        <div className="flex items-center gap-0 animate-marquee whitespace-nowrap" style={{ width: "max-content" }}>
          {[...ticker, ...ticker].map((item, idx) => (
            <div
              key={`tick-${idx}`}
              className="flex items-center gap-2 px-5"
              style={{ borderLeft: idx === 0 ? "none" : "2px solid rgba(212, 255, 0, 0.25)", fontFamily: "var(--font-body-serif)", fontSize: "13px", fontWeight: 700, color: "white" }}
            >
              {item.title.slice(0, 30)}{item.title.length > 30 ? "…" : ""}
              <span className="px-2 py-[2px] text-[11px] font-bold" style={{ background: "rgba(212, 255, 0, 0.2)", color: "var(--color-lime)", fontFamily: "var(--font-ui)" }}>
                {item.source.slice(0, 3).toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ══ 3-COLUMN CONTENT ══ */}
      <div
        className="grid gap-6 py-7 px-4 md:px-7"
        style={{ gridTemplateColumns: "1fr" }}
      >
        {/* On mobile: stack everything vertically */}
        {/* Left stories */}
        <div className="md:hidden">
          {left1 && (
            <button onClick={() => setSelectedArticle(left1)} className="text-left w-full group cursor-pointer mb-6">
              {left1.image && (
                <img src={left1.image} alt="" className="w-full h-[200px] object-cover grayscale mb-3" onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none" }} />
              )}
              <h2 className="mb-2 group-hover:text-[var(--color-lime)] transition-colors" style={{ fontFamily: "var(--font-serif)", fontSize: "22px", fontWeight: 700, lineHeight: 1.2, color: "white" }}>
                {left1.title}
              </h2>
              <p className="line-clamp-3" style={{ fontFamily: "var(--font-body-serif)", fontSize: "12px", lineHeight: 1.6, color: "#999" }}>
                {left1.description}
              </p>
              <span className="inline-flex items-center gap-1.5 mt-3" style={{ fontFamily: "var(--font-ui)", fontSize: "12px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--color-lime)" }}>
                READ MORE ——→
              </span>
            </button>
          )}

          {center && (
            <button onClick={() => setSelectedArticle(center)} className="text-left w-full group cursor-pointer mb-6 pt-6 border-t border-white/10">
              {center.image && (
                <img src={center.image} alt="" className="w-full h-[220px] object-cover grayscale mb-3" onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none" }} />
              )}
              <span style={{ fontFamily: "var(--font-ui)", fontSize: "12px", fontWeight: 700, letterSpacing: "1px", color: "#888", textTransform: "uppercase" }}>
                Trending
              </span>
              <h2 className="mt-2 group-hover:text-[var(--color-lime)] transition-colors" style={{ fontFamily: "var(--font-serif)", fontSize: "24px", fontWeight: 700, lineHeight: 1.2, color: "white" }}>
                {center.title}
              </h2>
              <p className="mt-2 line-clamp-3" style={{ fontFamily: "var(--font-body-serif)", fontSize: "13px", lineHeight: 1.7, color: "#999" }}>
                {center.description}
              </p>
              <div className="mt-3" style={{ fontFamily: "var(--font-ui)", fontSize: "11px", color: "#888" }}>
                {center.source} · {fmtDate(center.pubDate)}
              </div>
            </button>
          )}

          {left2 && (
            <button onClick={() => setSelectedArticle(left2)} className="text-left w-full group cursor-pointer mb-6 pt-6 border-t border-white/10">
              <div className="flex gap-3 items-start">
                {left2.image && (
                  <img src={left2.image} alt="" className="w-[100px] h-[80px] object-cover flex-shrink-0 grayscale" onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none" }} />
                )}
                <div>
                  <h3 className="group-hover:text-[var(--color-lime)] transition-colors" style={{ fontFamily: "var(--font-serif)", fontSize: "16px", fontWeight: 700, lineHeight: 1.2, color: "white" }}>
                    {left2.title}
                  </h3>
                  <div style={{ fontFamily: "var(--font-ui)", fontSize: "11px", color: "#888", marginTop: "4px" }}>
                    {fmtDate(left2.pubDate)}
                  </div>
                </div>
              </div>
            </button>
          )}

          {[right1, right2, right3, right4, right5].filter(Boolean).map((item, idx) => (
            <button
              key={`rm-${idx}`}
              onClick={() => item && setSelectedArticle(item)}
              className="flex gap-3 items-start text-left w-full group cursor-pointer py-4 border-t border-white/10"
            >
              {item?.image && (
                <img src={item.image} alt="" className="w-[75px] h-[65px] object-cover flex-shrink-0 grayscale" onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none" }} />
              )}
              <div>
                <h4 className="group-hover:text-[var(--color-lime)] transition-colors" style={{ fontFamily: "var(--font-serif)", fontSize: "14px", fontWeight: 700, lineHeight: 1.3, color: "white" }}>
                  {item?.title}
                </h4>
                <p className="mt-1" style={{ fontFamily: "var(--font-ui)", fontSize: "10px", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {item?.source} · {item?.pubDate ? fmtDate(item.pubDate) : ""}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Desktop: 3-column layout (hidden on mobile) */}
        <div className="hidden md:grid gap-6" style={{ gridTemplateColumns: "280px 1fr 280px" }}>
        {/* ─── LEFT COLUMN ─── */}
        <div>
          {left1 && (
            <button onClick={() => setSelectedArticle(left1)} className="text-left w-full group cursor-pointer">
              <h2 className="mb-3 group-hover:text-[var(--color-lime)] transition-colors" style={{ fontFamily: "var(--font-serif)", fontSize: "22px", fontWeight: 700, lineHeight: 1.2, color: "white" }}>
                {left1.title}
              </h2>
              <div className="flex gap-3">
                {left1.image && (
                  <img src={left1.image} alt="" className="w-[130px] h-[160px] object-cover flex-shrink-0 grayscale" onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none" }} />
                )}
                <p style={{ fontFamily: "var(--font-body-serif)", fontSize: "12px", lineHeight: 1.6, color: "#999" }}>
                  {left1.description}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 mt-3" style={{ fontFamily: "var(--font-ui)", fontSize: "12px", fontWeight: 700, letterSpacing: "0.5px", color: "var(--color-lime)" }}>
                READ MORE ——→
              </span>
            </button>
          )}

          {left2 && (
            <button onClick={() => setSelectedArticle(left2)} className="text-left w-full group cursor-pointer mt-6 pt-5 border-t border-white/10">
              <div className="flex gap-3 items-start">
                {left2.image && (
                  <img src={left2.image} alt="" className="w-[100px] h-[100px] object-cover flex-shrink-0 grayscale" onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none" }} />
                )}
                <div>
                  <h3 className="group-hover:text-[var(--color-lime)] transition-colors" style={{ fontFamily: "var(--font-serif)", fontSize: "17px", fontWeight: 700, lineHeight: 1.2, color: "white" }}>
                    {left2.title}
                  </h3>
                  <div style={{ fontFamily: "var(--font-ui)", fontSize: "11px", color: "#888", marginTop: "4px" }}>
                    {fmtDate(left2.pubDate)}
                  </div>
                </div>
              </div>
              <p className="mt-3 line-clamp-3" style={{ fontFamily: "var(--font-body-serif)", fontSize: "12px", lineHeight: 1.6, color: "#999" }}>
                {left2.description}
              </p>
              <span className="inline-flex items-center gap-1.5 mt-3" style={{ fontFamily: "var(--font-ui)", fontSize: "12px", fontWeight: 700, color: "var(--color-lime)" }}>
                READ MORE ——→
              </span>
            </button>
          )}
        </div>

        {/* ─── CENTER COLUMN ─── */}
        <div>
          {center && (
            <button onClick={() => setSelectedArticle(center)} className="text-left w-full group cursor-pointer">
              {center.image && (
                <img src={center.image} alt="" className="w-full h-[320px] object-cover grayscale" onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none" }} />
              )}
              <div className="flex items-center justify-between mt-[18px]">
                <span style={{ fontFamily: "var(--font-ui)", fontSize: "12px", fontWeight: 700, letterSpacing: "1px", color: "#888", textTransform: "uppercase" }}>
                  Trending
                </span>
                <div className="w-7 h-7 rounded-full bg-[var(--color-lime)] flex items-center justify-center text-black text-sm">
                  ➜
                </div>
              </div>
              <h2 className="mt-3 group-hover:text-[var(--color-lime)] transition-colors" style={{ fontFamily: "var(--font-serif)", fontSize: "28px", fontWeight: 700, lineHeight: 1.2, color: "white" }}>
                {center.title}
              </h2>
              <p className="mt-[14px] line-clamp-4" style={{ fontFamily: "var(--font-body-serif)", fontSize: "14px", lineHeight: 1.7, color: "#999" }}>
                {center.description}
              </p>
              <div className="flex items-center gap-[10px] mt-5 pt-[14px] border-t border-white/10">
                <div>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: "14px", fontWeight: 700, color: "white" }}>
                    {center.source}
                  </div>
                  <div style={{ fontFamily: "var(--font-ui)", fontSize: "11px", color: "#888" }}>
                    {fmtDate(center.pubDate)}
                  </div>
                </div>
              </div>
            </button>
          )}
        </div>

        {/* ─── RIGHT COLUMN ─── */}
        <div>
          {/* Sidebar articles */}
          <div className="flex flex-col gap-4">
            {[right1, right2, right3, right4, right5].filter(Boolean).map((item, idx) => (
              <button
                key={`r-${idx}`}
                onClick={() => item && setSelectedArticle(item)}
                className="flex gap-3 items-start text-left w-full group cursor-pointer"
              >
                {item?.image && (
                  <img src={item.image} alt="" className="w-[75px] h-[65px] object-cover flex-shrink-0 grayscale" onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none" }} />
                )}
                <div>
                  <h4 className="group-hover:text-[var(--color-lime)] transition-colors" style={{ fontFamily: "var(--font-serif)", fontSize: "14px", fontWeight: 700, lineHeight: 1.3, color: "white" }}>
                    {item?.title}
                  </h4>
                  <p className="mt-1" style={{ fontFamily: "var(--font-ui)", fontSize: "10px", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {item?.pubDate ? fmtDate(item.pubDate) : ""}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* Subscribe box */}
        </div>
      </div>
      </div>

      {/* ══ MORE STORIES GRID ══ */}
      {items.length > 8 && (
        <div className="px-7 pb-8 border-t border-white/10 pt-6">
          <h2 className="mb-5" style={{ fontFamily: "var(--font-ui)", fontSize: "12px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#888" }}>
            More Stories
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-6">
            {items.slice(8).map((item, idx) => (
              <button key={`more-${idx}`} onClick={() => setSelectedArticle(item)} className="text-left w-full group cursor-pointer">
                {item.image && (
                  <img src={item.image} alt="" className="w-full h-[140px] object-cover grayscale mb-3" onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none" }} />
                )}
                <h4 className="group-hover:text-[var(--color-lime)] transition-colors line-clamp-2" style={{ fontFamily: "var(--font-serif)", fontSize: "15px", fontWeight: 700, lineHeight: 1.3, color: "white" }}>
                  {item.title}
                </h4>
                <p className="mt-1.5 line-clamp-2" style={{ fontFamily: "var(--font-body-serif)", fontSize: "12px", lineHeight: 1.5, color: "#888" }}>
                  {item.description}
                </p>
                <p className="mt-1.5" style={{ fontFamily: "var(--font-ui)", fontSize: "10px", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {item.source} · {fmtDate(item.pubDate)}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── ARTICLE DETAIL ─── */
function ArticleDetail({
  article, onBack, fmtDate, relatedItems, onSelect,
}: {
  article: NewsItem; onBack: () => void; fmtDate: (d: string) => string
  relatedItems: NewsItem[]; onSelect: (item: NewsItem) => void
}) {
  const [story, setStory] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [byline, setByline] = useState<string | null>(null)
  const [hiResImage, setHiResImage] = useState<string | null>(null)

  useEffect(() => {
    if (!article.id) { setLoading(false); return }
    fetch(`/api/news/article?id=${article.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.story) setStory(data.story)
        if (data.byline) setByline(data.byline)
        if (data.image) setHiResImage(data.image)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [article.id])

  const heroImage = hiResImage || article.image
  const col1Items = relatedItems.slice(0, 2)
  const col3Items = relatedItems.slice(2, 4)
  const col4Items = relatedItems.slice(4, 6)

  return (
    <div className="px-4 md:px-7 py-7" style={{ background: "#faf5f0", color: "#1a1a1a" }}>
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-2 mb-8 cursor-pointer hover:text-[#c44569] transition-colors" style={{ fontFamily: "var(--font-ui)", fontSize: "12px", fontWeight: 700, letterSpacing: "0.5px", color: "#444", textTransform: "uppercase" }}>
        <ArrowRight className="w-4 h-4 rotate-180" /> Back to Headlines
      </button>

      {/* Section title */}
      <div className="text-center mb-10">
        <h2 className="inline-block pb-2 border-b-[3px] border-[#1a1a1a]" style={{ fontFamily: "var(--font-serif)", fontSize: "28px", fontWeight: 700, color: "#1a1a1a" }}>
          Latest Updates
        </h2>
      </div>

      {/* Mobile: single column article view */}
      <div className="md:hidden">
        <div>
          {heroImage && (
            <img src={heroImage} alt="" className="w-full h-[220px] object-cover grayscale mb-5" />
          )}
          <h2 className="mb-4" style={{ fontFamily: "var(--font-serif)", fontSize: "22px", fontWeight: 700, lineHeight: 1.25, color: "#1a1a1a" }}>
            {article.title}
          </h2>

          {loading ? (
            <div className="space-y-3">
              {[100, 92, 88, 95, 85, 90].map((w, i) => (
                <div key={i} className="h-4 bg-[#ddd] animate-pulse" style={{ width: `${w}%` }} />
              ))}
            </div>
          ) : story ? (
            <div
              className="prose-article-light"
              style={{ fontFamily: "var(--font-body-serif)", fontSize: "14px", lineHeight: 1.7, color: "#333" }}
              dangerouslySetInnerHTML={{ __html: story }}
            />
          ) : (
            <p style={{ fontFamily: "var(--font-body-serif)", fontSize: "14px", lineHeight: 1.7, color: "#333" }}>
              {article.description}
            </p>
          )}

          <div className="flex items-center gap-3 mt-5 pt-4 border-t border-[#ddd]">
            <div>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: "13px", fontWeight: 600, color: "#1a1a1a" }}>
                {byline || article.source}
              </div>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: "11px", color: "#666" }}>
                {fmtDate(article.pubDate)}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <a href={article.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:underline cursor-pointer" style={{ fontFamily: "var(--font-ui)", fontSize: "12px", fontWeight: 700, letterSpacing: "1px", color: "#c44569", textTransform: "uppercase" }}>
              Read on ESPN <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Related stories on mobile */}
        {relatedItems.length > 0 && (
          <div className="mt-8 pt-6 border-t border-[#ddd]">
            <h3 className="mb-4" style={{ fontFamily: "var(--font-ui)", fontSize: "12px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#888" }}>
              More Stories
            </h3>
            <div className="space-y-4">
              {relatedItems.slice(0, 5).map((item, idx) => (
                <button key={`rel-${idx}`} onClick={() => onSelect(item)} className="flex gap-3 items-start text-left w-full group cursor-pointer">
                  {item.image && (
                    <img src={item.image} alt="" className="w-[75px] h-[60px] object-cover flex-shrink-0 grayscale" onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none" }} />
                  )}
                  <div>
                    <h4 className="group-hover:text-[#c44569] transition-colors" style={{ fontFamily: "var(--font-serif)", fontSize: "14px", fontWeight: 700, lineHeight: 1.3, color: "#1a1a1a" }}>
                      {item.title}
                    </h4>
                    <p className="mt-1" style={{ fontFamily: "var(--font-ui)", fontSize: "10px", color: "#666" }}>
                      {item.source} · {fmtDate(item.pubDate)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4-COLUMN GRID — main story takes 2fr */}
      <div className="hidden md:grid gap-9" style={{ gridTemplateColumns: "220px 2fr 1fr 220px", alignItems: "start" }}>

        {/* ─── COL 1: Left sidebar stories ─── */}
        <div>
          {col1Items[0] && (
            <button onClick={() => onSelect(col1Items[0])} className="text-left w-full group cursor-pointer mb-9">
              <h2 className="mb-4 group-hover:text-[#c44569] transition-colors" style={{ fontFamily: "var(--font-serif)", fontSize: "24px", fontWeight: 700, lineHeight: 1.25, color: "#1a1a1a" }}>
                {highlightHeadline(col1Items[0].title, 0)}
              </h2>
              <p style={{ fontFamily: "var(--font-body-serif)", fontSize: "13px", lineHeight: 1.7, color: "#333" }}>
                {col1Items[0].description}
              </p>
              <div className="mt-4" style={{ fontFamily: "var(--font-ui)", fontSize: "12px", color: "#555" }}>
                {col1Items[0].source} · {fmtDate(col1Items[0].pubDate)}
              </div>
            </button>
          )}
          {col1Items[1] && (
            <button onClick={() => onSelect(col1Items[1])} className="text-left w-full group cursor-pointer border-t border-[#ddd] pt-8">
              <h2 className="mb-3 group-hover:text-[#c44569] transition-colors" style={{ fontFamily: "var(--font-serif)", fontSize: "22px", fontWeight: 700, lineHeight: 1.25, color: "#1a1a1a" }}>
                {col1Items[1].title}
              </h2>
              <p style={{ fontFamily: "var(--font-ui)", fontSize: "12px", color: "#555", lineHeight: 1.5 }}>
                By {col1Items[1].source} · {fmtDate(col1Items[1].pubDate)}
              </p>
            </button>
          )}
        </div>

        {/* ─── COL 2: Main article ─── */}
        <div>
          {heroImage && (
            <img src={heroImage} alt="" className="w-full h-[280px] object-cover grayscale mb-5" />
          )}
          <h2 className="mb-4" style={{ fontFamily: "var(--font-serif)", fontSize: "22px", fontWeight: 700, lineHeight: 1.25, color: "#1a1a1a" }}>
            {highlightHeadline(article.title, 3)}
          </h2>

          {loading ? (
            <div className="space-y-3">
              {[100, 92, 88, 95, 85, 90].map((w, i) => (
                <div key={i} className="h-4 bg-[#ddd] animate-pulse" style={{ width: `${w}%` }} />
              ))}
            </div>
          ) : story ? (
            <div
              className="prose-article-light"
              style={{ fontFamily: "var(--font-body-serif)", fontSize: "13px", lineHeight: 1.7, color: "#333" }}
              dangerouslySetInnerHTML={{ __html: story }}
            />
          ) : (
            <p style={{ fontFamily: "var(--font-body-serif)", fontSize: "13px", lineHeight: 1.7, color: "#333" }}>
              {article.description}
            </p>
          )}

          <div className="flex items-center gap-3 mt-5 pt-4 border-t border-[#ddd]">
            <div>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: "13px", fontWeight: 600, color: "#1a1a1a" }}>
                {byline || article.source}
              </div>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: "11px", color: "#666" }}>
                {fmtDate(article.pubDate)}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <a href={article.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:underline cursor-pointer" style={{ fontFamily: "var(--font-ui)", fontSize: "12px", fontWeight: 700, letterSpacing: "1px", color: "#c44569", textTransform: "uppercase" }}>
              Read on ESPN <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* ─── COL 3: Image cards ─── */}
        <div>
          {col3Items.map((item, idx) => (
            <button key={`c3-${idx}`} onClick={() => onSelect(item)} className="text-left w-full group cursor-pointer mb-7">
              {item.image && (
                <img src={item.image} alt="" className="w-full h-[160px] object-cover grayscale mb-3" onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none" }} />
              )}
              <h3 className="mb-2 group-hover:text-[#c44569] transition-colors" style={{ fontFamily: "var(--font-serif)", fontSize: "18px", fontWeight: 700, lineHeight: 1.3, color: "#1a1a1a" }}>
                {item.title}
              </h3>
              <p style={{ fontFamily: "var(--font-ui)", fontSize: "12px", color: "#555" }}>
                By {item.source} · {fmtDate(item.pubDate)}
              </p>
            </button>
          ))}
        </div>

        {/* ─── COL 4: Right sidebar ─── */}
        <div>
          {col4Items[0] && (
            <button onClick={() => onSelect(col4Items[0])} className="text-left w-full group cursor-pointer mb-7">
              <h2 className="mb-3 group-hover:text-[#c44569] transition-colors" style={{ fontFamily: "var(--font-serif)", fontSize: "20px", fontWeight: 700, lineHeight: 1.3, color: "#1a1a1a" }}>
                {col4Items[0].title}
              </h2>
              <p style={{ fontFamily: "var(--font-body-serif)", fontSize: "13px", lineHeight: 1.7, color: "#333" }}>
                {col4Items[0].description}
              </p>
              <div className="mt-3" style={{ fontFamily: "var(--font-ui)", fontSize: "12px", color: "#555" }}>
                {col4Items[0].source} · {fmtDate(col4Items[0].pubDate)}
              </div>
            </button>
          )}
          {col4Items[1] && (
            <button onClick={() => onSelect(col4Items[1])} className="text-left w-full group cursor-pointer border-t border-[#ddd] pt-6">
              <h2 className="mb-3 group-hover:text-[#c44569] transition-colors" style={{ fontFamily: "var(--font-serif)", fontSize: "20px", fontWeight: 700, lineHeight: 1.3, color: "#1a1a1a" }}>
                {col4Items[1].title}
              </h2>
              <p style={{ fontFamily: "var(--font-body-serif)", fontSize: "13px", lineHeight: 1.7, color: "#333" }}>
                {col4Items[1].description}
              </p>
              <div className="mt-3" style={{ fontFamily: "var(--font-ui)", fontSize: "12px", color: "#555" }}>
                {col4Items[1].source} · {fmtDate(col4Items[1].pubDate)}
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
