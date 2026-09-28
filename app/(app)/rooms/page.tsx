import { createClient } from "@/lib/supabase/server"
import RoomsClient from "./RoomsClient"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Rooms | Lasyly",
  description: "Join prediction rooms, share picks, and chat with other sports fans in real-time.",
}

export default async function RoomsPage() {
  const supabase = await createClient()

  // `getClaims()`, not `getUser()`: this only needs "real account or guest?", and
  // getUser() spends a 195-395ms round-trip to Supabase Auth to answer it, with
  // the whole page waiting. Local JWT verification (ES256 keys on this project)
  // answers the same question for free. See the long note in
  // app/(app)/analysis/page.tsx for why this is not a weaker check here — the
  // proxy already gates this route on the same locally-verified claim.
  let isAuthenticated = false
  try {
    const { data } = await supabase.auth.getClaims()
    isAuthenticated = typeof data?.claims?.sub === "string"
  } catch {
    isAuthenticated = false
  }

  return <RoomsClient isAuthenticated={isAuthenticated} />
}
