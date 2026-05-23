import type { Metadata, Viewport } from "next";
import { Playfair_Display, Libre_Baskerville, Source_Sans_3 } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import "@/lib/env"; // Validate environment variables at startup
import CookieConsent from "@/components/CookieConsent";
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
  description: "Real-time sports rooms, prop analytics, live scores, curated news, and a tipster marketplace. All in one place.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://lasyly.com"),
  icons: {
    icon: "/lasyly_logo.png",
    apple: "/lasyly_logo.png",
  },
  openGraph: {
    type: "website",
    siteName: "Lasyly",
    title: "Lasyly — Sports Analytics & Community Platform",
    description: "Real-time sports rooms, prop analytics, live scores, curated news, and a tipster marketplace.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lasyly — Sports Analytics & Community Platform",
    description: "Real-time sports rooms, prop analytics, live scores, curated news, and a tipster marketplace.",
  },
  robots: {
    index: true,
    follow: true,
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
        {children}
        <CookieConsent />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
