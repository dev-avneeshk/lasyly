/**
 * Parallel range pagination for Supabase reads.
 *
 * Supabase caps a single `select()` at 1000 rows, so any scan larger than that
 * has to be paged. The obvious implementation — a `for` loop that awaits each
 * page and stops when a short page comes back — is correct but serial: a 40k-row
 * scan becomes 40 sequential round trips. At ~80ms each that is over three
 * seconds of pure latency before any computation starts, and the props engines
 * were doing exactly this several times per request.
 *
 * This helper trades one cheap `HEAD` count query for the ability to fan every
 * page out at once, turning N round trips into roughly two.
 */

/** Supabase's hard per-request row cap. */
const DEFAULT_PAGE_SIZE = 1000

/**
 * How many page requests are in flight at once. Supabase/PostgREST will happily
 * accept more, but each page is a separate Postgres connection from the pooler;
 * beyond this the pooler queues them anyway and we just burn memory holding the
 * promises.
 */
const DEFAULT_CONCURRENCY = 8

export interface PagedOptions {
  /** Rows per page. Defaults to Supabase's 1000-row cap. */
  pageSize?: number
  /** Hard ceiling on rows returned, as a cost guard. */
  maxRows?: number
  /** Max page requests in flight at once. */
  concurrency?: number
}

/**
 * Fetch every row of a range-paginated query, issuing the pages in parallel.
 *
 * `countRows` should run the same filters as `fetchPage` but with
 * `{ count: "exact", head: true }` so it transfers no rows. When it fails or
 * returns null we fall back to serial paging, which is slower but always
 * correct — a broken count must not silently truncate results.
 *
 * @param countRows Returns the total row count for the query, or null if unknown.
 * @param fetchPage Returns the rows in the inclusive range [from, to].
 */
export async function fetchPagedParallel<T>(
  countRows: () => Promise<number | null>,
  fetchPage: (from: number, to: number) => Promise<T[]>,
  options?: PagedOptions
): Promise<T[]> {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE
  const maxRows = options?.maxRows ?? 50_000
  const concurrency = options?.concurrency ?? DEFAULT_CONCURRENCY

  let total: number | null = null
  try {
    total = await countRows()
  } catch {
    total = null
  }

  // Unknown count — fall back to serial paging so we never under-fetch.
  if (total === null || !Number.isFinite(total)) {
    return fetchPagedSerial(fetchPage, { pageSize, maxRows })
  }

  const rowCount = Math.min(total, maxRows)
  if (rowCount <= 0) return []

  const pageCount = Math.ceil(rowCount / pageSize)
  const out: T[] = []

  // Fan out in bounded waves rather than all at once.
  for (let start = 0; start < pageCount; start += concurrency) {
    const wave = []
    for (let page = start; page < Math.min(start + concurrency, pageCount); page++) {
      const from = page * pageSize
      const to = Math.min(from + pageSize, rowCount) - 1
      wave.push(fetchPage(from, to))
    }
    const settled = await Promise.all(wave)
    for (const rows of settled) out.push(...rows)
  }

  return out
}

/**
 * Serial fallback: page until a short page arrives. Used when the count query
 * is unavailable.
 */
async function fetchPagedSerial<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  options: { pageSize: number; maxRows: number }
): Promise<T[]> {
  const { pageSize, maxRows } = options
  const out: T[] = []

  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const rows = await fetchPage(offset, offset + pageSize - 1)
    if (rows.length === 0) break
    out.push(...rows)
    if (rows.length < pageSize) break
  }

  return out
}
