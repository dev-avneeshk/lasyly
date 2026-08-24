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
    const slug = NFL_TEAM_SLUG_MAP[lower]
    return slug ? `https://a.espncdn.com/i/teamlogos/nfl/500/${slug}.png` : null
  }

  if (sport === "NBA") {
    const espnAbbr = NBA_ESPN_TEAM_MAP[lower] ?? lower
    return `https://a.espncdn.com/i/teamlogos/nba/500/${espnAbbr}.png`
  }

  return null
}
