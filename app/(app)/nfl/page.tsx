import type { Metadata } from "next"
import NflClient from "./NflClient"

export const metadata: Metadata = {
  title: "NFL Auction 1v1 | Lasyly Gridiron",
  description: "Win a live bidding war for a 9-player NFL roster, then simulate a 1v1 game against an intelligent CPU manager.",
  robots: { index: false },
}

export default function NflPage() {
  return <NflClient />
}
