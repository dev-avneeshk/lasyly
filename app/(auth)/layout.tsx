import Link from "next/link"
import Image from "next/image"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-[var(--color-background)] relative overflow-hidden">
      {/* Ambient orbs — desktop only */}
      <div className="hidden md:block absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-[var(--color-lime)]/8 blur-[160px] pointer-events-none" />
      <div className="hidden md:block absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[var(--color-lime)]/4 blur-[140px] pointer-events-none" />

      {/* Left panel - Branding */}
      <div className="hidden md:flex flex-col flex-1 p-12 lg:p-16 justify-between relative z-10">
        <div>
          <Link href="/" className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-lime)] shadow-[0_0_30px_rgba(212,255,0,0.4)] flex items-center justify-center overflow-hidden">
              <Image src="/lasyly_logo.png" alt="Lasyly" width={40} height={40} className="w-full h-full object-cover" priority />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">Lasyly</span>
          </Link>
          <h1 className="text-[3rem] lg:text-[3.5rem] font-bold font-serif tracking-tight text-white leading-[1.08] max-w-lg">
            Share the thrill.<br />
            <span className="text-white/40">Own the pick.</span>
          </h1>
          <p className="mt-6 text-lg text-white/40 max-w-md leading-relaxed">
            The social platform for sports bettors. Join rooms, track live scores, and win together in real-time.
          </p>
        </div>

        <p className="text-sm text-white/30">
          Be among the first to join.
        </p>
      </div>

      {/* Right panel - Auth form */}
      <div className="flex-1 flex flex-col justify-center p-6 md:p-12 lg:p-20 relative z-10 w-full max-w-[560px] mx-auto">
        {/* Mobile logo */}
        <div className="md:hidden flex items-center gap-3 mb-12 justify-center">
          <div className="w-8 h-8 rounded-xl bg-[var(--color-lime)] flex items-center justify-center overflow-hidden">
            <Image src="/lasyly_logo.png" alt="Lasyly" width={32} height={32} className="w-full h-full object-cover" priority />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">Lasyly</span>
        </div>

        {/* Form card — double-bezel */}
        <div className="rounded-[2rem] p-[1px] bg-gradient-to-b from-white/10 to-transparent">
          <div className="rounded-[calc(2rem-1px)] bg-[var(--color-surface)] p-8 md:p-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)]">
            {children}
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-[var(--color-text-muted)]">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="text-white/70 hover:text-white transition-colors duration-300">Terms</Link>
          {" "}and{" "}
          <Link href="/privacy" className="text-white/70 hover:text-white transition-colors duration-300">Privacy Policy</Link>.
        </div>
      </div>
    </div>
  )
}
