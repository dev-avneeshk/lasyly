"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Bell, UserPlus, Trophy, XCircle, Users, Award, Check } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

type Notification = {
  id: string
  type: "follow" | "parlay_won" | "parlay_lost" | "room_invite" | "achievement"
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string
  metadata: Record<string, unknown>
}

const TYPE_ICONS: Record<Notification["type"], typeof Bell> = {
  follow: UserPlus,
  parlay_won: Trophy,
  parlay_lost: XCircle,
  room_invite: Users,
  achievement: Award,
}

const TYPE_COLORS: Record<Notification["type"], string> = {
  follow: "text-blue-400",
  parlay_won: "text-[var(--color-success)]",
  parlay_lost: "text-[var(--color-danger)]",
  room_invite: "text-purple-400",
  achievement: "text-[var(--color-lime)]",
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)

  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export default function NotificationBell({ collapsed }: { collapsed?: boolean }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications")
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications ?? [])
      setUnreadCount(data.unreadCount ?? 0)
    } catch {
      // silently fail
    }
  }, [])

  // Initial fetch + polling every 30s
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [isOpen])

  const markAllRead = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      })
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
        setUnreadCount(0)
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
    }
  }

  const markRead = async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      })
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch {
      // silently fail
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border)]/30 transition-colors relative group",
          collapsed ? "justify-center w-9 h-9" : "gap-4 w-full px-4 py-3"
        )}
        title={collapsed ? "Notifications" : undefined}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 flex-shrink-0" />
        {!collapsed && <span>Notifications</span>}
        {unreadCount > 0 && (
          <span className={cn(
            "absolute min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[var(--color-danger)] text-white text-[10px] font-bold px-1",
            collapsed ? "top-0 right-0" : "top-2 left-6"
          )}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={cn(
          "absolute w-80 max-h-[420px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col",
          collapsed ? "top-full right-0 mt-2" : "bottom-full left-0 mb-2"
        )}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
            <h3 className="text-sm font-bold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                disabled={isLoading}
                className="text-xs text-[var(--color-lime)] hover:underline font-medium flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-2 opacity-40" />
                <p className="text-xs text-[var(--color-text-muted)]">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const Icon = TYPE_ICONS[notification.type] || Bell
                const color = TYPE_COLORS[notification.type] || "text-white"
                const content = (
                  <div
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/5 cursor-pointer",
                      !notification.is_read && "bg-[var(--color-lime)]/5"
                    )}
                    onClick={() => {
                      if (!notification.is_read) markRead(notification.id)
                      setIsOpen(false)
                    }}
                  >
                    <div className={cn("mt-0.5 flex-shrink-0", color)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs leading-tight", notification.is_read ? "text-white/70" : "text-white font-medium")}>
                        {notification.title}
                      </p>
                      {notification.body && (
                        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 truncate">
                          {notification.body}
                        </p>
                      )}
                      <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                        {timeAgo(notification.created_at)}
                      </p>
                    </div>
                    {!notification.is_read && (
                      <div className="w-2 h-2 rounded-full bg-[var(--color-lime)] mt-1.5 flex-shrink-0" />
                    )}
                  </div>
                )

                if (notification.link) {
                  return (
                    <Link key={notification.id} href={notification.link}>
                      {content}
                    </Link>
                  )
                }
                return <div key={notification.id}>{content}</div>
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
