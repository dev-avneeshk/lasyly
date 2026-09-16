// Coarse difficulty heuristic for the generated NBA question banks.
//
// This is NOT a hand-graded label — it's a keyword/pattern heuristic used only
// to power the easy/medium/hard filter in the quiz UI. The goal is a sensible
// spread, not perfect judgement:
//   - easy   : household names, first-overall picks, "which team won the Finals"
//   - hard   : deep draft positions, obscure role players, specific stat lines,
//              seasons/years, "who won X award in <year>"
//   - medium : everything else
//
// Both generators import this so the two banks stay consistent.

const EASY_NAMES = [
  "lebron", "michael jordan", "kobe", "stephen curry", "shaquille", "shaq",
  "magic johnson", "larry bird", "kareem", "tim duncan", "kevin durant",
  "giannis", "nikola jokic", "luka", "wilt chamberlain",
]

const HARD_HINTS = [
  "undrafted", "second round", "41st", "53rd", "57th", "39th", "58th", "35th",
  "42nd", "quadruple-double", "20-20-20", "skills challenge", "3-point contest",
  "three-point contest", "role player", "sixth man of the year in",
]

function ordinalPickRank(prompt) {
  // Pull "13th", "28th", "No. 41", "41st overall", "second overall", etc.
  const words = prompt.toLowerCase()
  const map = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10 }
  for (const [w, n] of Object.entries(map)) {
    if (words.includes(`${w} overall`) || words.includes(`${w} pick`)) return n
  }
  const m = words.match(/\b(\d{1,2})(st|nd|rd|th)\b/)
  if (m) return Number(m[1])
  const m2 = words.match(/no\.\s*(\d{1,3})/)
  if (m2) return Number(m2[1])
  return null
}

export function deriveDifficulty(prompt) {
  const p = prompt.toLowerCase()

  // Hard signals first — obscure positions, specific feats, dated awards.
  if (HARD_HINTS.some((h) => p.includes(h))) return "hard"
  const rank = ordinalPickRank(prompt)
  if (rank != null && rank >= 10) return "hard" // deep draft picks

  // Easy signals — big names, top picks, broad Finals/championship recall.
  if (rank != null && rank <= 3) return "easy" // top-3 picks are well known
  if (EASY_NAMES.some((n) => p.includes(n))) return "easy"
  if (
    /first overall/.test(p) ||
    /won the \d{4} finals/.test(p) ||
    /which team (did|won|plays)/.test(p) ||
    /nicknamed|known as|called/.test(p)
  ) {
    return "easy"
  }

  return "medium"
}
