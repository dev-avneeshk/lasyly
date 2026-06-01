import { Metadata } from "next"
import TipstersClient from "./TipstersClient"

export const metadata: Metadata = {
  title: "Tipster Marketplace",
  description: "Discover and follow top sports tipsters. Browse by win rate, followers, and sport.",
}

export default function TipstersPage() {
  return <TipstersClient />
}
