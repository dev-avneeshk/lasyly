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
    description: "Sports betting tips, prop analytics guides, and community insights from the Lasyly team.",
    type: "website",
  },
}

const STATIC_POSTS = [
  { slug: "spurs-thunder-game-4-recap-2026", category: "NBA Playoffs", date: "May 25, 2026", readTime: "7 min read", title: "Wembanyama 33 Pts: Spurs Rout Thunder 103-82, West Finals Tied 2-2", excerpt: "Victor Wembanyama scores 33 points, 8 rebounds, and 3 blocks as San Antonio dominates OKC to even the Western Conference Finals. Full Game 4 recap, box score breakdown, and Game 5 betting angles.", accent: "#F59E0B" },
  { slug: "thunder-vs-spurs-nba-2026", category: "NBA", date: "May 25, 2026", readTime: "6 min read", title: "Thunder vs Spurs 2026: 1M+ Searches, Wembanyama Props & Full Betting Breakdown", excerpt: "OKC vs Spurs crossed 1 million US searches. We break down the OKC spread, Victor Wembanyama props, SGA points bets, and same-game parlay construction.", accent: "#F59E0B" },
  { slug: "cruz-azul-pumas-liga-mx-final-2026", category: "Liga MX", date: "May 25, 2026", readTime: "5 min read", title: "Cruz Azul Wins Liga MX Clausura 2026: Pumas Final Recap & Betting Analysis", excerpt: "Cruz Azul beat Pumas UNAM 2-1 with a Rodolfo Rotondi stoppage-time winner. 200K+ US searches. Full match recap and betting market breakdown.", accent: "#4ADE80" },
  { slug: "avalanche-vs-golden-knights-nhl-playoffs-2026", category: "NHL", date: "May 25, 2026", readTime: "5 min read", title: "Avalanche vs Golden Knights NHL Playoffs 2026: MacKinnon Props, OT Markets & Betting Breakdown", excerpt: "Colorado vs Vegas generated 200K+ searches with a 1,000% spike. Nathan MacKinnon scorer props, OT winner markets, and Golden Knights moneyline analysis.", accent: "#3B82F6" },
  { slug: "inter-miami-philadelphia-mls-messi-2026", category: "MLS", date: "May 25, 2026", readTime: "5 min read", title: "Inter Miami vs Philadelphia 2026: Messi Injury, MLS Betting Odds & Market Analysis", excerpt: "Messi injury concerns sent Inter Miami vs Philadelphia Union to 100K+ searches. Anytime scorer props, BTTS markets, and how Messi's fitness moves lines.", accent: "#EC4899" },
  { slug: "villarreal-atletico-madrid-la-liga-2026", category: "La Liga", date: "May 25, 2026", readTime: "5 min read", title: "Villarreal vs Atlético Madrid La Liga 2026: Griezmann Props, Under 2.5 & Betting Breakdown", excerpt: "One of the biggest European football betting trends this week. Atlético win, Under 2.5 goals, Griezmann scorer, and draw no bet markets fully analyzed.", accent: "#6C63FF" },
  { slug: "indy-500-2026-results-betting", category: "IndyCar", date: "May 25, 2026", readTime: "4 min read", title: "Indy 500 2026 Results: Who Won, Race Winner Odds & Betting Market Breakdown", excerpt: "The 2026 Indianapolis 500 generated 200K+ searches with a 900% spike. Race winner bets, podium markets, Felix Rosenqvist and David Malukas trending.", accent: "#F97316" },
  { slug: "why-share-your-betslip", category: "Community", date: "May 24, 2026", readTime: "6 min read", title: "Why You Should Share Your Betslip (Even When You Lose)", excerpt: "Sharing your betslip publicly isn't just about bragging rights. It builds your track record, sharpens your thinking, and turns a solo hobby into a competitive edge.", accent: "var(--color-lime)" },
  { slug: "how-to-read-prop-analytics", category: "Analytics", date: "May 22, 2026", readTime: "8 min read", title: "How to Read Prop Analytics: Hit Rates, Matchup Grades, and Confidence Scores Explained", excerpt: "Lasyly surfaces a lot of numbers on every player card. Here's what each metric actually means and how to combine them to find high-value props.", accent: "#6C63FF" },
  { slug: "nba-player-props-guide", category: "NBA", date: "May 20, 2026", readTime: "10 min read", title: "The Complete Guide to NBA Player Props in 2026", excerpt: "Points, rebounds, assists, 3-pointers, and beyond. A deep dive into how to approach NBA player props — from reading defensive matchups to spotting line value.", accent: "#F59E0B" },
]

