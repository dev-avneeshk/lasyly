import { EnhancedPropCardData } from "@/lib/analytics/types"

/** True when a prop describes a team total rather than a player. */
export function isTeamProp(prop: EnhancedPropCardData): boolean {
  const extras = prop as unknown as { isTeamProp?: boolean; position?: string }
  return !!extras.isTeamProp || extras.position === "Team"
}

/** URL slug used by the player detail route. */
export function playerSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
}

/** Detail-page href for a prop card. */
export function propDetailHref(prop: EnhancedPropCardData): string {
  const params = new URLSearchParams({
    stat: prop.statCategory,
    team: prop.team ?? "",
    sport: prop.sport ?? "NBA",
  })
  if (isTeamProp(prop)) params.set("type", "team")
  return `/analysis/${playerSlug(prop.player)}?${params.toString()}`
}
