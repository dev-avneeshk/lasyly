import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  arenaHeadshotSources,
  headshotObjectPath,
  nflHeadshotSources,
  storedHeadshotUrl,
} from "@/lib/data/headshot-paths"

const BASE = "https://proj.supabase.co/storage/v1/object/public/player-headshots"

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proj.supabase.co")
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe("headshotObjectPath", () => {
  it("puts each variant in its own folder, lg at the namespace root", () => {
    expect(headshotObjectPath("NFL", "1", "xl")).toBe("nfl/xl/1.webp")
    expect(headshotObjectPath("NFL", "1", "sm")).toBe("nfl/sm/1.webp")
    expect(headshotObjectPath("NFL", "1", "lg")).toBe("nfl/1.webp")
  })

  it("defaults to lg", () => {
    expect(headshotObjectPath("nbacdn", "203897")).toBe("nbacdn/203897.webp")
  })
})

describe("storedHeadshotUrl", () => {
  it("builds the public xl URL", () => {
    expect(storedHeadshotUrl("nfl", "3139477", "xl")).toBe(`${BASE}/nfl/xl/3139477.webp`)
  })
})

describe("arenaHeadshotSources", () => {
  const origin = "https://cdn.nba.com/headshots/nba/latest/1040x760/203897.png"

  it("stays on sm by default (thumbnails)", () => {
    expect(arenaHeadshotSources({ nbaId: 203897 })).toEqual({
      stored: `${BASE}/nbacdn/sm/203897.webp`,
      origin,
    })
  })

  it("returns the xl stored path with the same origin when asked", () => {
    expect(arenaHeadshotSources({ nbaId: 203897 }, "xl")).toEqual({
      stored: `${BASE}/nbacdn/xl/203897.webp`,
      origin,
    })
  })

  it("is null without an id", () => {
    expect(arenaHeadshotSources({})).toBeNull()
  })
})

describe("nflHeadshotSources", () => {
  const origin = "https://a.espncdn.com/i/headshots/nfl/players/full/3139477.png"

  it("stays on sm by default (thumbnails)", () => {
    expect(nflHeadshotSources({ espnId: 3139477 })).toEqual({
      stored: `${BASE}/nfl/sm/3139477.webp`,
      origin,
    })
  })

  it("returns the xl stored path with the same origin when asked", () => {
    expect(nflHeadshotSources({ espnId: 3139477 }, "xl")).toEqual({
      stored: `${BASE}/nfl/xl/3139477.webp`,
      origin,
    })
  })

  it("is null without an id", () => {
    expect(nflHeadshotSources({})).toBeNull()
  })
})
