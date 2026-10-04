import type { Metadata } from "next"
import { LoginContent } from "./LoginContent"
export const metadata: Metadata = { title: "Log in", robots: { index: false } }
export default function LoginPage() {
  return <LoginContent />
}
