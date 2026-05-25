import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.31.195"],
  logging: false,
  poweredByHeader: false,
  compress: true,
  // Emit source maps in production so Lighthouse and browser DevTools can
  // show original source. Sentry will also pick these up automatically.
  productionBrowserSourceMaps: true,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 3600,
    remotePatterns: [
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
              // Cache static assets aggressively (production only)
              source: "/(.*)\\.(js|css|woff2|png|jpg|svg|ico)",
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
