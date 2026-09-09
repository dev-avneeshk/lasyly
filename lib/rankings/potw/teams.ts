/**
 * NBA team tri-code -> full name map.
 *
 * nba_player_stats stores team tri-codes (e.g. "ATL"), while nba_games stores
 * full names (e.g. "Atlanta Hawks"). There is no team-mapping table in the DB,
 * so this canonical, stable list bridges the two for POTW win/loss resolution.
 *
 * Basketball Reference tri-codes are used (BRK for Brooklyn, CHO for Charlotte,
 * PHO for Phoenix) since that is the scraper's source.
 */
export const TRICODE_TO_FULL_NAME: Record<string, string> = {
  ATL: "Atlanta Hawks",
  BOS: "Boston Celtics",
  BRK: "Brooklyn Nets",
  BKN: "Brooklyn Nets",
  CHO: "Charlotte Hornets",
  CHA: "Charlotte Hornets",
  CHI: "Chicago Bulls",
  CLE: "Cleveland Cavaliers",
  DAL: "Dallas Mavericks",
  DEN: "Denver Nuggets",
  DET: "Detroit Pistons",
  GSW: "Golden State Warriors",
  HOU: "Houston Rockets",
  IND: "Indiana Pacers",
  LAC: "Los Angeles Clippers",
  LAL: "Los Angeles Lakers",
  MEM: "Memphis Grizzlies",
  MIA: "Miami Heat",
  MIL: "Milwaukee Bucks",
  MIN: "Minnesota Timberwolves",
  NOP: "New Orleans Pelicans",
  NYK: "New York Knicks",
  OKC: "Oklahoma City Thunder",
  ORL: "Orlando Magic",
  PHI: "Philadelphia 76ers",
  PHO: "Phoenix Suns",
  PHX: "Phoenix Suns",
  POR: "Portland Trail Blazers",
  SAC: "Sacramento Kings",
  SAS: "San Antonio Spurs",
  TOR: "Toronto Raptors",
  UTA: "Utah Jazz",
  WAS: "Washington Wizards",
}
