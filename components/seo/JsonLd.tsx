/**
 * Renders a JSON-LD <script> tag.
 * Usage: <JsonLd data={{ "@context": "https://schema.org", ... }} />
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: controlled structured data
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
