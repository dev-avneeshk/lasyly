"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
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
  const router = useRouter()
  const [items, setItems] = useState<NewsItem[]>(initialItems ?? [])
  const [loading, setLoading] = useState(!initialItems || initialItems.length === 0)
  const [selectedArticle, setSelectedArticle] = useState<NewsItem | null>(null)
  // Track whether we've already used the SSR-provided initialItems for the
  // current category, so a subsequent category change still triggers a fetch.
  const initialCategoryRef = useState(category ?? null)[0]

  /**
   * Navigate to a blog post when the news item has a linked blog slug,
   * otherwise open the in-feed ESPN article detail.
   */
  const handleItemClick = useCallback(
    (item: NewsItem) => {
      if (item.linkedBlogSlug) {
        router.push(`/blog/${item.linkedBlogSlug}?from=news`)
      } else {
        setSelectedArticle(item)
      }
    },
    [router]
  )

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
        onSelect={(item) => handleItemClick(item)}
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
            <button onClick={() => handleItemClick(left1)} className="text-left w-full group cursor-pointer mb-6">
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
            <button onClick={() => handleItemClick(center)} className="text-left w-full group cursor-pointer mb-6 pt-6 border-t border-white/10">
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
            <button onClick={() => handleItemClick(left2)} className="text-left w-full group cursor-pointer mb-6 pt-6 border-t border-white/10">
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
              onClick={() => item && handleItemClick(item)}
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
            <button onClick={() => handleItemClick(left1)} className="text-left w-full group cursor-pointer">
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
            <button onClick={() => handleItemClick(left2)} className="text-left w-full group cursor-pointer mt-6 pt-5 border-t border-white/10">
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
            <button onClick={() => handleItemClick(center)} className="text-left w-full group cursor-pointer">
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
                onClick={() => item && handleItemClick(item)}
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
              <button key={`more-${idx}`} onClick={() => handleItemClick(item)} className="text-left w-full group cursor-pointer">
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
  const sidebarItems = relatedItems.slice(0, 5)
  const bottomItems = relatedItems.slice(5, 11)

  return (
    <div style={{ background: "var(--color-background)", color: "var(--color-text-primary)", minHeight: "100vh" }}>

      {/* ── ARTICLE MASTHEAD ── */}
      <div className="border-b border-white/10 px-4 md:px-7 py-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 transition-colors hover:text-[var(--color-lime)]"
          style={{ fontFamily: "var(--font-ui)", fontSize: "11px", fontWeight: 700, letterSpacing: "1px", color: "#666", textTransform: "uppercase" }}
        >
          <ArrowRight className="w-3.5 h-3.5 rotate-180" />
          Back to Headlines
        </button>

        {/* Category pill */}
        <span
          className="px-3 py-1 border border-white/20 rounded-full"
          style={{ fontFamily: "var(--font-ui)", fontSize: "11px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--color-lime)" }}
        >
          {article.category || article.source}
        </span>
      </div>

      {/* ── MAIN CONTENT: article + sidebar ── */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-0 md:gap-0">

        {/* ─── LEFT: FEATURED ARTICLE ─── */}
        <article className="px-4 md:px-8 py-7 md:border-r border-white/10">

          {/* Hero image */}
          {heroImage && (
            <div className="w-full mb-6 overflow-hidden" style={{ maxHeight: "480px" }}>
              <img
                src={heroImage}
                alt=""
                className="w-full object-cover grayscale"
                style={{ maxHeight: "480px", objectPosition: "top" }}
                onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none" }}
              />
            </div>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-4 mb-5">
            <span
              className="px-3 py-1 border border-white/20 rounded-full"
              style={{ fontFamily: "var(--font-ui)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", color: "white" }}
            >
              {article.category || "Sports"}
            </span>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: "12px", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {fmtDate(article.pubDate)}
            </span>
          </div>

          {/* Headline */}
          <h1
            className="mb-5"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(22px, 3.5vw, 38px)",
              fontWeight: 400,
              lineHeight: 1.15,
              color: "white",
              letterSpacing: "-0.01em",
            }}
          >
            {highlightHeadline(article.title, 2)}
          </h1>

          {/* Byline */}
          <div className="flex items-center gap-2 mb-7 pb-6 border-b border-white/10">
            <span style={{ color: "var(--color-lime)", fontSize: "10px" }}>✦</span>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: "13px", color: "#888" }}>
              {byline || article.source}
            </span>
          </div>

          {/* Article body */}
          {loading ? (
            <div className="space-y-4">
              {[100, 92, 96, 88, 95, 82, 90, 85].map((w, i) => (
                <div
                  key={i}
                  className="h-4 animate-pulse rounded"
                  style={{ width: `${w}%`, background: "rgba(255,255,255,0.07)" }}
                />
              ))}
            </div>
          ) : story ? (
            <div
              className="prose-article"
              style={{ fontFamily: "var(--font-body-serif)", fontSize: "15px", lineHeight: 1.85, color: "#ccc" }}
              dangerouslySetInnerHTML={{ __html: story }}
            />
          ) : (
            /* Fallback: description as a pull-quote style block */
            <div>
              <p style={{ fontFamily: "var(--font-body-serif)", fontSize: "16px", lineHeight: 1.85, color: "#bbb" }}>
                {article.description}
              </p>
              {/* Decorative pull quote */}
              <blockquote
                className="my-8 pl-5"
                style={{
                  borderLeft: "3px solid var(--color-lime)",
                  fontFamily: "var(--font-serif)",
                  fontStyle: "italic",
                  fontSize: "18px",
                  lineHeight: 1.5,
                  color: "white",
                }}
              >
                {article.description?.slice(0, 120)}{article.description && article.description.length > 120 ? "…" : ""}
              </blockquote>
            </div>
          )}

          {/* Footer: source + read more */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/10">
            <div>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: "13px", fontWeight: 600, color: "white" }}>
                {byline || article.source}
              </div>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: "11px", color: "#666", marginTop: "2px" }}>
                {fmtDate(article.pubDate)}
              </div>
            </div>
            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 transition-opacity hover:opacity-70"
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "1px",
                color: "var(--color-lime)",
                textTransform: "uppercase",
              }}
            >
              Read Full Story <ArrowRight className="w-3 h-3" />
            </a>
          </div>
        </article>

        {/* ─── RIGHT: LATEST SIDEBAR ─── */}
        <aside className="px-4 md:px-6 py-7">
          <h2
            className="mb-6 pb-3 border-b border-white/10"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "22px",
              fontWeight: 700,
              color: "white",
              textTransform: "uppercase",
              letterSpacing: "0.02em",
            }}
          >
            Latest
          </h2>

          <div className="flex flex-col">
            {sidebarItems.map((item, idx) => (
              <button
                key={`sb-${idx}`}
                onClick={() => onSelect(item)}
                className="text-left w-full group pb-5 mb-5 border-b border-white/10 last:border-0 last:mb-0 last:pb-0"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className="px-2 py-0.5 border border-white/15 rounded-full"
                    style={{ fontFamily: "var(--font-ui)", fontSize: "10px", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", color: "#aaa" }}
                  >
                    {item.category || item.source.slice(0, 8)}
                  </span>
                  <span style={{ fontFamily: "var(--font-ui)", fontSize: "10px", color: "#555", textTransform: "uppercase", letterSpacing: "0.3px" }}>
                    {fmtDate(item.pubDate)}
                  </span>
                </div>
                <h3
                  className="group-hover:text-[var(--color-lime)] transition-colors"
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "14px",
                    fontWeight: 700,
                    lineHeight: 1.35,
                    color: "white",
                    textTransform: "uppercase",
                    letterSpacing: "0.01em",
                  }}
                >
                  {item.title}
                </h3>
              </button>
            ))}
          </div>
        </aside>
      </div>

      {/* ── BOTTOM: MORE STORIES GRID ── */}
      {bottomItems.length > 0 && (
        <div className="px-4 md:px-7 py-8 border-t border-white/10">
          <h2
            className="mb-6"
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: "#666",
            }}
          >
            More Stories
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-7 gap-y-7">
            {bottomItems.map((item, idx) => (
              <button
                key={`btm-${idx}`}
                onClick={() => onSelect(item)}
                className="text-left w-full group"
              >
                {item.image && (
                  <div className="w-full mb-4 overflow-hidden" style={{ aspectRatio: "4/3" }}>
                    <img
                      src={item.image}
                      alt=""
                      className="w-full h-full object-cover grayscale group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none" }}
                    />
                  </div>
                )}
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className="px-2 py-0.5 border border-white/15 rounded-full"
                    style={{ fontFamily: "var(--font-ui)", fontSize: "10px", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", color: "#aaa" }}
                  >
                    {item.category || item.source.slice(0, 8)}
                  </span>
                  <span style={{ fontFamily: "var(--font-ui)", fontSize: "10px", color: "#555", textTransform: "uppercase", letterSpacing: "0.3px" }}>
                    {fmtDate(item.pubDate)}
                  </span>
                </div>
                <h3
                  className="mb-3 group-hover:text-[var(--color-lime)] transition-colors"
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "15px",
                    fontWeight: 700,
                    lineHeight: 1.3,
                    color: "white",
                    textTransform: "uppercase",
                    letterSpacing: "0.01em",
                  }}
                >
                  {item.title}
                </h3>
                <div className="flex items-center gap-2">
                  <span style={{ color: "var(--color-lime)", fontSize: "9px" }}>✦</span>
                  <span style={{ fontFamily: "var(--font-ui)", fontSize: "11px", color: "#666" }}>
                    {item.source}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
