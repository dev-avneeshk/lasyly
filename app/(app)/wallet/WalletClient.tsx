"use client"

import { Wallet, Clock } from "lucide-react"

export default function WalletClient() {
  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-16 md:py-24 text-center">
      <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-8 md:p-12">
        <div className="w-16 h-16 rounded-full bg-[var(--color-lime)]/10 flex items-center justify-center mx-auto mb-6">
          <Wallet className="w-8 h-8 text-[var(--color-lime)]" />
        </div>

        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-3">
          Wallet Coming Soon
        </h1>

        <p className="text-[var(--color-text-muted)] text-sm max-w-md mx-auto mb-6">
          We&apos;re building a seamless way to manage your funds, top up your balance, and track all your transactions. Stay tuned.
        </p>

        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-border)]/30 border border-[var(--color-border)]">
          <Clock className="w-4 h-4 text-[var(--color-text-muted)]" />
          <span className="text-xs font-medium text-[var(--color-text-muted)]">Under Development</span>
        </div>
      </div>
    </div>
  )
}
