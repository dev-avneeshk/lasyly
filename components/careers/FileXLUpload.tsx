import { FILEXL_EMBED_SRC } from "@/lib/careers/constants"

/**
 * FileXL File Upload Widget, embedded as supplied (same src and attributes,
 * written in JSX form). The iframe IS the upload UI; there is intentionally no
 * file picker or upload button of our own around it.
 *
 * FileXL runs on its own origin and does not notify the parent page when an
 * upload completes (no postMessage/callback in the embed as of 2026-09-29), so
 * this component cannot know whether a file was uploaded. The form asks the
 * applicant to paste the download link FileXL shows after the upload.
 */
export function FileXLUpload() {
  return (
    <div className="filexl-upload-container">
      {/* FileXL File Upload Widget */}
      <iframe
        src={FILEXL_EMBED_SRC}
        width="100%"
        height="600"
        frameBorder="0"
        allow="camera; microphone"
        style={{
          border: "none",
          borderRadius: 12,
          minHeight: 500,
          background: "transparent",
        }}
        title="File Upload Widget"
        allowFullScreen
      />
      {/* End FileXL Widget */}
    </div>
  )
}
