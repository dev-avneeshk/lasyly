/**
 * Comparison data for "Lasyly vs X" SEO pages.
 * Each entry defines a competitor and how Lasyly stacks up.
 */

export type ComparisonFeature = {
  feature: string
  lasyly: string | boolean
  competitor: string | boolean
  note?: string
}

export type ComparisonData = {
  slug: string
  competitorName: string
  competitorUrl: string
  competitorTagline: string
  heroHeadline: string
  heroSubheadline: string
  metaTitle: string
  metaDescription: string
  /** Brief overview of the competitor (2-3 sentences) */
  competitorOverview: string
  /** Why someone would switch from competitor to Lasyly */
  switchReasons: string[]
  /** Feature comparison table */
  features: ComparisonFeature[]
  /** Who the competitor is best for */
  competitorBestFor: string
  /** Who Lasyly is best for */
  lasylyBestFor: string
  /** Final verdict paragraph */
  verdict: string
}

export const COMPARISONS: ComparisonData[] = [
  {
    slug: "lasyly-vs-props-cash",
    competitorName: "Props.cash",
    competitorUrl: "https://props.cash",
    competitorTagline: "Player prop research tool",
    heroHeadline: "Lasyly vs Props.cash",
    heroSubheadline: "Both help you research player props — but Lasyly gives you the full toolkit for free.",
    metaTitle: "Lasyly vs Props.cash (2026) — Free Prop Analytics Comparison",
    metaDescription: "Compare Lasyly and Props.cash for player prop research. See how hit rates, matchup grades, community features, and pricing stack up side by side.",
    competitorOverview: "Props.cash is a focused player prop research tool that shows hit rates and historical performance data for NBA and NFL props. It provides a clean interface for checking how often players hit over/under on specific stat lines.",
    switchReasons: [
      "Lasyly includes matchup grades (A–F) based on defensive stats — Props.cash doesn't",
      "Community rooms let you discuss picks with other bettors in real-time",
      "Correlated parlay builder finds props that historically hit together",
      "Live scores across 10+ sports built right into the platform",
      "Pick tracker with ROI analytics to measure your actual performance",
      "100% free — no subscription tiers or paywalled features",
    ],
    features: [
      { feature: "Player prop hit rates", lasyly: true, competitor: true },
      { feature: "Matchup grades (A–F)", lasyly: true, competitor: false },
      { feature: "Confidence scores", lasyly: true, competitor: false },
      { feature: "Line movement tracking", lasyly: true, competitor: "Limited" },
      { feature: "Correlated parlay builder", lasyly: true, competitor: false },
      { feature: "AI-generated prop writeups", lasyly: true, competitor: false },
      { feature: "Real-time community rooms", lasyly: true, competitor: false },
      { feature: "Live scores (10+ sports)", lasyly: true, competitor: false },
      { feature: "Pick tracker with ROI", lasyly: true, competitor: false },
      { feature: "Pick marketplace", lasyly: true, competitor: false },
      { feature: "Sports news feed", lasyly: true, competitor: false },
      { feature: "Free to use", lasyly: true, competitor: "Freemium" },
      { feature: "NBA props", lasyly: true, competitor: true },
      { feature: "NFL props", lasyly: true, competitor: true },
      { feature: "Tennis props", lasyly: true, competitor: false },
      { feature: "Soccer props", lasyly: true, competitor: false },
    ],
    competitorBestFor: "Bettors who only need a quick hit-rate lookup for NBA/NFL props and prefer a minimal, single-purpose tool.",
    lasylyBestFor: "Bettors who want a complete research-to-tracking workflow — prop analytics, community discussion, live scores, and performance tracking in one place.",
    verdict: "Props.cash does one thing well: showing hit rates for player props. But if you want matchup context, community insights, a parlay builder, and performance tracking without paying for multiple subscriptions, Lasyly delivers all of that for free.",
  },
  {
    slug: "lasyly-vs-prizepicks",
    competitorName: "PrizePicks",
    competitorUrl: "https://prizepicks.com",
    competitorTagline: "Daily fantasy sports platform",
    heroHeadline: "Lasyly vs PrizePicks",
    heroSubheadline: "PrizePicks is where you place bets. Lasyly is where you research them.",
    metaTitle: "Lasyly vs PrizePicks (2026) — Analytics vs Betting Platform",
    metaDescription: "Compare Lasyly's free prop analytics with PrizePicks. Lasyly provides hit rates, matchup grades, and community tools to research before you bet on PrizePicks.",
    competitorOverview: "PrizePicks is a daily fantasy sports platform where users build parlays on player props. It's a betting platform — you deposit money and place wagers on whether players go over or under on stat lines.",
    switchReasons: [
      "Lasyly shows you the data BEFORE you bet — hit rates, matchup grades, trends",
      "See how often a player actually hits a line before locking it in on PrizePicks",
      "Correlated parlay builder helps you find props that hit together",
      "Track your PrizePicks performance with our pick tracker",
      "Community rooms where bettors share their PrizePicks entries",
      "Lasyly is a research companion to PrizePicks, not a replacement",
    ],
    features: [
      { feature: "Place real-money bets", lasyly: false, competitor: true, note: "Lasyly is analytics, not a sportsbook" },
      { feature: "Player prop hit rates", lasyly: true, competitor: false },
      { feature: "Matchup grades (A–F)", lasyly: true, competitor: false },
      { feature: "Historical performance data", lasyly: true, competitor: false },
      { feature: "Correlated parlay builder", lasyly: true, competitor: false },
      { feature: "Community rooms", lasyly: true, competitor: false },
      { feature: "Pick tracker with ROI", lasyly: true, competitor: "Basic" },
      { feature: "Live scores", lasyly: true, competitor: false },
      { feature: "AI prop analysis", lasyly: true, competitor: false },
      { feature: "Free to use", lasyly: true, competitor: "Free to play (deposit required)" },
      { feature: "Multi-sport coverage", lasyly: true, competitor: true },
    ],
    competitorBestFor: "People who want to place real-money daily fantasy bets on player props with a simple over/under format.",
    lasylyBestFor: "PrizePicks users who want data-backed research before building their entries — hit rates, matchup context, and community validation.",
    verdict: "PrizePicks and Lasyly serve different purposes. PrizePicks is where you bet; Lasyly is where you research. Use Lasyly's hit rates and matchup grades to make smarter PrizePicks entries, then track your results over time.",
  },
  {
    slug: "lasyly-vs-propshark",
    competitorName: "PropShark",
    competitorUrl: "https://propshark.io",
    competitorTagline: "Prop betting analytics platform",
    heroHeadline: "Lasyly vs PropShark",
    heroSubheadline: "Premium prop analytics shouldn't cost $50/month. Lasyly gives you more — for free.",
    metaTitle: "Lasyly vs PropShark (2026) — Free vs Paid Prop Analytics",
    metaDescription: "Compare Lasyly's free prop analytics with PropShark's paid subscription. Hit rates, matchup grades, parlay builder, and community — all included at no cost.",
    competitorOverview: "PropShark is a paid prop analytics platform offering hit rates, line movement, and prop research tools. It requires a monthly subscription to access most features, with pricing starting around $30–50/month.",
    switchReasons: [
      "Everything PropShark charges for, Lasyly provides free",
      "Matchup grades (A–F) give you defensive context PropShark lacks",
      "Built-in community rooms — no need for a separate Discord",
      "Correlated parlay builder finds multi-leg opportunities",
      "Live scores and news feed keep you in one app",
      "Pick marketplace lets you monetize your expertise",
    ],
    features: [
      { feature: "Player prop hit rates", lasyly: true, competitor: true },
      { feature: "Line movement tracking", lasyly: true, competitor: true },
      { feature: "Matchup grades (A–F)", lasyly: true, competitor: false },
      { feature: "Confidence scores (1–5)", lasyly: true, competitor: false },
      { feature: "Correlated parlay builder", lasyly: true, competitor: false },
      { feature: "AI-generated writeups", lasyly: true, competitor: false },
      { feature: "Community rooms", lasyly: true, competitor: false },
      { feature: "Live scores (10+ sports)", lasyly: true, competitor: false },
      { feature: "Pick tracker", lasyly: true, competitor: true },
      { feature: "Pick marketplace", lasyly: true, competitor: false },
      { feature: "Sports news feed", lasyly: true, competitor: false },
      { feature: "Free to use", lasyly: true, competitor: false, note: "$30–50/month subscription" },
      { feature: "NBA + NFL + Tennis + Soccer", lasyly: true, competitor: "NBA + NFL only" },
    ],
    competitorBestFor: "Bettors willing to pay a monthly fee for a focused prop research tool with line movement data.",
    lasylyBestFor: "Bettors who want the same analytics (and more) without a subscription — plus community, live scores, and a pick marketplace.",
    verdict: "PropShark is a solid tool if you're willing to pay. But Lasyly matches its core features (hit rates, line movement) and adds matchup grades, a parlay builder, community rooms, and live scores — all without charging a dime.",
  },
  {
    slug: "lasyly-vs-action-network",
    competitorName: "Action Network",
    competitorUrl: "https://actionnetwork.com",
    competitorTagline: "Sports betting news and tools",
    heroHeadline: "Lasyly vs Action Network",
    heroSubheadline: "Action Network is a media company. Lasyly is a research platform built for bettors.",
    metaTitle: "Lasyly vs Action Network (2026) — Analytics Platform Comparison",
    metaDescription: "Compare Lasyly with Action Network. See how free prop analytics, community rooms, and live scores compare to Action's subscription-based tools and content.",
    competitorOverview: "Action Network is a sports betting media company offering news, expert picks, odds comparison, and betting tools. Their premium tier (Action PRO) costs $99/year and unlocks advanced features like sharp money indicators and bet tracking.",
    switchReasons: [
      "Lasyly's prop analytics are deeper — matchup grades, confidence scores, streak visualization",
      "No paywall — everything is free vs Action's $99/year PRO tier",
      "Real-time community rooms replace scattered Discord/Twitter discussions",
      "Correlated parlay builder is unique to Lasyly",
      "Pick marketplace lets skilled bettors earn from their expertise",
      "Cleaner, modern dark-themed UI designed for mobile-first use",
    ],
    features: [
      { feature: "Player prop hit rates", lasyly: true, competitor: "PRO only" },
      { feature: "Matchup grades (A–F)", lasyly: true, competitor: false },
      { feature: "Confidence scores", lasyly: true, competitor: false },
      { feature: "Odds comparison", lasyly: false, competitor: true },
      { feature: "Sharp money indicators", lasyly: false, competitor: "PRO only" },
      { feature: "Expert picks/articles", lasyly: false, competitor: true },
      { feature: "Community rooms", lasyly: true, competitor: false },
      { feature: "Correlated parlay builder", lasyly: true, competitor: false },
      { feature: "Live scores", lasyly: true, competitor: true },
      { feature: "Pick tracker", lasyly: true, competitor: true },
      { feature: "Pick marketplace", lasyly: true, competitor: false },
      { feature: "Sports news feed", lasyly: true, competitor: true },
      { feature: "Free to use", lasyly: true, competitor: "Freemium ($99/yr PRO)" },
      { feature: "Mobile-first dark UI", lasyly: true, competitor: false },
    ],
    competitorBestFor: "Bettors who want expert-written content, odds comparison across sportsbooks, and sharp money indicators.",
    lasylyBestFor: "Bettors who want free, data-driven prop analytics with community features and don't need odds comparison or expert articles.",
    verdict: "Action Network excels at sports betting media — articles, expert picks, and odds comparison. Lasyly excels at self-serve analytics — hit rates, matchup grades, and community-driven research. If you want to do your own research rather than follow experts, Lasyly is the better fit.",
  },
  {
    slug: "lasyly-vs-oddsjam",
    competitorName: "OddsJam",
    competitorUrl: "https://oddsjam.com",
    competitorTagline: "Positive EV and arbitrage betting tools",
    heroHeadline: "Lasyly vs OddsJam",
    heroSubheadline: "OddsJam finds +EV bets. Lasyly helps you research props. Different tools, different goals.",
    metaTitle: "Lasyly vs OddsJam (2026) — Prop Analytics vs EV Betting Tools",
    metaDescription: "Compare Lasyly's free prop analytics with OddsJam's positive EV and arbitrage tools. Understand which platform fits your betting style.",
    competitorOverview: "OddsJam is a premium tool focused on finding positive expected value (+EV) bets and arbitrage opportunities across sportsbooks. It compares odds from dozens of books to identify mispriced lines. Pricing starts at $99/month.",
    switchReasons: [
      "Lasyly is free — OddsJam costs $99+/month",
      "Player-level prop analytics with hit rates and matchup grades",
      "Community rooms for discussing picks and strategies",
      "Correlated parlay builder for multi-leg research",
      "Pick tracker to measure your actual ROI over time",
      "Live scores and news in the same platform",
    ],
    features: [
      { feature: "Positive EV bet finder", lasyly: false, competitor: true },
      { feature: "Arbitrage scanner", lasyly: false, competitor: true },
      { feature: "Odds comparison", lasyly: false, competitor: true },
      { feature: "Player prop hit rates", lasyly: true, competitor: false },
      { feature: "Matchup grades (A–F)", lasyly: true, competitor: false },
      { feature: "Correlated parlay builder", lasyly: true, competitor: false },
      { feature: "Community rooms", lasyly: true, competitor: false },
      { feature: "Live scores", lasyly: true, competitor: false },
      { feature: "Pick tracker", lasyly: true, competitor: true },
      { feature: "Pick marketplace", lasyly: true, competitor: false },
      { feature: "Free to use", lasyly: true, competitor: false, note: "$99+/month" },
    ],
    competitorBestFor: "Sharp bettors focused on mathematical edge — finding +EV lines and arbitrage opportunities across multiple sportsbooks.",
    lasylyBestFor: "Prop bettors who research individual players, want community insights, and prefer a free all-in-one platform over expensive specialized tools.",
    verdict: "OddsJam and Lasyly serve fundamentally different betting styles. OddsJam is for math-driven bettors hunting mispriced lines across books. Lasyly is for prop bettors who research player performance, discuss picks with a community, and track results — all for free.",
  },
  {
    slug: "lasyly-vs-betstamp",
    competitorName: "BetStamp",
    competitorUrl: "https://betstamp.app",
    competitorTagline: "Bet tracking and odds comparison",
    heroHeadline: "Lasyly vs BetStamp",
    heroSubheadline: "BetStamp tracks your bets. Lasyly helps you research, discuss, and track — all in one.",
    metaTitle: "Lasyly vs BetStamp (2026) — All-in-One vs Bet Tracker Comparison",
    metaDescription: "Compare Lasyly with BetStamp for bet tracking, prop analytics, and community features. See why bettors choose Lasyly's free all-in-one platform.",
    competitorOverview: "BetStamp is a bet tracking app with odds comparison features. It lets you log bets, compare lines across sportsbooks, and analyze your betting performance over time. It offers both free and premium tiers.",
    switchReasons: [
      "Lasyly includes prop analytics BEFORE you bet — not just tracking after",
      "Matchup grades and hit rates help you make better picks",
      "Community rooms for real-time discussion and pick sharing",
      "Correlated parlay builder for smarter multi-leg bets",
      "Live scores and news keep everything in one place",
      "Pick marketplace lets you monetize your track record",
    ],
    features: [
      { feature: "Bet tracking", lasyly: true, competitor: true },
      { feature: "ROI analytics", lasyly: true, competitor: true },
      { feature: "Odds comparison", lasyly: false, competitor: true },
      { feature: "Player prop hit rates", lasyly: true, competitor: false },
      { feature: "Matchup grades (A–F)", lasyly: true, competitor: false },
      { feature: "Correlated parlay builder", lasyly: true, competitor: false },
      { feature: "Community rooms", lasyly: true, competitor: false },
      { feature: "Live scores", lasyly: true, competitor: false },
      { feature: "Pick marketplace", lasyly: true, competitor: false },
      { feature: "Sports news feed", lasyly: true, competitor: false },
      { feature: "Free to use", lasyly: true, competitor: "Freemium" },
    ],
    competitorBestFor: "Bettors who primarily need a clean bet tracker with odds comparison across sportsbooks.",
    lasylyBestFor: "Bettors who want the full workflow — research props, discuss with community, place bets, track results — without switching between apps.",
    verdict: "BetStamp is a solid bet tracker with useful odds comparison. But it only covers the 'after' — tracking bets you've already placed. Lasyly covers the entire workflow: research with analytics, validate with community, and then track your performance.",
  },
]

export function getComparisonBySlug(slug: string): ComparisonData | undefined {
  return COMPARISONS.find((c) => c.slug === slug)
}

export function getAllComparisonSlugs(): string[] {
  return COMPARISONS.map((c) => c.slug)
}
