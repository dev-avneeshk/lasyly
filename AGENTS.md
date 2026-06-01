<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Caching

Use Redis for caching expensive or frequently-requested results (e.g., analytics queries, leaderboard data, player stats, live scores). Prefer cache-aside pattern: check Redis first, fall back to DB, then populate cache with a reasonable TTL.
