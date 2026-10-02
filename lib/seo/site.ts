/**
 * The site's primary origin: the Vercel primary domain (proxy.ts CANONICAL_HOST).
 * The apex 308s here, so canonicals, sitemap, robots, feed and structured data
 * must all use it; NEXT_PUBLIC_SITE_URL is the apex and mixed the two hosts.
 */
export const SITE_URL = "https://www.lasyly.me"
