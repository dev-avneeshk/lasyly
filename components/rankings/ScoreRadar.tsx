"use client"

import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from "recharts"

interface ScoreRadarProps {
  offense: number | null
  defense: number | null
  scoring: number | null
  playmaking: number | null
  rebounding: number | null
  shooting: number | null
  size?: number
}

export function ScoreRadar({
  offense,
  defense,
  scoring,
  playmaking,
  rebounding,
  shooting,
  size = 280,
}: ScoreRadarProps) {
  const data = [
    { subject: "Offense",    A: offense    ?? 50 },
    { subject: "Scoring",    A: scoring    ?? 50 },
    { subject: "Playmaking", A: playmaking ?? 50 },
    { subject: "Rebounding", A: rebounding ?? 50 },
    { subject: "Shooting",   A: shooting   ?? 50 },
    { subject: "Defense",    A: defense    ?? 50 },
  ]

  return (
    <ResponsiveContainer width="100%" height={size}>
      <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
        <PolarGrid
          stroke="rgba(255,255,255,0.08)"
          gridType="polygon"
        />
        <PolarAngleAxis
          dataKey="subject"
          tick={{
            fill: "rgba(255,255,255,0.5)",
            fontSize: 11,
            fontWeight: 600,
          }}
        />
        <Radar
          name="Player"
          dataKey="A"
          stroke="#D4FF00"
          fill="#D4FF00"
          fillOpacity={0.15}
          strokeWidth={2}
          dot={{ fill: "#D4FF00", r: 3, strokeWidth: 0 }}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
