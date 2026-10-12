import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PlayerCard } from "@/components/arena/PlayerCard"
import { NflPlayerCard } from "@/components/nfl/NflPlayerCard"
import { DEFAULT_SEASON as ARENA_SEASON, getSeasonPlayers as arenaPlayers } from "@/lib/arena/data"
import { DEFAULT_SEASON as NFL_SEASON, getSeasonPlayers as nflPlayers } from "@/lib/nfl/data"

// The large auction cards get the 480px xl variant with a `sizes` that matches
// the rendered photo width, so a DPR 2 screen is sent a big enough candidate.
// Thumbnails (BudgetPanel, NflBudgetPanel) stay on sm and are not covered here.

const imgTag = (html: string) => html.match(/<img[^>]*>/)?.[0] ?? ""

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proj.supabase.co")
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe("arena PlayerCard headshot", () => {
  const player = arenaPlayers(ARENA_SEASON).find((p) => p.nbaId)!

  it("requests the stored xl variant with the rendered-width sizes, eagerly", () => {
    const img = imgTag(renderToStaticMarkup(createElement(PlayerCard, { player })))
    expect(img).toContain(`nbacdn%2Fxl%2F${player.nbaId}.webp`)
    expect(img).not.toContain("nbacdn%2Fsm%2F")
    expect(img).toContain('sizes="(min-width: 640px) 220px, 154px"')
    expect(img).not.toContain('loading="lazy"')
    expect(img).toContain("object-cover object-top")
  })
})

describe("NflPlayerCard headshot", () => {
  const player = nflPlayers(NFL_SEASON).find((p) => p.espnId)!

  it("renders through next/image with the stored xl variant and rendered-width sizes", () => {
    const img = imgTag(renderToStaticMarkup(createElement(NflPlayerCard, { player })))
    expect(img).toContain(`nfl%2Fxl%2F${player.espnId}.webp`)
    expect(img).not.toContain("nfl%2Fsm%2F")
    expect(img).toContain('sizes="(min-width: 640px) 133px, 111px"')
    expect(img).toContain('loading="lazy"')
    expect(img).toContain('data-nimg="fill"')
    expect(img).toContain("object-cover object-top")
  })
})
