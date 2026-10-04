/**
 * Parse docs/product/week2.md (a Pro-Football-Reference Week-2 2026 box-score
 * dump) into structured JSON matching lib/analytics/nfl/types.ts shapes.
 *
 * Output: scripts/data/week2-2026.parsed.json
 *
 * Only values literally present in the source are recorded. The dump contains
 * per-game pages only (no league Team Offense/Defense tables, no snap counts,
 * no drives), so those dataset arrays are emitted empty — never fabricated.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const SRC = join(ROOT, "docs/product/week2.md")

const SEASON = 2026
const WEEK = 2

// Full team name -> abbreviation (PFR uses these abbrs in the Tm column).
const TEAM_ABBR = {
  "Arizona Cardinals": "ARI",
  "Atlanta Falcons": "ATL",
  "Baltimore Ravens": "BAL",
  "Buffalo Bills": "BUF",
  "Carolina Panthers": "CAR",
  "Chicago Bears": "CHI",
  "Cincinnati Bengals": "CIN",
  "Cleveland Browns": "CLE",
  "Dallas Cowboys": "DAL",
  "Denver Broncos": "DEN",
  "Detroit Lions": "DET",
  "Green Bay Packers": "GNB",
  "Houston Texans": "HOU",
  "Indianapolis Colts": "IND",
  "Jacksonville Jaguars": "JAX",
  "Kansas City Chiefs": "KAN",
  "Las Vegas Raiders": "LVR",
  "Los Angeles Chargers": "LAC",
  "Los Angeles Rams": "LAR",
  "Miami Dolphins": "MIA",
  "Minnesota Vikings": "MIN",
  "New England Patriots": "NWE",
  "New Orleans Saints": "NOR",
  "New York Giants": "NYG",
  "New York Jets": "NYJ",
  "Philadelphia Eagles": "PHI",
  "Pittsburgh Steelers": "PIT",
  "San Francisco 49ers": "SFO",
  "Seattle Seahawks": "SEA",
  "Tampa Bay Buccaneers": "TAM",
  "Tennessee Titans": "TEN",
  "Washington Commanders": "WAS",
}

const MONTHS = {
  January: "01", February: "02", March: "03", April: "04", May: "05",
  June: "06", July: "07", August: "08", September: "09", October: "10",
  November: "11", December: "12",
}

function gameId(away, home) {
  return `${SEASON}-${WEEK}-${away.toLowerCase()}-${home.toLowerCase()}`
}

/** Parse an integer, treating "" / undefined as 0. */
function int(s) {
  if (s == null) return 0
  const t = String(s).trim()
  if (t === "" || t === "-") return 0
  const n = parseInt(t, 10)
  return Number.isFinite(n) ? n : 0
}
/** Parse a float, returning null for "" / non-numeric (for nullable rating fields). */
function numOrNull(s) {
  if (s == null) return null
  const t = String(s).trim().replace("%", "")
  if (t === "") return null
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : null
}

const raw = readFileSync(SRC, "utf8")
const lines = raw.split(/\r?\n/)

// ── Split into 16 game blocks using the matchup header line ──────────────────
// Header form: "Detroit Lions at Buffalo Bills - September 17th, 2026"
// (skip the "You are here: ... > <matchup>" breadcrumb variant)
const headerRe = /^(.+?) at (.+?) - (January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2})(?:st|nd|rd|th), (\d{4})$/

const gameStarts = []
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(headerRe)
  if (m && !lines[i].startsWith("You are here")) {
    gameStarts.push({ i, m })
  }
}

const games = []
const teamGameStats = []
const playerGameStats = []
const advPassing = []
const advRushing = []
const advReceiving = []

