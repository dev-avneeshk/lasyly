-- Migration: Add linked_blog_slug to espn_news
-- When set, news cards in the news feed will link to the internal blog post
-- at /blog/[slug] instead of the external ESPN article.
--
-- This connects the news section and the blog section:
-- - News pages: clicking a card with linked_blog_slug → /blog/[slug]?from=news
--   (back button goes back to /news)
-- - Google/direct: /blog/[slug] with no ?from=news — back goes to previous
--   page (Google search, etc.)

ALTER TABLE public.espn_news
  ADD COLUMN IF NOT EXISTS linked_blog_slug TEXT REFERENCES public.blog_posts(slug)
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS idx_espn_news_linked_blog_slug
  ON public.espn_news (linked_blog_slug)
  WHERE linked_blog_slug IS NOT NULL;

COMMENT ON COLUMN public.espn_news.linked_blog_slug IS
  'When set, news feed cards link to /blog/[slug] instead of ESPN. '
  'Set this to the slug of the matching blog_posts row.';
