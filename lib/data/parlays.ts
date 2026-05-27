import "server-only"

import { createClient } from "@/lib/supabase/server"
import { computeParlayStats } from "@/lib/parlays/computations"
import type { ParlayWithLegs, ParlayStats } from "@/lib/types/parlay"

const PAGE_SIZE = 20

export interface DashboardParlayData {
  parlays: ParlayWithLegs[]
  stats: ParlayStats
}

/**
 * Fetch the user's parlays and compute stats for the dashboard widget.
 * Returns the first page (20 items) sorted by created_at DESC, plus
 * computed stats across ALL user parlays.
 */
export async function getDashboardParlays(
  userId: string
): Promise<DashboardParlayData> {
  const supabase = await createClient()

  // Fetch first page of parlays with legs for display
  const { data: parlaysData } = await supabase
    .from("parlays")
    .select("*, parlay_legs(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE)

  if (!parlaysData || parlaysData.length === 0) {
    return {
      parlays: [],
      stats: computeParlayStats([]),
    }
  }

  // Map DB rows to ParlayWithLegs shape
  const parlays: ParlayWithLegs[] = parlaysData.map((p) => ({
    id: p.id,
    user_id: p.user_id,
    status: p.status,
    visibility: p.visibility,
    odds: p.odds != null ? Number(p.odds) : null,
    stake: p.stake != null ? Number(p.stake) : null,
    custom_note: p.custom_note,
    combined_hit_rate: p.combined_hit_rate != null ? Number(p.combined_hit_rate) : null,
    created_at: p.created_at,
    resolved_at: p.resolved_at,
    legs: (p.parlay_legs ?? [])
      .map((leg: Record<string, unknown>) => ({
        id: leg.id as string,
        parlay_id: leg.parlay_id as string,
        player_name: leg.player_name as string,
        stat_category: leg.stat_category as string,
        prop_line: Number(leg.prop_line),
        direction: leg.direction as "over" | "under",
        l10_hit_rate: leg.l10_hit_rate != null ? Number(leg.l10_hit_rate) : null,
        leg_order: Number(leg.leg_order),
        sport: leg.sport as string,
      }))
      .sort((a: { leg_order: number }, b: { leg_order: number }) => a.leg_order - b.leg_order),
  }))

  // For stats computation, we need ALL user parlays (not just first page)
  // If user has more than PAGE_SIZE parlays, fetch all for accurate stats
  let allParlays = parlays
  if (parlaysData.length >= PAGE_SIZE) {
    const { data: allData } = await supabase
      .from("parlays")
      .select("*, parlay_legs(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (allData && allData.length > 0) {
      allParlays = allData.map((p) => ({
        id: p.id,
        user_id: p.user_id,
        status: p.status,
        visibility: p.visibility,
        odds: p.odds != null ? Number(p.odds) : null,
        stake: p.stake != null ? Number(p.stake) : null,
        custom_note: p.custom_note,
        combined_hit_rate: p.combined_hit_rate != null ? Number(p.combined_hit_rate) : null,
        created_at: p.created_at,
        resolved_at: p.resolved_at,
        legs: (p.parlay_legs ?? [])
          .map((leg: Record<string, unknown>) => ({
            id: leg.id as string,
            parlay_id: leg.parlay_id as string,
            player_name: leg.player_name as string,
            stat_category: leg.stat_category as string,
            prop_line: Number(leg.prop_line),
            direction: leg.direction as "over" | "under",
            l10_hit_rate: leg.l10_hit_rate != null ? Number(leg.l10_hit_rate) : null,
            leg_order: Number(leg.leg_order),
            sport: leg.sport as string,
          }))
          .sort((a: { leg_order: number }, b: { leg_order: number }) => a.leg_order - b.leg_order),
      }))
    }
  }

  const stats = computeParlayStats(allParlays)

  return { parlays, stats }
}
