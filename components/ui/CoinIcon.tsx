import * as React from "react"
import { cn } from "@/lib/utils"

export type CoinIconProps = React.SVGProps<SVGSVGElement> & {
  /** Convenience size in px, applied to width and height. Overridden by className width/height. */
  size?: number
}

/**
 * Lasyly Coin mark. An inline SVG so it inherits `currentColor` — style it
 * with a text color utility (e.g. `text-[var(--color-lime)]`) just like a
 * lucide icon, and size it with `className="w-4 h-4"` or the `size` prop.
 *
 * Coins are Lasyly's in-app currency for content/community access. This is
 * the single source of truth for the coin visual — do not reintroduce the
 * ad-hoc "◎" glyph or a "$" symbol.
 */
export function CoinIcon({ size = 16, className, ...props }: CoinIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label="Coins"
      className={cn("inline-block shrink-0", className)}
      {...props}
    >
      {/* Outer coin */}
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.18" />
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      {/* Inner rim */}
      <circle
        cx="12"
        cy="12"
        r="6"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.55"
      />
      {/* Lasyly "L" mark */}
      <path
        d="M10.4 8.2v7.6h3.9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

export default CoinIcon
