/**
 * Returns `target` only if it is a same-origin relative path, otherwise
 * `fallback`. Blocks open redirects via `?redirect=` / `?next=` such as
 * `https://evil.com`, `//evil.com` (protocol-relative) and `/\evil.com`
 * (browsers normalise the backslash to a slash).
 */
export function safeRedirectPath(target: string | null | undefined, fallback = "/explore"): string {
  if (!target) return fallback
  if (!target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) return fallback
  if (/[\u0000-\u001f]/.test(target)) return fallback
  return target
}
