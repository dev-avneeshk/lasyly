-- Migration: Create blog_posts table
-- Powers the dynamic blog at /blog/[slug]
-- Static hand-crafted posts stay as individual files in app/(marketing)/blog/
-- All new posts are written here and served by the dynamic route

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,            -- URL slug: "spurs-thunder-game-5-recap"
  title       TEXT NOT NULL,
  excerpt     TEXT NOT NULL,                   -- 1-2 sentence summary shown in blog index
  content     TEXT NOT NULL,                   -- Full HTML body rendered inside <article>
  category    TEXT NOT NULL,                   -- "🏀 NBA", "⚽ La Liga", "🏒 NHL", etc.
  accent      TEXT NOT NULL DEFAULT '#F59E0B', -- hex color for category badge
  read_time   TEXT NOT NULL DEFAULT '5 min read',
  sport       TEXT,                            -- "NBA", "NFL", "Soccer", etc. for filtering
  tags        TEXT[] DEFAULT '{}',             -- e.g. ARRAY['wembanyama','spurs','nba-playoffs']

  -- SEO fields (optional overrides; defaults derived from title/excerpt)
  seo_title       TEXT,   -- <title> tag override (defaults to title)
  seo_description TEXT,   -- meta description override (defaults to excerpt)
  canonical_url   TEXT,   -- override if needed; auto-built from slug otherwise
  keywords        TEXT[], -- extra keywords injected into JSON-LD

  -- Authoring
  author      TEXT NOT NULL DEFAULT 'Lasyly Team',
  published   BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug        ON public.blog_posts (slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published   ON public.blog_posts (published_at DESC) WHERE published = true;
CREATE INDEX IF NOT EXISTS idx_blog_posts_sport       ON public.blog_posts (sport) WHERE published = true;

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Anyone can read published posts (public blog)
CREATE POLICY "Published blog posts are publicly readable."
  ON public.blog_posts FOR SELECT
  USING (published = true);

-- Auto-update timestamp
CREATE TRIGGER trg_blog_posts_ts
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.espn_update_timestamp();
