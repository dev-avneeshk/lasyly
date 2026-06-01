import { createClient } from "@/lib/supabase/server"
import RoomsClient from "./RoomsClient"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Rooms | Lasyly",
  description: "Join betting rooms, share picks, and chat with other sports fans in real-time.",
}

export default async function RoomsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return <RoomsClient isAuthenticated={!!user} />
}
