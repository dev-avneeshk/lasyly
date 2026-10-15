import { describe, it, expect } from "vitest"
import type { GameResult, PlayerBoxLine, TeamBox, TeamId } from "@/lib/arena/types"
import { friendlyCoinNote } from "@/lib/arena/clientRequests"

/**
 * GameSummary verdict copy (node env, renderToStaticMarkup — mirrors
 * __tests__/rooms/skeletons.test.ts). The bug this guards: a friendly/practice
 * match that pays no winnings and returns the stake used to render a bare
 * competitive "You Win", which read as being cheated out of a win. A friendly
 * match must now show a neutral practice verdict and the "stake is back" note,
 * while a real pvp win keeps "You Win" and its winnings line.
 */

const noop = () => {}

function boxLine(team: TeamId, id: string): PlayerBoxLine {
  return {
    playerId: id,
    name: `Player ${id}`,
    team,
    slot: "PG",
    min: 30,
    pts: 2,
    reb: 1,
    ast: 1,
    stl: 0,
    blk: 0,
    tov: 0,
    fgm: 1,
    fga: 2,
    tpm: 0,
    tpa: 1,
    ftm: 0,
    fta: 0,
  }
}

function teamBox(team: TeamId, points: number): TeamBox {
  return {
    team,
    points,
    fgm: points / 2,
    fga: points,
    tpm: 0,
    tpa: 2,
    ftm: 0,
    fta: 0,
    reb: 10,
    ast: 5,
    tov: 2,
    stl: 1,
    blk: 1,
    paintPoints: points,
    fastBreakPoints: 0,
    secondChancePoints: 0,
  }
}

/** A minimal, internally-consistent GameResult with the given winner. */
function makeResult(winner: TeamId): GameResult {
  const p1Pts = winner === "P1" ? 4 : 2
  const p2Pts = winner === "P2" ? 4 : 2
  return {
    season: "2025-26",
    winner,
    finalScore: { p1: p1Pts, p2: p2Pts },
    quarters: [
      { quarter: 1, p1: p1Pts, p2: p2Pts },
      { quarter: 2, p1: 0, p2: 0 },
      { quarter: 3, p1: 0, p2: 0 },
      { quarter: 4, p1: 0, p2: 0 },
    ],
    moments: [],
    boxScore: [boxLine("P1", "a"), boxLine("P1", "b"), boxLine("P2", "c"), boxLine("P2", "d")],
    teamBox: { P1: teamBox("P1", p1Pts), P2: teamBox("P2", p2Pts) },
    mvp: { playerId: "a", name: "Star Player", team: winner },
    topPerformers: [],
    matchupNotes: [],
    analysis: {
      P1: [{ text: "P1 ran the floor.", positive: true }],
      P2: [{ text: "P2 kept it close.", positive: true }],
    },
    teamComparison: {
      offense: { p1: 50, p2: 50 },
      defense: { p1: 50, p2: 50 },
      shooting: { p1: 50, p2: 50 },
      rebounding: { p1: 50, p2: 50 },
      playmaking: { p1: 50, p2: 50 },
      athleticism: { p1: 50, p2: 50 },
      bench: { p1: 50, p2: 50 },
      chemistry: { p1: 50, p2: 50 },
    },
  }
}

async function render(props: {
  result: GameResult
  humanSeat: TeamId
  friendly?: boolean
  stakeOutcome?: { stake: number; payout: number; commission: number }
  coinNote?: string | null
}) {
  const { renderToStaticMarkup } = await import("react-dom/server")
  const { createElement } = await import("react")
  const { GameSummary } = await import("@/components/arena/GameSummary")
  return renderToStaticMarkup(
    createElement(GameSummary, {
      p1Label: "You",
      p2Label: "Opponent",
      onRematch: noop,
      onNewAuction: noop,
      onExit: noop,
      ...props,
    }),
  )
}

describe("GameSummary verdict — friendly (practice) match", () => {
  it("a practice win reads as a practice win, not a competitive 'You Win' with winnings", async () => {
    const html = await render({
      result: makeResult("P1"),
      humanSeat: "P1",
      friendly: true,
      coinNote: friendlyCoinNote({ mode: "friendly", amount: 25, returned: true }),
    })
    expect(html).toContain("Practice win")
    expect(html).not.toContain("You Win")
    // No winnings/payout language that implies coins were earned.
    expect(html).not.toContain("You won")
    expect(html).not.toContain("winnings")
    // The honest coin line is shown: no coins changed hands, stake is back.
    expect(html).toContain("no coins changed hands")
    expect(html).toContain("stake is back")
  })

  it("a practice loss reads as a practice loss with the stake returned, not a lost stake", async () => {
    const html = await render({
      result: makeResult("P2"),
      humanSeat: "P1",
      friendly: true,
      coinNote: friendlyCoinNote({ mode: "friendly", amount: 25, returned: true }),
    })
    expect(html).toContain("Practice loss")
    expect(html).not.toContain("You Lose")
    expect(html).not.toContain("You lost your")
    expect(html).toContain("stake is back")
  })

  it("never names a machine opponent (cpu/ai/bot/computer) — mirrors the existing client-copy guard", async () => {
    // Mirrors "client copy never names a machine opponent" in client-requests.test.ts.
    // Only the visible verdict + coin copy is asserted (Tailwind utility classes
    // like `font-medium` legitimately contain "medium", so difficulty words
    // can't be screened out of raw markup).
    const verdict = "Practice win"
    const coinNote = friendlyCoinNote({ mode: "friendly", amount: 25, returned: true }) ?? ""
    for (const copy of [verdict, coinNote]) {
      expect(copy).not.toMatch(/\b(cpu|ai|bot|computer)\b/i)
      expect(copy).not.toMatch(/\b(easy|medium|hard)\b/i)
    }
  })
})

describe("GameSummary verdict — real pvp match (regression)", () => {
  it("a staked win still shows 'You Win' and the winnings line", async () => {
    const html = await render({
      result: makeResult("P1"),
      humanSeat: "P1",
      stakeOutcome: { stake: 25, payout: 48, commission: 2 },
    })
    expect(html).toContain("You Win")
    expect(html).not.toContain("Practice win")
    expect(html).toContain("You won 48 coins")
    expect(html).toContain("winnings")
  })

  it("a staked loss still shows 'You Lose' and the lost-stake line", async () => {
    const html = await render({
      result: makeResult("P2"),
      humanSeat: "P1",
      stakeOutcome: { stake: 25, payout: 48, commission: 2 },
    })
    expect(html).toContain("You Lose")
    expect(html).not.toContain("Practice loss")
    expect(html).toContain("You lost your 25-coin stake")
  })
})