for (let g = 0; g < gameStarts.length; g++) {
  const start = gameStarts[g].i
  const end = g + 1 < gameStarts.length ? gameStarts[g + 1].i : lines.length
  const block = lines.slice(start, end)
  const m = gameStarts[g].m
  const awayName = m[1].trim()
  const homeName = m[2].trim()
  const away = TEAM_ABBR[awayName]
  const home = TEAM_ABBR[homeName]
  if (!away || !home) {
    throw new Error(`Unknown team in header: "${awayName}" at "${homeName}"`)
  }
  const date = `${m[5]}-${MONTHS[m[3]]}-${String(int(m[4])).padStart(2, "0")}`
  const gid = gameId(away, home)

  const find = (pred) => block.findIndex(pred)
  const get = (label) => {
    const idx = block.findIndex((l) => l.startsWith(label + "\t") || l === label)
    return idx >= 0 ? block[idx].split("\t").slice(1) : null
  }

  // ── Game meta ──────────────────────────────────────────────────────────────
  const roofLine = get("Roof")
  const surfaceLine = get("Surface")
  const attLine = get("Attendance")
  const durLine = get("Duration")
  const timeOfGame = block.find((l) => l.startsWith("Time of Game:"))
  const weatherLine = get("Weather")
  const vegasLine = get("Vegas Line")
  const ouLine = get("Over/Under")
  const wentToOt = block.some((l) => /\bOT\b/.test(l) && /Final/.test(l)) ||
    block.some((l) => l.startsWith("Won OT Toss"))

  // Line score final: row starting with the full team name ending in numbers.
  // Score strip near top: away/home scores appear right under names.
  // Simpler: use the Team Stats block presence + scoring; final scores come from
  // the "<TeamName>\t...\tFinal" line score rows.
  let homeScore = null, awayScore = null
  {
    // Line score rows look like: "Detroit Lions\t0\t10\t7\t14\t31"
    const awayRow = block.find((l) => l.startsWith(awayName + "\t"))
    const homeRow = block.find((l) => l.startsWith(homeName + "\t"))
    if (awayRow) {
      const parts = awayRow.split("\t")
      awayScore = int(parts[parts.length - 1])
    }
    if (homeRow) {
      const parts = homeRow.split("\t")
      homeScore = int(parts[parts.length - 1])
    }
  }

  // Weather parse: "67 degrees, relative humidity 92%, wind 4 mph"
  let temperature_f = null, humidity_pct = null, wind_mph = null
  if (weatherLine) {
    const w = weatherLine.join(" ")
    const t = w.match(/(-?\d+)\s*degrees/)
    if (t) temperature_f = int(t[1])
    const h = w.match(/humidity\s+(\d+)%/)
    if (h) humidity_pct = int(h[1])
    const wi = w.match(/wind\s+(\d+)\s*mph/)
    if (wi) wind_mph = int(wi[1])
  }

  // Roof normalize to RoofType union.
  let roof = "outdoors"
  if (roofLine) {
    const r = roofLine.join(" ").toLowerCase()
    if (r.includes("dome")) roof = "dome"
    else if (r.includes("closed")) roof = "retractable-closed"
    else if (r.includes("open")) roof = "retractable-open"
    else roof = "outdoors"
  }

  // Vegas line: "Buffalo Bills -5.5" -> favorite + spread (negative).
  let spread = null, spread_favorite = null
  if (vegasLine) {
    const v = vegasLine.join(" ").trim()
    const vm = v.match(/^(.*?)\s+(-?\d+(?:\.\d+)?)$/)
    if (vm) {
      spread_favorite = TEAM_ABBR[vm[1].trim()] || null
      spread = parseFloat(vm[2])
    } else if (/pick|even/i.test(v)) {
      spread = 0
    }
  }

  // Over/Under: "55.0 (over)" -> total + result.
  let over_under = null, total_result = null
  if (ouLine) {
    const o = ouLine.join(" ").trim()
    const om = o.match(/(\d+(?:\.\d+)?)\s*(?:\((over|under|push)\))?/)
    if (om) {
      over_under = parseFloat(om[1])
      total_result = om[2] || null
    }
  }

  // Duration: prefer "Time of Game: 3:11" then Game Info "Duration".
  let duration = null
  if (timeOfGame) duration = timeOfGame.replace("Time of Game:", "").trim()
  else if (durLine) duration = durLine.join(" ").trim()

  games.push({
    game_id: gid,
    season: SEASON,
    week: WEEK,
    date,
    home_team: home,
    away_team: away,
    home_score: homeScore,
    away_score: awayScore,
    stadium: (() => {
      const s = block.find((l) => l.startsWith("Stadium:"))
      return s ? s.replace("Stadium:", "").trim() : ""
    })(),
    roof,
    surface: surfaceLine ? surfaceLine.join(" ").trim() : "",
    attendance: attLine ? int(attLine.join("").replace(/,/g, "")) : null,
    duration,
    temperature_f,
    humidity_pct,
    wind_mph,
    spread,
    spread_favorite,
    over_under,
    total_result,
    went_to_ot: wentToOt,
  })

  // ── Team Stats block ─────────────────────────────────────────────────────
  // The header row "DET\tBUF" (abbrs) directly precedes the labeled rows.
  const tsHeaderIdx = block.findIndex(
    (l) => l === `${away}\t${home}` || l === `${home}\t${away}`
  )
  if (tsHeaderIdx >= 0) {
    const header = block[tsHeaderIdx].split("\t")
    const colTeam = [header[0], header[1]] // order as printed
    const grab = (label) => {
      const idx = block.findIndex((l, i) => i > tsHeaderIdx && l.startsWith(label + "\t"))
      if (idx < 0) return [null, null]
      const parts = block[idx].split("\t")
      return [parts[1], parts[2]]
    }
    const firstDowns = grab("First Downs")
    const rushYT = grab("Rush-Yds-TDs")
    const cmp = grab("Cmp-Att-Yd-TD-INT")
    const sacked = grab("Sacked-Yards")
    const netPass = grab("Net Pass Yards")
    const totalYds = grab("Total Yards")
    const fum = grab("Fumbles-Lost")
    const turn = grab("Turnovers")
    const pen = grab("Penalties-Yards")
    const third = grab("Third Down Conv.")
    const fourth = grab("Fourth Down Conv.")
    const top = grab("Time of Possession")

    for (let c = 0; c < 2; c++) {
      const team = colTeam[c]
      const opponent = colTeam[1 - c]
      const [ra, ry, rt] = (rushYT[c] || "0-0-0").split("-")
      const [pc, pa, py, ptd, pint] = (cmp[c] || "0-0-0-0-0").split("-")
      const [sk, skY] = (sacked[c] || "0-0").split("-")
      const [fmb, fl] = (fum[c] || "0-0").split("-")
      const [penN, penY] = (pen[c] || "0-0").split("-")
      const [td3c, td3a] = (third[c] || "0-0").split("-")
      const [td4c, td4a] = (fourth[c] || "0-0").split("-")
      teamGameStats.push({
        game_id: gid,
        team,
        opponent,
        is_home: team === home,
        first_downs: int(firstDowns[c]),
        rush_att: int(ra),
        rush_yds: int(ry),
        rush_td: int(rt),
        pass_cmp: int(pc),
        pass_att: int(pa),
        pass_yds: int(py),
        pass_td: int(ptd),
        pass_int: int(pint),
        sacked: int(sk),
        sacked_yds: int(skY),
        net_pass_yds: int(netPass[c]),
        total_yds: int(totalYds[c]),
        fumbles: int(fmb),
        fumbles_lost: int(fl),
        turnovers: int(turn[c]),
        penalties: int(penN),
        penalty_yds: int(penY),
        third_down_att: int(td3a),
        third_down_conv: int(td3c),
        fourth_down_att: int(td4a),
        fourth_down_conv: int(td4c),
        top: (top[c] || "").trim(),
      })
    }
  }

  // ── Player box scores: the two "Passing Rushing Receiving Fumbles" tables ──
  // Each table: a header line "Player Tm Cmp Att ...", then player rows until a
  // non-player line. Rows have 21 tab-separated cells.
  const boxHeaderIdxs = []
  for (let i = 0; i < block.length; i++) {
    if (block[i].startsWith("Player\tTm\tCmp\tAtt\tYds\tTD\tInt\tSk\tYds\tLng\tRate\tAtt")) {
      boxHeaderIdxs.push(i)
    }
  }
  for (const hi of boxHeaderIdxs) {
    for (let i = hi + 1; i < block.length; i++) {
      const parts = block[i].split("\t")
      // A player row: 21 cells, cell[1] is a known team abbr.
      if (parts.length >= 21 && (parts[1] === away || parts[1] === home)) {
        const p = parts
        playerGameStats.push({
          game_id: gid,
          player: p[0].trim(),
          team: p[1],
          opponent: p[1] === home ? away : home,
          pass_cmp: int(p[2]),
          pass_att: int(p[3]),
          pass_yds: int(p[4]),
          pass_td: int(p[5]),
          pass_int: int(p[6]),
          pass_sacked: int(p[7]),
          pass_sacked_yds: int(p[8]),
          pass_long: int(p[9]),
          pass_rating: numOrNull(p[10]),
          rush_att: int(p[11]),
          rush_yds: int(p[12]),
          rush_td: int(p[13]),
          rush_long: int(p[14]),
          targets: int(p[15]),
          rec: int(p[16]),
          rec_yds: int(p[17]),
          rec_td: int(p[18]),
          rec_long: int(p[19]),
          fumbles: int(p[20]),
          fumbles_lost: int(p[21]),
        })
      } else {
        break // end of this team's table
      }
    }
  }

  // ── Advanced Passing ───────────────────────────────────────────────────────
  // Header: Player Tm Cmp Att Yds 1D 1D% IAY IAY/PA CAY CAY/Cmp CAY/PA YAC
  //         YAC/Cmp Drops Drop% BadTh Bad% Sk Bltz Hrry Hits Prss Prss% Scrm Yds/Scr
  const advPassHeader = "Player\tTm\tCmp\tAtt\tYds\t1D\t1D%\tIAY"
  for (let i = 0; i < block.length; i++) {
    if (block[i].startsWith(advPassHeader)) {
      for (let j = i + 1; j < block.length; j++) {
        const p = block[j].split("\t")
        if (p.length >= 24 && (p[1] === away || p[1] === home)) {
          advPassing.push({
            game_id: gid, player: p[0].trim(), team: p[1],
            cmp: int(p[2]), att: int(p[3]), yds: int(p[4]),
            first_downs: int(p[5]), first_down_pct: numOrNull(p[6]),
            iay: int(p[7]), iay_per_att: numOrNull(p[8]),
            cay: int(p[9]), cay_per_cmp: numOrNull(p[10]), cay_per_att: numOrNull(p[11]),
            yac: int(p[12]), yac_per_cmp: numOrNull(p[13]),
            drops: int(p[14]), drop_pct: numOrNull(p[15]),
            bad_throws: int(p[16]), bad_throw_pct: numOrNull(p[17]),
            sacked: int(p[18]), blitzed: int(p[19]), hurried: int(p[20]),
            hits: int(p[21]), pressured: int(p[22]), pressured_pct: numOrNull(p[23]),
            scrambles: int(p[24]), yds_per_scramble: numOrNull(p[25]),
          })
        } else break
      }
    }
  }

  // ── Advanced Rushing ─────────────────────────────────────────────────────
  // Header: Player Tm Att Yds TD 1D YBC YBC/Att YAC YAC/Att BrkTkl Att/Br
  const advRushHeader = "Player\tTm\tAtt\tYds\tTD\t1D\tYBC\tYBC/Att"
  for (let i = 0; i < block.length; i++) {
    if (block[i].startsWith(advRushHeader)) {
      for (let j = i + 1; j < block.length; j++) {
        const p = block[j].split("\t")
        if (p.length >= 11 && (p[1] === away || p[1] === home)) {
          advRushing.push({
            game_id: gid, player: p[0].trim(), team: p[1],
            att: int(p[2]), yds: int(p[3]), td: int(p[4]), first_downs: int(p[5]),
            ybc: int(p[6]), ybc_per_att: numOrNull(p[7]),
            yac: int(p[8]), yac_per_att: numOrNull(p[9]),
            broken_tackles: int(p[10]), att_per_broken: numOrNull(p[11]),
          })
        } else break
      }
    }
  }

  // ── Advanced Receiving ─────────────────────────────────────────────────────
  // Header: Player Tm Tgt Rec Yds TD 1D YBC YBC/R YAC YAC/R ADOT BrkTkl Rec/Br
  //         Drop Drop% Int Rat
  const advRecHeader = "Player\tTm\tTgt\tRec\tYds\tTD\t1D\tYBC\tYBC/R"
  for (let i = 0; i < block.length; i++) {
    if (block[i].startsWith(advRecHeader)) {
      for (let j = i + 1; j < block.length; j++) {
        const p = block[j].split("\t")
        if (p.length >= 17 && (p[1] === away || p[1] === home)) {
          advReceiving.push({
            game_id: gid, player: p[0].trim(), team: p[1],
            targets: int(p[2]), rec: int(p[3]), yds: int(p[4]), td: int(p[5]),
            first_downs: int(p[6]),
            ybc: int(p[7]), ybc_per_rec: numOrNull(p[8]),
            yac: int(p[9]), yac_per_rec: numOrNull(p[10]),
            adot: numOrNull(p[11]),
            broken_tackles: int(p[12]), rec_per_broken: numOrNull(p[13]),
            drops: int(p[14]), drop_pct: numOrNull(p[15]),
            int_on_target: int(p[16]), rating_when_targeted: numOrNull(p[17]),
          })
        } else break
      }
    }
  }
}

const out = {
  season: SEASON,
  week: WEEK,
  source: "Pro-Football-Reference (2026 Week 2 box scores)",
  games,
  teamGameStats,
  playerGameStats,
  advReceiving,
  advRushing,
  advPassing,
  snapCounts: [],
  drives: [],
  teamOffense: [],
  teamDefense: [],
}

mkdirSync(join(ROOT, "scripts/data"), { recursive: true })
const dest = join(ROOT, "scripts/data/week2-2026.parsed.json")
writeFileSync(dest, JSON.stringify(out, null, 2))

console.log(`games=${games.length} teamGameStats=${teamGameStats.length} players=${playerGameStats.length} advPass=${advPassing.length} advRush=${advRushing.length} advRec=${advReceiving.length}`)
console.log(`wrote ${dest}`)
