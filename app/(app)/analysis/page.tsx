import { createClient } from "@/lib/supabase/server"
import AnalysisClient from "./AnalysisClient"

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; sport?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { search, sport } = await searchParams

  return (
    <AnalysisClient
      isAuthenticated={!!user}
      initialSearch={search ?? ""}
      initialSport={sport ?? "NBA"}
    />
  )
}
