export interface NewsItem {
  id: string
  title: string
  link: string
  description: string
  pubDate: string
  source: string
  image: string | null
  category: string
  /**
   * When set, this news item is linked to an internal blog post.
   * The news feed will navigate to `/blog/[linkedBlogSlug]?from=news`
   * instead of opening the ESPN article detail view.
   */
  linkedBlogSlug?: string | null
}
