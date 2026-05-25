"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import type { NewsItem } from "@/types/news"
import { useNewsTheme, useNewsGrayscale } from "@/app/(app)/news/NewsClient"

interface NewsFeedProps {
  category?: string | null
  initialItems?: NewsItem[]
}

function useThemeColors() {
  const theme = useNewsTheme()
  const d = theme === "dark"
  return {
    bg: d ? "#0a0b0f" : "#f5f0e8",
    surface: d ? "#111318" : "#ebe5d9",
    border: d ? "rgba(255,255,255,0.1)" : "#d4c9b0",
    headline: d ? "#ffffff" : "#1a1a1a",
    body: d ? "#c8ccd4" : "#3d352c",
    muted: d ? "#9ca3af" : "#6b5e4f",
    accent: d ? "#D4FF00" : "#8b4513",
    tickerBg: d ? "rgba(212,255,0,0.06)" : "#ebe5d9",
    tickerBorder: d ? "rgba(212,255,0,0.15)" : "#d4c9b0",
    badgeBg: d ? "#D4FF00" : "#1a1a1a",
    badgeText: d ? "#000000" : "#f5f0e8",
  }
}

export default function NewsFeed({ category, initialItems }: NewsFeedProps) {
  const router = useRouter()
  const theme = useNewsTheme()
  const c = useThemeColors()
  const grayscale = useNewsGrayscale()
  const imgStyle = grayscale ? { filter: "grayscale(1)" } : undefined
  const [items, setItems] = useState<NewsItem[]>(initialItems ?? [])
  const [loading, setLoading] = useState(!initialItems || initialItems.length === 0)
  const [selectedArticle, setSelectedArticle] = useState<NewsItem | null>(null)
  const initialCategoryRef = useState(category ?? null)[0]

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
    return <div className="h-[400px] animate-pulse" style={{ background: c.surface }} />
  }

  if (items.length === 0) {
    return <p className="text-center py-10 text-sm" style={{ fontFamily: "var(--font-body-serif)", color: c.muted }}>No news available.</p>
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
    <div style={{ background: c.bg }}>
      {/* Masthead */}
      <header className="text-center py-6" style={{ borderBottom: `1px solid ${c.border}` }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "32px", fontWeight: 400, letterSpacing: "6px", textTransform: "uppercase", color: c.headline }}>
          LASYLY DAILY
        </h1>
        <p style={{ fontFamily: "var(--font-body-serif)", fontSize: "13px", color: c.muted, marginTop: "4px", fontStyle: "italic" }}>
          Sports News · Picks · Community
        </p>
      </header>

      {/* Ticker */}
      <div className="overflow-hidden py-2.5 relative" style={{ background: c.tickerBg, borderTop: `1px solid ${c.tickerBorder}`, borderBottom: `1px solid ${c.tickerBorder}` }}>
        <div className="flex items-center gap-0 animate-marquee whitespace-nowrap" style={{ width: "max-content" }}>
          {[...ticker, ...ticker].map((item, idx) => (
            <div key={`tick-${idx}`} className="flex items-center gap-2 px-5" style={{ borderLeft: idx === 0 ? "none" : `1px solid ${c.tickerBorder}`, fontFamily: "var(--font-body-serif)", fontSize: "13px", fontWeight: 700, color: c.headline }}>
              {item.title.slice(0, 35)}{item.title.length > 35 ? "\u2026" : ""}
              <span className="px-2 py-0.5 text-[11px] font-bold rounded-sm" style={{ background: c.badgeBg, color: c.badgeText, fontFamily: "var(--font-ui)" }}>
                {item.source.slice(0, 3).toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3-Column Content */}
      <div className="py-8 px-4 md:px-7">
        {/* Mobile */}
        <div className="md:hidden space-y-6">
          {left1 && (
            <button onClick={() => handleItemClick(left1)} className="text-left w-full group cursor-pointer">
              {left1.image && <img style={imgStyle} src={left1.image} alt="" loading="eager" className="w-full h-[200px] object-cover mb-4 rounded-sm" onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none" }} />}
              <h2 className="mb-2" style={{ fontFamily: "var(--font-serif)", fontSize: "22px", fontWeight: 700, lineHeight: 1.25, color: c.headline }}>{left1.title}</h2>
              <p className="line-clamp-3" style={{ fontFamily: "var(--font-body-serif)", fontSize: "15px", lineHeight: 1.7, color: c.body }}>{left1.description}</p>
              <span className="inline-block mt-3" style={{ fontFamily: "var(--font-ui)", fontSize: "13px", fontWeight: 700, color: c.accent }}>Read more →</span>
            </button>
          )}
          {[center, left2, right1, right2, right3, right4, right5].filter(Boolean).map((item, idx) => (
            <button key={`m-${idx}`} onClick={() => item && handleItemClick(item)} className="flex gap-4 items-start text-left w-full group cursor-pointer pt-5" style={{ borderTop: `1px solid ${c.border}` }}>
              {item?.image && <img style={imgStyle} src={item.image} alt="" loading="lazy" className="w-[90px] h-[70px] object-cover shrink-0 rounded-sm" onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none" }} />}
              <div>
                <h4 style={{ fontFamily: "var(--font-serif)", fontSize: "16px", fontWeight: 700, lineHeight: 1.3, color: c.headline }}>{item?.title}</h4>
                <p className="mt-1.5" style={{ fontFamily: "var(--font-ui)", fontSize: "12px", color: c.muted }}>{item?.source} · {item?.pubDate ? fmtDate(item.pubDate) : ""}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Desktop */}
        <div className="hidden md:grid gap-8" style={{ gridTemplateColumns: "300px 1fr 280px" }}>
          {/* Left */}
          <div>
            {left1 && (
              <button onClick={() => handleItemClick(left1)} className="text-left w-full group cursor-pointer">
                <h2 className="mb-4" style={{ fontFamily: "var(--font-serif)", fontSize: "22px", fontWeight: 700, lineHeight: 1.25, color: c.headline }}>{left1.title}</h2>
                <div className="flex gap-4">
                  {left1.image && <img style={imgStyle} src={left1.image} alt="" loading="lazy" className="w-[130px] h-[160px] object-cover shrink-0 rounded-sm" onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none" }} />}
                  <p style={{ fontFamily: "var(--font-body-serif)", fontSize: "14px", lineHeight: 1.7, color: c.body }}>{left1.description}</p>
                </div>
                <span className="inline-block mt-4" style={{ fontFamily: "var(--font-ui)", fontSize: "13px", fontWeight: 700, color: c.accent }}>Read more →</span>
              </button>
            )}
            {left2 && (
              <button onClick={() => handleItemClick(left2)} className="text-left w-full group cursor-pointer mt-8 pt-6" style={{ borderTop: `1px solid ${c.border}` }}>
                <div className="flex gap-4 items-start">
                  {left2.image && <img style={imgStyle} src={left2.image} alt="" loading="lazy" className="w-[100px] h-[90px] object-cover shrink-0 rounded-sm" onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none" }} />}
                  <div>
                    <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "18px", fontWeight: 700, lineHeight: 1.25, color: c.headline }}>{left2.title}</h3>
                    <p className="mt-2" style={{ fontFamily: "var(--font-ui)", fontSize: "13px", color: c.muted }}>{fmtDate(left2.pubDate)}</p>
                  </div>
                </div>
                <p className="mt-3 line-clamp-3" style={{ fontFamily: "var(--font-body-serif)", fontSize: "14px", lineHeight: 1.7, color: c.body }}>{left2.description}</p>
              </button>
            )}
          </div>

          {/* Center */}
          <div className="px-4" style={{ borderLeft: `1px solid ${c.border}`, borderRight: `1px solid ${c.border}` }}>
            {center && (
              <button onClick={() => handleItemClick(center)} className="text-left w-full group cursor-pointer">
                {center.image && <img style={imgStyle} src={center.image} alt="" loading="eager" className="w-full h-[300px] object-cover rounded-sm" onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none" }} />}
                <p className="mt-4" style={{ fontFamily: "var(--font-ui)", fontSize: "12px", fontWeight: 700, letterSpacing: "1px", color: c.muted, textTransform: "uppercase" }}>Trending</p>
                <h2 className="mt-2" style={{ fontFamily: "var(--font-serif)", fontSize: "28px", fontWeight: 700, lineHeight: 1.2, color: c.headline }}>{center.title}</h2>
                <p className="mt-4 line-clamp-4" style={{ fontFamily: "var(--font-body-serif)", fontSize: "16px", lineHeight: 1.75, color: c.body }}>{center.description}</p>
                <div className="mt-5 pt-4 flex items-center justify-between" style={{ borderTop: `1px solid ${c.border}` }}>
                  <span style={{ fontFamily: "var(--font-ui)", fontSize: "13px", color: c.muted }}>{center.source} · {fmtDate(center.pubDate)}</span>
                  <span style={{ fontFamily: "var(--font-ui)", fontSize: "13px", fontWeight: 700, color: c.accent }}>Read →</span>
                </div>
              </button>
            )}
          </div>

          {/* Right */}
          <div className="space-y-5">
            {[right1, right2, right3, right4, right5].filter(Boolean).map((item, idx) => (
              <button key={`r-${idx}`} onClick={() => item && handleItemClick(item)} className="flex gap-3 items-start text-left w-full group cursor-pointer pb-5" style={{ borderBottom: `1px solid ${c.border}` }}>
                {item?.image && <img style={imgStyle} src={item.image} alt="" loading="lazy" className="w-[75px] h-[62px] object-cover shrink-0 rounded-sm" onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none" }} />}
                <div>
                  <h4 style={{ fontFamily: "var(--font-serif)", fontSize: "15px", fontWeight: 700, lineHeight: 1.35, color: c.headline }}>{item?.title}</h4>
                  <p className="mt-1.5" style={{ fontFamily: "var(--font-ui)", fontSize: "12px", color: c.muted }}>{item?.source} · {item?.pubDate ? fmtDate(item.pubDate) : ""}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* More Stories */}
      {items.length > 8 && (
        <div className="px-4 md:px-7 pb-10 pt-8" style={{ borderTop: `1px solid ${c.border}` }}>
          <h2 className="mb-6" style={{ fontFamily: "var(--font-ui)", fontSize: "13px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: c.muted }}>More Stories</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">
            {items.slice(8).map((item, idx) => (
              <button key={`more-${idx}`} onClick={() => handleItemClick(item)} className="text-left w-full group cursor-pointer">
                {item.image && <img style={imgStyle} src={item.image} alt="" loading="lazy" className="w-full h-[150px] object-cover mb-3 rounded-sm" onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none" }} />}
                <h4 className="line-clamp-2" style={{ fontFamily: "var(--font-serif)", fontSize: "16px", fontWeight: 700, lineHeight: 1.35, color: c.headline }}>{item.title}</h4>
                <p className="mt-2 line-clamp-2" style={{ fontFamily: "var(--font-body-serif)", fontSize: "14px", lineHeight: 1.6, color: c.body }}>{item.description}</p>
                <p className="mt-2" style={{ fontFamily: "var(--font-ui)", fontSize: "12px", color: c.muted }}>{item.source} · {fmtDate(item.pubDate)}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* Article Detail */
function ArticleDetail({ article, onBack, fmtDate, relatedItems, onSelect }: {
  article: NewsItem; onBack: () => void; fmtDate: (d: string) => string; relatedItems: NewsItem[]; onSelect: (item: NewsItem) => void
}) {
  const theme = useNewsTheme()
  const c = useThemeColors()
  const grayscale = useNewsGrayscale()
  const imgStyle = grayscale ? { filter: "grayscale(1)" } : undefined
  const [story, setStory] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [byline, setByline] = useState<string | null>(null)
  const [hiResImage, setHiResImage] = useState<string | null>(null)

  useEffect(() => {
    if (!article.id) { setLoading(false); return }
    fetch(`/api/news/article?id=${article.id}`)
      .then((r) => r.json())
      .then((data) => { if (data.story) setStory(data.story); if (data.byline) setByline(data.byline); if (data.image) setHiResImage(data.image) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [article.id])

  const heroImage = hiResImage || article.image
  const sidebarItems = relatedItems.slice(0, 5)

  return (
    <div style={{ background: c.bg, color: c.headline, minHeight: "100vh" }}>
      {/* Back bar */}
      <div className="px-4 md:px-7 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${c.border}` }}>
        <button onClick={onBack} className="flex items-center gap-2 transition-opacity hover:opacity-70" style={{ fontFamily: "var(--font-ui)", fontSize: "12px", fontWeight: 700, letterSpacing: "0.5px", color: c.muted, textTransform: "uppercase" }}>
          <ArrowRight className="w-3.5 h-3.5 rotate-180" /> Back to Headlines
        </button>
        <span className="px-3 py-1 rounded-full" style={{ border: `1px solid ${c.border}`, fontFamily: "var(--font-ui)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: c.accent }}>
          {article.category || article.source}
        </span>
      </div>

      {/* Article + sidebar */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_280px]">
        <article className="px-4 md:px-8 py-8" style={{ borderRight: `1px solid ${c.border}` }}>
          {heroImage && <img style={imgStyle} src={heroImage} alt="" loading="eager" className="w-full max-h-[420px] object-cover mb-6 rounded-sm" onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none" }} />}
          <h1 className="mb-5" style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 700, lineHeight: 1.2, color: c.headline }}>{article.title}</h1>
          <div className="flex items-center gap-3 mb-6 pb-5" style={{ borderBottom: `1px solid ${c.border}` }}>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: "13px", color: c.muted }}>{byline || article.source}</span>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: "13px", color: c.muted }}>·</span>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: "13px", color: c.muted }}>{fmtDate(article.pubDate)}</span>
          </div>

          {loading ? (
            <div className="space-y-4">{[100, 92, 96, 88, 95].map((w, i) => (<div key={i} className="h-4 animate-pulse rounded" style={{ width: `${w}%`, background: c.surface }} />))}</div>
          ) : story ? (
            <div className={theme === "dark" ? "prose-article" : "prose-article-light"} style={{ fontFamily: "var(--font-body-serif)", fontSize: "16px", lineHeight: 1.85, color: c.body }} dangerouslySetInnerHTML={{ __html: story }} />
          ) : (
            <p style={{ fontFamily: "var(--font-body-serif)", fontSize: "16px", lineHeight: 1.85, color: c.body }}>{article.description}</p>
          )}

          <div className="mt-8 pt-5 flex items-center justify-between" style={{ borderTop: `1px solid ${c.border}` }}>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: "13px", color: c.muted }}>{byline || article.source}</span>
            <a href={article.link} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "var(--font-ui)", fontSize: "12px", fontWeight: 700, color: c.accent, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Read Full Story →
            </a>
          </div>
        </article>

        {/* Sidebar */}
        <aside className="px-4 md:px-5 py-8">
          <h2 className="mb-5 pb-3" style={{ borderBottom: `1px solid ${c.border}`, fontFamily: "var(--font-ui)", fontSize: "12px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: c.muted }}>Latest</h2>
          <div className="space-y-4">
            {sidebarItems.map((item, idx) => (
              <button key={`sb-${idx}`} onClick={() => onSelect(item)} className="text-left w-full group pb-4" style={{ borderBottom: `1px solid ${c.border}` }}>
                <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "15px", fontWeight: 700, lineHeight: 1.35, color: c.headline }}>{item.title}</h3>
                <p className="mt-1.5" style={{ fontFamily: "var(--font-ui)", fontSize: "12px", color: c.muted }}>{item.source} · {fmtDate(item.pubDate)}</p>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}
