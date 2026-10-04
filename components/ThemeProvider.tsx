"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { MotionConfig } from "framer-motion"

type Theme = "dark" | "light"

type ThemeContextValue = {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark")

  // data-theme is applied before first paint by the inline script in
  // app/layout.tsx; this only syncs the toggle's state. The Provider is always
  // rendered: swapping a fragment for it after mount remounted the whole tree.
  useEffect(() => {
    if (document.documentElement.dataset.theme === "light") setTheme("light")
  }, [])

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark"
    setTheme(next)
    localStorage.setItem("lasyly-theme", next)
    document.documentElement.setAttribute("data-theme", next)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {/* framer-motion ignores prefers-reduced-motion unless told to. */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </ThemeContext.Provider>
  )
}
