import type { Metadata } from "next"
import Link from "next/link"
import { JsonLd } from "@/components/seo/JsonLd"

export const metadata: Metadata = {
  title: "Blog — Lasyly",
  description:
    "Sports betting tips, prop analytics guides, and community insights from the Lasyly team. Learn how to bet smarter with data.",
  openGraph: {
    title: "Blog — Lasyly",
    description:
      "Sports betting tips, prop analytics guides, and community insights from the Lasyly team.",
    type: "website",
  },
}

const posts = [
  {
    slug: "why-share-your-betslip",
    category: "Community",
    date: "May 24, 2026",
    readTime: "6 min read",
    title: "Why You Should Share Your Betslip (Even When You Lose)",
    excerpt:
      "Sharing your betslip publicly isn't just about bragging rights. It builds your track record, sharpens your thinking, and turns a solo hobby into a competitive edge.",
    accent: "var(--color-lime)",
  },
  {
    slug: "how-to-read-prop-analytics",
    category: "Analytics",
    date: "May 22, 2026",
    readTime: "8 min read",
    title: "How to Read Prop Analytics: Hit Rates, Matchup Grades, and Confidence Scores Explained",
    excerpt:
      "Lasyly surfaces a lot of numbers on every player card. Here's what each metric actually means and how to combine them to find high-value props.",
    accent: "#6C63FF",
  },
  {
    slug: "nba-player-props-guide",
    category: "NBA",
    date: "May 20, 2026",
    readTime: "10 min read",
    title: "The Complete Guide to NBA Player Props in 2026",
    excerpt:
      "Points, rebounds, assists, 3-pointers, and beyond. A deep dive into how to approach NBA player props — from reading defensive matchups to spotting line value.",
    accent: "#F59E0B",
  },
]

export default function BlogIndexPage() {
  const baseUrl = "https://lasyly.me"
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Blog",
        "name": "Lasyly Blog",
        "url": `${baseUrl}/blog`,
        "description": "Sports betting tips, prop analytics guides, and community insights from the Lasyly team.",
        "publisher": {
          "@type": "Organization",
          "name": "Lasyly",
          "url": baseUrl,
          "logo": { "@type": "ImageObject", "url": `${baseUrl}/lasyly_logo.png` },
        },
        "blogPost": posts.map((p) => ({
          "@type": "BlogPosting",
          "headline": p.title,
          "description": p.excerpt,
          "url": `${baseUrl}/blog/${p.slug}`,
          "datePublished": p.date,
        })),
      }} />
      {/* Header */}
      <div className="mb-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-lime)] mb-3">
          Lasyly Journal
        </p>
        <h1 className="text-5xl md:text-6xl font-bold font-serif tracking-tight text-white leading-none mb-6">
          The Blog
        </h1>
        <p className="text-lg text-[var(--color-text-muted)] max-w-xl leading-relaxed">
          Tips, guides, and honest takes on sports betting, prop analytics, and building smarter habits as a bettor.
        </p>
      </div>

      {/* Featured post */}
      <Link
        href={`/blog/${posts[0].slug}`}
        className="group block mb-12 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-white/15 transition-colors overflow-hidden"
      >
        <div className="p-8 md:p-12">
          <div className="flex items-center gap-3 mb-6">
            <span
              className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
              style={{ background: `${posts[0].accent}20`, color: posts[0].accent }}
            >
              {posts[0].category}
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">{posts[0].date}</span>
            <span className="text-xs text-[var(--color-text-muted)]">·</span>
            <span className="text-xs text-[var(--color-text-muted)]">{posts[0].readTime}</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold font-serif tracking-tight text-white leading-tight mb-4 group-hover:text-[var(--color-lime)] transition-colors">
            {posts[0].title}
          </h2>
          <p className="text-base text-[var(--color-text-muted)] leading-relaxed max-w-2xl">
            {posts[0].excerpt}
          </p>
          <div className="mt-6 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-lime)]">
            Read post
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="group-hover:translate-x-0.5 transition-transform">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </Link>

      {/* Post grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {posts.slice(1).map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group block rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-white/15 transition-colors p-7"
          >
            <div className="flex items-center gap-3 mb-4">
              <span
                className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                style={{ background: `${post.accent}20`, color: post.accent }}
              >
                {post.category}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">{post.readTime}</span>
            </div>
            <h2 className="text-xl font-bold font-serif tracking-tight text-white leading-tight mb-3 group-hover:text-[var(--color-lime)] transition-colors">
              {post.title}
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{post.excerpt}</p>
            <div className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-lime)]">
              Read post
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="group-hover:translate-x-0.5 transition-transform">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </Link>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-20 rounded-2xl border border-[var(--color-lime)]/20 bg-[var(--color-lime)]/5 p-8 md:p-12 text-center">
        <h2 className="text-3xl font-bold font-serif text-white mb-3">
          Ready to bet smarter?
        </h2>
        <p className="text-[var(--color-text-muted)] mb-6 max-w-md mx-auto">
          Join the platform where data meets community. Free to use — always.
        </p>
        <Link
          href="/signup"
          className="inline-block bg-[var(--color-lime)] text-black font-bold text-sm px-6 py-3 rounded-full hover:opacity-90 transition-opacity"
        >
          Create free account →
        </Link>
      </div>
    </div>
  )
}
