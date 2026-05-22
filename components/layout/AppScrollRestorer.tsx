"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

export default function AppScrollRestorer() {
  const pathname = usePathname()

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual"
    }

    const scrollToTop = () => {
      const appMain = document.querySelector<HTMLElement>("[data-app-scroll]")
      appMain?.scrollTo({ top: 0, left: 0, behavior: "auto" })
      window.scrollTo({ top: 0, left: 0, behavior: "auto" })
    }

    scrollToTop()

    const frame = requestAnimationFrame(scrollToTop)
    const timers = [80, 220, 500, 900].map((delay) => window.setTimeout(scrollToTop, delay))

    return () => {
      cancelAnimationFrame(frame)
      timers.forEach(window.clearTimeout)
    }
  }, [pathname])

  return null
}
