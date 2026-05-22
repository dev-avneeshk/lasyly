export type User = {
  id: string
  username: string
  displayName: string
  avatarUrl: string
  bio?: string
  favouriteSport?: string
  favouriteSports?: string[]
  country?: string
  isVerified?: boolean
  followers?: number
  following?: number
  winRate?: number
  totalPicks?: number
  roi?: number
  streak?: number
  createdAt: string
}

export type RoomType = 'Public' | 'Private' | 'Tipster'

export type Room = {
  id: string
  name: string
  description: string
  type: RoomType
  sportTag: string
  bannerUrl?: string
  creatorId: string
  memberCount: number
  isLive?: boolean
  createdAt: string
}

export type BetStatus = 'Pending' | 'Won' | 'Lost' | 'Void' | 'Partial'
export type BetType = 'Single' | 'Accumulator' | 'System' | 'Lucky'

export type Betslip = {
  id: string
  roomId?: string
  userId: string
  user: User
  sportsbook: string
  betType: BetType
  odds: number
  stake?: number
  payout?: number
  matches: string[]
  description?: string
  status: BetStatus
  isForSale?: boolean
  price?: number
  createdAt: string
  reactions?: Record<string, number>
  commentCount?: number
}

export type MatchStatus = 'Not Started' | 'First Half' | 'Halftime' | 'Second Half' | 'Finished' | 'Postponed' | 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'OT' | 'In Progress'

export type LiveMatch = {
  id: string
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  clock?: string
  startTime?: string  // ISO timestamp for scheduled matches (used for local time display)
  status: MatchStatus
  league: string
  sport: string
  homeLogo?: string
  awayLogo?: string
  homeColor?: string
  awayColor?: string
  venue?: string
  eventId?: string
}

export type MatchSummary = {
  eventId: string
  venue?: string
  broadcasts?: string[]
  odds?: {
    homeMoneyline?: string
    awayMoneyline?: string
    spread?: string
    overUnder?: string
  }
  leaders?: Array<{
    team: string
    name: string
    stat: string
    value: string
  }>
  headline?: string
  boxscore?: {
    teams: Array<{
      team: string
      logo?: string
      stats: Array<{ label: string; value: string }>
    }>
    players: Array<{
      team: string
      labels: string[]
      athletes: Array<{
        name: string
        position?: string
        stats: string[]
      }>
    }>
  }
}

export type ChatMessage = {
  id: string
  roomId: string
  userId: string
  user?: User
  content: string
  createdAt: string
  isSystem?: boolean
}
