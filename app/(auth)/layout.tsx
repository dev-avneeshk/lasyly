import Link from "next/link"
import Image from "next/image"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // NOTE: removed await connection() — the CSP nonce is applied automatically
  // by Next.js 16 from the proxy CSP header. Keeping this as sync removes
  // the forced dynamic rendering that caused /onboarding FCP of 5.19s on mobile.
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[var(--color-background)] relative overflow-hidden">
      {/* Ambient orbs — desktop only, hidden on mobile to avoid GPU paint cost */}
      <div className="hidden md:block absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-[var(--color-lime)]/10 blur-[140px] pointer-events-none" />
      <div className="hidden md:block absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[var(--color-lime)]/5 blur-[120px] pointer-events-none" />

      {/* Left panel - Branding (hidden on mobile) */}
      <div className="hidden md:flex flex-col flex-1 p-12 justify-between relative z-10">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-lime)] shadow-[0_0_30px_rgba(212,255,0,0.5)] flex items-center justify-center overflow-hidden">
              <Image
                src="/lasyly_logo.png"
                alt="Lasyly"
                width={40}
                height={40}
                className="w-full h-full object-cover"
                priority
              />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">Lasyly</span>
          </div>
          <h1 className="text-5xl lg:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white to-white/50 leading-tight tracking-tighter max-w-lg mt-20">
            Share the thrill.<br />Own the pick.
          </h1>
          <p className="mt-6 text-xl text-[var(--color-text-muted)] max-w-md">
            The social platform for sports bettors. Join rooms, track live scores, and win together in real-time.
          </p>
        </div>

        <div className="flex gap-4 items-center">
          <p className="text-sm font-medium text-white/80">
            Be among the first to join.
          </p>
        </div>
      </div>

      {/* Right panel - Auth form container */}
      <div className="flex-1 flex flex-col justify-center p-6 md:p-12 lg:p-24 relative z-10 w-full max-w-[600px] mx-auto">
        <div className="md:hidden flex items-center gap-3 mb-12 justify-center">
          <div className="w-8 h-8 rounded-xl bg-[var(--color-lime)] flex items-center justify-center overflow-hidden">
            <Image
              src="/lasyly_logo.png"
              alt="Lasyly"
              width={32}
              height={32}
              className="w-full h-full object-cover"
              priority
            />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">Lasyly</span>
        </div>

        {/* Removed backdrop-blur-2xl — replaced with solid bg for mobile perf */}
        <div className="bg-[var(--color-surface)] p-8 md:p-10 rounded-3xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] w-full relative">
          {children}
        </div>

        <div className="mt-8 text-center text-sm text-[var(--color-text-muted)]">
          By continuing, you agree to our <Link href="/terms" className="text-white hover:underline">Terms</Link> and <Link href="/privacy" className="text-white hover:underline">Privacy Policy</Link>.
        </div>
      </div>
    </div>
  )
}
