/**
 * Team abbreviation and slug mappings for ESPN CDN logos.
 * Used by the player analysis page and any component that needs team logos.
 */

/** NHL team name → ESPN CDN slug (lowercase) */
export const NHL_TEAM_SLUG_MAP: Record<string, string> = {
  "carolina hurricanes": "car",
  "florida panthers": "fla",
  "dallas stars": "dal",
  "edmonton oilers": "edm",
  "new york rangers": "nyr",
  "winnipeg jets": "wpg",
  "colorado avalanche": "col",
  "vegas golden knights": "vgk",
  "toronto maple leafs": "tor",
  "boston bruins": "bos",
  "new jersey devils": "njd",
  "tampa bay lightning": "tb",
  "los angeles kings": "la",
  "minnesota wild": "min",
  "vancouver canucks": "van",
  "new york islanders": "nyi",
  "ottawa senators": "ott",
  "detroit red wings": "det",
  "nashville predators": "nsh",
  "st. louis blues": "stl",
  "seattle kraken": "sea",
  "pittsburgh penguins": "pit",
  "washington capitals": "wsh",
  "calgary flames": "cgy",
  "philadelphia flyers": "phi",
  "montreal canadiens": "mtl",
  "buffalo sabres": "buf",
  "utah hockey club": "utah",
  "columbus blue jackets": "cbj",
  "chicago blackhawks": "chi",
  "anaheim ducks": "ana",
  "san jose sharks": "sj",
}

/** NFL team name → ESPN CDN slug (lowercase) */
export const NFL_TEAM_SLUG_MAP: Record<string, string> = {
  "kansas city chiefs": "kc",
  "buffalo bills": "buf",
  "baltimore ravens": "bal",
  "san francisco 49ers": "sf",
  "detroit lions": "det",
  "dallas cowboys": "dal",
  "philadelphia eagles": "phi",
  "miami dolphins": "mia",
  "green bay packers": "gb",
  "cleveland browns": "cle",
  "houston texans": "hou",
  "jacksonville jaguars": "jax",
  "pittsburgh steelers": "pit",
  "los angeles rams": "lar",
  "seattle seahawks": "sea",
  "cincinnati bengals": "cin",
  "minnesota vikings": "min",
  "tampa bay buccaneers": "tb",
  "new york jets": "nyj",
  "new york giants": "nyg",
  "los angeles chargers": "lac",
  "indianapolis colts": "ind",
  "denver broncos": "den",
  "atlanta falcons": "atl",
  "new orleans saints": "no",
  "chicago bears": "chi",
  "arizona cardinals": "ari",
  "washington commanders": "wsh",
  "tennessee titans": "ten",
  "carolina panthers": "car",
  "new england patriots": "ne",
  "las vegas raiders": "lv",
}

/** NFL team abbreviation (upper) → full team name. */
export const NFL_TEAM_FULL_NAME: Record<string, string> = {
  ARI: "Arizona Cardinals", ATL: "Atlanta Falcons", BAL: "Baltimore Ravens",
  BUF: "Buffalo Bills", CAR: "Carolina Panthers", CHI: "Chicago Bears",
  CIN: "Cincinnati Bengals", CLE: "Cleveland Browns", DAL: "Dallas Cowboys",
  DEN: "Denver Broncos", DET: "Detroit Lions", GB: "Green Bay Packers",
  HOU: "Houston Texans", IND: "Indianapolis Colts", JAX: "Jacksonville Jaguars",
  KC: "Kansas City Chiefs", LV: "Las Vegas Raiders", LAC: "Los Angeles Chargers",
  LAR: "Los Angeles Rams", MIA: "Miami Dolphins", MIN: "Minnesota Vikings",
  NE: "New England Patriots", NO: "New Orleans Saints", NYG: "New York Giants",
  NYJ: "New York Jets", PHI: "Philadelphia Eagles", PIT: "Pittsburgh Steelers",
  SF: "San Francisco 49ers", SEA: "Seattle Seahawks", TB: "Tampa Bay Buccaneers",
  TEN: "Tennessee Titans", WSH: "Washington Commanders",
}

