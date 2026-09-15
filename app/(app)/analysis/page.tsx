import { createClient } from "@/lib/supabase/server"
import AnalysisClient from "./AnalysisClient"

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { search } = await searchParams

  return <AnalysisClient isAuthenticated={!!user} initialSearch={search ?? ""} />
}
