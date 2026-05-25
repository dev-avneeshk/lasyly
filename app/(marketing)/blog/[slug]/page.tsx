import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { JsonLd } from "@/components/seo/JsonLd"
import BlogPostBackButton from "@/components/blog/BlogPostBackButton"

const BASE_URL = "https://lasyly.me"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BlogPost {
  id: string
  slug: string
  title: string
  excerpt: string
  content: string
  category: string
  accent: string
  read_time: string
  sport: string | null
  tags: string[]
  seo_title: string | null
  seo_description: string | null
  canonical_url: string | null
  keywords: string[] | null
  author: string
  published_at: string
}

// ---------------------------------------------------------------------------
// Static params — tells Next.js which slugs exist at build time.
// At runtime, any slug not in this list is fetched on-demand (ISR).
// Uses the admin client (service role key) — no cookies, safe at build time.
// ---------------------------------------------------------------------------

export async function generateStaticParams() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("blog_posts")
    .select("slug")
    .eq("published", true)
    .order("published_at", { ascending: false })
    .limit(100)

  return (data ?? []).map((row: { slug: string }) => ({ slug: row.slug }))
}

// ---------------------------------------------------------------------------
// Dynamic metadata per post
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data: post } = await supabase
    .from("blog_posts")
    .select("title, excerpt, seo_title, seo_description, canonical_url, published_at, slug")
    .eq("slug", slug)
    .eq("published", true)
    .single()

  if (!post) return {}

  const title = post.seo_title ?? `${post.title} — Lasyly`
  const description = post.seo_description ?? post.excerpt
  const canonical = post.canonical_url ?? `${BASE_URL}/blog/${post.slug}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime: post.published_at,
    },
    alternates: { canonical },
  }
}

// Revalidate pages every 60 seconds so new posts appear without a redeploy
export const revalidate = 60

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function DynamicBlogPost({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: post } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .single<BlogPost>()

  if (!post) notFound()

  // Fetch 3 related posts for the sidebar (same sport, exclude current)
  const { data: related } = await supabase
    .from("blog_posts")
    .select("slug, title, category")
    .eq("published", true)
    .neq("slug", post.slug)
    .eq("sport", post.sport ?? "")
    .order("published_at", { ascending: false })
    .limit(3)

  const canonical = post.canonical_url ?? `${BASE_URL}/blog/${post.slug}`
  const displayDate = new Date(post.published_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          headline: post.title,
          description: post.seo_description ?? post.excerpt,
          datePublished: post.published_at,
          dateModified: post.published_at,
          author: { "@type": "Organization", name: "Lasyly", url: BASE_URL },
          publisher: {
            "@type": "Organization",
            name: "Lasyly",
            url: BASE_URL,
            logo: { "@type": "ImageObject", url: `${BASE_URL}/lasyly_logo.png` },
          },
          url: canonical,
          mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
          keywords: post.keywords ?? post.tags,
        }}
      />

      <div className="max-w-2xl">
        {/* Back navigation — context-aware */}
        <BlogPostBackButton sport={post.sport ?? post.category} />

        {/* Header */}
        <div className="mb-12">
          <span
            className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
            style={{
              background: `${post.accent}20`,
              color: post.accent,
            }}
          >
            {post.category}
          </span>
          <h1 className="text-4xl md:text-5xl font-bold font-serif tracking-tight text-white leading-tight mt-5 mb-4">
            {post.title}
          </h1>
          <div className="flex items-center gap-3 text-sm text-[var(--color-text-muted)]">
            <span>{displayDate}</span>
            <span>·</span>
            <span>{post.read_time}</span>
            <span>·</span>
            <span>{post.author}</span>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr_280px] gap-16 items-start">
        {/* Article — content is stored as HTML */}
        <article
          className="prose prose-invert prose-lg max-w-none
            prose-headings:font-serif prose-headings:font-bold prose-headings:tracking-tight
            prose-p:text-[var(--color-text-muted)] prose-p:leading-relaxed
            prose-li:text-[var(--color-text-muted)]
            prose-strong:text-white
            prose-a:text-[var(--color-lime)] prose-a:no-underline hover:prose-a:underline
            prose-table:text-sm prose-th:text-[var(--color-text-muted)] prose-td:text-white/80
          "
          // Content is authored HTML — only admin-controlled, no user input
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Sidebar */}
        <aside className="hidden md:flex flex-col gap-6 sticky top-24">
          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-3">
                Tags
              </p>
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2.5 py-1 rounded-full bg-white/5 text-white/60"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Related posts */}
          {related && related.length > 0 && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-3">
                More {post.sport ?? "posts"}
              </p>
              <ul className="space-y-3">
                {related.map((r: { slug: string; title: string; category: string }) => (
                  <li key={r.slug}>
                    <Link
                      href={`/blog/${r.slug}`}
                      className="text-sm text-white/80 hover:text-white transition-colors block leading-snug"
                    >
                      {r.category} {r.title} →
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* CTA */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
              Track props on Lasyly
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mb-3">
              Hit rates, matchup grades, and confidence scores. Free.
            </p>
            <Link
              href="/analysis"
              className="block text-center bg-[var(--color-lime)] text-black font-bold text-xs px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
            >
              View player props →
            </Link>
          </div>

          <Link
            href="/signup"
            className="block text-center bg-white/5 border border-[var(--color-border)] text-white font-bold text-sm px-5 py-3 rounded-xl hover:bg-white/10 transition-colors"
          >
            Join Lasyly free →
          </Link>
        </aside>
      </div>
    </div>
  )
}
