import type { Metadata } from "next"
import NflClient from "../NflClient"

/**
 * /nfl/auction is an alias into the same single-page auction experience hosted
 * at /nfl (which is itself a state machine: lobby → auction → sim → results).
 * Kept so the documented route resolves without a parallel implementation.
 */
export const metadata: Metadata = {
  title: "NFL Auction | Lasyly Gridiron",
  description: "Enter the live NFL player auction.",
  robots: { index: false },
}

export default function NflAuctionPage() {
  return <NflClient />
}
