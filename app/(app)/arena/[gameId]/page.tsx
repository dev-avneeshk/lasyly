import type { Metadata } from "next"
import JoinClient from "./JoinClient"

export const metadata: Metadata = {
  title: "Join 1v1 | Lasyly Arena",
  robots: { index: false },
}

export default async function ArenaJoinPage({
  params,
}: {
  params: Promise<{ gameId: string }>
}) {
  const { gameId } = await params
  return <JoinClient gameId={gameId} />
}
