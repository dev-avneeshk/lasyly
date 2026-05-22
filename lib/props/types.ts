export interface PropCardData {
  id: string
  player: string
  team: string
  statCategory: string
  propLine: number
  l5Avg: number
  l10Avg: number
  lastGames: GameResult[]
  hitRate: HitRate
  trend: "up" | "down" | "neutral"
  trendPct: number
  matchup: string
  sport: "NBA" | "Tennis" | "Soccer" | "NFL" | "NHL"
}

export interface GameResult {
  value: number
  overLine: boolean
  date: string
  opponent: string
  minutes?: number
}

export interface HitRate {
  over: number
  total: number
  label: string
}

export interface Game {
  id: string
  homeTeam: string
  awayTeam: string
  gameTime: string
  status: "scheduled" | "live" | "completed"
  homeScore?: number
  awayScore?: number
  homeLogo?: string
  awayLogo?: string
}

export interface StatFilter {
  key: string
  label: string
  sport: "NBA" | "Tennis" | "Soccer" | "NFL" | "NHL" | "all"
}
