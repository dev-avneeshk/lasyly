import type { Metadata } from "next";
import { Playfair_Display, Libre_Baskerville, Source_Sans_3 } from "next/font/google";
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

export const metadata: Metadata = {
  title: {
    default: "Lasyly — Social Sports Betting Platform",
    template: "%s | Lasyly",
  },
  description: "Social sports rooms, betslip sharing, prop analytics, live scores, and a tipster marketplace. All in one place.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://lasyly.com"),
  openGraph: {
    type: "website",
    siteName: "Lasyly",
    title: "Lasyly — Social Sports Betting Platform",
    description: "Social sports rooms, betslip sharing, prop analytics, live scores, and a tipster marketplace.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lasyly — Social Sports Betting Platform",
    description: "Social sports rooms, betslip sharing, prop analytics, live scores, and a tipster marketplace.",
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
      </body>
    </html>
  );
}
