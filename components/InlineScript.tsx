/**
 * InlineScript — renders a synchronous inline `<script>` that runs during HTML
 * parsing (before first paint), without triggering React hydration warnings.
 *
 * Why this exists:
 *   Inline scripts placed in <head> via `dangerouslySetInnerHTML` are a common
 *   source of dev-only hydration mismatches. Browser extensions (Bitdefender
 *   TrafficLight, Grammarly, etc.) rewrite the <script> element — swapping its
 *   body and stamping on attributes like `bis_use` / `src="chrome-extension://…"`
 *   — before React hydrates. React then compares the extension-mutated DOM node
 *   against what it rendered on the server, finds a mismatch, and throws:
 *     "A tree hydrated but some attributes of the server rendered HTML didn't
 *      match the client properties."
 *
 * The fix (per the Next.js "Preventing Flash Before Hydration" guide):
 *   - Set `type="text/javascript"` on the server so the browser executes it
 *     during parsing, and `type="text/plain"` on the client so React's render
 *     produces an inert node (the script has already run by then).
 *   - Add `suppressHydrationWarning` so React accepts whatever is in the DOM
 *     (including any extension mutations) instead of erroring.
 *
 * Reference: node_modules/next/dist/docs/01-app/02-guides/
 *            preventing-flash-before-hydration.md  ("Extracting a reusable component")
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default InlineScript;
