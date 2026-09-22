import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Next 16.3.x reads `experimental.instantInsights.validationLevel` in
  // base-server without optional chaining, so it crashes at request time when
  // the field is absent (TypeError: cannot read 'validationLevel' of
  // undefined). Defining it explicitly gives the runtime the shape it expects.
  experimental: {
    instantInsights: { validationLevel: "warning" },
    // Tree-shake barrel imports so only the modules actually used ship to the
    // client. Next optimizes lucide-react / date-fns / recharts by default in
    // this version (see node_modules/next/dist/docs/.../optimizePackageImports.md),
    // so only framer-motion — used on the arena/rankings/nfl routes — needs to
    // be listed explicitly. This trims the first-load JS on those routes.
    optimizePackageImports: ["framer-motion"],
    // When proxy.ts is present, Next.js buffers a clone of every request body in
    // memory so it can be read both in proxy and in the route handler. The
    // default ceiling is 10MB per request, and the app's own limit
    // (BODY_LIMIT_STANDARD = 1MB) is only a Content-Length pre-check, which a
    // client can skip with chunked encoding. This is the ceiling that holds
    // regardless of what the request claims: Next buffers at most this much and
    // logs a warning. 1mb matches BODY_LIMIT_STANDARD; no route in the app
    // legitimately posts more (the largest bodies are chat messages capped at
    // 1000 chars and betslip payloads).
    proxyClientMaxBodySize: "1mb",
  } as NextConfig["experimental"],
  allowedDevOrigins: ["192.168.31.195"],
  logging: false,
  poweredByHeader: false,
  compress: true,
  // Source maps are uploaded to Sentry during build — they don't need to be
  // served to browsers in production. Serving them exposes source code and
  // adds ~200KB+ to the JS payload flagged by Lighthouse "unused JS".
  productionBrowserSourceMaps: false,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400, // 24h — was 1h, improves CDN cache hit rate significantly
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.nba.com",
        pathname: "/headshots/**",
      },
      {
        // Self-hosted player headshots. Scoped to the public storage path for
        // this bucket rather than the whole project, so a misconfigured src
        // cannot turn next/image into a proxy for arbitrary Supabase objects.
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/player-headshots/**",
      },
      {
        protocol: "https",
        hostname: "a.espncdn.com",
      },
      {
        protocol: "https",
        hostname: "s.espncdn.com",
      },
      {
        protocol: "https",
        hostname: "*.espncdn.com",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
    ],
  },
  async headers() {
    const isDev = process.env.NODE_ENV === "development";
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
        ],
      },
      // Cache news API responses at the CDN edge for 60s (stale-while-revalidate 300s)
      {
        source: "/api/news/:path*",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=300" },
        ],
      },
      // Cache scores API for 10s at edge (matches polling interval)
      {
        source: "/api/scores/:path*",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=10, stale-while-revalidate=30" },
        ],
      },
      ...(isDev
        ? []
        : [
            {
              // Cache hashed JS/CSS chunks forever — they have content hashes in filenames
              source: "/_next/static/(.*)",
              headers: [
                { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
              ],
            },
            {
              // Cache public static assets (images, fonts, icons) for 1 year
              source: "/(.*)\\.(js|css|woff2|woff|ttf|otf|png|jpg|jpeg|webp|avif|svg|ico|gif)",
              headers: [
                { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
              ],
            },
          ]),
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: "lasyly",
  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // productionBrowserSourceMaps is set above — Sentry will pick them up.
  // Disable widenClientFileUpload since we're serving source maps directly.
  widenClientFileUpload: false,

  // Disable the Sentry client-side bundle for pages that don't need it.
  // This removes ~100KB from the initial JS payload on marketing/auth pages.

  webpack: {
    automaticVercelMonitors: true,
    treeshake: {
      removeDebugLogging: true,
    },
  },

  // Reduce Sentry bundle size: disable features not needed on the client
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayShadowDom: true,
    excludeReplayIframe: true,
    excludeReplayWorker: true,
  },
});
