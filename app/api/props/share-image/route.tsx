import { ImageResponse } from "next/og"
import { NextRequest } from "next/server"

export const runtime = "edge"

/**
 * GET /api/props/share-image?player=...&stat=...&line=...&hitRate=...&direction=...&trend=...&confidence=...&team=...&sport=...
 *
 * Generates a branded prop card image (1080x1080 for social sharing).
 * Used by the "Share" button on prop cards.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  const player = searchParams.get("player") || "Player"
  const stat = searchParams.get("stat") || "PTS"
  const line = searchParams.get("line") || "0"
  const hitRate = searchParams.get("hitRate") || "0"
  const direction = searchParams.get("direction") || "over"
  const trend = searchParams.get("trend") || "neutral"
  const confidence = parseInt(searchParams.get("confidence") || "3", 10)
  const team = searchParams.get("team") || ""
  const sport = searchParams.get("sport") || "NBA"
  const matchupGrade = searchParams.get("grade") || ""

  const isOver = direction === "over"
  const hitRateNum = parseInt(hitRate, 10)
  const hitRateColor = hitRateNum >= 70 ? "#22c55e" : hitRateNum >= 50 ? "#D4FF00" : "#ef4444"
  const trendArrow = trend === "up" ? "↑" : trend === "down" ? "↓" : "→"
  const trendColor = trend === "up" ? "#22c55e" : trend === "down" ? "#ef4444" : "#94a3b8"

  const stars = "★".repeat(confidence) + "☆".repeat(5 - confidence)

  return new ImageResponse(
    (
      <div
        style={{
          background: "#0A0B0F",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "60px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background grid */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage:
              "linear-gradient(rgba(212,255,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(212,255,0,0.03) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        {/* Glow */}
        <div
          style={{
            position: "absolute",
            top: "-15%",
            right: "-10%",
            width: "50%",
            height: "50%",
            background:
              "radial-gradient(ellipse, rgba(212,255,0,0.08) 0%, transparent 70%)",
          }}
        />

        {/* Header: Logo + Sport badge */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: "#D4FF00",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ width: 20, height: 20, background: "#0A0B0F", borderRadius: 4 }} />
            </div>
            <span style={{ color: "#ffffff", fontSize: 22, fontWeight: 700 }}>Lasyly</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "rgba(212,255,0,0.1)",
              border: "1px solid rgba(212,255,0,0.3)",
              borderRadius: 999,
              padding: "6px 16px",
            }}
          >
            <span style={{ color: "#D4FF00", fontSize: 14, fontWeight: 700, letterSpacing: "0.1em" }}>
              {sport}
            </span>
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {/* Player name + team */}
          <div style={{ marginBottom: "8px" }}>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 16, fontWeight: 500 }}>
              {team}
            </span>
          </div>
          <div style={{ marginBottom: "32px" }}>
            <span style={{ color: "#ffffff", fontSize: 52, fontWeight: 900, letterSpacing: "-1px" }}>
              {player}
            </span>
          </div>

          {/* Prop line - big and bold */}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "16px",
              marginBottom: "40px",
            }}
          >
            <span
              style={{
                color: isOver ? "#22c55e" : "#ef4444",
                fontSize: 18,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              {direction}
            </span>
            <span style={{ color: "#D4FF00", fontSize: 72, fontWeight: 900 }}>
              {line}
            </span>
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 28, fontWeight: 600 }}>
              {stat}
            </span>
          </div>

          {/* Stats row */}
          <div
            style={{
              display: "flex",
              gap: "32px",
              marginBottom: "24px",
            }}
          >
            {/* Hit Rate */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, letterSpacing: "0.1em" }}>
                HIT RATE
              </span>
              <span style={{ color: hitRateColor, fontSize: 32, fontWeight: 800 }}>
                {hitRate}%
              </span>
            </div>
            {/* Trend */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, letterSpacing: "0.1em" }}>
                TREND
              </span>
              <span style={{ color: trendColor, fontSize: 32, fontWeight: 800 }}>
                {trendArrow}
              </span>
            </div>
            {/* Confidence */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, letterSpacing: "0.1em" }}>
                CONFIDENCE
              </span>
              <span style={{ color: "#D4FF00", fontSize: 28 }}>
                {stars}
              </span>
            </div>
            {/* Matchup Grade */}
            {matchupGrade && (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, letterSpacing: "0.1em" }}>
                  MATCHUP
                </span>
                <span
                  style={{
                    color: matchupGrade === "A" || matchupGrade === "B" ? "#22c55e" : matchupGrade === "D" || matchupGrade === "F" ? "#ef4444" : "#ffffff",
                    fontSize: 32,
                    fontWeight: 800,
                  }}
                >
                  {matchupGrade}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            paddingTop: "24px",
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
            lasyly.me/props
          </span>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
            Free prop analytics for sports bettors
          </span>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 }
  )
}
