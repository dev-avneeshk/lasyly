import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { escapePostgrestFilter } from "@/lib/sanitize"
import { withSecurity, checkQueryParams, CACHE_CONTROL } from "@/lib/security/routeHelpers"

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50
const VALID_SPORT_TAGS = ["Football", "Basketball", "Tennis", "Mixed", "Other"]

export const GET = withSecurity(async (request: Request) => {
  const { searchParams } = new URL(request.url)

  const sport_tag = searchParams.get("sport_tag")
  const search = searchParams.get("search")
  const pageParam = searchParams.get("page")
  const pageSizeParam = searchParams.get("page_size")

  // Check query params for injection patterns
  const injectionCheck = checkQueryParams({ sport_tag, search, pageParam, pageSizeParam })
  if (injectionCheck) return injectionCheck

  // Validate search query length
  if (search && search.length < 2) {
    return NextResponse.json(
      { error: "Search query must be at least 2 characters." },
      { status: 400 }
    )
  }

  if (search && search.length > 100) {
    return NextResponse.json(
      { error: "Search query must not exceed 100 characters." },
      { status: 400 }
    )
  }

  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1)
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(pageSizeParam ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
  )

  const offset = (page - 1) * pageSize

  const supabase = createAdminClient()

  let query = supabase
    .from("rooms")
    .select("id, name, description, type, sport_tag, member_count, is_live, created_at", { count: "exact" })
    .in("type", ["Public", "Tipster"])
    .order("member_count", { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (sport_tag && VALID_SPORT_TAGS.includes(sport_tag)) {
    query = query.eq("sport_tag", sport_tag)
  }

  if (search) {
    const escaped = escapePostgrestFilter(search)
    query = query.or(`name.ilike.%${escaped}%,description.ilike.%${escaped}%`)
  }

  const { data: rooms, error, count } = await query

  if (error) {
    return NextResponse.json({ error: "Failed to fetch rooms." }, { status: 500 })
  }

  return NextResponse.json({
    rooms: rooms ?? [],
    pagination: {
      page,
      pageSize,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    },
  })
}, { cacheControl: CACHE_CONTROL.PUBLIC_SHORT })
