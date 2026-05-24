import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "The Complete Guide to NBA Player Props in 2026 — Lasyly Blog"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OGImage() {
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
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundImage: "linear-gradient(rgba(245,158,11,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.03) 1px, transparent 1px)", backgroundSize: "80px 80px" }} />
        <div style={{ position: "absolute", top: "-5%", right: "-5%", width: "45%", height: "55%", background: "radial-gradient(ellipse, rgba(245,158,11,0.15) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", top: 60, left: 80, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#D4FF00" }} />
          <span style={{ color: "#fff", fontSize: 22, fontWeight: 700 }}>Lasyly</span>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 22, marginLeft: 8 }}>/ Blog</span>
        </div>
        <div style={{ display: "flex", marginBottom: 24, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 999, padding: "7px 18px" }}>
          <span style={{ color: "#F59E0B", fontSize: 12, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" }}>NBA · 10 min read</span>
        </div>
        <div style={{ color: "#ffffff", fontSize: 58, fontWeight: 900, lineHeight: 1.0, letterSpacing: "-1.5px", marginBottom: 24, maxWidth: 860 }}>
          The Complete Guide to
          <br />
          <span style={{ color: "#F59E0B" }}>NBA Player Props</span>
          <span style={{ color: "rgba(255,255,255,0.4)" }}> in 2026</span>
        </div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 20, lineHeight: 1.5, maxWidth: 680 }}>
          Points, rebounds, assists, 3PM — defensive matchups, line value, correlated parlays, and how to track your edge.
        </div>
      </div>
    ),
    { ...size }
  )
}