/** NFL abbreviation → full team name (or the abbr if unknown). */
export function getNflTeamFullName(abbr: string | null | undefined): string | null {
  if (!abbr) return null
  return NFL_TEAM_FULL_NAME[abbr.toUpperCase()] ?? abbr
}

/** NBA 3-letter abbreviation → ESPN CDN abbreviation (lowercase) */
export const NBA_ESPN_TEAM_MAP: Record<string, string> = {
  sas: "sa",
  phx: "phx",
  nyk: "ny",
  nop: "no",
  gsw: "gs",
  okc: "okc",
  lac: "lac",
  lal: "lal",
  mil: "mil",
  bos: "bos",
  den: "den",
  min: "min",
  cle: "cle",
  dal: "dal",
  mem: "mem",
  mia: "mia",
  atl: "atl",
  chi: "chi",
  hou: "hou",
  ind: "ind",
  orl: "orl",
  phi: "phi",
  por: "por",
  sac: "sac",
  tor: "tor",
  uta: "utah",
  was: "wsh",
  bkn: "bkn",
  cha: "cha",
  det: "det",
}

/** NBA 3-letter abbreviation → full team name. */
export const NBA_TEAM_FULL_NAME: Record<string, string> = {
  atl: "Atlanta Hawks",
  bos: "Boston Celtics",
  bkn: "Brooklyn Nets",
  cha: "Charlotte Hornets",
  chi: "Chicago Bulls",
  cle: "Cleveland Cavaliers",
  dal: "Dallas Mavericks",
  den: "Denver Nuggets",
  det: "Detroit Pistons",
  gsw: "Golden State Warriors",
  hou: "Houston Rockets",
  ind: "Indiana Pacers",
  lac: "LA Clippers",
  lal: "Los Angeles Lakers",
  mem: "Memphis Grizzlies",
  mia: "Miami Heat",
  mil: "Milwaukee Bucks",
  min: "Minnesota Timberwolves",
  nop: "New Orleans Pelicans",
  nyk: "New York Knicks",
  okc: "Oklahoma City Thunder",
  orl: "Orlando Magic",
  phi: "Philadelphia 76ers",
  phx: "Phoenix Suns",
  por: "Portland Trail Blazers",
  sac: "Sacramento Kings",
  sas: "San Antonio Spurs",
  tor: "Toronto Raptors",
  uta: "Utah Jazz",
  was: "Washington Wizards",
}

/** Resolve an NBA team abbreviation to its full name, falling back to the input. */
export function getNbaTeamFullName(abbr: string | null | undefined): string | null {
  if (!abbr) return null
  return NBA_TEAM_FULL_NAME[abbr.toLowerCase()] ?? abbr
}

/**
 * Get the ESPN CDN logo URL for a team.
 * @param teamIdentifier - Team name (NHL/NFL) or 3-letter abbreviation (NBA)
 * @param sport - Sport identifier
 */
export function getTeamLogoUrl(teamIdentifier: string, sport: string): string | null {
  const lower = teamIdentifier.toLowerCase()

  if (sport === "NHL") {
    const slug = NHL_TEAM_SLUG_MAP[lower]
    return slug ? `https://a.espncdn.com/i/teamlogos/nhl/500/${slug}.png` : null
  }

  if (sport === "NFL") {
    // Ranking/roster data stores NFL teams as abbreviations ("SEA", "LAR",
    // "NE"), while NFL_TEAM_SLUG_MAP is keyed by full names ("seattle
    // seahawks"). Try the full-name map first, then fall back to treating the
    // identifier as an abbreviation — the ESPN NFL slug is just the lowercased
    // abbreviation. We validate against NFL_TEAM_FULL_NAME so an unknown string
    // still returns null instead of a broken CDN URL.
    const slug =
      NFL_TEAM_SLUG_MAP[lower] ??
      (NFL_TEAM_FULL_NAME[teamIdentifier.toUpperCase()] ? lower : undefined)
    return slug ? `https://a.espncdn.com/i/teamlogos/nfl/500/${slug}.png` : null
  }

  if (sport === "NBA") {
    const espnAbbr = NBA_ESPN_TEAM_MAP[lower] ?? lower
    return `https://a.espncdn.com/i/teamlogos/nba/500/${espnAbbr}.png`
  }

  return null
}
