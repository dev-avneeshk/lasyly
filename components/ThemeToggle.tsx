"use client"

import { Sun, Moon } from "lucide-react"
import { useTheme } from "@/components/ThemeProvider"
import { cn } from "@/lib/utils"

type ThemeToggleProps = {
  collapsed?: boolean
}

export default function ThemeToggle({ collapsed = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "flex items-center rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border)]/30 transition-colors group",
        collapsed ? "justify-center w-9 h-9" : "gap-4 w-full px-4 py-3"
      )}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <Sun className="w-5 h-5 flex-shrink-0 group-hover:text-yellow-400 transition-colors" />
      ) : (
        <Moon className="w-5 h-5 flex-shrink-0 group-hover:text-blue-400 transition-colors" />
      )}
      {!collapsed && (
        <span className="text-sm">{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
      )}
    </button>
  )
}
