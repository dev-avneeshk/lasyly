import { mutateGame, type StoredGame } from "@/lib/arena/store"
import { awardCpuReward, settle1v1 } from "@/lib/economy/wallet"
import { XP_REWARDS, stakePayout } from "@/lib/economy/arena"

/**
 * Pay out a completed arena game, then mark `econ.settled`. Server only.
 *
 *   cpu → the human (P1) beat the CPU? pay cpuReward + win XP; else 0 + play XP.
 *   pvp → pay the winning seat's human 2*stake*0.9; both get play XP, winner
 *         gets the extra win XP.
 *
 * The flag is set only after the RPC confirms: setting it first (inside the
 * simulate lock) lost the payout for good when the RPC failed. The RPCs are
 * idempotent per game, so concurrent or repeated calls pay once. Called by
 * simulate and by the GET view, so a failed payout retries on the next load.
 */
export async function settleArenaGame(game: StoredGame): Promise<void> {
  const { state } = game
  const econ = state.econ
  if (state.status !== "complete" || !state.result || !econ || econ.settled) return

  const p1Won = state.result.winner === "P1"
  const winnerId = p1Won ? game.ownerUserId : game.guestUserId
  const res =
    econ.mode === "cpu"
      ? await awardCpuReward({
          userId: game.ownerUserId,
          gameId: state.gameId,
          reward: p1Won ? (econ.cpuReward ?? 0) : 0,
          xp: XP_REWARDS.play + (p1Won ? XP_REWARDS.cpuWin : 0),
        })
      : winnerId
        ? await settle1v1({
            gameId: state.gameId,
            winnerId,
            loserId: (p1Won ? game.guestUserId : game.ownerUserId) ?? null,
            payout: stakePayout(econ.amount),
            winnerXp: XP_REWARDS.play + XP_REWARDS.pvpWin,
            loserXp: XP_REWARDS.play,
          })
        : "error"

  if (res === "completed" || res === "duplicate") {
    await mutateGame(state.gameId, (g) => {
      if (g.state.econ) g.state.econ.settled = true
    }).catch(() => {}) // flag is an optimisation; the RPC already holds the truth
  }
}
