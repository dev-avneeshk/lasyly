/**
 * Prop-specific cheat sheet configuration module.
 *
 * Provides static mappings of which stats matter most for each prop type,
 * categorized by signal strength: primary, secondary, context.
 *
 * Pure configuration — no side effects or external dependencies.
 */

export interface CheatSheetConfig {
  propType: string
  stats: {
    key: string
    label: string
    category: "primary" | "secondary" | "context"
    explanation: string // max 120 chars
  }[]
}

const POINTS_CHEAT_SHEET: CheatSheetConfig = {
  propType: "points",
  stats: [
    {
      key: "fgaPerGame",
      label: "FGA per game",
      category: "primary",
      explanation: "Shot volume is the strongest predictor of scoring output.",
    },
    {
      key: "ftaPerGame",
      label: "FTA per game",
      category: "primary",
      explanation: "Free throw attempts add guaranteed scoring opportunities beyond field goals.",
    },
    {
      key: "tpaPerGame",
      label: "3PA per game",
      category: "secondary",
      explanation: "Three-point volume amplifies scoring ceiling when shots fall.",
    },
    {
      key: "ePPS",
      label: "ePPS",
      category: "secondary",
      explanation: "Expected points per shot measures scoring efficiency across all attempts.",
    },
    {
      key: "rimAttemptsPerGame",
      label: "Rim attempts per game",
      category: "context",
      explanation: "Rim attempts indicate paint touches and high-percentage shot selection.",
    },
    {
      key: "selfCreatedFGAPerGame",
      label: "Self-created FGA",
      category: "context",
      explanation: "Unassisted shots reflect ability to generate offense independently.",
    },
  ],
}

const REBOUNDS_CHEAT_SHEET: CheatSheetConfig = {
  propType: "rebounds",
  stats: [
    {
      key: "trbPct",
      label: "TRB%",
      category: "primary",
      explanation: "Total rebound percentage measures share of available boards grabbed while on court.",
    },
    {
      key: "orbPct",
      label: "ORB%",
      category: "primary",
      explanation: "Offensive rebound rate shows aggressiveness on the glass after misses.",
    },
    {
      key: "drbPct",
      label: "DRB%",
      category: "secondary",
      explanation: "Defensive rebound rate captures positioning and effort on opponent misses.",
    },
    {
      key: "projectedReboundsPerGame",
      label: "Projected rebounds per game",
      category: "secondary",
      explanation: "Projected boards combine rebound rate with team total rebound opportunities.",
    },
    {
      key: "opponentPace",
      label: "Opponent pace",
      category: "context",
      explanation: "Faster opponents create more possessions and more rebound opportunities.",
    },
  ],
}

const ASSISTS_CHEAT_SHEET: CheatSheetConfig = {
  propType: "assists",
  stats: [
    {
      key: "astPct",
      label: "AST%",
      category: "primary",
      explanation: "Assist percentage measures share of teammate field goals assisted while on court.",
    },
    {
      key: "pgaPerGame",
      label: "PGA per game",
      category: "primary",
      explanation: "Potential assists track passes leading to shot attempts regardless of make or miss.",
    },
    {
      key: "pgaConversionRate",
      label: "PGA conversion rate",
      category: "secondary",
      explanation: "Conversion rate shows how often potential assists turn into actual assists.",
    },
    {
      key: "astTovRatio",
      label: "AST/TOV ratio",
      category: "secondary",
      explanation: "Assist-to-turnover ratio reflects playmaking efficiency and ball security.",
    },
    {
      key: "teamPace",
      label: "Team pace",
      category: "context",
      explanation: "Higher team pace means more possessions and more assist opportunities per game.",
    },
  ],
}

const PRA_CHEAT_SHEET: CheatSheetConfig = {
  propType: "pra",
  stats: [
    {
      key: "ePPS",
      label: "ePPS",
      category: "primary",
      explanation: "Scoring efficiency indicates points contribution to the combined PRA total.",
    },
    {
      key: "trbPct",
      label: "TRB%",
      category: "primary",
      explanation: "Rebound rate drives the rebounding component of the PRA combo prop.",
    },
    {
      key: "astPct",
      label: "AST%",
      category: "primary",
      explanation: "Assist percentage drives the playmaking component of the PRA combo prop.",
    },
    {
      key: "fgaPerGame",
      label: "FGA per game",
      category: "secondary",
      explanation: "Shot volume supports scoring output which is the largest PRA component.",
    },
    {
      key: "minutesPerGame",
      label: "Minutes per game",
      category: "secondary",
      explanation: "Playing time is a prerequisite for accumulating stats across all three categories.",
    },
    {
      key: "opponentPace",
      label: "Opponent pace",
      category: "context",
      explanation: "Faster games produce more possessions, boosting all three PRA components.",
    },
  ],
}

const CHEAT_SHEETS: Record<string, CheatSheetConfig> = {
  points: POINTS_CHEAT_SHEET,
  rebounds: REBOUNDS_CHEAT_SHEET,
  assists: ASSISTS_CHEAT_SHEET,
  pra: PRA_CHEAT_SHEET,
}

/**
 * Returns the cheat sheet configuration for a given prop type.
 * Returns null for unsupported prop types.
 */
export function getCheatSheet(propType: string): CheatSheetConfig | null {
  return CHEAT_SHEETS[propType.toLowerCase()] ?? null
}
