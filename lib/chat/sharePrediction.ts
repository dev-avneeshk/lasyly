/**
 * Share one of the signed-in user's predictions (a parlay) into a room's chat.
 *
 * Reuses the existing messages route, which already requires auth, verifies the
 * caller is a member of the room, validates the input, and confirms the parlay
 * belongs to the sender. The server then inserts a `kind="betslip"` message and
 * broadcasts it, so the shared prediction renders as a Prediction card for
 * everyone in the room.
 *
 * Returns `{ ok: true }` on a 2xx response, otherwise `{ ok: false, error }`
 * with the server's error message when one is available.
 *
 * Pass `subchannelId` to target the channel the user is viewing (so the card
 * appears in that channel's feed); omit it to let the server fall back to the
 * room's default channel.
 */
export async function sharePredictionToRoom(
  roomId: string,
  parlayId: string,
  subchannelId?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/rooms/${roomId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "betslip",
        betslipId: parlayId,
        ...(subchannelId ? { subchannelId } : {}),
      }),
    })
    if (res.ok) return { ok: true }
    const body = (await res.json().catch(() => ({}))) as { error?: unknown }
    return {
      ok: false,
      error: typeof body.error === "string" ? body.error : "Couldn't share prediction.",
    }
  } catch {
    return { ok: false, error: "Couldn't share prediction. Check your connection." }
  }
}
