import { Suspense } from "react"
import { LoginContent } from "./LoginContent"

function LoginFallback() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-40 rounded bg-white/5 animate-pulse" />
      <div className="h-4 w-56 rounded bg-white/5 animate-pulse" />
      <div className="h-12 rounded-xl bg-white/5 animate-pulse mt-6" />
      <div className="h-12 rounded-xl bg-white/5 animate-pulse" />
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  )
}
