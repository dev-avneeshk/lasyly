"use client"

import { cn } from "@/lib/utils"

export interface GaugeSegment {
  label: string
  value: number
  color: string
  icon: string
}

export function GaugeChart({ segments, totalLabel }: { segments: GaugeSegment[], totalLabel: string }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const radius = 90
  const pathLength = Math.PI * radius // approx 282.74

  // When there's no data render just the empty track
  if (total === 0) {
    return (
      <div className="relative w-full mt-2 mb-2 flex flex-col items-center justify-end">
        <svg className="w-full h-auto" viewBox="0 0 200 115">
          <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke="var(--color-dash-surface)" strokeWidth="16" />
        </svg>
        <div className="absolute bottom-8 flex flex-col items-center">
          <span className="text-3xl font-black text-white">$0.00</span>
          <span className="text-[10px] text-[var(--color-text-muted)] font-semibold uppercase tracking-widest mt-1">{totalLabel}</span>
        </div>
      </div>
    )
  }

  let currentOffset = 0

  return (
    <div className="relative w-full mt-2 mb-2 flex flex-col items-center justify-end">
      {/* Background glow */}
      <div className="absolute bottom-4 w-3/4 h-[80%] bg-[var(--color-lime)]/20 blur-[50px] rounded-t-full pointer-events-none" />
      
      <svg className="w-full h-auto" viewBox="0 0 200 115">
        {/* Track */}
        <path
          d="M 10 100 A 90 90 0 0 1 190 100"
          fill="none"
          stroke="var(--color-dash-surface)"
          strokeWidth="16"
        />
        
        {/* Segments */}
        {segments.map((segment, idx) => {
          const segmentLength = (segment.value / total) * pathLength
          const dashArray = `${segmentLength} ${pathLength - segmentLength}`
          const dashOffset = -currentOffset
          
          currentOffset += segmentLength

          return (
            <path
              key={segment.label}
              d="M 10 100 A 90 90 0 0 1 190 100"
              fill="none"
              stroke={segment.color}
              strokeWidth="16"
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              className={idx === 0 ? "drop-shadow-[0_0_8px_rgba(212,255,0,0.5)]" : ""}
            />
          )
        })}
        
        {/* Rounded Caps */}
        {segments.length > 0 && (
          <>
            <circle cx="10" cy="100" r="8" fill={segments[0].color} />
            <circle cx="190" cy="100" r="8" fill={segments[segments.length - 1].color} />
          </>
        )}
      </svg>
      
      <div className="absolute bottom-8 flex flex-col items-center">
        <span className="text-3xl font-black text-white">${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        <span className="text-[10px] text-[var(--color-text-muted)] font-semibold uppercase tracking-widest mt-1">{totalLabel}</span>
      </div>
    </div>
  )
}

export interface LineChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    color: string
  }[]
}

export function DualLineChart({ data }: { data: LineChartData }) {
  const allValues = data.datasets.flatMap(d => d.data)
  const maxValue = Math.max(...allValues, 1)
  
  // Chart dimensions
  const width = 300
  const height = 80 // Y range from 20 to 100 for data points to fit within SVG (0-100)
  const paddingY = 20

  const getPath = (points: number[]) => {
    if (points.length === 0) return ""
    const stepX = width / (points.length - 1)
    
    let path = `M 0 ${100 - paddingY - (points[0] / maxValue) * height}`
    for (let i = 1; i < points.length; i++) {
      const x = i * stepX
      const y = 100 - paddingY - (points[i] / maxValue) * height
      // Using simple bezier for smoothness
      const prevX = (i - 1) * stepX
      const prevY = 100 - paddingY - (points[i - 1] / maxValue) * height
      const cp1x = prevX + (x - prevX) / 2
      const cp2x = cp1x
      path += ` C ${cp1x} ${prevY}, ${cp2x} ${y}, ${x} ${y}`
    }
    return path
  }

  return (
    <div className="relative w-full h-32 mt-4">
      <svg className="w-full h-full overflow-visible" viewBox="0 0 300 100" preserveAspectRatio="none">
        {/* Grid lines */}
        <line x1="0" y1="20" x2="300" y2="20" stroke="var(--color-border)" strokeWidth="0.5" strokeDasharray="2 2" />
        <line x1="0" y1="50" x2="300" y2="50" stroke="var(--color-border)" strokeWidth="0.5" strokeDasharray="2 2" />
        <line x1="0" y1="80" x2="300" y2="80" stroke="var(--color-border)" strokeWidth="0.5" strokeDasharray="2 2" />

        {data.datasets.map((dataset, idx) => {
          const path = getPath(dataset.data)
          const lastX = width
          const lastY = dataset.data.length > 0 ? 100 - paddingY - (dataset.data[dataset.data.length - 1] / maxValue) * height : 0
          
          return (
            <g key={dataset.label}>
              <path
                d={path}
                fill="none"
                stroke={dataset.color}
                strokeWidth="2"
                className={idx === 0 ? "drop-shadow-[0_2px_4px_rgba(212,255,0,0.3)]" : ""}
              />
              <circle cx={lastX} cy={lastY} r="3" fill={dataset.color} />
            </g>
          )
        })}
      </svg>
      
      {/* Y-Axis Labels */}
      <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[8px] text-[var(--color-text-muted)] py-2 pointer-events-none">
        {maxValue >= 1000 ? (
          <>
            <span>{(maxValue / 1000).toFixed(1)}k</span>
            <span>{(maxValue * 0.66 / 1000).toFixed(1)}k</span>
            <span>{(maxValue * 0.33 / 1000).toFixed(1)}k</span>
          </>
        ) : (
          <>
            <span>{Math.round(maxValue)}</span>
            <span>{Math.round(maxValue * 0.66)}</span>
            <span>{Math.round(maxValue * 0.33)}</span>
          </>
        )}
        <span>0</span>
      </div>
      
      {/* X-Axis Labels */}
      <div className="absolute -bottom-5 w-full flex justify-between text-[8px] text-[var(--color-text-muted)] pl-4">
        {data.labels.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>
    </div>
  )
}

export function ProgressBar({ label, percentage, color }: { label: string; percentage: number; color: string }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between items-end mb-1">
        <span className="text-xs font-semibold text-white">{label}</span>
        <span className="text-xs font-bold text-white">{percentage}%</span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-500" 
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
