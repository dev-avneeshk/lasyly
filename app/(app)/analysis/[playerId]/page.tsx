"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { cachedFetch } from "@/lib/clientCache"
import {
  ComposedChart, Bar, Line, XAxis, YAxis, ReferenceLine,
  ResponsiveContainer, Tooltip, Cell,
} from "recharts"

interface PropData {
  id: string
  player: string
  team: string
  position?: string
  statCategory: string
  propLine: number
  l5Avg: number
  l10Avg: number
  lastGames: { value: number; overLine: boolean; date: string; opponent: string; minutes?: number }[]
  hitRate: { over: number; total: number; label: string }
  trend: "up" | "down" | "neutral"
  trendPct: number
  matchup: string
  graphData?: { value: number; date: string; opponent: string; overLine: boolean }[]
  defensiveMatchup?: {
    opponentTeam: string
    statAllowedPerGame: number
    leagueAverage: number
    grade: string
    paceRating: string
  } | null
  projection?: {
    baseAvg: number
    projection: number
    edge: number | null
    edgeSignal: string | null
    multipliers: {
      defFactor: number
      paceFactor: number
      venueFactor: number
      restFactor: number
      minutesFactor: number
    }
    multipliersApplied: string[]
    baseComponents: {
      l3Avg: number
      l5Avg: number
      l10Avg: number
      seasonAvg: number
    }
  } | null
}

