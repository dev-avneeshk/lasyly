import type { Metadata, Viewport } from "next";
import { Playfair_Display, Libre_Baskerville, Source_Sans_3 } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import "@/lib/env"; // Validate environment variables at startup
import CookieConsent from "@/components/CookieConsent";
import ThemeProvider from "@/components/ThemeProvider";
import { InlineScript } from "@/components/InlineScript";

const playfair = Playfair_Display({
  subsets: ["latin"],
  // Playfair renders the large `font-serif` headings that are the LCP element on
  // the marketing / auth / explore routes, so this is the one family worth
  // preloading — the swap-in of a heavy display face was a visible late paint.
  // Italic was dropped: the only serif-italic usage in the app is a single
  // blockquote on the rankings player detail page (a deep, non-critical route),
  // and shipping a whole extra italic font file site-wide to serve it isn't
  // worth the bytes. The browser synthesizes an acceptable oblique there.
  weight: ["400", "700"],
  style: ["normal"],
  variable: "--font-playfair",
  display: "swap",
  preload: true,
});

const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal"],
  variable: "--font-libre-baskerville",
  display: "swap",
  preload: false,
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-source-sans",
  display: "swap",
  preload: false,
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#d4ff00",
  // Removed maximumScale:1 / userScalable:false — accessibility violation flagged
  // by Lighthouse Best Practices and WCAG 1.4.4. Modern iOS/Android handle zoom
  // gracefully; blocking it harms users who rely on browser zoom.
} satisfies Viewport

export const metadata: Metadata = {
  title: {
    default: "Lasyly — Sports Analytics & Community Platform",
    template: "%s | Lasyly",
  },
  manifest: "/manifest.json",
  verification: {
    other: {
      "msvalidate.01": "6BA0E86BC23D5F04B75CC76D4AE41AB8",
    },
  },
  description: "Real-time sports rooms, prop analytics, live scores, curated news, and a pick marketplace. All in one place.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://lasyly.me"),
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Lasyly",
  },
  keywords: [
    "sports analytics",
    "player prop analytics",
    "NBA props",
    "pick tracker",
    "sports community",
    "pick marketplace",
    "hit rate",
    "matchup grade",
    "live sports scores",
    "prop research",
    "slip sharing",
    "parlay builder",
    "sports analytics app",
    "PrizePicks alternative",
    "Action Network alternative",
  ],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    shortcut: "/favicon.ico",
    apple: { url: "/apple-icon.png", type: "image/png", sizes: "180x180" },
  },
  openGraph: {
    type: "website",
    siteName: "Lasyly",
    title: "Lasyly — Sports Analytics & Community Platform",
    description: "Real-time sports rooms, prop analytics, live scores, curated news, and a pick marketplace.",
    locale: "en_US",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://lasyly.me",
  },
  twitter: {
    card: "summary_large_image",
    site: "@lasyly",
    creator: "@lasyly",
    title: "Lasyly — Sports Analytics & Community Platform",
    description: "Real-time sports rooms, prop analytics, live scores, curated news, and a pick marketplace.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: process.env.NEXT_PUBLIC_SITE_URL || "https://lasyly.me",
    types: {
      "application/rss+xml": `${process.env.NEXT_PUBLIC_SITE_URL || "https://lasyly.me"}/blog/feed.xml`,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // NOTE: `await connection()` was here to read the per-request CSP nonce,
  // but Next.js 16 auto-stamps nonces on framework scripts from the CSP header
  // set in proxy.ts — no layout call needed. Removing it lets public pages
  // (/, /blog, /onboarding, /login) be served as static ISR from CDN edge,
  // which is the primary fix for mobile FCP 4.1s / 5.19s.
  return (
    <html lang="en" suppressHydrationWarning className={`h-full antialiased ${playfair.variable} ${libreBaskerville.variable} ${sourceSans.variable}`}>
      <head>
        {/* dns-prefetch for ESPN CDN — next/image proxies through /_next/image
            so preconnect is unnecessary, but dns-prefetch is still useful for
            pages that use raw img tags (social feed avatars, etc.) */}
        <link rel="dns-prefetch" href="https://a.espncdn.com" />
        <link rel="dns-prefetch" href="https://s.espncdn.com" />
        {/* Pre-paint consent check. Must stay a blocking inline script in <head>:
            the cookie notice is server-rendered (so that when it DOES show it
            paints with FCP instead of after hydration — it was previously the
            LCP element at ~9s on mobile), which means returning visitors would
            see it flash before React could hide it. Setting this class before
            first paint hides it with no flash. Paired with the
            `.consent-given #cookie-consent` rule in globals.css. Kept tiny and
            wrapped in try/catch because localStorage throws in some
            partitioned/private contexts. */}
        <InlineScript
          html={`try{if(localStorage.getItem('lasyly_cookie_consent'))document.documentElement.classList.add('consent-given')}catch(e){}`}
        />
        {/* Browser extensions (Bitdefender TrafficLight, Grammarly, etc.) inject
            attributes into the server HTML before React hydrates, causing
            spurious hydration-mismatch WARNINGS in the console. We strip ONLY
            the purely cosmetic marker attributes that trigger the warning
            (`bis_skin_checked`, Grammarly's install flags).

            This is a DEV-ONLY quality-of-life fix. In production it shipped a
            blocking inline script plus an always-on MutationObserver that ran on
            every page before hydration — pure overhead for a console warning
            nobody sees in prod. `suppressHydrationWarning` on <html>/<body>
            already prevents these attributes from breaking hydration itself, so
            production needs nothing here. */}
        {process.env.NODE_ENV === "development" && (
          <InlineScript
            html={`(function(){try{var SAFE=['bis_skin_checked','data-gr-ext-installed','data-new-gr-c-s-check-loaded','data-new-gr-c-s-loaded'];function clean(el){if(!el||!el.removeAttribute)return;for(var i=0;i<SAFE.length;i++){if(el.hasAttribute&&el.hasAttribute(SAFE[i]))el.removeAttribute(SAFE[i]);}}function sweep(){clean(document.documentElement);if(document.body){clean(document.body);var all=document.body.getElementsByTagName('*');for(var i=0;i<all.length;i++)clean(all[i]);}}var mo=new MutationObserver(function(muts){for(var i=0;i<muts.length;i++){var m=muts[i];if(m.type==='attributes'&&m.target&&SAFE.indexOf(m.attributeName)!==-1){try{m.target.removeAttribute(m.attributeName);}catch(e){}}}});function start(){sweep();try{mo.observe(document.documentElement,{attributes:true,subtree:true,attributeFilter:SAFE});}catch(e){}}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',start);}else{start();}}catch(e){}})();`}
          />
        )}
      </head>
      <body suppressHydrationWarning className="min-h-full h-full bg-[var(--color-background)] text-[var(--color-text-primary)]">
        {/* Site-wide Organization/WebSite/ItemList JSON-LD was moved out of the
            root layout into <SiteStructuredData /> and is now rendered only on
            the home surfaces (marketing landing + /explore). It was adding
            identical structured-data bytes to every route's HTML for no SEO
            benefit off the entry pages. */}
        <ThemeProvider>
        {children}
        <CookieConsent />
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
