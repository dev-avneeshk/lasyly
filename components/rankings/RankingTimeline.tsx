"use client"

import { LineChart, Line, XAxis, YAxis, ReferenceLine, Tooltip, ResponsiveContainer } from "recharts"

interface TimelinePoint {
  season: string
  rank: number | null
  score?: number | null
}

interface RankingTimelineProps {
  data: TimelinePoint[]
  height?: number
}

export function RankingTimeline({ data, height = 120 }: RankingTimelineProps) {
  if (!data || data.length < 2) return null

  // Filter out seasons with no rank data
  const chartData = data
    .filter((d) => d.rank != null)
    .map((d) => ({
      season: d.season.replace("20", "'"),
      rank: d.rank,
      score: d.score,
    }))

  if (chartData.length < 2) return null

  // Y-axis: inverted (rank 1 = top). Find min/max ranks
  const ranks = chartData.map((d) => d.rank!).filter((r) => r != null)
  const maxRank = Math.max(...ranks, 100)
  const minRank = Math.min(...ranks, 1)

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
          Ranking History
        </span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <XAxis
            dataKey="season"
            tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            reversed
            domain={[Math.max(1, minRank - 5), Math.min(100, maxRank + 5)]}
            tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "var(--color-text-primary)",
            }}
            formatter={(value: any) => [`#${value}`, "Rank"]}
          />
          <Line
            type="monotone"
            dataKey="rank"
            stroke="#D4FF00"
            strokeWidth={2}
            dot={{ fill: "#D4FF00", r: 4, strokeWidth: 0 }}
            activeDot={{ fill: "#D4FF00", r: 6, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
