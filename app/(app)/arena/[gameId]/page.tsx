import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { loadGame } from "@/lib/arena/store"
import { stakeTerms } from "@/lib/arena/clientRequests"
import JoinClient, { type JoinPreview } from "./JoinClient"
export const metadata: Metadata = {
  title: "Join 1v1 | Lasyly Arena",
  robots: { index: false },
}

/**
 * What the invitee needs to decide before paying: the stake and the payout.
 * Only primitives leave the server, never the stored game. Null (signed out,
 * game missing, store down) means "just try to join", which surfaces the
 * route's own error as before.
 */
async function loadPreview(gameId: string): Promise<JoinPreview | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const game = await loadGame(gameId)
    if (!game) return null
    const econ = game.state.econ
    const stake = econ?.mode === "pvp" ? econ.amount : 0
    return {
      stake,
      ...stakeTerms(stake),
      seated: game.ownerUserId === user.id || game.guestUserId === user.id,
      joinable: !game.state.isAI.P2 && !game.guestUserId && game.state.status === "lobby",
    }
  } catch {
    return null
  }
}

export default async function ArenaJoinPage({
  params,
}: {
  params: Promise<{ gameId: string }>
}) {
  const { gameId } = await params
  const preview = await loadPreview(gameId)
  return <JoinClient gameId={gameId} preview={preview} />
}
