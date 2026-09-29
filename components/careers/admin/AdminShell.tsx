import Link from "next/link"
import { cn } from "@/lib/utils"
import { STATUS_BADGE_CLASS, APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/careers/constants"

export function AdminShell({
  active,
  title,
  actions,
  children,
}: {
  active: "applications" | "jobs"
  title: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  const tabs = [
    { key: "applications", label: "Applications", href: "/admin/careers" },
    { key: "jobs", label: "Jobs", href: "/admin/careers/jobs" },
  ] as const

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">Careers admin</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold font-serif tracking-tight text-white">{title}</h1>
        {actions}
      </div>
      <nav aria-label="Careers admin" className="mt-6 flex gap-1 border-b border-[var(--color-border)]">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={active === t.key ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors",
              active === t.key
                ? "border-[var(--color-lime)] font-medium text-[var(--color-lime)]"
                : "border-transparent text-[var(--color-text-muted)] hover:text-white"
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  )
}

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const label = APPLICATION_STATUSES.find((s) => s.value === status)?.label ?? status
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STATUS_BADGE_CLASS[status] ?? "border-[var(--color-border)] text-[var(--color-text-muted)]"
      )}
    >
      {label}
    </span>
  )
}