interface PostCard {
  slug: string; category: string; date: string; readTime: string; title: string; excerpt: string; accent: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

export default async function BlogIndexPage() {
  const baseUrl = "https://lasyly.me"
  const supabase = createAdminClient()
  const { data: dbRows } = await supabase
    .from("blog_posts")
    .select("slug, title, excerpt, category, accent, read_time, published_at")
    .eq("published", true)
    .order("published_at", { ascending: false })
    .limit(50)

  const dbPosts: PostCard[] = (dbRows ?? []).map(
    (r: { slug: string; title: string; excerpt: string; category: string; accent: string; read_time: string; published_at: string }) => ({
      slug: r.slug, category: r.category, date: formatDate(r.published_at), readTime: r.read_time, title: r.title, excerpt: r.excerpt, accent: r.accent,
    })
  )

  const staticSlugs = new Set(STATIC_POSTS.map((p) => p.slug))
  const mergedPosts: PostCard[] = [...dbPosts.filter((p) => !staticSlugs.has(p.slug)), ...STATIC_POSTS]

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 md:py-20">
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "Blog", name: "Lasyly Blog", url: `${baseUrl}/blog`,
        description: "Sports betting tips, prop analytics guides, and community insights from the Lasyly team.",
        publisher: { "@type": "Organization", name: "Lasyly", url: baseUrl, logo: { "@type": "ImageObject", url: `${baseUrl}/lasyly_logo.png` } },
        blogPost: mergedPosts.map((p) => ({ "@type": "BlogPosting", headline: p.title, description: p.excerpt, url: `${baseUrl}/blog/${p.slug}`, datePublished: p.date })),
      }} />

      {/* Header */}
      <div className="mb-14 max-w-3xl">
        <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--color-lime)] mb-4">Lasyly Journal</span>
        <h1 className="text-[2.25rem] md:text-[3rem] font-bold font-serif tracking-tight text-white leading-[1.08] mb-5">
          The Blog
        </h1>
        <p className="text-lg text-white/50 max-w-[48ch] leading-relaxed">
          Tips, guides, and honest takes on sports betting, prop analytics, and building smarter habits as a bettor.
        </p>
      </div>

      {/* Featured post */}
      <Link
        href={`/blog/${mergedPosts[0].slug}`}
        className="group block mb-12 rounded-[1.5rem] p-[1px] bg-gradient-to-br from-white/8 to-transparent hover:from-white/14 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
      >
        <div className="rounded-[calc(1.5rem-1px)] bg-[var(--color-surface)] p-8 md:p-12 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full" style={{ background: `${mergedPosts[0].accent}15`, color: mergedPosts[0].accent }}>
              {mergedPosts[0].category}
            </span>
            <span className="text-[12px] text-[var(--color-text-muted)]">{mergedPosts[0].date}</span>
            <span className="w-1 h-1 rounded-full bg-[var(--color-text-muted)]" />
            <span className="text-[12px] text-[var(--color-text-muted)]">{mergedPosts[0].readTime}</span>
          </div>
          <h2 className="text-2xl md:text-4xl font-bold font-serif tracking-tight text-white leading-tight mb-4 group-hover:text-[var(--color-lime)] transition-colors duration-300">
            {mergedPosts[0].title}
          </h2>
          <p className="text-base text-[var(--color-text-muted)] leading-relaxed max-w-2xl mb-6">
            {mergedPosts[0].excerpt}
          </p>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-lime)]">
            Read post
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="group-hover:translate-x-0.5 transition-transform duration-300"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </div>
      </Link>

      {/* Post grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {mergedPosts.slice(1).map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group block rounded-[1.25rem] p-[1px] bg-gradient-to-b from-white/6 to-transparent hover:from-white/12 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
          >
            <div className="rounded-[calc(1.25rem-1px)] bg-[var(--color-surface)] p-6 h-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full" style={{ background: `${post.accent}15`, color: post.accent }}>
                  {post.category}
                </span>
                <span className="text-[12px] text-[var(--color-text-muted)]">{post.readTime}</span>
              </div>
              <h2 className="text-lg font-bold font-serif tracking-tight text-white leading-snug mb-3 group-hover:text-[var(--color-lime)] transition-colors duration-300">
                {post.title}
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed line-clamp-3">{post.excerpt}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-16 rounded-[2rem] p-[1px] bg-gradient-to-br from-[var(--color-lime)]/25 via-transparent to-[#6C63FF]/15">
        <div className="rounded-[calc(2rem-1px)] bg-[var(--color-surface)] p-10 md:p-14 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
          <h2 className="text-3xl font-bold font-serif tracking-tight text-white mb-3">Ready to bet smarter?</h2>
          <p className="text-[var(--color-text-muted)] mb-7 max-w-md mx-auto">
            Join the platform where data meets community. Free to use — always.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-[var(--color-lime)] text-black font-bold text-sm px-6 py-3 rounded-full hover:scale-[0.98] active:scale-[0.96] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          >
            Create free account
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
        </div>
      </div>
    </div>
  )
}
