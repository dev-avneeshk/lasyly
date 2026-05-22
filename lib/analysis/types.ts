export interface PlayerProfile {
  name: string
  team: string
  position: string
  fgPct: number
  mpg: number
  imageUrl?: string
}

export interface InjuryEntry {
  player: string
  status: "Out" | "Questionable" | "Doubtful" | "Probable"
  pointsImpact: number | null
  minutesImpact: number | null
  gamesOut: number | null
  lastX: string | null
}

export interface MatchupInfo {
  date: string
  time: string
  homeTeam: string
  awayTeam: string
  homeRecord: string
  awayRecord: string
  venue: string
}

export interface StatCategory {
  key: string
  label: string
  propLine: number | null
}

export interface PerformanceGame {
  opponent: string
  date: string
  value: number
  minutes: number
  isHome: boolean
}

export interface PerformanceData {
  games: PerformanceGame[]
  threshold: number
}

export interface FilteredAverage {
  metric: string
  l15: number
  l5: number
  trendPct: number
  trendDirection: "up" | "down"
}

export interface VsTeamGame {
  date: string
  value: number
  minutes: number
}

export interface DefenseDataPoint {
  date: string
  points: number
  rolling: number
}

export interface PositionPointEntry {
  position: string
  points: number
  rank: number
  isHigh: boolean
}

export interface MatchupFactor {
  metric: string
  homeValue: number | string
  awayValue: number | string
}

export interface PlayerDashboardData {
  player: PlayerProfile
  injuries: InjuryEntry[]
  matchup: MatchupInfo
  statCategories: StatCategory[]
  performance: PerformanceData
  filteredAverages: FilteredAverage[]
  vsTeamHistory: VsTeamGame[]
  opponentDefense: DefenseDataPoint[]
  positionPoints: PositionPointEntry[]
  matchupFactors: MatchupFactor[]
}
