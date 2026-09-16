import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a dollar amount for display.
 *
 * The auction engine deals in whole dollars, but a few values are derived from
 * fractional intermediate math (budget / rosterSize, value multipliers, AI
 * ceilings). Those are rounded before they reach state — but persisted games or
 * an unexpected config can still surface a float like `1.0101020`, which then
 * renders with an ugly repeating tail. Rounding at the render boundary makes
 * the UI robust to any stray float regardless of where it came from.
 *
 * Returns the integer dollar value as a string (no currency symbol — callers
 * add their own "$"). NaN / null / undefined collapse to "0".
 */
export function formatMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "0"
  return String(Math.round(value))
}
