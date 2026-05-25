/**
 * Wraps blog post pages in the newspaper-style light theme
 * matching the /news section aesthetic. Overrides CSS custom properties
 * so existing components using var(--color-*) automatically adapt.
 */
export default function BlogNewspaperWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen"
      style={{
        // @ts-expect-error -- CSS custom properties
        "--color-background": "#f5f0e8",
        "--color-surface": "#ebe5d9",
        "--color-surface-elevated": "#e2dbd0",
        "--color-border": "rgba(180, 165, 140, 0.5)",
        "--color-text-primary": "#1a1a1a",
        "--color-text-muted": "#5c5145",
        "--color-lime": "#8b4513",
        background: "#f5f0e8",
        color: "#1a1a1a",
      }}
    >
      {children}
    </div>
  )
}
