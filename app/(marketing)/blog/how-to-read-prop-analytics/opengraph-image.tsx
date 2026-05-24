import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "How to Read Prop Analytics: Hit Rates, Matchup Grades & Confidence Scores — Lasyly Blog"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OGImage() {
  const metrics = ["Hit Rate L5/L10/L20", "Matchup Grade A–F", "Confidence ★★★★★", "Trend Arrow", "Streak Dots", "Correlations"]
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
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundImage: "linear-gradient(rgba(108,99,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(108,99,255,0.04) 1px, transparent 1px)", backgroundSize: "80px 80px" }} />
        <div style={{ position: "absolute", top: "-5%", left: "-5%", width: "50%", height: "50%", background: "radial-gradient(ellipse, rgba(108,99,255,0.15) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", top: 60, left: 80, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#D4FF00" }} />
          <span style={{ color: "#fff", fontSize: 22, fontWeight: 700 }}>Lasyly</span>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 22, marginLeft: 8 }}>/ Blog</span>
        </div>
        {/* Metric pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28, maxWidth: 700 }}>
          {metrics.map((m) => (
            <div key={m} style={{ background: "rgba(108,99,255,0.15)", border: "1px solid rgba(108,99,255,0.3)", borderRadius: 6, padding: "5px 12px", color: "#8B83FF", fontSize: 12, fontFamily: "monospace", letterSpacing: "0.05em" }}>{m}</div>
          ))}
        </div>
        <div style={{ color: "#ffffff", fontSize: 52, fontWeight: 900, lineHeight: 1.05, letterSpacing: "-1.5px", marginBottom: 22, maxWidth: 860 }}>
          How to Read Prop Analytics:
          <br />
          <span style={{ color: "#8B83FF" }}>Hit Rates, Matchup Grades & Confidence Scores</span>
        </div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 19, lineHeight: 1.5, maxWidth: 660 }}>
          A plain-English breakdown of every metric on a Lasyly prop card. Analytics · 8 min read
        </div>
      </div>
    ),
    { ...size }
  )
}
