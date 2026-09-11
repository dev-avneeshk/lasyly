import type { Metadata, Viewport } from "next";
import { Playfair_Display, Libre_Baskerville, Source_Sans_3 } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import "@/lib/env"; // Validate environment variables at startup
import CookieConsent from "@/components/CookieConsent";
import { JsonLd } from "@/components/seo/JsonLd";
import ThemeProvider from "@/components/ThemeProvider";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
  preload: false,     // display:swap means it won't block render — no need to preload
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
        {/* Browser extensions (Bitdefender TrafficLight, Grammarly, etc.) inject
            attributes into the server HTML before React hydrates, causing
            spurious hydration-mismatch warnings. We strip ONLY the purely
            cosmetic marker attributes that trigger the warning
            (`bis_skin_checked`, Grammarly's install flags). We deliberately do
            NOT touch the extension's stateful bookkeeping attributes
            (`bis_register`, `__processed_*`) — the extension reads those back,
            and removing them made its own scripts crash. React's
            `suppressHydrationWarning` on <html>/<body> covers the rest.
            Dev-quality-of-life only; a no-op when no extension is present. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var SAFE=['bis_skin_checked','data-gr-ext-installed','data-new-gr-c-s-check-loaded','data-new-gr-c-s-loaded'];function clean(el){if(!el||!el.removeAttribute)return;for(var i=0;i<SAFE.length;i++){if(el.hasAttribute&&el.hasAttribute(SAFE[i]))el.removeAttribute(SAFE[i]);}}function sweep(){clean(document.documentElement);if(document.body){clean(document.body);var all=document.body.getElementsByTagName('*');for(var i=0;i<all.length;i++)clean(all[i]);}}var mo=new MutationObserver(function(muts){for(var i=0;i<muts.length;i++){var m=muts[i];if(m.type==='attributes'&&m.target&&SAFE.indexOf(m.attributeName)!==-1){try{m.target.removeAttribute(m.attributeName);}catch(e){}}}});function start(){sweep();try{mo.observe(document.documentElement,{attributes:true,subtree:true,attributeFilter:SAFE});}catch(e){}}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',start);}else{start();}}catch(e){}})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning className="min-h-full h-full bg-[var(--color-background)] text-[var(--color-text-primary)]">
        <ThemeProvider>
        <JsonLd data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Lasyly",
          "url": process.env.NEXT_PUBLIC_SITE_URL || "https://lasyly.me",
          "logo": `${process.env.NEXT_PUBLIC_SITE_URL || "https://lasyly.me"}/lasyly_logo.png`,
          "description": "Lasyly is a sports analytics and community platform offering player prop analytics, live scores, community rooms, sports news, and a pick marketplace.",
          "sameAs": [
            "https://instagram.com/dev.avneeshk",
          ],
          "knowsAbout": [
            "sports analytics",
            "player prop analytics",
            "NBA props",
            "sports community",
            "live sports scores",
            "pick marketplace",
            "pick tracking",
          ],
        }} />
        <JsonLd data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "Lasyly",
          "url": process.env.NEXT_PUBLIC_SITE_URL || "https://lasyly.me",
          "description": "Real-time social platform for sports fans. Prop analytics, live scores, community rooms, and a pick marketplace.",
          "potentialAction": {
            "@type": "SearchAction",
            "target": {
              "@type": "EntryPoint",
              "urlTemplate": `${process.env.NEXT_PUBLIC_SITE_URL || "https://lasyly.me"}/analysis?search={search_term_string}`,
            },
            "query-input": "required name=search_term_string",
          },
        }} />
        <JsonLd data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          "name": "Lasyly — Key Pages",
          "itemListElement": [
            {
              "@type": "SiteLinksSearchBox",
              "target": {
                "@type": "EntryPoint",
                "urlTemplate": `${process.env.NEXT_PUBLIC_SITE_URL || "https://lasyly.me"}/analysis?search={search_term_string}`,
              },
              "query-input": "required name=search_term_string",
            },
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Prop Analytics",
              "url": `${process.env.NEXT_PUBLIC_SITE_URL || "https://lasyly.me"}/analysis`,
              "description": "Deep player prop analytics with hit rates, matchup grades, and trends.",
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": "Live Scores",
              "url": `${process.env.NEXT_PUBLIC_SITE_URL || "https://lasyly.me"}/scores`,
              "description": "Real-time live scores across NBA, NFL, MLB, and more.",
            },
            {
              "@type": "ListItem",
              "position": 3,
              "name": "Betting Rooms",
              "url": `${process.env.NEXT_PUBLIC_SITE_URL || "https://lasyly.me"}/rooms`,
              "description": "Join live betting rooms and share picks with the community.",
            },
            {
              "@type": "ListItem",
              "position": 4,
              "name": "Sports News",
              "url": `${process.env.NEXT_PUBLIC_SITE_URL || "https://lasyly.me"}/news`,
              "description": "Curated sports news and injury updates that matter for bettors.",
            },
            {
              "@type": "ListItem",
              "position": 5,
              "name": "Sign Up",
              "url": `${process.env.NEXT_PUBLIC_SITE_URL || "https://lasyly.me"}/signup`,
              "description": "Create a free Lasyly account and start tracking your props.",
            },
            {
              "@type": "ListItem",
              "position": 6,
              "name": "Login",
              "url": `${process.env.NEXT_PUBLIC_SITE_URL || "https://lasyly.me"}/login`,
              "description": "Log in to your Lasyly account.",
            },
          ],
        }} />
        {children}
        <CookieConsent />
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
