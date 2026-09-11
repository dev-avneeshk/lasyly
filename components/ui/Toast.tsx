"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { Check, X, AlertTriangle, Info } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────

type ToastType = "success" | "error" | "info"

type ToastItem = {
  id: number
  message: string
  type: ToastType
}

type ToastContextValue = {
  /** Fire a toast. Auto-dismisses after ~3s. */
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

/**
 * App-wide toast provider. Wrap the app (or a subtree) once, then call
 * `useToast().toast("...")` anywhere. Replaces one-off inline toast state.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = Date.now() + Math.random()
    setItems((prev) => [...prev, { id, message, type }])
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-2 pointer-events-none">
        {items.map((t) => (
          <ToastCard key={t.id} item={t} onDone={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastCard({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3000)
    return () => clearTimeout(timer)
  }, [onDone])

  const config = {
    success: { icon: Check, color: "#B8FF4F" },
    error: { icon: AlertTriangle, color: "#F87171" },
    info: { icon: Info, color: "#60A5FA" },
  }[item.type]
  const Icon = config.icon

  return (
    <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl bg-[#1A1A1A] border border-white/[0.08] pl-3.5 pr-2.5 py-2.5 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200 max-w-[90vw]">
      <span
        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
        style={{ background: `${config.color}22` }}
      >
        <Icon className="w-3 h-3" style={{ color: config.color }} />
      </span>
      <span className="text-[13px] font-medium text-white/85">{item.message}</span>
      <button
        onClick={onDone}
        className={cn("w-6 h-6 rounded-lg flex items-center justify-center text-white/25 hover:text-white/60 hover:bg-white/[0.06] transition-colors shrink-0")}
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

/** Access the toast dispatcher. Falls back to a no-op if no provider is mounted. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Fail soft rather than crash if a component using toast renders outside
    // the provider (e.g. in isolation). Logs to console in dev.
    return {
      toast: (message: string) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[useToast] no ToastProvider mounted; message:", message)
        }
      },
    }
  }
  return ctx
}
