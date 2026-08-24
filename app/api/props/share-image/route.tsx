import { ImageResponse } from "next/og"
import { NextRequest } from "next/server"

export const runtime = "edge"

/**
 * GET /api/props/share-image?player=...&stat=...&line=...&hitRate=...&direction=...&trend=...&confidence=...&team=...&sport=...&grade=...
 *
 * Generates a branded 1080x1080 prop card image for social sharing.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  const player = searchParams.get("player") || "Player"
  const stat = (searchParams.get("stat") || "PTS").toUpperCase()
  const line = searchParams.get("line") || "0"
  const hitRate = searchParams.get("hitRate") || "0"
  const direction = searchParams.get("direction") || "over"
  const trend = searchParams.get("trend") || "neutral"
  const confidence = Math.min(5, Math.max(1, parseInt(searchParams.get("confidence") || "3", 10)))
  const team = searchParams.get("team") || ""
  const sport = searchParams.get("sport") || "NBA"
  const matchupGrade = searchParams.get("grade") || ""

  const hitRateNum = parseInt(hitRate, 10)
  const hitRateColor = hitRateNum >= 70 ? "#22c55e" : hitRateNum >= 50 ? "#D4FF00" : "#ef4444"
  const dirColor = direction === "over" ? "#22c55e" : "#ef4444"
  const trendArrow = trend === "up" ? "↑" : trend === "down" ? "↓" : "→"
  const trendColor = trend === "up" ? "#22c55e" : trend === "down" ? "#ef4444" : "#94a3b8"
  const stars = "★".repeat(confidence) + "☆".repeat(5 - confidence)

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#0A0B0F", padding: "60px", position: "relative" }}>
        {/* Background grid */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundImage: "linear-gradient(rgba(212,255,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(212,255,0,0.04) 1px, transparent 1px)", backgroundSize: "60px 60px", display: "flex" }} />

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "48px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "#D4FF00", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: "20px", height: "20px", background: "#0A0B0F", borderRadius: "4px", display: "flex" }} />
            </div>
            <div style={{ color: "#ffffff", fontSize: "22px", fontWeight: 700, display: "flex" }}>Lasyly</div>
          </div>
          <div style={{ display: "flex", background: "rgba(212,255,0,0.1)", border: "1px solid rgba(212,255,0,0.3)", borderRadius: "999px", padding: "6px 16px" }}>
            <div style={{ color: "#D4FF00", fontSize: "14px", fontWeight: 700, letterSpacing: "0.1em", display: "flex" }}>{sport}</div>
          </div>
        </div>

        {/* Player */}
        <div style={{ display: "flex", flexDirection: "column", marginBottom: "16px" }}>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "16px", display: "flex", marginBottom: "4px" }}>{team}</div>
          <div style={{ color: "#ffffff", fontSize: "52px", fontWeight: 900, display: "flex" }}>{player}</div>
        </div>

        {/* Prop line */}
        <div style={{ display: "flex", alignItems: "baseline", gap: "16px", marginBottom: "48px" }}>
          <div style={{ color: dirColor, fontSize: "20px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", display: "flex" }}>{direction}</div>
          <div style={{ color: "#D4FF00", fontSize: "72px", fontWeight: 900, display: "flex" }}>{line}</div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "28px", fontWeight: 600, display: "flex" }}>{stat}</div>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: "40px", marginBottom: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", fontWeight: 600, letterSpacing: "0.1em", display: "flex" }}>HIT RATE</div>
            <div style={{ color: hitRateColor, fontSize: "36px", fontWeight: 800, display: "flex" }}>{hitRate}%</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", fontWeight: 600, letterSpacing: "0.1em", display: "flex" }}>TREND</div>
            <div style={{ color: trendColor, fontSize: "36px", fontWeight: 800, display: "flex" }}>{trendArrow}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", fontWeight: 600, letterSpacing: "0.1em", display: "flex" }}>CONFIDENCE</div>
            <div style={{ color: "#D4FF00", fontSize: "28px", display: "flex" }}>{stars}</div>
          </div>
          {matchupGrade && (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", fontWeight: 600, letterSpacing: "0.1em", display: "flex" }}>MATCHUP</div>
              <div style={{ color: matchupGrade === "A" || matchupGrade === "B" ? "#22c55e" : matchupGrade === "D" || matchupGrade === "F" ? "#ef4444" : "#ffffff", fontSize: "36px", fontWeight: 800, display: "flex" }}>{matchupGrade}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "24px" }}>
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "14px", display: "flex" }}>lasyly.me</div>
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "14px", display: "flex" }}>Free prop analytics for sports bettors</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 }
  )
}
