// Coarse bucketing heuristic for the generated NFL question banks.
//
// The NFL quizzes surface three buckets: player, team, and mixed. Unlike the
// NBA banks (which are ordered by theme), the NFL raw files interleave topics,
// so we classify each question by its prompt/answer text:
//   - team   : the question is about a franchise (asks "which team", or the
//              correct answer is a team name)
//   - player : the question is about a person (coach, QB, MVP, nickname, etc.)
//   - mixed  : records, rules, scores, years, and everything else
//
// This is a heuristic for the difficulty/category grid, not a hand-graded
// label. Both NFL generators import this so the two banks stay consistent.

const TEAM_NAMES = [
  "packers", "patriots", "cowboys", "steelers", "49ers", "san francisco",
  "chiefs", "bills", "broncos", "ravens", "colts", "giants", "eagles",
  "rams", "bengals", "saints", "seahawks", "buccaneers", "raiders", "jets",
  "dolphins", "vikings", "bears", "lions", "panthers", "falcons", "cardinals",
  "chargers", "texans", "titans", "commanders", "washington", "browns",
  "jaguars", "oilers", "staleys", "texans", "spartans", "redskins",
]

const TEAM_QUESTION_HINTS = [
  "which team", "which afl team", "which nfl dynasty", "which franchise",
  "was nicknamed america", "won the first super bowl", "which team did",
  "which team was", "which team won", "which team lost", "which team beat",
  "which team plays", "began play in", "joined the nfl", "entered the nfl",
  "originally the", "were once the", "began as the", "moved from",
  "have played in", "which team drafted", "which team acquired",
  "which team did peyton", "which team did dan", "which team did emmitt",
  "which team did jerry",
]

const PLAYER_HINTS = [
  "who ", "who?", "which quarterback", "which running back", "which receiver",
  "which coach", "which player", "which defender", "which corner",
  "which safety", "which linebacker", "which tight end", "which lineman",
  "which defensive end", "which pass rusher", "which giants", "which ravens",
  "which steelers", "which jets", "which bears", "which cleveland",
  "which baltimore coach", "which san francisco coach", "mvp", "nickname",
  "nicknamed", "known as", "called", "drafted in", "selected", "traded",
  "coached", "guaranteed", "roger staubach", "franco harris", "tom brady",
  "what was miami's quarterback",
]

/** Does this text contain a franchise/team name token? */
function mentionsTeam(text) {
  return TEAM_NAMES.some((t) => text.includes(t))
}

/**
 * Classify a question into one of the three buckets from its prompt and the
 * text of its options (so "Which answer completes ... Green Bay Packers"
 * lands in team).
 */
export function deriveBucket(prompt, options = []) {
  const p = prompt.toLowerCase()
  const opts = options.map((o) => o.toLowerCase())

  // Team questions: explicit "which team ..." phrasing, or franchise-origin
  // trivia (began play, moved, renamed, originally the X).
  if (TEAM_QUESTION_HINTS.some((h) => p.includes(h))) return "team"

  // Player questions: person-focused prompts (who/which <position>/MVP/etc.).
  if (PLAYER_HINTS.some((h) => p.includes(h))) {
    // A "who/which coach" whose answer is clearly a team is still a team Q.
    if (p.startsWith("which team")) return "team"
    return "player"
  }

  // Fall back on the correct/answer options: if they read like team names,
  // treat as team; otherwise mixed.
  if (opts.some((o) => mentionsTeam(o))) return "team"

  return "mixed"
}
