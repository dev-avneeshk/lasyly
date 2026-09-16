import type { Metadata } from "next"
import ArenaHub from "./ArenaHub"

export const metadata: Metadata = {
  title: "Arena | Lasyly",
  description: "Play NBA and NFL auctions and test your sports IQ with quizzes — all in one place.",
  robots: { index: false },
}

export default function ArenaPage() {
  return <ArenaHub />
}
