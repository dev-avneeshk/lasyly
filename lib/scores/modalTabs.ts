/**
 * Tab rules for `MatchDetailModal`: which tabs a match shows, in display order,
 * and which one opens first. Pure so the NBA / NFL / Soccer behavior is locked
 * by unit tests (__tests__/scores/modal-tabs.test.ts).
 */

import type { LiveMatch, MatchSummary } from "@/types"

export type ModalTabId = "summary" | "boxscore" | "stats" | "standings"

export interface ModalTab {
  id: ModalTabId
  label: string
}

/** Sports that are individual (no team stats or box score). */
export const INDIVIDUAL_SPORTS = new Set(["Tennis", "MMA", "Golf", "F1"])

/** Sports where box scores (individual player stats) make sense. */
export const BOX_SCORE_SPORTS = new Set(["Basketball", "American Football", "Hockey", "Baseball"])

function isUpcoming(match: LiveMatch): boolean {
  return match.status === "Not Started"
}

/** Big-5 soccer match stats from our DB (defined, even when empty). */
function hasPeriodStats(presupplied?: MatchSummary | null): boolean {
  return presupplied?.periodStats !== undefined
}

/** Our DB boxscore (NBA): player stat lines only, no team-stat comparison. */
function isDbBoxscore(presupplied?: MatchSummary | null): boolean {
  return !!presupplied && !presupplied.boxscore?.teams?.length
}

/** Visible tabs, in display order. */
export function getModalTabs(match: LiveMatch, presupplied?: MatchSummary | null): ModalTab[] {
  if (isUpcoming(match)) return [{ id: "summary", label: "Preview" }]
  if (hasPeriodStats(presupplied)) return [{ id: "stats", label: "Match Stats" }]
  if (isDbBoxscore(presupplied)) return [{ id: "boxscore", label: "Box Score" }]

  if (INDIVIDUAL_SPORTS.has(match.sport)) return [{ id: "summary", label: "Match Info" }]

  const tabs: ModalTab[] = [{ id: "stats", label: "Team Stats" }]
  // Only show Box Score for sports that actually have player-level stats.
  if (BOX_SCORE_SPORTS.has(match.sport)) tabs.push({ id: "boxscore", label: "Box Score" })
  tabs.push({ id: "standings", label: "Standings" })
  return tabs
}

/** The tab a newly opened match starts on. */
export function getInitialModalTab(match: LiveMatch, presupplied?: MatchSummary | null): ModalTabId {
  if (isUpcoming(match)) return "summary"
  if (hasPeriodStats(presupplied)) return "stats"
  if (isDbBoxscore(presupplied)) return "boxscore"
  if (INDIVIDUAL_SPORTS.has(match.sport)) return "summary"
  return "stats"
}
