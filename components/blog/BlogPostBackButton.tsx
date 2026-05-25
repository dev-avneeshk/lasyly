"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

interface BlogPostBackButtonProps {
  /** Shown in the breadcrumb trail when coming directly (not from news). */
  sport: string
}

/**
 * Context-aware back navigation for blog posts.
 *
 * - Arrived via the news section (?from=news):
 *   Shows "← Back to News" linking to /news
 *
 * - Arrived directly (Google, blog index, share link, etc.):
 *   Shows the normal breadcrumb "Blog / [sport]"
 */
export default function BlogPostBackButton({ sport }: BlogPostBackButtonProps) {
  return (
    <Suspense fallback={
      // Static fallback while searchParams resolves — renders the breadcrumb
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-10">
        <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
        <span>/</span>
        <span>{sport}</span>
      </div>
    }>
      <BackButtonInner sport={sport} />
    </Suspense>
  )
}

function BackButtonInner({ sport }: BlogPostBackButtonProps) {
  const searchParams = useSearchParams()
  const fromNews = searchParams.get("from") === "news"

  if (fromNews) {
    return (
      <div className="mb-10">
        <Link
          href="/news"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-white transition-colors group"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            className="group-hover:-translate-x-0.5 transition-transform"
          >
            <path
              d="M13 8H3M7 12l-4-4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to News
        </Link>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-10">
      <Link href="/blog" className="hover:text-white transition-colors">
        Blog
      </Link>
      <span>/</span>
      <span>{sport}</span>
    </div>
  )
}