export default function PlayerDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const playerId = decodeURIComponent(params.playerId as string)
  const statParam = searchParams.get("stat") ?? "pts"
  const teamParam = searchParams.get("team") ?? ""
  const sportParam = searchParams.get("sport") ?? "NBA"
  const isSoccer = sportParam === "Soccer"
  const isESPNSport = sportParam === "Soccer" || sportParam === "NFL" || sportParam === "NHL"
  const isTeamProp = searchParams.get("type") === "team" || isSoccer

  const [prop, setProp] = useState<PropData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeStat, setActiveStat] = useState(statParam.toUpperCase())
  const [timeRange, setTimeRange] = useState("L15")
  const [threshold, setThreshold] = useState(0)
  const [rollingAverages, setRollingAverages] = useState<Record<string, Record<string, number | null>> | null>(null)
  const [shootingZones, setShootingZones] = useState<{
    fgPct0_3ft: number | null; fgPct3_10ft: number | null; fgPct10_16ft: number | null;
    fgPct16_3pt: number | null; fgPct3pt: number | null; fg3PctCorner: number | null;
    pctFga0_3ft: number | null; pctFga3_10ft: number | null; pctFga10_16ft: number | null;
    pctFga16_3pt: number | null; pctFga3pt: number | null; pctFg3aCorner: number | null;
    avgDist: number | null; pctFgaDunk: number | null; dunksMade: number | null;
  } | null>(null)
  const [seasonStats, setSeasonStats] = useState<{
    ppg: number | null; apg: number | null; rpg: number | null; spg: number | null; bpg: number | null;
    mpg: number | null; fgPct: number | null; fg3Pct: number | null; ftPct: number | null;
    efgPct: number | null; fgaPerG: number | null; ftaPerG: number | null; fg3aPerG: number | null;
    fg3PerG: number | null; tovPerG: number | null; orbPerG: number | null; drbPerG: number | null;
    tsPct: number | null; usgPct: number | null; astPct: number | null; per: number | null;
    ws: number | null; bpm: number | null; obpm: number | null; dbpm: number | null;
    vorp: number | null; offRtg: number | null; defRtg: number | null; tovPct: number | null;
  } | null>(null)
  const [injuries, setInjuries] = useState<{ name: string; position: string; status: string; date: string; comment: string }[]>([])
  const [headshot, setHeadshot] = useState<string | null>(null)
  const [teamLogo, setTeamLogo] = useState<string | null>(null)
  const [shotChartMode, setShotChartMode] = useState<"heatmap" | "zones">("heatmap")
  const [shotChartOpen, setShotChartOpen] = useState(true)
  const [seasonType, setSeasonType] = useState<"regular" | "playoffs">("regular")
  const [teamAnalytics, setTeamAnalytics] = useState<any>(null)
  const [seriesRecord, setSeriesRecord] = useState<{ team: number; opponent: number; type: string } | null>(null)
  const [gameBreakdown, setGameBreakdown] = useState<{
    date: string | null; opponent: string; fg: number; fga: number; tp: number; tpa: number;
    ft: number; fta: number; orb: number; drb: number; ast: number; pts: number;
    trb: number; stl: number; blk: number; tov: number; fg2m: number; fg2a: number;
  }[] | null>(null)
  const [splitsTab, setSplitsTab] = useState<"shooting" | "points" | "efficiency">("shooting")
  // The actual stat used for fetching (synced with activeStat)
  // Map display names to API stat params
  const statApiMap: Record<string, string> = {
    "PTS": "pts",
    "AST": "ast",
    "REB": "trb",
    "PTS+AST": "pts",
    "PTS+REB": "pts",
    "AST+REB": "ast",
    "PTS+AST+REB": "pra",
    "BLK": "blk",
    "STL": "stl",
  }
  // For NBA, map display stat names to API params. For other sports, use the stat param directly.
  const fetchStat = sportParam === "NBA"
    ? (statApiMap[activeStat] ?? statParam)
    : statParam

  // Fetch the prop data for this player
  useEffect(() => {
    setLoading(true)
    // Include search param to find the specific player/team
    const playerSearch = playerId.replace(/-/g, " ")
    const url = `/api/props?sport=${sportParam}&stat=${fetchStat}&search=${encodeURIComponent(playerSearch)}`
    // Cache for 30 seconds — same data as the analysis page
    cachedFetch<{ props?: PropData[] }>(url, 30_000)
      .then(data => {
        const props = data.props ?? []
        // Find matching prop by player slug or id
        const found = props.find((p: PropData) => {
          const slug = p.player.toLowerCase().replace(/[^a-z0-9]+/g, "-")
          return p.id === playerId || slug === playerId || p.id.startsWith(playerId) || slug.includes(playerId)
        }) || props[0]

        if (found) {
          setProp(found)
          setThreshold(found.propLine)
          setLoading(false)
        } else {
          // Fallback: try with stat=all to find the player in any stat category
          const fallbackUrl = `/api/props?sport=${sportParam}&stat=all&search=${encodeURIComponent(playerSearch)}`
          cachedFetch<{ props?: PropData[] }>(fallbackUrl, 30_000)
            .then(fallbackData => {
              const fallbackProps = fallbackData.props ?? []
              const fallbackFound = fallbackProps.find((p: PropData) => {
                const slug = p.player.toLowerCase().replace(/[^a-z0-9]+/g, "-")
                return p.id === playerId || slug === playerId || p.id.startsWith(playerId) || slug.includes(playerId)
              }) || fallbackProps[0]

              if (fallbackFound) {
                setProp(fallbackFound)
                setThreshold(fallbackFound.propLine)
              }
              setLoading(false)
            })
            .catch(() => setLoading(false))
        }
      })
      .catch(() => setLoading(false))
  }, [playerId, fetchStat, sportParam])

  // Fetch rolling averages from stats-reference endpoint (NBA only)
  useEffect(() => {
    if (!prop) return
    if (sportParam !== "NBA") return // Stats reference only available for NBA
    const playoffParam = seasonType === "playoffs" ? "&playoff=true" : ""
    fetch(`/api/props/stats-reference?player=${encodeURIComponent(prop.player)}&stat=${fetchStat}${playoffParam}`)
      .then(res => res.json())
      .then(data => {
        if (data.rollingAverages) {
          setRollingAverages(data.rollingAverages)
        }
        if (data.shootingZones) {
          setShootingZones(data.shootingZones)
        }
        if (data.seasonStats) {
          setSeasonStats(data.seasonStats)
        }
        if (data.gameBreakdown) {
          setGameBreakdown(data.gameBreakdown)
        }
      })
      .catch(() => {})
  }, [prop?.player, fetchStat, seasonType])

  // Fetch team analytics for non-NBA sports (Soccer, NFL, NHL)
  useEffect(() => {
    if (!prop?.team) return
    if (sportParam === "NBA" || sportParam === "Tennis") return
    fetch(`/api/props/team-stats?team=${encodeURIComponent(prop.team)}&sport=${sportParam}`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setTeamAnalytics(data)
          if (data.logoUrl && !teamLogo) {
            setTeamLogo(data.logoUrl)
          }
        }
      })
      .catch(() => {})
  }, [prop?.team, sportParam])

  // Fetch player-level stats for NHL/NFL
  const [playerAnalytics, setPlayerAnalytics] = useState<any>(null)
  useEffect(() => {
    if (!prop?.player) return
    if (sportParam !== "NHL" && sportParam !== "NFL") return
    fetch(`/api/props/player-stats?player=${encodeURIComponent(prop.player)}&sport=${sportParam}`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setPlayerAnalytics(data)
          if (data.headshotUrl) setHeadshot(data.headshotUrl)
        }
      })
      .catch(() => {})
  }, [prop?.player, sportParam])

  // Fetch injuries for the player's team (NBA only — ESPN injuries API is NBA-specific)
  useEffect(() => {
    if (!prop?.team) return
    if (sportParam !== "NBA") return

    // Fetch series record between the two teams
    if (prop.matchup) {
      fetch(`/api/props/series?team=${encodeURIComponent(prop.team)}&opponent=${encodeURIComponent(prop.matchup)}`)
        .then(res => res.json())
        .then(data => {
          if (data.teamWins !== undefined && data.opponentWins !== undefined) {
            setSeriesRecord({ team: data.teamWins, opponent: data.opponentWins, type: data.type ?? "season" })
          }
        })
        .catch(() => {})
    }

    // Try multiple abbreviation formats (e.g., SAS→SA, PHX→PHO, etc.)
    const teamAbbr = prop.team
    const altAbbr = teamAbbr.length === 3 ? teamAbbr.slice(0, 2) : teamAbbr
    fetch(`/api/injuries?team=${encodeURIComponent(altAbbr)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.injuries && data.injuries.length > 0) {
          // Filter to only show injuries matching our team
          const teamInjuries = data.injuries.filter((inj: { teamAbbr: string }) =>
            inj.teamAbbr === teamAbbr || inj.teamAbbr === altAbbr
          )
          setInjuries(teamInjuries.length > 0 ? teamInjuries : data.injuries)
        } else if (teamAbbr !== altAbbr) {
          // Retry with full abbreviation
          fetch(`/api/injuries?team=${encodeURIComponent(teamAbbr)}`)
            .then(res2 => res2.json())
            .then(data2 => {
              if (data2.success && data2.injuries) setInjuries(data2.injuries)
            })
            .catch(() => {})
        }
      })
      .catch(() => {})
  }, [prop?.team])

  // Fetch player headshot and set team logo
  useEffect(() => {
    if (!prop?.player) return

    // For soccer team props, use the logoUrl from the prop data
    if (isESPNSport && (prop as any).logoUrl) {
      setTeamLogo((prop as any).logoUrl)
      setHeadshot(null)
      return
    }

    // For ESPN sports without logoUrl in prop, try fetching from headshot API (which checks espn_teams)
    if (isESPNSport) {
      // For player props (NHL/NFL), fetch the player headshot separately
      if (!isTeamProp) {
        // First check if the prop already has a headshotUrl from the engine's bulk fetch
        if ((prop as any).headshotUrl) {
          setHeadshot((prop as any).headshotUrl)
        } else {
          // Fall back to the headshot API
          const headshotUrl = `/api/players/headshot?name=${encodeURIComponent(prop.player)}&team=${encodeURIComponent(prop.team)}&sport=${sportParam}`
          cachedFetch<{ success: boolean; headshot?: string }>(headshotUrl, 300_000)
            .then(data => {
              if (data.success && data.headshot) {
                setHeadshot(data.headshot)
              }
            })
            .catch(() => {})
        }
        // Also set team logo from ESPN CDN for the corner badge
        const nhlTeamSlugMap: Record<string, string> = {
          "carolina hurricanes": "car", "florida panthers": "fla", "dallas stars": "dal",
          "edmonton oilers": "edm", "new york rangers": "nyr", "winnipeg jets": "wpg",
          "colorado avalanche": "col", "vegas golden knights": "vgk", "toronto maple leafs": "tor",
          "boston bruins": "bos", "new jersey devils": "njd", "tampa bay lightning": "tb",
          "los angeles kings": "la", "minnesota wild": "min", "vancouver canucks": "van",
          "new york islanders": "nyi", "ottawa senators": "ott", "detroit red wings": "det",
          "nashville predators": "nsh", "st. louis blues": "stl", "seattle kraken": "sea",
          "pittsburgh penguins": "pit", "washington capitals": "wsh", "calgary flames": "cgy",
          "philadelphia flyers": "phi", "montreal canadiens": "mtl", "buffalo sabres": "buf",
          "utah hockey club": "utah", "columbus blue jackets": "cbj",
          "chicago blackhawks": "chi", "anaheim ducks": "ana", "san jose sharks": "sj",
        }
        const nflTeamSlugMap: Record<string, string> = {
          "kansas city chiefs": "kc", "buffalo bills": "buf", "baltimore ravens": "bal",
          "san francisco 49ers": "sf", "detroit lions": "det", "dallas cowboys": "dal",
          "philadelphia eagles": "phi", "miami dolphins": "mia", "green bay packers": "gb",
          "cleveland browns": "cle", "houston texans": "hou", "jacksonville jaguars": "jax",
          "pittsburgh steelers": "pit", "los angeles rams": "lar", "seattle seahawks": "sea",
          "cincinnati bengals": "cin", "minnesota vikings": "min", "tampa bay buccaneers": "tb",
          "new york jets": "nyj", "new york giants": "nyg", "los angeles chargers": "lac",
          "indianapolis colts": "ind", "denver broncos": "den", "atlanta falcons": "atl",
          "new orleans saints": "no", "chicago bears": "chi", "arizona cardinals": "ari",
          "washington commanders": "wsh", "tennessee titans": "ten", "carolina panthers": "car",
          "new england patriots": "ne", "las vegas raiders": "lv",
        }
        const teamLower = prop.team.toLowerCase()
        const slug = sportParam === "NHL"
          ? nhlTeamSlugMap[teamLower]
          : nflTeamSlugMap[teamLower]
        if (slug) {
          const logoSport = sportParam === "NHL" ? "nhl" : "nfl"
          setTeamLogo(`https://a.espncdn.com/i/teamlogos/${logoSport}/500/${slug}.png`)
        }
      } else {
        // Team prop — use team logo as the main image
        const headshotUrl = `/api/players/headshot?name=${encodeURIComponent(prop.player)}&team=${encodeURIComponent(prop.team)}&sport=${sportParam}`
        cachedFetch<{ success: boolean; headshot?: string }>(headshotUrl, 300_000)
          .then(data => {
            if (data.success && data.headshot) {
              setTeamLogo(data.headshot)
            }
          })
          .catch(() => {})
      }
      return
    }

    // For non-NBA sports, use the headshotUrl from the prop data directly
    if (sportParam !== "NBA" && (prop as any).headshotUrl) {
      setHeadshot((prop as any).headshotUrl)
      setTeamLogo(null)
      return
    }

    // Set team logo from ESPN CDN (predictable URL pattern)
    const teamAbbr = prop.team?.toLowerCase() ?? ""
    // Map common 3-letter to ESPN 2/3-letter format
    const espnTeamMap: Record<string, string> = {
      sas: "sa", phx: "phx", nyk: "ny", nop: "no", gsw: "gs", okc: "okc",
      lac: "lac", lal: "lal", mil: "mil", bos: "bos", den: "den", min: "min",
      cle: "cle", dal: "dal", mem: "mem", mia: "mia", atl: "atl", chi: "chi",
      hou: "hou", ind: "ind", orl: "orl", phi: "phi", por: "por", sac: "sac",
      tor: "tor", uta: "utah", was: "wsh", bkn: "bkn", cha: "cha", det: "det",
    }
    const espnAbbr = espnTeamMap[teamAbbr] ?? teamAbbr
    setTeamLogo(`https://a.espncdn.com/i/teamlogos/nba/500/${espnAbbr}.png`)

    // Use cachedFetch for headshot — persists across navigations (5 min cache)
    const headshotUrl = `/api/players/headshot?name=${encodeURIComponent(prop.player)}&team=${encodeURIComponent(prop.team)}&sport=${sportParam}`
    cachedFetch<{ success: boolean; headshot?: string }>(headshotUrl, 300_000)
      .then(data => {
        if (data.success && data.headshot) {
          setHeadshot(data.headshot)
        }
      })
      .catch(() => {})
  }, [prop?.player, prop?.team, isSoccer])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text-primary)] p-4 flex flex-col gap-4 overflow-x-hidden font-sans">
        {/* Back Button Skeleton */}
        <div className="h-4 w-16 rounded bg-white/5 animate-pulse" />

        {/* Row 1: Player Profile Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:h-[280px]">
          <div className="lg:col-span-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-4 animate-pulse">
            <div className="flex justify-between items-start mb-6">
              <div className="h-12 w-28 rounded bg-white/5" />
              <div className="w-14 h-14 rounded-full bg-white/5" />
            </div>
            <div className="flex justify-center mb-4">
              <div className="h-[120px] w-[100px] rounded-lg bg-white/5" />
            </div>
            <div className="grid grid-cols-3 gap-2 border-t border-[var(--color-border)] pt-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className="h-3 w-10 rounded bg-white/5" />
                  <div className="h-5 w-8 rounded bg-white/5" />
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-4 animate-pulse">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-white/5" />
                <div className="h-4 w-24 rounded bg-white/5" />
              </div>
              <div className="h-5 w-12 rounded bg-white/5" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 rounded bg-white/5" />
              ))}
            </div>
          </div>
          <div className="lg:col-span-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-4 animate-pulse">
            <div className="h-5 w-20 rounded bg-white/5 mx-auto mb-4" />
            <div className="flex justify-between items-center px-4 my-6">
              <div className="w-16 h-16 rounded-full bg-white/5" />
              <div className="h-6 w-16 rounded bg-white/5" />
              <div className="w-16 h-16 rounded-full bg-white/5" />
            </div>
            <div className="h-4 w-32 rounded bg-white/5 mx-auto" />
          </div>
        </div>

        {/* Row 2: Stat Selector Skeleton */}
        <div className="flex gap-2 overflow-hidden">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-10 w-20 rounded-md bg-white/5 animate-pulse shrink-0" />
          ))}
        </div>

        {/* Row 3: Performance Chart Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-9 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-4 animate-pulse">
            <div className="flex justify-between items-center mb-4">
              <div className="h-5 w-28 rounded bg-white/5" />
              <div className="flex items-center gap-2">
                <div className="h-7 w-32 rounded bg-white/5" />
                <div className="h-5 w-10 rounded bg-white/5" />
              </div>
            </div>
            <div className="h-[320px] flex items-end gap-2 px-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-white/5"
                  style={{ height: `${30 + Math.random() * 60}%` }}
                />
              ))}
            </div>
          </div>
          <div className="lg:col-span-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-4 animate-pulse">
            <div className="h-5 w-32 rounded bg-white/5 mx-auto mb-4" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 w-12 rounded bg-white/5" />
                  <div className="h-4 w-8 rounded bg-white/5" />
                  <div className="h-4 w-8 rounded bg-white/5" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!prop) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] text-[var(--color-text-muted)]">
        <p>No data available for this player.</p>
      </div>
    )
  }

  // Build chart data from real game history (already in chronological order from API)
  const gameHistory = prop.lastGames
  // Apply time range filter - take the most recent N games
  const timeRangeNum = parseInt(timeRange.replace("L", ""))
  const filteredHistory = gameHistory.slice(-timeRangeNum)
  const chartData = filteredHistory.map(g => ({
    name: g.opponent,
    value: g.value,
    minutes: g.minutes ?? 0,
    opponent: g.opponent,
    date: g.date,
  }))

  const overCount = filteredHistory.filter(g => g.value >= threshold).length
  const totalGames = filteredHistory.length

  // Stat categories — sport-specific
  const statCategories = isESPNSport
    ? sportParam === "Soccer" ? [
        { key: "team_totalGoals", label: "Team Goals", propLine: activeStat === "team_totalGoals" ? prop.propLine : null },
        { key: "team_matchGoals", label: "Match Goals", propLine: activeStat === "team_matchGoals" ? prop.propLine : null },
        { key: "team_cards", label: "Cards", propLine: activeStat === "team_cards" ? prop.propLine : null },
        { key: "team_corners", label: "Corners", propLine: activeStat === "team_corners" ? prop.propLine : null },
      ]
      : sportParam === "NFL" ? [
        { key: "YDS", label: "Yards", propLine: activeStat === "YDS" ? prop.propLine : null },
        { key: "TD", label: "TDs", propLine: activeStat === "TD" ? prop.propLine : null },
        { key: "REC", label: "Receptions", propLine: activeStat === "REC" ? prop.propLine : null },
        { key: "CAR", label: "Carries", propLine: activeStat === "CAR" ? prop.propLine : null },
        { key: "INT", label: "INTs", propLine: null },
      ]
      : [ // NHL
        { key: "G", label: "Goals", propLine: activeStat === "G" ? prop.propLine : null },
        { key: "A", label: "Assists", propLine: activeStat === "A" ? prop.propLine : null },
        { key: "SOG", label: "Shots", propLine: activeStat === "SOG" ? prop.propLine : null },
        { key: "HT", label: "Hits", propLine: activeStat === "HT" ? prop.propLine : null },
        { key: "BS", label: "Blocks", propLine: activeStat === "BS" ? prop.propLine : null },
      ]
    : [
        { key: "PTS", label: "PTS", propLine: activeStat === "PTS" ? prop.propLine : null },
        { key: "AST", label: "AST", propLine: activeStat === "AST" ? prop.propLine : null },
        { key: "REB", label: "REB", propLine: activeStat === "REB" ? prop.propLine : null },
        { key: "PTS+AST", label: "PTS+AST", propLine: null },
        { key: "PTS+REB", label: "PTS+REB", propLine: null },
        { key: "AST+REB", label: "AST+REB", propLine: null },
        { key: "PTS+AST+REB", label: "PRA", propLine: null },
        { key: "BLK", label: "BLK", propLine: null },
        { key: "STL", label: "STL", propLine: null },
      ]

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text-primary)] p-4 flex flex-col gap-4 overflow-x-hidden font-sans">
      {/* Back Button */}
      <button
        onClick={() => router.push("/analysis")}
        className="flex items-center gap-1 text-[var(--color-text-muted)] hover:text-white transition-colors w-fit"
      >
        <ChevronLeft className="w-4 h-4" />
        <span className="text-xs font-semibold tracking-wider uppercase">Back</span>
      </button>

      {/* Row 1: Player Profile | Injury Report | Matchup */}
      <div className={cn("grid grid-cols-1 gap-4 lg:h-[280px]", isESPNSport ? "lg:grid-cols-4" : "lg:grid-cols-12")}>
        {/* Player Profile Card — REAL DATA */}
        <div className={cn("flex flex-col relative overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md", isESPNSport ? "lg:col-span-4" : "lg:col-span-3")}>
          <div className="absolute top-0 left-0 w-full h-[60%] bg-[var(--color-lime)]/20 transform -skew-y-6 origin-top-left z-0" />
          <div className="relative z-10 p-4 flex-grow flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-1.5 rounded flex items-center gap-2 shadow-sm backdrop-blur-sm">
                <span className="font-semibold text-sm tracking-wide">
                  {prop.player.split(" ")[0]}<br />{prop.player.split(" ").slice(1).join(" ")}
                </span>
              </div>
              <div className="w-14 h-14 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden">
                {teamLogo ? (
                  <img src={teamLogo} alt={prop.team} className="w-10 h-10 object-contain" />
                ) : (
                  <span className="text-xs font-bold text-[var(--color-lime)]">{prop.team}</span>
                )}
              </div>
            </div>
            <div className="flex-grow flex items-end justify-center -mb-4 relative z-20">
              {isESPNSport && isTeamProp && teamLogo ? (
                <img src={teamLogo} alt={prop.player} className="h-[120px] w-[120px] object-contain" />
              ) : headshot ? (
                <img src={headshot} alt={prop.player} className="h-[140px] w-[110px] object-cover object-top" />
              ) : teamLogo ? (
                <img src={teamLogo} alt={prop.player} className="h-[120px] w-[120px] object-contain" />
              ) : (
                <div className="h-[140px] w-[100px] bg-[var(--color-surface-elevated)] rounded-lg flex items-center justify-center">
                  <span className="text-4xl font-black text-[var(--color-border)] opacity-50">
                    {prop.player.split(" ").map(n => n[0]).join("")}
                  </span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4 text-center border-t border-[var(--color-border)] pt-3 relative z-30 bg-[var(--color-surface)]/80 backdrop-blur-md -mx-4 -mb-4 px-4 pb-4">
              <div>
                <div className="text-[var(--color-text-muted)] text-[10px] uppercase tracking-wider font-medium mb-1">L5 AVG</div>
                <div className="text-[var(--color-lime)] font-bold text-lg">{prop.l5Avg}</div>
              </div>
              <div>
                <div className="text-[var(--color-text-muted)] text-[10px] uppercase tracking-wider font-medium mb-1">Position</div>
                <div className="text-white font-bold text-lg">{prop.position ?? "nil"}</div>
              </div>
              <div>
                <div className="text-[var(--color-text-muted)] text-[10px] uppercase tracking-wider font-medium mb-1">L10 AVG</div>
                <div className="text-white font-bold text-lg">{prop.l10Avg}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Injury Report — REAL DATA from ESPN (NBA only) */}
        {!isESPNSport && (
        <div className="lg:col-span-6 flex flex-col bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md">
          <div className="p-3 border-b border-[var(--color-border)] flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[var(--color-danger)]" />
              <h2 className="font-semibold text-sm tracking-wide">Injury Report</h2>
            </div>
            <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-elevated)] px-2 py-1 rounded border border-[var(--color-border)]">
              {prop.team}
            </span>
          </div>
          <div className="flex-grow overflow-auto max-h-[200px]">
            {injuries.length === 0 ? (
              <div className="flex items-center justify-center p-6 h-full">
                <span className="text-[var(--color-text-muted)] text-sm italic">No injuries reported for {prop.team}</span>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {injuries.map((inj, i) => (
                  <div key={i} className="px-4 py-3 flex items-start gap-3">
                    <div className={cn(
                      "w-2 h-2 rounded-full mt-1.5 shrink-0",
                      inj.status === "Out" ? "bg-[var(--color-danger)]" :
                      inj.status === "Day-To-Day" ? "bg-[var(--color-warning)]" :
                      "bg-[var(--color-text-muted)]"
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{inj.name}</span>
                        <span className="text-[9px] text-[var(--color-text-muted)] bg-white/5 px-1.5 py-0.5 rounded">{inj.position}</span>
                        <span className={cn(
                          "text-[9px] font-bold px-1.5 py-0.5 rounded",
                          inj.status === "Out" ? "bg-[var(--color-danger)]/20 text-[var(--color-danger)]" :
                          inj.status === "Day-To-Day" ? "bg-[var(--color-warning)]/20 text-[var(--color-warning)]" :
                          "bg-white/10 text-white/60"
                        )}>{inj.status}</span>
                      </div>
                      {inj.comment && (
                        <p className="text-[10px] text-[var(--color-text-muted)] mt-1 line-clamp-2">{inj.comment}</p>
                      )}
                    </div>
                    <span className="text-[9px] text-[var(--color-text-muted)] shrink-0">{inj.date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        )}

        {/* Matchup Header — NBA only */}
        {!isESPNSport && (
        <div className="lg:col-span-3 bg-gradient-to-b from-[var(--color-primary)]/20 to-[var(--color-surface)] relative overflow-hidden flex flex-col justify-between p-4 border border-[var(--color-border)] rounded-md">
          <div className="relative z-10 text-center border-b border-white/10 pb-3 mb-3">
            <h3 className="font-bold text-lg tracking-wide">Upcoming</h3>
            <p className="text-[var(--color-lime)] text-sm font-medium">
              {(() => {
                const abbrToName: Record<string, string> = {
                  ATL: "Atlanta Hawks", BOS: "Boston Celtics", BKN: "Brooklyn Nets",
                  CHA: "Charlotte Hornets", CHI: "Chicago Bulls", CLE: "Cleveland Cavaliers",
                  DAL: "Dallas Mavericks", DEN: "Denver Nuggets", DET: "Detroit Pistons",
                  GSW: "Golden State Warriors", HOU: "Houston Rockets", IND: "Indiana Pacers",
                  LAC: "LA Clippers", LAL: "LA Lakers", MEM: "Memphis Grizzlies",
                  MIA: "Miami Heat", MIL: "Milwaukee Bucks", MIN: "Minnesota Timberwolves",
                  NOP: "New Orleans Pelicans", NYK: "New York Knicks", OKC: "Oklahoma City Thunder",
                  ORL: "Orlando Magic", PHI: "Philadelphia 76ers", PHX: "Phoenix Suns",
                  POR: "Portland Trail Blazers", SAC: "Sacramento Kings", SAS: "San Antonio Spurs",
                  TOR: "Toronto Raptors", UTA: "Utah Jazz", WAS: "Washington Wizards",
                }
                return abbrToName[prop.matchup] ?? prop.matchup ?? "nil"
              })()}
            </p>
          </div>
          <div className="relative z-10 flex justify-between items-center px-4 flex-grow">
            <div className="flex flex-col items-center gap-1">
              <div className="w-16 h-16 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden">
                {teamLogo ? (
                  <img src={teamLogo} alt={prop.team} className="w-12 h-12 object-contain" />
                ) : (
                  <span className="text-xs font-bold text-[var(--color-lime)]">{prop.team}</span>
                )}
              </div>
              <span className="text-[10px] font-bold text-white tracking-wide">{prop.team}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="text-[var(--color-text-muted)] text-[10px] font-medium uppercase tracking-wider">
                {seriesRecord?.type === "playoff" ? "Playoff Series" : "Season Series"}
              </div>
              <div className="text-white text-lg font-black tracking-wide">
                {seriesRecord ? `${seriesRecord.team} — ${seriesRecord.opponent}` : "— —"}
              </div>
              <div className="text-[var(--color-text-muted)] text-[10px] font-medium uppercase tracking-wider">VS</div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-16 h-16 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden">
                {(() => {
                  const oppTeam = prop.defensiveMatchup?.opponentTeam ?? prop.matchup?.split(" ").pop() ?? ""
                  const teamNameToSlug: Record<string, string> = {
                    timberwolves: "min", wolves: "min", min: "min",
                    lakers: "lal", lal: "lal",
                    celtics: "bos", bos: "bos",
                    warriors: "gs", gsw: "gs", gs: "gs",
                    nuggets: "den", den: "den",
                    bucks: "mil", mil: "mil",
                    heat: "mia", mia: "mia",
                    suns: "phx", phx: "phx",
                    cavaliers: "cle", cavs: "cle", cle: "cle",
                    thunder: "okc", okc: "okc",
                    mavericks: "dal", mavs: "dal", dal: "dal",
                    grizzlies: "mem", mem: "mem",
                    "76ers": "phi", sixers: "phi", phi: "phi",
                    knicks: "ny", nyk: "ny", ny: "ny",
                    nets: "bkn", bkn: "bkn",
                    raptors: "tor", tor: "tor",
                    bulls: "chi", chi: "chi",
                    hawks: "atl", atl: "atl",
                    pacers: "ind", ind: "ind",
                    magic: "orl", orl: "orl",
                    hornets: "cha", cha: "cha",
                    pistons: "det", det: "det",
                    rockets: "hou", hou: "hou",
                    spurs: "sa", sas: "sa", sa: "sa",
                    pelicans: "no", nop: "no", no: "no",
                    kings: "sac", sac: "sac",
                    clippers: "lac", lac: "lac",
                    blazers: "por", por: "por",
                    jazz: "utah", uta: "utah", utah: "utah",
                    wizards: "wsh", was: "wsh", wsh: "wsh",
                  }
                  const oppLower = oppTeam.toLowerCase()
                  const slug = teamNameToSlug[oppLower] ?? teamNameToSlug[oppLower.split(" ").pop() ?? ""] ?? ""
                  if (slug) {
                    return <img src={`https://a.espncdn.com/i/teamlogos/nba/500/${slug}.png`} alt={oppTeam} className="w-12 h-12 object-contain" />
                  }
                  return <span className="text-[9px] font-bold text-[var(--color-lime)]">{oppTeam.slice(0, 4)}</span>
                })()}
              </div>
              <span className="text-[10px] font-bold text-white tracking-wide">{prop.matchup}</span>
            </div>
          </div>
          <div className="relative z-10 text-center mt-3 border-t border-white/10 pt-3">
            <div className="flex items-center justify-center gap-3">
              {prop.defensiveMatchup ? (
                <>
                  <span className={cn(
                    "text-xs font-bold px-2 py-0.5 rounded",
                    prop.defensiveMatchup.grade === "A" || prop.defensiveMatchup.grade === "B"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : prop.defensiveMatchup.grade === "C"
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-red-500/20 text-red-400"
                  )}>
                    Grade {prop.defensiveMatchup.grade}
                  </span>
                  <span className="text-[var(--color-text-muted)] text-xs">•</span>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    Pace: {prop.defensiveMatchup.paceRating}
                  </span>
                </>
              ) : (
                <span className="text-xs text-[var(--color-text-muted)] italic">Matchup details unavailable</span>
              )}
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Row 2: Stat Selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {statCategories.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveStat(cat.key)}
            className={cn(
              "flex-shrink-0 px-5 py-2 rounded-md border transition-all flex flex-col items-center justify-center min-w-[80px]",
              activeStat === cat.key
                ? "bg-[var(--color-lime)] text-black border-[var(--color-lime)] shadow-[0_0_15px_rgba(212,255,0,0.3)]"
                : "bg-[var(--color-surface)] border-[var(--color-border)] hover:bg-[var(--color-surface-elevated)]"
            )}
          >
            <span className={cn("text-[10px] uppercase tracking-wider font-medium", activeStat === cat.key ? "opacity-90" : "text-[var(--color-text-muted)]")}>{cat.label}</span>
            {cat.propLine && <span className={cn("font-bold text-sm", activeStat !== cat.key && "text-[var(--color-text-muted)]")}>{cat.propLine}</span>}
          </button>
        ))}
      </div>

      {/* Row 3: Performance Chart | Filtered Averages — AT TOP */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Performance Chart — REAL DATA */}
        <div className={cn("flex flex-col p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md relative", isESPNSport ? "lg:col-span-12" : "lg:col-span-9")}>
          {/* Header */}
          <div className="flex justify-between items-center mb-4 z-10">
            <h2 className="font-semibold text-lg tracking-wide">Performance</h2>
            <div className="flex items-center gap-4">
              <div className="flex bg-[var(--color-surface-elevated)] rounded border border-[var(--color-border)] p-0.5">
                {["L5", "L10", "L15", "L30"].map(range => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded",
                      timeRange === range
                        ? "bg-[var(--color-lime)] text-black font-medium shadow-sm"
                        : "text-[var(--color-text-muted)] hover:text-white"
                    )}
                  >
                    {range}
                  </button>
                ))}
              </div>
              <div className="font-bold text-sm tracking-wide text-[var(--color-lime)]">{overCount}/{totalGames}</div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-6 mb-3 text-xs z-10">
            <div className="flex items-center gap-2">
              <div className="w-3 h-1 bg-[var(--color-lime)]" />
              <span className="text-[var(--color-text-muted)] font-medium">{prop.statCategory}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 border-t border-dashed border-white/50" />
              <span className="text-[var(--color-text-muted)] font-medium">Threshold ({threshold})</span>
            </div>
          </div>

          {/* Threshold Control */}
          <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 bg-[var(--color-surface-elevated)] p-1 rounded border border-[var(--color-border)] z-20 shadow-sm">
            <button onClick={() => setThreshold(t => t + 0.5)} className="text-[var(--color-text-muted)] hover:text-white">
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-bold">{threshold}</span>
            <button onClick={() => setThreshold(t => Math.max(0, t - 0.5))} className="text-[var(--color-text-muted)] hover:text-white">
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Chart */}
          <div className="w-full h-[320px]">
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, "auto"]}
                />
                <ReferenceLine
                  y={threshold}
                  stroke="rgba(255,255,255,0.3)"
                  strokeDasharray="4 4"
                  label={{ value: String(threshold), position: "left", fill: "var(--color-lime)", fontSize: 10 }}
                />
                <Tooltip
                  cursor={false}
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null
                    const data = payload[0].payload
                    return (
                      <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg p-3 shadow-xl">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-bold text-white">vs {data.opponent}</span>
                          <span className="text-[10px] text-[var(--color-text-muted)]">{data.date}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div>
                            <span className="text-[9px] text-[var(--color-text-muted)] uppercase">{prop.statCategory}</span>
                            <span className={cn("ml-1 text-sm font-black", data.value >= threshold ? "text-[var(--color-lime)]" : "text-white")}>{data.value}</span>
                          </div>
                          {data.minutes > 0 && (
                            <div>
                              <span className="text-[9px] text-[var(--color-text-muted)] uppercase">MIN</span>
                              <span className="ml-1 text-sm font-bold text-white">{data.minutes}</span>
                            </div>
                          )}
                        </div>
                        <div className="mt-1 text-[9px] text-[var(--color-text-muted)]">
                          Line: {threshold} | {data.value >= threshold ? "✓ Over" : "✗ Under"}
                        </div>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={28} label={({ x, y, width, value }: any) => (
                  <text x={x + width / 2} y={y - 6} textAnchor="middle" fill={value >= threshold ? "var(--color-lime)" : "var(--color-text-muted)"} fontSize={9} fontWeight="bold">
                    {value}
                  </text>
                )}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.value >= threshold ? "var(--color-lime)" : "var(--color-text-muted)"}
                      opacity={entry.value >= threshold ? 1 : 0.4}
                    />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Filtered Averages — REAL DATA from stats-reference (NBA only) */}
        {!isESPNSport && (
        <div className="lg:col-span-3 flex flex-col p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md">
          <h3 className="font-semibold text-base tracking-wide text-center border-b border-[var(--color-border)] pb-3 mb-2">Filtered Averages</h3>
          <div className="flex-grow overflow-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                  <th className="py-2 font-medium">Metric</th>
                  <th className="py-2 font-medium">L10</th>
                  <th className="py-2 font-medium">L5</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                <tr>
                  <td className="py-2 font-medium">{activeStat}</td>
                  <td className="py-2 text-[var(--color-text-muted)]">
                    {rollingAverages?.L10?.[activeStat] ?? prop.l10Avg}
                  </td>
                  <td className="py-2">
                    {(() => {
                      const l5 = Number(rollingAverages?.L5?.[activeStat] ?? prop.l5Avg)
                      const l10 = Number(rollingAverages?.L10?.[activeStat] ?? prop.l10Avg)
                      const diff = l10 !== 0 ? ((l5 - l10) / l10) * 100 : 0
                      const isUp = l5 > l10
                      const isDown = l5 < l10
                      const color = isUp ? "text-[var(--color-success)]" : isDown ? "text-[var(--color-danger)]" : "text-white"
                      return (
                        <>
                          <span className={cn("font-semibold", color)}>{l5}</span>
                          {diff !== 0 && (
                            <span className={cn("ml-1 text-[9px] font-medium", color)}>
                              {isUp ? "↑" : "↓"}{Math.abs(diff).toFixed(0)}%
                            </span>
                          )}
                        </>
                      )
                    })()}
                  </td>
                </tr>
                {["MIN", "FG%", "FG3%", "FT%", "OREB", "DREB", "TOUCHES", "PASSES"].map(metric => {
                  // Map display metrics to rollingAverages keys
                  const metricKeyMap: Record<string, string> = {
                    "MIN": "MIN", "FG%": "FG%", "FG3%": "FG3%", "FT%": "FT%",
                    "OREB": "OREB", "DREB": "DREB", "TOUCHES": "FGA", "PASSES": "FTA",
                  }
                  const raKey = metricKeyMap[metric] ?? metric
                  const l10Val = rollingAverages?.L10?.[raKey] ?? null
                  const l5Val = rollingAverages?.L5?.[raKey] ?? null
                  return (
                    <tr key={metric} className="hover:bg-white/5 transition-colors">
                      <td className="py-2 font-medium text-[var(--color-text-muted)]">{metric}</td>
                      <td className="py-2 text-[var(--color-text-muted)]">
                        {l10Val !== null ? (metric.includes("%") ? `${l10Val}%` : l10Val) : <span className="italic">nil</span>}
                      </td>
                      <td className="py-2">
                        {l5Val !== null && l10Val !== null ? (
                          (() => {
                            const l5Num = Number(l5Val)
                            const l10Num = Number(l10Val)
                            const diff = l10Num !== 0 ? ((l5Num - l10Num) / l10Num) * 100 : 0
                            const isUp = l5Num > l10Num
                            const isDown = l5Num < l10Num
                            const color = isUp ? "text-[var(--color-success)]" : isDown ? "text-[var(--color-danger)]" : "text-white"
                            return (
                              <>
                                <span className={cn("font-semibold", color)}>
                                  {metric.includes("%") ? `${l5Val}%` : l5Val}
                                </span>
                                {diff !== 0 && (
                                  <span className={cn("ml-1 text-[9px] font-medium", color)}>
                                    {isUp ? "↑" : "↓"}{Math.abs(diff).toFixed(0)}%
                                  </span>
                                )}
                              </>
                            )
                          })()
                        ) : l5Val !== null ? (
                          <span className="text-white font-semibold">
                            {metric.includes("%") ? `${l5Val}%` : l5Val}
                          </span>
                        ) : <span className="text-[var(--color-text-muted)] italic">nil</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>

      {/* Splits Panel — Shooting / Points / Efficiency (NBA only) */}
      {!isESPNSport && rollingAverages && (
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md">
        {/* Tab Header */}
        <div className="flex border-b border-[var(--color-border)]">
          {(["shooting", "points", "efficiency"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setSplitsTab(tab)}
              className={cn(
                "flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2",
                splitsTab === tab
                  ? "text-[var(--color-lime)] border-[var(--color-lime)]"
                  : "text-[var(--color-text-muted)] border-transparent hover:text-white"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Shooting Tab */}
        {splitsTab === "shooting" && (
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-xs min-w-[600px]">
              <thead>
                <tr className="text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                  <th className="py-2 text-center font-medium">FGA</th>
                  <th className="py-2 text-center font-medium">FGM</th>
                  <th className="py-2 text-center font-medium">FG%</th>
                  <th className="py-2 text-center font-medium">2PA</th>
                  <th className="py-2 text-center font-medium">2PM</th>
                  <th className="py-2 text-center font-medium">2P%</th>
                  <th className="py-2 text-center font-medium">3PA</th>
                  <th className="py-2 text-center font-medium">3PM</th>
                  <th className="py-2 text-center font-medium">3P%</th>
                  <th className="py-2 text-center font-medium">FTA</th>
                  <th className="py-2 text-center font-medium">FTM</th>
                  <th className="py-2 text-center font-medium">FT%</th>
                </tr>
              </thead>
              <tbody>
                <tr className="text-white font-semibold">
                  <td className="py-3 text-center">{rollingAverages?.L10?.FGA ?? "—"}</td>
                  <td className="py-3 text-center">{rollingAverages?.L10?.FGM ?? "—"}</td>
                  <td className="py-3 text-center text-[var(--color-lime)]">{rollingAverages?.L10?.["FG%"] != null ? `${rollingAverages.L10["FG%"]}%` : "—"}</td>
                  <td className="py-3 text-center">{rollingAverages?.L10?.["2PA"] ?? "—"}</td>
                  <td className="py-3 text-center">{rollingAverages?.L10?.["2PM"] ?? "—"}</td>
                  <td className="py-3 text-center text-[var(--color-lime)]">{rollingAverages?.L10?.["2P%"] != null ? `${rollingAverages.L10["2P%"]}%` : "—"}</td>
                  <td className="py-3 text-center">{rollingAverages?.L10?.["3PA"] ?? (rollingAverages?.L10?.FGA != null && rollingAverages?.L10?.["2PA"] != null ? ((rollingAverages.L10.FGA ?? 0) - (rollingAverages.L10["2PA"] ?? 0)).toFixed(1) : "—")}</td>
                  <td className="py-3 text-center">{rollingAverages?.L10?.["3PM"] ?? "—"}</td>
                  <td className="py-3 text-center text-[var(--color-lime)]">{rollingAverages?.L10?.["FG3%"] != null ? `${rollingAverages.L10["FG3%"]}%` : "—"}</td>
                  <td className="py-3 text-center">{rollingAverages?.L10?.FTA ?? "—"}</td>
                  <td className="py-3 text-center">{rollingAverages?.L10?.FTM ?? "—"}</td>
                  <td className="py-3 text-center text-[var(--color-lime)]">{rollingAverages?.L10?.["FT%"] != null ? `${rollingAverages.L10["FT%"]}%` : "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Points Tab */}
        {splitsTab === "points" && (
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                  <th className="py-2 text-center font-medium">PTS</th>
                  <th className="py-2 text-center font-medium">REB</th>
                  <th className="py-2 text-center font-medium">AST</th>
                  <th className="py-2 text-center font-medium">STL</th>
                  <th className="py-2 text-center font-medium">BLK</th>
                  <th className="py-2 text-center font-medium">TOV</th>
                </tr>
              </thead>
              <tbody>
                <tr className="text-white font-semibold">
                  <td className="py-3 text-center text-[var(--color-lime)]">{rollingAverages?.L10?.PTS ?? "—"}</td>
                  <td className="py-3 text-center">{rollingAverages?.L10?.REB ?? "—"}</td>
                  <td className="py-3 text-center">{rollingAverages?.L10?.AST ?? "—"}</td>
                  <td className="py-3 text-center">{rollingAverages?.L10?.STL ?? "—"}</td>
                  <td className="py-3 text-center">{rollingAverages?.L10?.BLK ?? "—"}</td>
                  <td className="py-3 text-center">{rollingAverages?.L10?.TOV ?? "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Efficiency Tab */}
        {splitsTab === "efficiency" && (
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                  <th className="py-2 text-center font-medium">USG%</th>
                  <th className="py-2 text-center font-medium">EFG%</th>
                  <th className="py-2 text-center font-medium">TS%</th>
                  <th className="py-2 text-center font-medium">EFF</th>
                  <th className="py-2 text-center font-medium">AST/TOV</th>
                </tr>
              </thead>
              <tbody>
                <tr className="text-white font-semibold">
                  <td className="py-3 text-center">{seasonStats?.usgPct != null ? `${seasonStats.usgPct.toFixed(1)}` : "—"}</td>
                  <td className="py-3 text-center">{seasonStats?.efgPct != null ? `${(seasonStats.efgPct * 100).toFixed(1)}%` : "—"}</td>
                  <td className="py-3 text-center text-[var(--color-lime)]">{seasonStats?.tsPct != null ? `${(seasonStats.tsPct * 100).toFixed(1)}%` : "—"}</td>
                  <td className="py-3 text-center">{(() => {
                    // EFF = PTS + REB + AST + STL + BLK - Missed FG - Missed FT - TOV
                    const pts = Number(rollingAverages?.L10?.PTS ?? 0)
                    const reb = Number(rollingAverages?.L10?.REB ?? 0)
                    const ast = Number(rollingAverages?.L10?.AST ?? 0)
                    const stl = Number(rollingAverages?.L10?.STL ?? 0)
                    const blk = Number(rollingAverages?.L10?.BLK ?? 0)
                    const fga = Number(rollingAverages?.L10?.FGA ?? 0)
                    const fgm = Number(rollingAverages?.L10?.FGM ?? 0)
                    const fta = Number(rollingAverages?.L10?.FTA ?? 0)
                    const ftm = Number(rollingAverages?.L10?.FTM ?? 0)
                    const tov = Number(rollingAverages?.L10?.TOV ?? 0)
                    if (pts === 0 && fga === 0) return "—"
                    const eff = pts + reb + ast + stl + blk - (fga - fgm) - (fta - ftm) - tov
                    return eff.toFixed(1)
                  })()}</td>
                  <td className="py-3 text-center">{(() => {
                    const ast = Number(rollingAverages?.L10?.AST ?? 0)
                    const tov = Number(rollingAverages?.L10?.TOV ?? 0)
                    if (tov === 0) return ast > 0 ? "∞" : "—"
                    return (ast / tov).toFixed(2)
                  })()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* Game-by-Game Charts (NBA only) */}
      {!isESPNSport && gameBreakdown && gameBreakdown.length > 0 && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Assists Chart */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Assists</h4>
            <span className="text-[10px] text-[var(--color-text-muted)]">Avg: <span className="text-white font-bold">{rollingAverages?.L10?.AST ?? "—"}</span></span>
          </div>
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={gameBreakdown} margin={{ top: 15, right: 5, left: 5, bottom: 5 }}>
                <XAxis dataKey="opponent" tick={{ fill: "var(--color-text-muted)", fontSize: 8 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--color-text-muted)", fontSize: 9 }} axisLine={false} tickLine={false} domain={[0, "auto"]} width={20} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload
                  return <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded p-2 text-xs"><span className="font-bold">{d.ast} AST</span> <span className="text-[var(--color-text-muted)]">vs {d.opponent}</span></div>
                }} />
                <Bar dataKey="ast" radius={[3, 3, 0, 0]} maxBarSize={24} label={({ x, y, width, value }: any) => (
                  <text x={x + width / 2} y={y - 4} textAnchor="middle" fill="var(--color-lime)" fontSize={8} fontWeight="bold">{value}</text>
                )}>
                  {gameBreakdown.map((_, i) => <Cell key={i} fill="var(--color-lime)" opacity={0.8} />)}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* FGM / FGA Chart */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">FGM / FGA</h4>
            <span className="text-[10px] text-[var(--color-text-muted)]">Avg FGM: <span className="text-white font-bold">{rollingAverages?.L10?.FGM ?? "—"}</span> · FGA: <span className="text-white font-bold">{rollingAverages?.L10?.FGA ?? "—"}</span></span>
          </div>
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={gameBreakdown} margin={{ top: 15, right: 5, left: 5, bottom: 5 }}>
                <XAxis dataKey="opponent" tick={{ fill: "var(--color-text-muted)", fontSize: 8 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--color-text-muted)", fontSize: 9 }} axisLine={false} tickLine={false} domain={[0, "auto"]} width={20} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload
                  return <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded p-2 text-xs"><span className="font-bold">{d.fg}/{d.fga} FG</span> <span className="text-[var(--color-text-muted)]">({d.fga > 0 ? ((d.fg / d.fga) * 100).toFixed(0) : 0}%)</span></div>
                }} />
                <Bar dataKey="fga" radius={[3, 3, 0, 0]} maxBarSize={24} label={({ x, y, width, value }: any) => (
                  <text x={x + width / 2} y={y - 4} textAnchor="middle" fill="var(--color-text-muted)" fontSize={8} fontWeight="bold">{value}</text>
                )}>
                  {gameBreakdown.map((_, i) => <Cell key={i} fill="var(--color-text-muted)" opacity={0.3} />)}
                </Bar>
                <Bar dataKey="fg" radius={[3, 3, 0, 0]} maxBarSize={24} label={({ x, y, width, value }: any) => (
                  <text x={x + width / 2} y={y - 4} textAnchor="middle" fill="var(--color-lime)" fontSize={8} fontWeight="bold">{value}</text>
                )}>
                  {gameBreakdown.map((_, i) => <Cell key={i} fill="var(--color-lime)" opacity={0.8} />)}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* OREB / DREB Chart */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Rebounds</h4>
            <span className="text-[10px] text-[var(--color-text-muted)]">Avg OREB: <span className="text-white font-bold">{rollingAverages?.L10?.OREB ?? "—"}</span> · DREB: <span className="text-white font-bold">{rollingAverages?.L10?.DREB ?? "—"}</span></span>
          </div>
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={gameBreakdown} margin={{ top: 15, right: 5, left: 5, bottom: 5 }}>
                <XAxis dataKey="opponent" tick={{ fill: "var(--color-text-muted)", fontSize: 8 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--color-text-muted)", fontSize: 9 }} axisLine={false} tickLine={false} domain={[0, "auto"]} width={20} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload
                  return <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded p-2 text-xs"><span className="font-bold">{d.orb} OREB · {d.drb} DREB</span></div>
                }} />
                <Bar dataKey="drb" radius={[3, 3, 0, 0]} maxBarSize={24} stackId="reb" label={({ x, y, width, value }: any) => (
                  <text x={x + width / 2} y={y - 4} textAnchor="middle" fill="var(--color-lime)" fontSize={8} fontWeight="bold">{value}</text>
                )}>
                  {gameBreakdown.map((_, i) => <Cell key={i} fill="var(--color-lime)" opacity={0.7} />)}
                </Bar>
                <Bar dataKey="orb" radius={[3, 3, 0, 0]} maxBarSize={24} stackId="reb">
                  {gameBreakdown.map((_, i) => <Cell key={i} fill="var(--color-warning)" opacity={0.7} />)}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-4 mt-2">
            <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-[var(--color-lime)] opacity-70" /><span className="text-[9px] text-[var(--color-text-muted)]">DREB</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-[var(--color-warning)] opacity-70" /><span className="text-[9px] text-[var(--color-text-muted)]">OREB</span></div>
          </div>
        </div>

        {/* 3PM / 3PA Chart */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">3PT</h4>
            <span className="text-[10px] text-[var(--color-text-muted)]">Avg 3PM: <span className="text-white font-bold">{rollingAverages?.L10?.["3PM"] ?? "—"}</span> · 3PA: <span className="text-white font-bold">{rollingAverages?.L10?.["3PA"] ?? "—"}</span></span>
          </div>
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={gameBreakdown} margin={{ top: 15, right: 5, left: 5, bottom: 5 }}>
                <XAxis dataKey="opponent" tick={{ fill: "var(--color-text-muted)", fontSize: 8 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--color-text-muted)", fontSize: 9 }} axisLine={false} tickLine={false} domain={[0, "auto"]} width={20} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload
                  return <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded p-2 text-xs"><span className="font-bold">{d.tp}/{d.tpa} 3PT</span> <span className="text-[var(--color-text-muted)]">({d.tpa > 0 ? ((d.tp / d.tpa) * 100).toFixed(0) : 0}%)</span></div>
                }} />
                <Bar dataKey="tpa" radius={[3, 3, 0, 0]} maxBarSize={24} label={({ x, y, width, value }: any) => (
                  <text x={x + width / 2} y={y - 4} textAnchor="middle" fill="var(--color-text-muted)" fontSize={8} fontWeight="bold">{value}</text>
                )}>
                  {gameBreakdown.map((_, i) => <Cell key={i} fill="var(--color-text-muted)" opacity={0.3} />)}
                </Bar>
                <Bar dataKey="tp" radius={[3, 3, 0, 0]} maxBarSize={24} label={({ x, y, width, value }: any) => (
                  <text x={x + width / 2} y={y - 4} textAnchor="middle" fill="var(--color-lime)" fontSize={8} fontWeight="bold">{value}</text>
                )}>
                  {gameBreakdown.map((_, i) => <Cell key={i} fill="var(--color-lime)" opacity={0.8} />)}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      )}

      {/* Team Analytics — Soccer, NFL, NHL */}
      {isESPNSport && teamAnalytics && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Offensive Stats */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-4">
          <h3 className="font-semibold text-sm tracking-wide mb-3 text-[var(--color-lime)]">Attacking</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                <th className="py-2 text-left font-medium">Metric</th>
                <th className="py-2 text-center font-medium">L5</th>
                <th className="py-2 text-center font-medium">L10</th>
                <th className="py-2 text-center font-medium">Season</th>
                <th className="py-2 text-right font-medium">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {Object.values(teamAnalytics.stats).map((stat: any) => (
                <tr key={stat.label} className="hover:bg-white/5">
                  <td className="py-2 font-medium text-white">{stat.label}</td>
                  <td className="py-2 text-center text-[var(--color-lime)] font-semibold">{stat.l5 ?? "—"}{stat.label.includes("%") ? "%" : ""}</td>
                  <td className="py-2 text-center text-[var(--color-text-muted)]">{stat.l10 ?? "—"}{stat.label.includes("%") ? "%" : ""}</td>
                  <td className="py-2 text-center text-[var(--color-text-muted)]">{stat.season ?? "—"}{stat.label.includes("%") ? "%" : ""}</td>
                  <td className="py-2 text-right">
                    <span className={cn("text-xs font-bold", stat.trend === "up" ? "text-[var(--color-success)]" : stat.trend === "down" ? "text-[var(--color-danger)]" : "text-[var(--color-text-muted)]")}>
                      {stat.trend === "up" ? "↑" : stat.trend === "down" ? "↓" : "→"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Defensive Stats */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-4">
          <h3 className="font-semibold text-sm tracking-wide mb-3 text-[var(--color-danger)]">Defensive / Betting</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                <th className="py-2 text-left font-medium">Metric</th>
                <th className="py-2 text-center font-medium">L5</th>
                <th className="py-2 text-center font-medium">L10</th>
                <th className="py-2 text-center font-medium">Season</th>
                <th className="py-2 text-right font-medium">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {Object.values(teamAnalytics.defensiveStats).map((stat: any) => (
                <tr key={stat.label} className="hover:bg-white/5">
                  <td className="py-2 font-medium text-white">{stat.label}</td>
                  <td className="py-2 text-center text-[var(--color-lime)] font-semibold">{stat.l5 ?? "—"}{stat.label.includes("%") ? "%" : ""}</td>
                  <td className="py-2 text-center text-[var(--color-text-muted)]">{stat.l10 ?? "—"}{stat.label.includes("%") ? "%" : ""}</td>
                  <td className="py-2 text-center text-[var(--color-text-muted)]">{stat.season ?? "—"}{stat.label.includes("%") ? "%" : ""}</td>
                  <td className="py-2 text-right">
                    <span className={cn("text-xs font-bold", stat.trend === "up" ? "text-[var(--color-success)]" : stat.trend === "down" ? "text-[var(--color-danger)]" : "text-[var(--color-text-muted)]")}>
                      {stat.trend === "up" ? "↑" : stat.trend === "down" ? "↓" : "→"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Recent Form */}
        {teamAnalytics.gameLog && teamAnalytics.gameLog.length > 0 && (
        <div className="lg:col-span-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-4">
          <h3 className="font-semibold text-sm tracking-wide mb-3">Recent Form</h3>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {teamAnalytics.gameLog.slice(0, 10).map((game: any, i: number) => (
              <div key={i} className="flex-shrink-0 flex flex-col items-center gap-1 min-w-[60px]">
                <span className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
                  game.result === "W" ? "bg-[var(--color-success)]/20 text-[var(--color-success)]" :
                  game.result === "L" ? "bg-[var(--color-danger)]/20 text-[var(--color-danger)]" :
                  "bg-[var(--color-warning)]/20 text-[var(--color-warning)]"
                )}>
                  {game.result}
                </span>
                <span className="text-[10px] font-bold text-white">{game.goalsFor}-{game.goalsAgainst}</span>
                <span className="text-[9px] text-[var(--color-text-muted)] truncate max-w-[60px]">{game.opponent.split(" ").pop()}</span>
              </div>
            ))}
          </div>
        </div>
        )}
      </div>
      )}

      {/* NHL/NFL Player Stats */}
      {(sportParam === "NHL" || sportParam === "NFL") && playerAnalytics && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Per-Game Averages Table */}
        <div className="lg:col-span-7 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-4">
          <h3 className="font-semibold text-sm tracking-wide mb-3">Per-Game Averages</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                <th className="py-2 text-left font-medium">Stat</th>
                <th className="py-2 text-center font-medium">L5</th>
                <th className="py-2 text-center font-medium">L10</th>
                <th className="py-2 text-center font-medium">Season</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {Object.entries(playerAnalytics.averages).map(([key, stat]: [string, any]) => (
                <tr key={key} className="hover:bg-white/5">
                  <td className="py-2 font-medium text-white">{stat.label}</td>
                  <td className="py-2 text-center text-[var(--color-lime)] font-semibold">{stat.l5 ?? "—"}</td>
                  <td className="py-2 text-center text-white">{stat.l10 ?? "—"}</td>
                  <td className="py-2 text-center text-[var(--color-text-muted)]">{stat.season ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Splits (Season Per-Game) */}
        <div className="lg:col-span-5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-4">
          <h3 className="font-semibold text-sm tracking-wide mb-3">
            {playerAnalytics.player} <span className="text-[var(--color-text-muted)] font-normal">{playerAnalytics.position ?? ""} · Splits</span>
          </h3>
          <div className="space-y-1">
            {Object.entries(playerAnalytics.splits).map(([label, value]: [string, any]) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]/50">
                <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
                <span className="text-xs font-bold text-white">{value ?? "—"}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Game Log */}
        {playerAnalytics.gameLog && playerAnalytics.gameLog.length > 0 && (
        <div className="lg:col-span-12 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-4">
          <h3 className="font-semibold text-sm tracking-wide mb-3">Game Log</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[600px]">
              <thead>
                <tr className="text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                  <th className="py-2 text-left font-medium">Date</th>
                  <th className="py-2 text-center font-medium">W/L</th>
                  {sportParam === "NHL" ? (
                    <>
                      <th className="py-2 text-center font-medium">G</th>
                      <th className="py-2 text-center font-medium">A</th>
                      <th className="py-2 text-center font-medium">PTS</th>
                      <th className="py-2 text-center font-medium">SOG</th>
                      <th className="py-2 text-center font-medium">HT</th>
                      <th className="py-2 text-center font-medium">BS</th>
                      <th className="py-2 text-center font-medium">TOI</th>
                      <th className="py-2 text-center font-medium">+/-</th>
                    </>
                  ) : (
                    <>
                      <th className="py-2 text-center font-medium">YDS</th>
                      <th className="py-2 text-center font-medium">TD</th>
                      <th className="py-2 text-center font-medium">REC</th>
                      <th className="py-2 text-center font-medium">CAR</th>
                      <th className="py-2 text-center font-medium">TGTS</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {playerAnalytics.gameLog.slice(0, 15).map((game: any, i: number) => (
                  <tr key={i} className="hover:bg-white/5">
                    <td className="py-1.5 text-[var(--color-text-muted)]">{game.date}</td>
                    <td className="py-1.5 text-center">
                      <span className={cn("text-xs font-bold", game.result === "W" ? "text-[var(--color-success)]" : game.result === "L" ? "text-[var(--color-danger)]" : "text-[var(--color-text-muted)]")}>
                        {game.result || "—"}
                      </span>
                    </td>
                    {sportParam === "NHL" ? (
                      <>
                        <td className={cn("py-1.5 text-center font-semibold", (game.stats.G ?? 0) > 0 ? "text-[var(--color-lime)]" : "")}>{game.stats.G ?? 0}</td>
                        <td className={cn("py-1.5 text-center font-semibold", (game.stats.A ?? 0) > 0 ? "text-[var(--color-lime)]" : "")}>{game.stats.A ?? 0}</td>
                        <td className={cn("py-1.5 text-center font-bold", (game.stats.PTS ?? 0) > 0 ? "text-[var(--color-lime)]" : "")}>{game.stats.PTS ?? 0}</td>
                        <td className="py-1.5 text-center">{game.stats.SOG ?? "—"}</td>
                        <td className="py-1.5 text-center">{game.stats.HT ?? "—"}</td>
                        <td className="py-1.5 text-center">{game.stats.BS ?? "—"}</td>
                        <td className="py-1.5 text-center text-[var(--color-text-muted)]">{game.stats.TOI ?? "—"}</td>
                        <td className={cn("py-1.5 text-center font-semibold", (game.stats["+/-"] ?? 0) > 0 ? "text-[var(--color-success)]" : (game.stats["+/-"] ?? 0) < 0 ? "text-[var(--color-danger)]" : "")}>{game.stats["+/-"] ?? "—"}</td>
                      </>
                    ) : (
                      <>
                        <td className="py-1.5 text-center font-semibold">{game.stats.YDS ?? "—"}</td>
                        <td className={cn("py-1.5 text-center font-bold", (game.stats.TD ?? 0) > 0 ? "text-[var(--color-lime)]" : "")}>{game.stats.TD ?? 0}</td>
                        <td className="py-1.5 text-center">{game.stats.REC ?? "—"}</td>
                        <td className="py-1.5 text-center">{game.stats.CAR ?? "—"}</td>
                        <td className="py-1.5 text-center">{game.stats.TGTS ?? "—"}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>
      )}

      {/* Row 3.5: Per Game (left) | Projected + Matchup (right) — NBA only */}
      {!isESPNSport && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Per Game Stats */}
        <div className="lg:col-span-9">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Per Game</h3>
            <div className="flex bg-[var(--color-surface-elevated)] rounded border border-[var(--color-border)] p-0.5">
              {(["regular", "playoffs"] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setSeasonType(type)}
                  className={cn(
                    "px-3 py-1 text-[10px] rounded font-medium transition-all",
                    seasonType === type
                      ? "bg-[var(--color-lime)] text-black shadow-sm"
                      : "text-[var(--color-text-muted)] hover:text-white"
                  )}
                >
                  {type === "regular" ? "Regular" : "Playoffs"}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-3">
            <div className="grid grid-cols-10 gap-1.5">
              {[
                { label: "MIN", value: seasonStats?.mpg ?? rollingAverages?.L10?.MIN ?? "—" },
                { label: "PPG", value: seasonStats?.ppg ?? rollingAverages?.L10?.PTS ?? prop.l10Avg },
                { label: "APG", value: seasonStats?.apg ?? rollingAverages?.L10?.AST ?? "—" },
                { label: "RPG", value: seasonStats?.rpg ?? rollingAverages?.L10?.REB ?? "—" },
                { label: "SPG", value: seasonStats?.spg ?? rollingAverages?.L10?.STL ?? "—" },
                { label: "FGA", value: seasonStats?.fgaPerG ?? rollingAverages?.L10?.FGA ?? "—" },
                { label: "FG%", value: seasonStats?.fgPct != null ? `${(seasonStats.fgPct * 100).toFixed(1)}` : (rollingAverages?.L10?.["FG%"] != null ? `${rollingAverages.L10["FG%"]}` : "—") },
                { label: "3PM", value: seasonStats?.fg3PerG ?? rollingAverages?.L10?.["3PM"] ?? "—" },
                { label: "FT%", value: seasonStats?.ftPct != null ? `${(seasonStats.ftPct * 100).toFixed(1)}` : "—" },
                { label: "TOV", value: seasonStats?.tovPerG ?? rollingAverages?.L10?.TOV ?? "—" },
              ].map((s) => (
                <div key={s.label} className="flex flex-col items-center justify-center py-2 rounded border border-[var(--color-border)] bg-[var(--color-surface-elevated)]">
                  <span className="text-sm font-black text-white">{s.value}</span>
                  <span className="text-[8px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider mt-0.5">{s.label}</span>
                </div>
              ))}
            </div>
          </div>


          {/* Shot Chart — Collapsible */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md mt-3">
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-3">
                <h4 className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Shot Chart</h4>
                {shotChartOpen && (
                  <div className="flex bg-[var(--color-surface-elevated)] rounded border border-[var(--color-border)] p-0.5">
                    {(["heatmap", "zones"] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setShotChartMode(mode)}
                        className={cn(
                          "px-3 py-1 text-[10px] rounded capitalize font-medium transition-all",
                          shotChartMode === mode
                            ? "bg-[var(--color-lime)] text-black shadow-sm"
                            : "text-[var(--color-text-muted)] hover:text-white"
                        )}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setShotChartOpen(!shotChartOpen)}
                className="p-1 rounded hover:bg-white/5 transition-colors"
              >
                <ChevronDown className={cn("w-4 h-4 text-[var(--color-text-muted)] transition-transform", shotChartOpen && "rotate-180")} />
              </button>
            </div>
            {shotChartOpen && (
              <div className="px-4 pb-4">
            {(() => {
              // Use real shooting zone data if available, fall back to estimates
              const fgPct = Number(rollingAverages?.L10?.["FG%"] ?? 0)
              const fg3Pct = shootingZones?.fgPct3pt != null ? shootingZones.fgPct3pt * 100 : Number(rollingAverages?.L10?.["FG3%"] ?? 0)
              const ftPct = seasonStats?.ftPct != null ? seasonStats.ftPct * 100 : Number(rollingAverages?.L10?.["FT%"] ?? 0)
              const fga = seasonStats?.fgaPerG ?? Number(rollingAverages?.L10?.FGA ?? 0)
              const tpm = seasonStats?.fg3PerG ?? Number(rollingAverages?.L10?.["3PM"] ?? 0)

              // Real zone FG% from BBRef shooting page (stored as decimals 0-1, multiply by 100)
              const paintPct = shootingZones?.fgPct0_3ft != null ? shootingZones.fgPct0_3ft * 100 : Math.min(100, fgPct * 1.3)
              const shortMidPct = shootingZones?.fgPct3_10ft != null ? shootingZones.fgPct3_10ft * 100 : fgPct * 0.9
              const longMidPct = shootingZones?.fgPct10_16ft != null ? shootingZones.fgPct10_16ft * 100 : fgPct * 0.85
              const midRangePct = shootingZones?.fgPct16_3pt != null ? shootingZones.fgPct16_3pt * 100 : fgPct > 0 ? Math.max(0, fgPct * 0.85) : 0
              const corner3Pct = shootingZones?.fg3PctCorner != null ? shootingZones.fg3PctCorner * 100 : fg3Pct

              // Real volume distribution (already 0-100 from API)
              const paintVolume = shootingZones?.pctFga0_3ft != null ? shootingZones.pctFga0_3ft / 100 : (fga > 0 ? 0.35 : 0)
              const midVolume = shootingZones != null
                ? ((shootingZones.pctFga3_10ft ?? 0) + (shootingZones.pctFga10_16ft ?? 0) + (shootingZones.pctFga16_3pt ?? 0)) / 100
                : (fga > 0 ? 0.35 : 0)
              const threeVolume = shootingZones?.pctFga3pt != null ? shootingZones.pctFga3pt / 100 : (fga > 0 ? 0.30 : 0)

              const getHeatColor = (pct: number) => {
                if (pct >= 60) return "bg-[var(--color-lime)]"
                if (pct >= 45) return "bg-[var(--color-success)]"
                if (pct >= 35) return "bg-yellow-500"
                if (pct > 0) return "bg-[var(--color-danger)]"
                return "bg-white/10"
              }

              const getTextColor = (pct: number) => {
                if (pct >= 45) return "text-black"
                return "text-white"
              }

              if (shotChartMode === "heatmap") {
                // Deterministic pseudo-random for stable renders
                const seed = (prop.player + activeStat).split("").reduce((a, c) => a + c.charCodeAt(0), 0)
                const seededRandom = (i: number) => {
                  const x = Math.sin(seed * 9301 + i * 49297) * 49297
                  return x - Math.floor(x)
                }

                // Generate dense heatmap spots based on volume
                const spots: { x: number; y: number; size: number; intensity: number }[] = []
                let idx = 0
                // Paint area spots (dense cluster near rim)
                const paintCount = Math.round(8 + paintVolume * 12)
                for (let i = 0; i < paintCount; i++) {
                  spots.push({
                    x: 35 + seededRandom(idx++) * 30,
                    y: 3 + seededRandom(idx++) * 22,
                    size: 12 + seededRandom(idx++) * 18,
                    intensity: 0.6 + seededRandom(idx++) * 0.4,
                  })
                }
                // Mid-range spots
                const midCount = Math.round(5 + midVolume * 10)
                for (let i = 0; i < midCount; i++) {
                  const angle = seededRandom(idx++) * Math.PI
                  const dist = 28 + seededRandom(idx++) * 15
                  spots.push({
                    x: 50 + Math.cos(angle) * dist,
                    y: 8 + Math.sin(angle) * dist,
                    size: 10 + seededRandom(idx++) * 14,
                    intensity: 0.35 + seededRandom(idx++) * 0.35,
                  })
                }
                // Three-point spots
                const threeCount = Math.round(4 + threeVolume * 14)
                for (let i = 0; i < threeCount; i++) {
                  const angle = seededRandom(idx++) * Math.PI
                  const dist = 38 + seededRandom(idx++) * 12
                  spots.push({
                    x: 50 + Math.cos(angle) * dist,
                    y: 10 + Math.sin(angle) * dist,
                    size: 10 + seededRandom(idx++) * 12,
                    intensity: 0.25 + seededRandom(idx++) * 0.4,
                  })
                }
                // Corner 3s
                for (let i = 0; i < Math.round(2 + threeVolume * 4); i++) {
                  spots.push({ x: 3 + seededRandom(idx++) * 8, y: 3 + seededRandom(idx++) * 18, size: 10 + seededRandom(idx++) * 10, intensity: 0.3 + seededRandom(idx++) * 0.4 })
                  spots.push({ x: 89 + seededRandom(idx++) * 8, y: 3 + seededRandom(idx++) * 18, size: 10 + seededRandom(idx++) * 10, intensity: 0.3 + seededRandom(idx++) * 0.4 })
                }

                return (
                  <div className="relative w-full max-w-[420px] mx-auto aspect-[5/3] rounded-lg overflow-hidden border border-[var(--color-border)]">
                    {/* Background — dark court */}
                    <div className="absolute inset-0 bg-[#1a1a2e]" />

                    {/* Gaussian blur layer for smooth heatmap effect */}
                    <div className="absolute inset-0 z-[1]" style={{ filter: "blur(8px)" }}>
                      {spots.map((spot, i) => (
                        <div
                          key={i}
                          className="absolute rounded-full"
                          style={{
                            left: `${spot.x}%`,
                            top: `${spot.y}%`,
                            width: `${spot.size}%`,
                            height: `${spot.size}%`,
                            transform: "translate(-50%, -50%)",
                            background: spot.intensity > 0.7
                              ? `radial-gradient(circle, rgba(255,100,0,${spot.intensity}) 0%, rgba(255,160,0,${spot.intensity * 0.7}) 30%, rgba(255,200,50,${spot.intensity * 0.4}) 60%, transparent 80%)`
                              : spot.intensity > 0.4
                              ? `radial-gradient(circle, rgba(255,160,0,${spot.intensity}) 0%, rgba(255,210,50,${spot.intensity * 0.6}) 40%, rgba(255,240,150,${spot.intensity * 0.3}) 65%, transparent 85%)`
                              : `radial-gradient(circle, rgba(255,200,50,${spot.intensity}) 0%, rgba(255,230,120,${spot.intensity * 0.5}) 45%, transparent 80%)`,
                          }}
                        />
                      ))}
                    </div>

                    {/* Sharp overlay spots for hot zones (orange/red cores) */}
                    <div className="absolute inset-0 z-[2]" style={{ filter: "blur(3px)" }}>
                      {spots.filter(s => s.intensity > 0.55).map((spot, i) => (
                        <div
                          key={`core-${i}`}
                          className="absolute rounded-full"
                          style={{
                            left: `${spot.x}%`,
                            top: `${spot.y}%`,
                            width: `${spot.size * 0.5}%`,
                            height: `${spot.size * 0.5}%`,
                            transform: "translate(-50%, -50%)",
                            background: `radial-gradient(circle, rgba(255,80,0,${spot.intensity * 0.8}) 0%, rgba(255,140,0,${spot.intensity * 0.5}) 50%, transparent 80%)`,
                          }}
                        />
                      ))}
                    </div>

                    {/* Court SVG lines on top */}
                    <svg viewBox="0 0 300 180" className="absolute inset-0 w-full h-full z-10" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="5" y="5" width="290" height="170" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" fill="none" />
                      <path d="M 30 5 L 30 40 A 110 110 0 0 0 270 40 L 270 5" stroke="rgba(255,255,255,0.15)" strokeWidth="1" fill="none" />
                      <rect x="110" y="5" width="80" height="70" stroke="rgba(255,255,255,0.15)" strokeWidth="1" fill="none" />
                      <circle cx="150" cy="75" r="25" stroke="rgba(255,255,255,0.12)" strokeWidth="1" fill="none" strokeDasharray="4 3" />
                      <circle cx="150" cy="14" r="5" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" fill="none" />
                      <path d="M 137 5 A 13 13 0 0 0 163 5" stroke="rgba(255,255,255,0.15)" strokeWidth="1" fill="none" />
                    </svg>

                    {/* Legend */}
                    <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2 bg-black/50 backdrop-blur-md rounded-md px-3 py-1.5 border border-white/10">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,230,120,0.9), rgba(255,240,180,0.3))" }} />
                        <span className="text-[9px] text-white/60 font-medium">Low</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,160,0,0.9), rgba(255,200,50,0.4))" }} />
                        <span className="text-[9px] text-white/60 font-medium">Med</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,80,0,0.95), rgba(255,140,0,0.5))" }} />
                        <span className="text-[9px] text-white/60 font-medium">Hot</span>
                      </div>
                    </div>

                    {/* FGA label */}
                    <div className="absolute top-3 left-3 z-20 bg-black/50 backdrop-blur-md rounded-md px-2.5 py-1 border border-white/10">
                      <span className="text-[9px] text-white/60 font-medium">{fga > 0 ? `${fga.toFixed(1)} FGA/G` : "No data"}</span>
                    </div>
                  </div>
                )
              }

              // Zones mode — minimal dark court with clean zone indicators
              return (
                <div className="relative w-full max-w-[420px] mx-auto aspect-[5/3] rounded-lg overflow-hidden bg-[#0d1117]">
                  {/* Court SVG lines */}
                  <svg viewBox="0 0 300 180" className="absolute inset-0 w-full h-full z-[5]" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="3" width="294" height="174" rx="2" stroke="rgba(255,255,255,0.15)" strokeWidth="1" fill="none" />
                    <path d="M 30 3 L 30 40 A 110 110 0 0 0 270 40 L 270 3" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" fill="none" />
                    <rect x="110" y="3" width="80" height="70" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" fill="none" />
                    <circle cx="150" cy="73" r="25" stroke="rgba(255,255,255,0.1)" strokeWidth="0.8" fill="none" strokeDasharray="4 3" />
                    <circle cx="150" cy="14" r="5" stroke="rgba(255,255,255,0.2)" strokeWidth="1" fill="none" />
                    <path d="M 137 3 A 13 13 0 0 0 163 3" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" fill="none" />
                  </svg>

                  {/* Zone labels — just percentages, no boxes */}
                  <div className="absolute inset-0 z-[6]">
                    {/* Paint (0-3ft) */}
                    <div className="absolute top-[12%] left-[50%] -translate-x-1/2 flex flex-col items-center">
                      <span className={cn("text-xl font-black", paintPct >= 55 ? "text-[var(--color-lime)]" : paintPct >= 40 ? "text-white" : "text-red-400")}>{paintPct.toFixed(0)}%</span>
                      <span className="text-[8px] text-white/40 uppercase tracking-wider">0-3ft</span>
                    </div>

                    {/* Short mid (3-10ft) left */}
                    <div className="absolute top-[28%] left-[18%] flex flex-col items-center">
                      <span className={cn("text-sm font-bold", shortMidPct >= 45 ? "text-[var(--color-lime)]" : shortMidPct >= 35 ? "text-white" : "text-red-400")}>{shortMidPct.toFixed(0)}%</span>
                      <span className="text-[7px] text-white/30 uppercase">3-10ft</span>
                    </div>

                    {/* Long mid (16ft-3pt) right */}
                    <div className="absolute top-[28%] right-[18%] flex flex-col items-center">
                      <span className={cn("text-sm font-bold", midRangePct >= 42 ? "text-[var(--color-lime)]" : midRangePct >= 35 ? "text-white" : "text-red-400")}>{midRangePct.toFixed(0)}%</span>
                      <span className="text-[7px] text-white/30 uppercase">16ft+</span>
                    </div>

                    {/* Corner 3 left */}
                    <div className="absolute top-[14%] left-[5%] flex flex-col items-center">
                      <span className={cn("text-xs font-bold", corner3Pct >= 38 ? "text-[var(--color-lime)]" : corner3Pct >= 33 ? "text-white" : "text-red-400")}>{corner3Pct > 0 ? `${corner3Pct.toFixed(0)}%` : "\u2014"}</span>
                      <span className="text-[6px] text-white/30 uppercase">c3</span>
                    </div>

                    {/* Corner 3 right */}
                    <div className="absolute top-[14%] right-[5%] flex flex-col items-center">
                      <span className={cn("text-xs font-bold", corner3Pct >= 38 ? "text-[var(--color-lime)]" : corner3Pct >= 33 ? "text-white" : "text-red-400")}>{corner3Pct > 0 ? `${corner3Pct.toFixed(0)}%` : "\u2014"}</span>
                      <span className="text-[6px] text-white/30 uppercase">c3</span>
                    </div>

                    {/* FT — at the free throw line */}
                    <div className="absolute top-[48%] left-[50%] -translate-x-1/2 flex flex-col items-center">
                      <span className={cn("text-xs font-bold", ftPct >= 80 ? "text-[var(--color-lime)]" : ftPct > 0 ? "text-white" : "text-white/40")}>{ftPct > 0 ? `${ftPct}%` : "\u2014"}</span>
                      <span className="text-[7px] text-white/30 uppercase">ft</span>
                    </div>

                    {/* 3PT arc — outside the arc */}
                    <div className="absolute bottom-[8%] left-[50%] -translate-x-1/2 flex flex-col items-center">
                      <span className={cn("text-lg font-black", fg3Pct >= 38 ? "text-[var(--color-lime)]" : fg3Pct >= 33 ? "text-white" : "text-red-400")}>{fg3Pct > 0 ? `${fg3Pct.toFixed(0)}%` : "\u2014"}</span>
                      <span className="text-[8px] text-white/40 uppercase tracking-wider">3pt</span>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Shot Distribution Summary */}
            {(() => {
              const fga = Number(rollingAverages?.L10?.FGA ?? 0)
              // Use real distribution data from shootingZones (already 0-100)
              const realPaintRate = shootingZones?.pctFga0_3ft ?? null
              const realMidRate = shootingZones != null
                ? ((shootingZones.pctFga3_10ft ?? 0) + (shootingZones.pctFga10_16ft ?? 0) + (shootingZones.pctFga16_3pt ?? 0))
                : null
              const realThreeRate = shootingZones?.pctFga3pt ?? null

              const paintRate = realPaintRate ?? 35
              const midRate = realMidRate ?? 35
              const threeRate = realThreeRate ?? 30

              // Real FG% per zone
              const paintFg = shootingZones?.fgPct0_3ft != null ? (shootingZones.fgPct0_3ft * 100).toFixed(0) : "—"
              const midFg = shootingZones?.fgPct10_16ft != null ? (((shootingZones.fgPct3_10ft ?? 0) + (shootingZones.fgPct10_16ft ?? 0) + (shootingZones.fgPct16_3pt ?? 0)) / 3 * 100).toFixed(0) : "—"
              const threeFg = shootingZones?.fgPct3pt != null ? (shootingZones.fgPct3pt * 100).toFixed(0) : "—"

              if (fga === 0 && !shootingZones) return null
              return (
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-[var(--color-surface-elevated)] rounded-lg p-2 border border-[var(--color-border)]">
                    <div className="text-lg font-black text-[var(--color-lime)]">{paintRate.toFixed(0)}%</div>
                    <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider">Paint</div>
                    <div className="text-[10px] text-white/60 mt-0.5">{paintFg}% FG</div>
                  </div>
                  <div className="bg-[var(--color-surface-elevated)] rounded-lg p-2 border border-[var(--color-border)]">
                    <div className="text-lg font-black text-yellow-400">{midRate.toFixed(0)}%</div>
                    <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider">Mid</div>
                    <div className="text-[10px] text-white/60 mt-0.5">{midFg}% FG</div>
                  </div>
                  <div className="bg-[var(--color-surface-elevated)] rounded-lg p-2 border border-[var(--color-border)]">
                    <div className="text-lg font-black text-orange-400">{threeRate.toFixed(0)}%</div>
                    <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider">3PT</div>
                    <div className="text-[10px] text-white/60 mt-0.5">{threeFg}% FG</div>
                  </div>
                </div>
              )
            })()}
              </div>
            )}
          </div>
        </div>

        {/* Right: Projected + Matchup stacked */}
        <div className="lg:col-span-3 space-y-4">
          {/* Projected vs Opponent */}
          <div>
            <h3 className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-3">
              Projected vs {prop.defensiveMatchup?.opponentTeam ?? prop.matchup ?? "Opponent"}
            </h3>
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md divide-y divide-[var(--color-border)]">
              {(() => {
                const ptsPerGame = seasonStats?.ppg ?? Number(rollingAverages?.L10?.PTS ?? prop.l10Avg)
                const fgaPerGame = seasonStats?.fgaPerG ?? Number(rollingAverages?.L10?.FGA ?? 0)
                const ftaPerGame = seasonStats?.ftaPerG ?? Number(rollingAverages?.L10?.FTA ?? 0)
                const astPerGame = seasonStats?.apg ?? Number(rollingAverages?.L10?.AST ?? 0)
                const tovPerGame = seasonStats?.tovPerG ?? Number(rollingAverages?.L10?.TOV ?? 0)
                const rebPerGame = seasonStats?.rpg ?? Number(rollingAverages?.L10?.REB ?? 0)
                const stlPerGame = seasonStats?.spg ?? Number(rollingAverages?.L10?.STL ?? 0)
                const blkPerGame = seasonStats?.bpg ?? Number(rollingAverages?.L10?.BLK ?? 0)

                // Use real True Shooting % if available
                const tsPct = seasonStats?.tsPct != null ? `${(seasonStats.tsPct * 100).toFixed(1)}%` : null
                const ePPS = fgaPerGame + 0.44 * ftaPerGame > 0 ? (ptsPerGame / (fgaPerGame + 0.44 * ftaPerGame)).toFixed(2) : "—"
                const astTov = tovPerGame > 0 ? (astPerGame / tovPerGame).toFixed(2) : "—"
                const foulsDrawn = ftaPerGame > 0 ? (ftaPerGame / 1.8).toFixed(1) : "—"
                const stocks = (stlPerGame + blkPerGame).toFixed(1)
                const usgRate = seasonStats?.usgPct != null ? `${seasonStats.usgPct.toFixed(1)}%` : null

                return [
                  { label: "ePPS", desc: "Points per shot attempt", value: ePPS, badge: tsPct ? `TS: ${tsPct}` : null },
                  { label: "Usage Rate", desc: "% of team plays used", value: usgRate ?? "—", badge: null },
                  { label: "Fouls drawn/G", desc: "Expected FT trips", value: foulsDrawn, badge: null },
                  { label: "Rebounds/G", desc: "Season average", value: rebPerGame || "—", badge: null },
                  { label: "AST / TOV", desc: "Decision-making", value: astTov, badge: null },
                  { label: "Stocks (STL+BLK)", desc: "Defensive plays", value: stocks, badge: null },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="text-xs font-bold text-white">{row.label}</div>
                      <div className="text-[10px] text-[var(--color-text-muted)]">{row.desc}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-white">{row.value}</span>
                      {row.badge && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-[var(--color-text-muted)]">{row.badge}</span>}
                    </div>
                  </div>
                ))
              })()}
            </div>
          </div>

          {/* Matchup — Opponent allows to Position */}
          <div>
            <h3 className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-3">
              Matchup — {prop.defensiveMatchup?.opponentTeam ?? prop.matchup ?? "Opponent"} allows to {prop.position ?? "?"}
            </h3>
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md divide-y divide-[var(--color-border)]">
              {prop.defensiveMatchup ? (
                [
                  { label: `Points allowed to ${prop.position}/G`, value: prop.defensiveMatchup.statAllowedPerGame, rating: prop.defensiveMatchup.grade === "A" || prop.defensiveMatchup.grade === "B" ? "weak" : prop.defensiveMatchup.grade === "D" || prop.defensiveMatchup.grade === "F" ? "strong" : "mid", color: prop.defensiveMatchup.grade === "A" || prop.defensiveMatchup.grade === "B" ? "red" : prop.defensiveMatchup.grade === "D" || prop.defensiveMatchup.grade === "F" ? "green" : "yellow" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between px-4 py-3">
                    <span className="text-xs font-medium text-white">{row.label}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", row.color === "red" ? "bg-red-500" : row.color === "green" ? "bg-green-500" : "bg-yellow-500")} style={{ width: `${Math.min(100, (Number(row.value) / 30) * 100)}%` }} />
                      </div>
                      <span className="text-xs font-black text-white">{row.value}</span>
                      <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded", row.rating === "weak" ? "bg-red-500/20 text-red-400" : row.rating === "strong" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400")}>{row.rating}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-6 text-center">
                  <span className="text-xs text-[var(--color-text-muted)] italic">Matchup data not available</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Row 4: Pts vs Team | Defense | Position Points | Matchup Factors */}
      {!isESPNSport && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-3 p-4 flex flex-col bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md min-h-[160px]">
          <h3 className="font-semibold text-sm tracking-wide mb-3">
            {prop.statCategory} vs {prop.defensiveMatchup?.opponentTeam ?? prop.matchup ?? "Opponent"}
          </h3>
          {(() => {
            const oppTeam = (prop.defensiveMatchup?.opponentTeam ?? prop.matchup ?? "").toUpperCase()
            const vsGames = prop.lastGames.filter(g => g.opponent.toUpperCase() === oppTeam)
            if (vsGames.length === 0) {
              return (
                <div className="flex-grow flex items-center justify-center">
                  <span className="text-[var(--color-text-muted)] text-sm italic">No games vs {oppTeam} in recent history</span>
                </div>
              )
            }
            const avg = (vsGames.reduce((s, g) => s + g.value, 0) / vsGames.length).toFixed(1)
            return (
              <div className="flex-grow flex flex-col justify-center gap-2">
                <div className="text-center">
                  <span className="text-2xl font-black text-[var(--color-lime)]">{avg}</span>
                  <span className="text-[10px] text-[var(--color-text-muted)] ml-1">avg in {vsGames.length} game{vsGames.length > 1 ? "s" : ""}</span>
                </div>
                <div className="flex justify-center gap-1">
                  {vsGames.slice(-5).map((g, i) => (
                    <div key={i} className={cn("px-2 py-1 rounded text-xs font-bold", g.overLine ? "bg-[var(--color-lime)]/20 text-[var(--color-lime)]" : "bg-white/5 text-[var(--color-text-muted)]")}>
                      {g.value}
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>

        {/* Defense Chart — visual comparison */}
        <div className="lg:col-span-5 p-4 flex flex-col bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md min-h-[160px]">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-sm tracking-wide">
              {prop.defensiveMatchup?.opponentTeam ?? "Opponent"} Defense
            </h3>
            {prop.defensiveMatchup && (
              <div className="text-xs">
                <span className="text-[var(--color-text-muted)]">Allows:</span>{" "}
                <span className="font-bold">{prop.defensiveMatchup.statAllowedPerGame}</span>
                <span className="text-[var(--color-text-muted)] ml-2">Avg:</span>{" "}
                <span className="font-bold">{prop.defensiveMatchup.leagueAverage}</span>
                <span className={cn(
                  "ml-2 font-bold px-1.5 py-0.5 rounded text-[10px]",
                  prop.defensiveMatchup.grade === "A" ? "bg-[var(--color-success)]/20 text-[var(--color-success)]" :
                  prop.defensiveMatchup.grade === "B" ? "bg-[var(--color-success)]/10 text-[var(--color-success)]" :
                  prop.defensiveMatchup.grade === "D" ? "bg-[var(--color-danger)]/10 text-[var(--color-danger)]" :
                  prop.defensiveMatchup.grade === "F" ? "bg-[var(--color-danger)]/20 text-[var(--color-danger)]" :
                  "bg-white/10 text-white"
                )}>
                  {prop.defensiveMatchup.grade}
                </span>
              </div>
            )}
          </div>
          {prop.defensiveMatchup ? (
            <div className="flex-grow flex flex-col justify-center gap-3 px-2">
              {/* Visual bar comparison: allowed vs league avg */}
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mb-1">
                    <span>Allowed to {prop.position}</span>
                    <span className="font-bold text-white">{prop.defensiveMatchup.statAllowedPerGame}</span>
                  </div>
                  <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", prop.defensiveMatchup.statAllowedPerGame > prop.defensiveMatchup.leagueAverage ? "bg-[var(--color-success)]" : "bg-[var(--color-danger)]")} style={{ width: `${Math.min(100, (prop.defensiveMatchup.statAllowedPerGame / (prop.defensiveMatchup.leagueAverage * 1.5)) * 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mb-1">
                    <span>League Average</span>
                    <span className="font-bold text-white">{prop.defensiveMatchup.leagueAverage}</span>
                  </div>
                  <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-white/30" style={{ width: `${Math.min(100, (prop.defensiveMatchup.leagueAverage / (prop.defensiveMatchup.leagueAverage * 1.5)) * 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mb-1">
                    <span>Player L10 Avg</span>
                    <span className="font-bold text-[var(--color-lime)]">{prop.l10Avg}</span>
                  </div>
                  <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--color-lime)]" style={{ width: `${Math.min(100, (prop.l10Avg / (prop.defensiveMatchup.leagueAverage * 1.5)) * 100)}%` }} />
                  </div>
                </div>
              </div>
              <div className="text-[10px] text-[var(--color-text-muted)] text-center mt-1">
                Pace: {prop.defensiveMatchup.paceRating}
              </div>
            </div>
          ) : (
            <div className="flex-grow flex items-center justify-center">
              <span className="text-[var(--color-text-muted)] text-sm italic">Defensive data not available</span>
            </div>
          )}
        </div>

        {/* Position Points — PARTIAL (from defensive matchup) */}
        <div className="lg:col-span-2 p-0 flex flex-col overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md min-h-[160px]">
          <div className="grid grid-cols-2 text-[9px] uppercase tracking-wider font-medium text-[var(--color-text-muted)] border-b border-[var(--color-border)] p-2 text-center bg-[var(--color-surface-elevated)]">
            <div>Position</div>
            <div>Allowed</div>
          </div>
          {prop.defensiveMatchup ? (
            <div className="flex flex-col flex-grow justify-center px-2">
              <div className="grid grid-cols-2 text-xs py-2">
                <div className="font-medium text-[var(--color-text-muted)]">{prop.position ?? "?"}</div>
                <div className="text-right">
                  <span className={cn("font-medium", prop.defensiveMatchup.statAllowedPerGame > prop.defensiveMatchup.leagueAverage ? "text-[var(--color-success)]" : "text-[var(--color-danger)]")}>
                    {prop.defensiveMatchup.statAllowedPerGame}
                  </span>
                  <span className="text-[9px] text-[var(--color-text-muted)] ml-1">(avg: {prop.defensiveMatchup.leagueAverage})</span>
                </div>
              </div>
              <div className="text-[9px] text-[var(--color-text-muted)] italic text-center mt-2">Other positions: nil</div>
            </div>
          ) : (
            <div className="flex-grow flex items-center justify-center p-2">
              <span className="text-[var(--color-text-muted)] text-[10px] italic text-center">nil</span>
            </div>
          )}
        </div>

        {/* Matchup Factors — from defensive matchup data */}
        <div className="lg:col-span-2 flex flex-col p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md min-h-[160px]">
          <h3 className="font-semibold text-sm tracking-wide mb-2 border-b border-[var(--color-border)] pb-2">Matchup Factors</h3>
          {prop.defensiveMatchup ? (
            <div className="flex-grow flex flex-col justify-center gap-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-[var(--color-text-muted)]">Grade</span>
                <span className={cn("text-xs font-bold px-2 py-0.5 rounded",
                  prop.defensiveMatchup.grade === "A" || prop.defensiveMatchup.grade === "B" ? "bg-[var(--color-success)]/20 text-[var(--color-success)]" :
                  prop.defensiveMatchup.grade === "D" || prop.defensiveMatchup.grade === "F" ? "bg-[var(--color-danger)]/20 text-[var(--color-danger)]" :
                  "bg-white/10 text-white"
                )}>{prop.defensiveMatchup.grade}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-[var(--color-text-muted)]">Pace</span>
                <span className="text-xs font-bold text-white">{prop.defensiveMatchup.paceRating}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-[var(--color-text-muted)]">Diff vs Avg</span>
                <span className={cn("text-xs font-bold", prop.defensiveMatchup.statAllowedPerGame > prop.defensiveMatchup.leagueAverage ? "text-[var(--color-success)]" : "text-[var(--color-danger)]")}>
                  {prop.defensiveMatchup.statAllowedPerGame > prop.defensiveMatchup.leagueAverage ? "+" : ""}{(prop.defensiveMatchup.statAllowedPerGame - prop.defensiveMatchup.leagueAverage).toFixed(1)}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-grow flex items-center justify-center">
              <span className="text-[var(--color-text-muted)] text-sm italic text-center">No matchup data</span>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Hit Rate Summary */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold">Hit Rate:</span>
          <span className="text-[var(--color-lime)] font-bold text-lg">
            {prop.hitRate.total > 0 ? Math.round((prop.hitRate.over / prop.hitRate.total) * 100) : 0}%
          </span>
          <span className="text-[var(--color-text-muted)] text-sm">
            ({prop.hitRate.over}/{prop.hitRate.total} {prop.hitRate.label})
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn("text-sm font-medium flex items-center gap-1", prop.trend === "up" ? "text-[var(--color-success)]" : prop.trend === "down" ? "text-[var(--color-danger)]" : "text-[var(--color-text-muted)]")}>
            {prop.trend === "up" ? "↑" : prop.trend === "down" ? "↓" : "→"} {prop.trendPct}% trend
          </span>
          <span className="text-[var(--color-text-muted)] text-xs">Prop: {prop.propLine} {prop.statCategory}</span>
          {prop.projection?.projection != null && (
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">
              · Projected: {prop.projection.projection}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
