import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rateLimit"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

const EXPORT_RATE_LIMIT = { maxRequests: 1, windowMs: 60000 }

export const GET = withSecurity(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  // Rate limit: 1 export per minute
  const rateCheck = checkRateLimit(`export-bets:${user.id}`, EXPORT_RATE_LIMIT)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Rate limited. Please wait before exporting again." },
      { status: 429 }
    )
  }

  const { data: betslips, error } = await supabase
    .from("betslips")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: "Failed to fetch bet history." }, { status: 500 })
  }

  // CSV headers
  const headers = ["Date", "Player", "Sport", "Stat", "Line", "Direction", "Odds", "Stake", "Status", "Payout"]
  const rows = (betslips ?? []).map((bet) => [
    new Date(bet.created_at).toLocaleDateString("en-US"),
    bet.player_name ?? "",
    bet.sport ?? "",
    bet.stat_type ?? "",
    bet.line ?? "",
    bet.direction ?? "",
    bet.odds ?? "",
    bet.stake ?? "",
    bet.status ?? "",
    bet.payout ?? "",
  ])

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => {
        const str = String(cell ?? "")
        // Escape commas and quotes in CSV
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }).join(",")
    ),
  ].join("\n")

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="lasyly-bets-${new Date().toISOString().split("T")[0]}.csv"`,
      "Cache-Control": CACHE_CONTROL.SENSITIVE,
    },
  })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
