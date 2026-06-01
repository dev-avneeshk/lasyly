"use client"

import { createContext, useContext, useEffect, useState } from "react"

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
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem("lasyly-theme") as Theme | null
    if (stored === "light" || stored === "dark") {
      setTheme(stored)
      document.documentElement.setAttribute("data-theme", stored)
    }
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark"
    setTheme(next)
    localStorage.setItem("lasyly-theme", next)
    document.documentElement.setAttribute("data-theme", next)
  }

  // Prevent flash of wrong theme
  if (!mounted) return <>{children}</>

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
