import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "Lasyly — Where Sports Bettors Win Together"
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
        {/* Grid accent lines */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: "linear-gradient(rgba(212,255,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(212,255,0,0.04) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }} />

        {/* Glow */}
        <div style={{
          position: "absolute", top: "-10%", left: "-5%",
          width: "50%", height: "60%",
          background: "radial-gradient(ellipse, rgba(212,255,0,0.12) 0%, transparent 70%)",
        }} />

        {/* Logo mark */}
        <div style={{
          position: "absolute", top: 60, left: 80,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: "#D4FF00",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ width: 28, height: 28, background: "#0A0B0F", borderRadius: 4 }} />
          </div>
          <span style={{ color: "#ffffff", fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px" }}>
            Lasyly
          </span>
        </div>

        {/* Tagline pill */}
        <div style={{
          display: "flex", alignItems: "center",
          background: "rgba(212,255,0,0.12)",
          border: "1px solid rgba(212,255,0,0.3)",
          borderRadius: 999,
          padding: "8px 20px",
          marginBottom: 28,
        }}>
          <span style={{ color: "#D4FF00", fontSize: 14, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" }}>
            Sports Betting Platform
          </span>
        </div>

        {/* Headline */}
        <div style={{
          color: "#ffffff",
          fontSize: 72,
          fontWeight: 900,
          lineHeight: 0.95,
          letterSpacing: "-2px",
          marginBottom: 28,
          maxWidth: 780,
        }}>
          Where bettors<br />
          <span style={{ color: "#D4FF00" }}>win together.</span>
        </div>

        {/* Description */}
        <div style={{
          color: "rgba(255,255,255,0.55)",
          fontSize: 22,
          lineHeight: 1.4,
          maxWidth: 640,
          marginBottom: 48,
        }}>
          Prop analytics · Real-time rooms · Live scores · Tipster marketplace
        </div>

        {/* Stat pills */}
        <div style={{ display: "flex", gap: 12 }}>
          {["10+ Sports", "Hit Rates & Matchup Grades", "85% Tipster Revenue"].map((s) => (
            <div key={s} style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "10px 20px",
              color: "rgba(255,255,255,0.7)",
              fontSize: 15,
              fontFamily: "monospace",
              letterSpacing: "0.05em",
            }}>
              {s}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
