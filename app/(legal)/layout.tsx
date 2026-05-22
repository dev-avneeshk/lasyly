export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {children}
      </div>
    </div>
  )
}
