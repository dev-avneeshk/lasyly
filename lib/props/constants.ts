import { StatFilter } from "./types"

export const NBA_STAT_FILTERS: StatFilter[] = [
  { key: "all", label: "All", sport: "NBA" },
  { key: "pts", label: "Points", sport: "NBA" },
  { key: "trb", label: "Rebounds", sport: "NBA" },
  { key: "ast", label: "Assists", sport: "NBA" },
  { key: "tp", label: "3PM", sport: "NBA" },
  { key: "fg", label: "FGM", sport: "NBA" },
  { key: "fga", label: "FGA", sport: "NBA" },
  { key: "ft", label: "FTM", sport: "NBA" },
  { key: "fta", label: "FTA", sport: "NBA" },
  { key: "stl", label: "Steals", sport: "NBA" },
  { key: "blk", label: "Blocks", sport: "NBA" },
  { key: "tov", label: "Turnovers", sport: "NBA" },
  { key: "pra", label: "PRA", sport: "NBA" },
]

export const TENNIS_STAT_FILTERS: StatFilter[] = [
  { key: "all", label: "All", sport: "Tennis" },
  { key: "aces", label: "Aces", sport: "Tennis" },
  { key: "double_faults", label: "Double Faults", sport: "Tennis" },
  { key: "win_pct", label: "To Win", sport: "Tennis" },
  { key: "sets_won", label: "Sets Won", sport: "Tennis" },
  { key: "games_won", label: "Games Won", sport: "Tennis" },
]

export const SOCCER_STAT_FILTERS: StatFilter[] = [
  { key: "all", label: "All", sport: "all" },
  { key: "team_totalGoals", label: "Team Goals", sport: "all" },
  { key: "team_matchGoals", label: "Match Goals", sport: "all" },
  { key: "team_cards", label: "Cards", sport: "all" },
  { key: "team_corners", label: "Corners", sport: "all" },
]

export const NFL_STAT_FILTERS: StatFilter[] = [
  { key: "all", label: "All", sport: "all" },
  { key: "YDS", label: "Pass Yards", sport: "all" },
  { key: "TD", label: "Touchdowns", sport: "all" },
  { key: "REC", label: "Receptions", sport: "all" },
  { key: "CAR", label: "Carries", sport: "all" },
  { key: "INT", label: "Interceptions", sport: "all" },
  { key: "SACKS", label: "Sacks", sport: "all" },
]

export const NHL_STAT_FILTERS: StatFilter[] = [
  { key: "all", label: "All", sport: "all" },
  { key: "G", label: "Goals", sport: "all" },
  { key: "A", label: "Assists", sport: "all" },
  { key: "SOG", label: "Shots on Goal", sport: "all" },
  { key: "+/-", label: "+/-", sport: "all" },
  { key: "HT", label: "Hits", sport: "all" },
  { key: "BS", label: "Blocked Shots", sport: "all" },
  { key: "TK", label: "Takeaways", sport: "all" },
  { key: "PIM", label: "Penalty Min", sport: "all" },
]

export const STAT_LABELS: Record<string, string> = {
  pts: "Points",
  trb: "Rebounds",
  ast: "Assists",
  tp: "3PM",
  fg: "FGM",
  fga: "FGA",
  ft: "FTM",
  fta: "FTA",
  stl: "Steals",
  blk: "Blocks",
  tov: "Turnovers",
  pra: "Pts+Reb+Ast",
  aces: "Aces",
  first_serve_pct: "1st Serve %",
  double_faults: "Double Faults",
  win_pct: "To Win",
  sets_won: "Sets Won",
  sets_lost: "Sets Lost",
  games_won: "Games Won",
  games_lost: "Games Lost",
  // Soccer (Player)
  totalGoals: "Goals",
  goalAssists: "Assists",
  totalShots: "Shots",
  shotsOnTarget: "Shots on Target",
  foulsCommitted: "Fouls",
  yellowCards: "Yellow Cards",
  saves: "Saves",
  // Soccer (Team)
  team_totalGoals: "Team Goals",
  team_corners: "Corners",
  team_cards: "Cards",
  team_matchGoals: "Match Goals",
  // NFL
  YDS: "Yards",
  TD: "Touchdowns",
  REC: "Receptions",
  CAR: "Carries",
  INT: "Interceptions",
  SACKS: "Sacks",
  // NHL
  G: "Goals",
  A: "Assists",
  PTS: "Points",
  SOG: "Shots on Goal",
  "+/-": "+/-",
  SV: "Saves",
}

export const DEFAULT_STATS: Record<string, string> = {
  NBA: "all",
  Tennis: "all",
  Soccer: "all",
  NFL: "all",
  NHL: "all",
}
