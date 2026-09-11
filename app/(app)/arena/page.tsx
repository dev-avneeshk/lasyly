import type { Metadata } from "next"
import ArenaClient from "./ArenaClient"

export const metadata: Metadata = {
  title: "NBA Auction 1v1 | Lasyly Arena",
  description: "Build a 6-player NBA roster in a live auction, then simulate a 1v1 game.",
  robots: { index: false },
}

export default function ArenaPage() {
  return <ArenaClient />
}
