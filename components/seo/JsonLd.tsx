/**
 * Renders a JSON-LD <script> tag.
 * Usage: <JsonLd data={{ "@context": "https://schema.org", ... }} />
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // `<` escaped so a value containing "</script>" (e.g. a blog title) can't close the tag.
      // biome-ignore lint/security/noDangerouslySetInnerHtml: controlled structured data
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  )
}
