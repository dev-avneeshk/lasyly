/**
 * Sport chips on the Experts/marketplace page, and the only categories
 * GET /api/experts-leaderboard accepts.
 *
 * Lives outside app/(app)/marketplace/TipstersClient.tsx on purpose: that file
 * is "use client", so the route handler importing it got a client reference
 * instead of the array and every request failed with "find is not a function".
 */
export const SPORT_FILTERS = [
  "All",
  "Football",
  "Basketball",
  "Tennis",
  "Cricket",
  "NFL",
  "Formula 1",
  "Esports",
  "MMA",
  "Boxing",
  "Golf",
]
