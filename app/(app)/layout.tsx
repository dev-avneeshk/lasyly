import Sidebar from "@/components/layout/Sidebar"
import BottomNav from "@/components/layout/BottomNav"
import AppScrollRestorer from "@/components/layout/AppScrollRestorer"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-background)] relative w-full max-w-full">
      {/* Preconnect to ESPN CDN — used heavily on news, scores, analysis pages */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <link rel="preconnect" href="https://a.espncdn.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://a.espncdn.com" />
        <link rel="dns-prefetch" href="https://s.espncdn.com" />
      </head>
      {/* Premium background hint — kept lightweight to avoid blocking paint.
          Single, smaller, lower blur radius; hidden on small screens where
          it's invisible behind UI anyway and just costs compositor time. */}
      <div
        aria-hidden
        className="hidden md:block absolute top-[-10%] left-[-10%] w-[30%] h-[30%] rounded-full bg-[var(--color-lime)]/5 blur-3xl pointer-events-none"
      />

      <Sidebar />
      <AppScrollRestorer />
      <main data-app-scroll className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden scroll-pt-28 pb-36 md:pb-0">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
