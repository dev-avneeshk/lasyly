import { createClient } from "@/lib/supabase/server"
import AnalysisClient from "./AnalysisClient"

export default async function AnalysisPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return <AnalysisClient isAuthenticated={!!user} />
}
