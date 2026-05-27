// Shared TypeScript types for the Parlay Builder & Tracker feature

// --- Enums / Union Types ---

export type ParlayStatus = "pending" | "won" | "lost"
export type ParlayVisibility = "public" | "private"

// --- Database Row Types ---

export interface Parlay {
  id: string
  user_id: string
  status: ParlayStatus
  visibility: ParlayVisibility
  odds: number | null
  stake: number | null
  custom_note: string | null
  combined_hit_rate: number | null
  created_at: string
  resolved_at: string | null
}

export interface ParlayLeg {
  id: string
  parlay_id: string
  player_name: string
  stat_category: string
  prop_line: number
  direction: "over" | "under"
  l10_hit_rate: number | null
  leg_order: number
  sport: string
}

// --- Composite Types ---

/** Same shape as ParlayLeg — alias for clarity in query results */
export type ParlayLegRow = ParlayLeg

export interface ParlayWithLegs extends Parlay {
  legs: ParlayLegRow[]
  user?: {
    display_name: string
    username: string
    avatar_url: string
    is_verified: boolean
  }
}

// --- Stats & Computation Types ---

export interface ParlayStats {
  total: number
  won: number
  lost: number
  pending: number
  win_rate: number | null
  net_profit_loss: number
  avg_legs: number | null
  most_common_sport: string | null
  best_streak: number
  current_streak: { count: number; type: "won" | "lost" | null }
  by_leg_count: {
    "2-leg": { won: number; total: number; win_rate: number | null }
    "3-leg": { won: number; total: number; win_rate: number | null }
    "4+-leg": { won: number; total: number; win_rate: number | null }
  }
}

// --- API Payload Types ---

export interface ParlayLegInput {
  player_name: string
  stat_category: string
  prop_line: number
  direction: "over" | "under"
  l10_hit_rate: number
  sport: string
}

export interface SaveParlayPayload {
  legs: ParlayLegInput[]
  visibility: ParlayVisibility
  odds: number | null
  stake: number | null
  custom_note: string | null
  combined_hit_rate: number | null
}

// --- Component Props Types ---

export interface SaveParlayDialogProps {
  legs: ParlayLeg[]
  combinedHitRate: number | null
  onSave: (data: SaveParlayPayload) => Promise<void>
  onClose: () => void
  isSubmitting: boolean
  error: string | null
}

export interface ParlayBetslipCardProps {
  parlay: ParlayWithLegs
  variant: "compact" | "expanded" | "feed"
  onStatusChange?: (status: "won" | "lost" | "pending") => void
  onToggleExpand?: () => void
  showActions?: boolean
  currentUserId?: string
}

export interface DashboardParlayWidgetProps {
  initialParlays: ParlayWithLegs[]
  initialStats: ParlayStats
}
