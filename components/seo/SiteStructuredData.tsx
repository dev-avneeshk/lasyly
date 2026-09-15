import { JsonLd } from "./JsonLd"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://lasyly.me"

/**
 * Site-wide Organization / WebSite / ItemList structured data.
 *
 * These used to live in the root layout, which meant every single page in the
 * app shipped ~2–3 KB of identical JSON-LD in its HTML — bytes that count
 * against FCP on every route while only helping SEO on the home / entry pages.
 * Search engines only need this sitelinks/organization markup on the canonical
 * home surface, so it now renders exactly on the marketing landing page and on
 * /explore (the canonical home that `/` rewrites to). Every other route drops
 * the payload entirely.
 */
export function SiteStructuredData() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Lasyly",
          url: SITE_URL,
          logo: `${SITE_URL}/lasyly_logo.png`,
          description:
            "Lasyly is a sports analytics and community platform offering player prop analytics, live scores, community rooms, sports news, and a pick marketplace.",
          sameAs: ["https://instagram.com/dev.avneeshk"],
          knowsAbout: [
            "sports analytics",
            "player prop analytics",
            "NBA props",
            "sports community",
            "live sports scores",
            "pick marketplace",
            "pick tracking",
          ],
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Lasyly",
          url: SITE_URL,
          description:
            "Real-time social platform for sports fans. Prop analytics, live scores, community rooms, and a pick marketplace.",
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: `${SITE_URL}/analysis?search={search_term_string}`,
            },
            "query-input": "required name=search_term_string",
          },
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Lasyly — Key Pages",
          itemListElement: [
            {
              "@type": "SiteLinksSearchBox",
              target: {
                "@type": "EntryPoint",
                urlTemplate: `${SITE_URL}/analysis?search={search_term_string}`,
              },
              "query-input": "required name=search_term_string",
            },
            {
              "@type": "ListItem",
              position: 1,
              name: "Prop Analytics",
              url: `${SITE_URL}/analysis`,
              description: "Deep player prop analytics with hit rates, matchup grades, and trends.",
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Live Scores",
              url: `${SITE_URL}/scores`,
              description: "Real-time live scores across NBA, NFL, MLB, and more.",
            },
            {
              "@type": "ListItem",
              position: 3,
              name: "Betting Rooms",
              url: `${SITE_URL}/rooms`,
              description: "Join live betting rooms and share picks with the community.",
            },
            {
              "@type": "ListItem",
              position: 4,
              name: "Sports News",
              url: `${SITE_URL}/news`,
              description: "Curated sports news and injury updates that matter for bettors.",
            },
            {
              "@type": "ListItem",
              position: 5,
              name: "Sign Up",
              url: `${SITE_URL}/signup`,
              description: "Create a free Lasyly account and start tracking your props.",
            },
            {
              "@type": "ListItem",
              position: 6,
              name: "Login",
              url: `${SITE_URL}/login`,
              description: "Log in to your Lasyly account.",
            },
          ],
        }}
      />
    </>
  )
}
