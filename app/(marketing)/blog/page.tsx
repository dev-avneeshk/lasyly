import type { Metadata } from "next"
import Link from "next/link"
import { JsonLd } from "@/components/seo/JsonLd"
import { createAdminClient } from "@/lib/supabase/admin"

export const revalidate = 60

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

// ---------------------------------------------------------------------------
// Static posts — these have their own page.tsx files in app/(marketing)/blog/
// They appear first and are always shown. Newest static post should be first.
// ---------------------------------------------------------------------------

const STATIC_POSTS = [
  {
    slug: "spurs-thunder-game-4-recap-2026",
    category: "🏀 NBA Playoffs",
    date: "May 25, 2026",
    readTime: "7 min read",
    title: "Wembanyama 33 Pts: Spurs Rout Thunder 103-82, West Finals Tied 2-2",
    excerpt:
      "Victor Wembanyama scores 33 points, 8 rebounds, and 3 blocks as San Antonio dominates OKC to even the Western Conference Finals. Full Game 4 recap, box score breakdown, and Game 5 betting angles.",
    accent: "#F59E0B",
  },
  {
    slug: "thunder-vs-spurs-nba-2026",
    category: "🏀 NBA",
    date: "May 25, 2026",
    readTime: "6 min read",
    title: "Thunder vs Spurs 2026: 1M+ Searches, Wembanyama Props & Full Betting Breakdown",
    excerpt:
      "OKC vs Spurs crossed 1 million US searches. We break down the OKC spread, Victor Wembanyama props, SGA points bets, and same-game parlay construction.",
    accent: "#F59E0B",
  },
  {
    slug: "cruz-azul-pumas-liga-mx-final-2026",
    category: "⚽ Liga MX",
    date: "May 25, 2026",
    readTime: "5 min read",
    title: "Cruz Azul Wins Liga MX Clausura 2026: Pumas Final Recap & Betting Analysis",
    excerpt:
      "Cruz Azul beat Pumas UNAM 2-1 with a Rodolfo Rotondi stoppage-time winner. 200K+ US searches. Full match recap and betting market breakdown.",
    accent: "#4ADE80",
  },
  {
    slug: "avalanche-vs-golden-knights-nhl-playoffs-2026",
    category: "🏒 NHL",
    date: "May 25, 2026",
    readTime: "5 min read",
    title: "Avalanche vs Golden Knights NHL Playoffs 2026: MacKinnon Props, OT Markets & Betting Breakdown",
    excerpt:
      "Colorado vs Vegas generated 200K+ searches with a 1,000% spike. Nathan MacKinnon scorer props, OT winner markets, and Golden Knights moneyline analysis.",
    accent: "#3B82F6",
  },
  {
    slug: "inter-miami-philadelphia-mls-messi-2026",
    category: "⚽ MLS",
    date: "May 25, 2026",
    readTime: "5 min read",
    title: "Inter Miami vs Philadelphia 2026: Messi Injury, MLS Betting Odds & Market Analysis",
    excerpt:
      "Messi injury concerns sent Inter Miami vs Philadelphia Union to 100K+ searches. Anytime scorer props, BTTS markets, and how Messi's fitness moves lines.",
    accent: "#EC4899",
  },
  {
    slug: "villarreal-atletico-madrid-la-liga-2026",
    category: "⚽ La Liga",
    date: "May 25, 2026",
    readTime: "5 min read",
    title: "Villarreal vs Atlético Madrid La Liga 2026: Griezmann Props, Under 2.5 & Betting Breakdown",
    excerpt:
      "One of the biggest European football betting trends this week. Atlético win, Under 2.5 goals, Griezmann scorer, and draw no bet markets fully analyzed.",
    accent: "#6C63FF",
  },
  {
    slug: "indy-500-2026-results-betting",
    category: "🏎️ IndyCar",
    date: "May 25, 2026",
    readTime: "4 min read",
    title: "Indy 500 2026 Results: Who Won, Race Winner Odds & Betting Market Breakdown",
    excerpt:
      "The 2026 Indianapolis 500 generated 200K+ searches with a 900% spike. Race winner bets, podium markets, Felix Rosenqvist and David Malukas trending — full breakdown.",
    accent: "#F97316",
  },
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

// ---------------------------------------------------------------------------
// Shared post card shapes
// ---------------------------------------------------------------------------

interface PostCard {
  slug: string
  category: string
  date: string
  readTime: string
  title: string
  excerpt: string
  accent: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

// ---------------------------------------------------------------------------
// Page — async Server Component, fetches DB posts at request time
// ---------------------------------------------------------------------------

export default async function BlogIndexPage() {
  const baseUrl = "https://lasyly.me"

  // Pull DB posts — newest first, limit to 50 so the index doesn't explode
  const supabase = createAdminClient()
  const { data: dbRows } = await supabase
    .from("blog_posts")
    .select("slug, title, excerpt, category, accent, read_time, published_at")
    .eq("published", true)
    .order("published_at", { ascending: false })
    .limit(50)

  const dbPosts: PostCard[] = (dbRows ?? []).map(
    (r: {
      slug: string
      title: string
      excerpt: string
      category: string
      accent: string
      read_time: string
      published_at: string
    }) => ({
      slug: r.slug,
      category: r.category,
      date: formatDate(r.published_at),
      readTime: r.read_time,
      title: r.title,
      excerpt: r.excerpt,
      accent: r.accent,
    })
  )

  // DB posts first (freshest), static posts after — deduplicate by slug
  const staticSlugs = new Set(STATIC_POSTS.map((p) => p.slug))
  const mergedPosts: PostCard[] = [
    ...dbPosts.filter((p) => !staticSlugs.has(p.slug)),
    ...STATIC_POSTS,
  ]

  // All posts for JSON-LD
  const allPosts = mergedPosts

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "Lasyly Blog",
          url: `${baseUrl}/blog`,
          description:
            "Sports betting tips, prop analytics guides, and community insights from the Lasyly team.",
          publisher: {
            "@type": "Organization",
            name: "Lasyly",
            url: baseUrl,
            logo: { "@type": "ImageObject", url: `${baseUrl}/lasyly_logo.png` },
          },
          blogPost: allPosts.map((p) => ({
            "@type": "BlogPosting",
            headline: p.title,
            description: p.excerpt,
            url: `${baseUrl}/blog/${p.slug}`,
            datePublished: p.date,
          })),
        }}
      />

      {/* Header */}
      <div className="mb-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-lime)] mb-3">
          Lasyly Journal
        </p>
        <h1 className="text-5xl md:text-6xl font-bold font-serif tracking-tight text-white leading-none mb-6">
          The Blog
        </h1>
        <p className="text-lg text-[var(--color-text-muted)] max-w-xl leading-relaxed">
          Tips, guides, and honest takes on sports betting, prop analytics, and building smarter
          habits as a bettor.
        </p>
      </div>

      {/* Featured post */}
      <Link
        href={`/blog/${mergedPosts[0].slug}`}
        className="group block mb-12 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-white/15 transition-colors overflow-hidden"
      >
        <div className="p-8 md:p-12">
          <div className="flex items-center gap-3 mb-6">
            <span
              className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
              style={{
                background: `${mergedPosts[0].accent}20`,
                color: mergedPosts[0].accent,
              }}
            >
              {mergedPosts[0].category}
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">{mergedPosts[0].date}</span>
            <span className="text-xs text-[var(--color-text-muted)]">·</span>
            <span className="text-xs text-[var(--color-text-muted)]">
              {mergedPosts[0].readTime}
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold font-serif tracking-tight text-white leading-tight mb-4 group-hover:text-[var(--color-lime)] transition-colors">
            {mergedPosts[0].title}
          </h2>
          <p className="text-base text-[var(--color-text-muted)] leading-relaxed max-w-2xl">
            {mergedPosts[0].excerpt}
          </p>
          <div className="mt-6 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-lime)]">
            Read post
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="group-hover:translate-x-0.5 transition-transform"
            >
              <path
                d="M3 8h10M9 4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </Link>

      {/* Post grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {mergedPosts.slice(1).map((post) => (
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
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="group-hover:translate-x-0.5 transition-transform"
              >
                <path
                  d="M3 8h10M9 4l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </Link>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-20 rounded-2xl border border-[var(--color-lime)]/20 bg-[var(--color-lime)]/5 p-8 md:p-12 text-center">
        <h2 className="text-3xl font-bold font-serif text-white mb-3">Ready to bet smarter?</h2>
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
