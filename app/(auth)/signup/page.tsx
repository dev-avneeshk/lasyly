import type { Metadata } from "next"
import { SignupContent } from "./SignupContent"
export const metadata: Metadata = { title: "Sign up", robots: { index: false } }
export default function SignupPage() {
  return <SignupContent />
}
