import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "Lasyly Blog — Sports Betting Guides & Prop Analytics"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function BlogOGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0A0B0F",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "flex-end",
          padding: "72px 80px",
          fontFamily: "Georgia, serif",
          position: "relative",
        }}
      >
        {/* Grid lines */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: "linear-gradient(rgba(212,255,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(212,255,0,0.03) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }} />
        {/* Glow */}
        <div style={{
          position: "absolute", top: "-10%", right: "-5%",
          width: "40%", height: "55%",
          background: "radial-gradient(ellipse, rgba(108,99,255,0.18) 0%, transparent 70%)",
        }} />
        {/* Logo */}
        <div style={{ position: "absolute", top: 60, left: 80, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "#D4FF00", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 24, height: 24, background: "#0A0B0F", borderRadius: 4 }} />
          </div>
          <span style={{ color: "#ffffff", fontSize: 24, fontWeight: 700 }}>Lasyly Blog</span>
        </div>
        {/* Pill */}
        <div style={{
          display: "flex", alignItems: "center",
          background: "rgba(108,99,255,0.15)", border: "1px solid rgba(108,99,255,0.35)",
          borderRadius: 999, padding: "8px 20px", marginBottom: 28,
        }}>
          <span style={{ color: "#8B83FF", fontSize: 13, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" }}>
            Guides · Analytics · Community
          </span>
        </div>
        <div style={{ color: "#ffffff", fontSize: 68, fontWeight: 900, lineHeight: 0.95, letterSpacing: "-2px", marginBottom: 28, maxWidth: 780 }}>
          Bet smarter.<br />
          <span style={{ color: "#D4FF00" }}>Not harder.</span>
        </div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 21, lineHeight: 1.4, maxWidth: 600 }}>
          Prop analytics guides, betslip strategy, NBA player props, and more.
        </div>
      </div>
    ),
    { ...size }
  )
}
