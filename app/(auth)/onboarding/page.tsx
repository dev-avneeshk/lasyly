import type { Metadata } from "next"
import { OnboardingContent } from "./OnboardingContent"
export const metadata: Metadata = { title: "Welcome", robots: { index: false } }
export default function OnboardingPage() {
  return <OnboardingContent />
}
