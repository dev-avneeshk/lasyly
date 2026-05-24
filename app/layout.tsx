import type { Metadata, Viewport } from "next";
import { Playfair_Display, Libre_Baskerville, Source_Sans_3 } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import "@/lib/env"; // Validate environment variables at startup
import CookieConsent from "@/components/CookieConsent";
import { JsonLd } from "@/components/seo/JsonLd";
import { connection } from "next/server";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-libre-baskerville",
  display: "swap",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-source-sans",
  display: "swap",
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: {
    default: "Lasyly — Sports Analytics & Community Platform",
    template: "%s | Lasyly",
  },
  verification: {
    other: {
      "msvalidate.01": "6BA0E86BC23D5F04B75CC76D4AE41AB8",
    },
  },
  description: "Real-time sports rooms, prop analytics, live scores, curated news, and a tipster marketplace. All in one place.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://lasyly.me"),
  keywords: [
    "sports betting analytics",
    "player prop analytics",
    "NBA prop bets",
    "bet tracker",
    "sports betting community",
    "tipster marketplace",
    "hit rate",
    "matchup grade",
    "live sports scores",
    "prop research",
    "betslip sharing",
    "parlay builder",
    "sports betting app",
    "PrizePicks alternative",
    "Action Network alternative",
  ],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/lasyly_logo.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: { url: "/lasyly_logo.png", type: "image/png" },
  },
  openGraph: {
    type: "website",
    siteName: "Lasyly",
    title: "Lasyly — Sports Analytics & Community Platform",
    description: "Real-time sports rooms, prop analytics, live scores, curated news, and a tipster marketplace.",
    locale: "en_US",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://lasyly.me",
  },
  twitter: {
    card: "summary_large_image",
    site: "@lasyly",
    creator: "@lasyly",
    title: "Lasyly — Sports Analytics & Community Platform",
    description: "Real-time sports rooms, prop analytics, live scores, curated news, and a tipster marketplace.",
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Force dynamic rendering so Next.js reads the per-request CSP nonce
  // from proxy and stamps it on all <script> tags it injects.
  await connection();
  return (
    <html lang="en" className={`h-full antialiased ${playfair.variable} ${libreBaskerville.variable} ${sourceSans.variable}`}>
      <head>
        {/* Warm up connections to image CDNs we use heavily for team logos &
            news photos so the first <img> hit doesn't pay TLS+DNS twice. */}
        <link rel="preconnect" href="https://a.espncdn.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://a.espncdn.com" />
        <link rel="dns-prefetch" href="https://s.espncdn.com" />
      </head>
      <body className="min-h-full h-full bg-[var(--color-background)] text-[var(--color-text-primary)]">
        <JsonLd data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Lasyly",
          "url": process.env.NEXT_PUBLIC_SITE_URL || "https://lasyly.me",
          "logo": `${process.env.NEXT_PUBLIC_SITE_URL || "https://lasyly.me"}/lasyly_logo.png`,
          "description": "Lasyly is a sports analytics and betting community platform offering player prop analytics, live scores, betting rooms, sports news, and a tipster marketplace.",
          "sameAs": [
            "https://twitter.com/lasyly",
          ],
          "knowsAbout": [
            "sports betting analytics",
            "player prop analytics",
            "NBA prop bets",
            "sports betting community",
            "live sports scores",
            "tipster marketplace",
            "bet tracking",
          ],
        }} />
        <JsonLd data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "Lasyly",
          "url": process.env.NEXT_PUBLIC_SITE_URL || "https://lasyly.me",
          "description": "Real-time social platform for sports bettors. Prop analytics, live scores, betting rooms, and a tipster marketplace.",
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
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
