/**
 * Server-side wallet operations for the arena economy.
 *
 * These are thin, typed wrappers around the SECURITY DEFINER money RPCs added
 * in supabase/migrations/20260921_arena_economy.sql. They run with the
 * service-role admin client (the RPCs are granted to service_role only), so
 * they MUST be called exclusively from trusted server code (API route handlers,
 * cron jobs) — never anywhere reachable by a client.
 *
 * The DB is the single source of truth for balances: every function here is
 * idempotent on the game id (or ISO week), so retries and duplicate calls are
 * safe no-ops that return 'duplicate'.
 */

import { createAdminClient } from "@/lib/supabase/admin"

/** Return codes shared by the debit path. */
export type StakeResult =
  | "completed"
  | "duplicate"
  | "insufficient_funds"
  | "invalid_amount"
  | "no_profile"
  | "unauthenticated"
  | "forbidden"
  | "error"

/**
 * Debit a player's entry cost (CPU) or stake (1v1) when a game starts.
 * Idempotent per (user, game).
 */
export async function chargeArenaStake(params: {
  userId: string
  gameId: string
  amount: number
  isPvp: boolean
}): Promise<StakeResult> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc("start_arena_stake", {
    p_user_id: params.userId,
    p_game_id: params.gameId,
    p_amount: params.amount,
    p_is_pvp: params.isPvp,
  })
  if (error) {
    console.error("start_arena_stake error:", error.message)
    return "error"
  }
  return (data as StakeResult) ?? "error"
}

/**
 * Credit a CPU-win reward (0 on a loss → XP only) and apply XP. Idempotent per
 * (user, game).
 */
export async function awardCpuReward(params: {
  userId: string
  gameId: string
  reward: number
  xp: number
}): Promise<"completed" | "duplicate" | "no_profile" | "error"> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc("award_cpu_reward", {
    p_user_id: params.userId,
    p_game_id: params.gameId,
    p_reward: params.reward,
    p_xp: params.xp,
  })
  if (error) {
    console.error("award_cpu_reward error:", error.message)
    return "error"
  }
  return (data as "completed" | "duplicate" | "no_profile") ?? "error"
}

/**
 * Pay the 1v1 winner the pot minus commission and apply XP to both players.
 * Idempotent per game.
 */
export async function settle1v1(params: {
  gameId: string
  winnerId: string
  loserId: string | null
  payout: number
  winnerXp: number
  loserXp: number
}): Promise<"completed" | "duplicate" | "no_profile" | "error"> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc("settle_1v1_stake", {
    p_game_id: params.gameId,
    p_winner_id: params.winnerId,
    p_loser_id: params.loserId,
    p_payout: params.payout,
    p_winner_xp: params.winnerXp,
    p_loser_xp: params.loserXp,
  })
  if (error) {
    console.error("settle_1v1_stake error:", error.message)
    return "error"
  }
  return (data as "completed" | "duplicate" | "no_profile") ?? "error"
}

/** Refund a stake/entry for an abandoned game. Idempotent per (user, game). */
export async function refundArenaStake(params: {
  userId: string
  gameId: string
}): Promise<"completed" | "duplicate" | "nothing_to_refund" | "already_settled" | "error"> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc("refund_arena_stake", {
    p_user_id: params.userId,
    p_game_id: params.gameId,
  })
  if (error) {
    console.error("refund_arena_stake error:", error.message)
    return "error"
  }
  return (data as "completed" | "duplicate" | "nothing_to_refund" | "already_settled") ?? "error"
}

/** Grant a user's weekly level bonus. Idempotent per (user, ISO week). */
export async function grantWeeklyLevelBonus(params: {
  userId: string
  weekKey: string
  amount: number
}): Promise<"completed" | "duplicate" | "invalid_amount" | "no_profile" | "error"> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc("grant_weekly_level_bonus", {
    p_user_id: params.userId,
    p_week_key: params.weekKey,
    p_amount: params.amount,
  })
  if (error) {
    console.error("grant_weekly_level_bonus error:", error.message)
    return "error"
  }
  return (data as "completed" | "duplicate" | "invalid_amount" | "no_profile") ?? "error"
}
