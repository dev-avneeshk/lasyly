/**
 * Loading skeletons for the rooms ("Chat") surfaces.
 *
 * Server-safe on purpose (no "use client", no hooks): the same markup is the
 * route `loading.tsx` fallback AND the client components' own loading state,
 * so the hand-off from one to the other is invisible instead of flashing a
 * second loader. The shell class constants are shared with the real UI roots
 * so the skeleton's outer geometry can't drift from the loaded page.
 */

/** Root of the rooms list (`RoomsClient`). */
export const ROOMS_LIST_SHELL = "h-[calc(100dvh-64px)] flex flex-col bg-[#0A0A0A]"

/** Root of a single room view (`rooms/[roomId]/page.tsx`). */
export const ROOM_SHELL = "flex h-[calc(100dvh-64px)] overflow-hidden bg-[#0A0A0A]"

const PULSE = "animate-pulse motion-reduce:animate-none bg-white/5"

// Deterministic widths (no Math.random) so server and client markup match.
const MESSAGE_WIDTHS: ReadonlyArray<{ name: string; lines: string[] }> = [
  { name: "w-24", lines: ["w-3/4"] },
  { name: "w-20", lines: ["w-11/12", "w-1/2"] },
  { name: "w-28", lines: ["w-2/3"] },
  { name: "w-16", lines: ["w-5/6", "w-2/5"] },
  { name: "w-24", lines: ["w-1/2"] },
  { name: "w-20", lines: ["w-3/5"] },
]
const MEMBER_WIDTHS = ["w-24", "w-20", "w-28", "w-16", "w-24"]

// ─── Rooms list ───────────────────────────────────────────────────────────────

/** Mirrors `RoomCard` in RoomsClient: 120px banner + title/description/members body. */
export function RoomCardSkeleton() {
  return (
    <div className="rounded-2xl bg-[#111111] border border-white/[0.06] overflow-hidden">
      <div className={`h-[120px] ${PULSE}`} />
      <div className="p-3">
        {/* title row: 14px text, mb-1 */}
        <div className="h-[21px] flex items-center mb-1">
          <div className={`h-4 w-3/4 rounded ${PULSE}`} />
        </div>
        {/* 2-line clamped description: 12px, leading-relaxed, mb-3 */}
        <div className="mb-3">
          <div className="h-[19.5px] flex items-center">
            <div className={`h-3 w-full rounded ${PULSE}`} />
          </div>
          {/* Most descriptions fit one line in the single-column mobile grid; in
              the multi-column grid a row stretches to its tallest (2-line) card. */}
          <div className="h-[19.5px] hidden md:flex items-center">
            <div className={`h-3 w-2/3 rounded ${PULSE}`} />
          </div>
        </div>
        {/* members row: 11px text beside a 14px icon */}
        <div className="h-[16.5px] flex items-center">
          <div className={`h-3 w-20 rounded ${PULSE}`} />
        </div>
      </div>
    </div>
  )
}

export function RoomCardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <RoomCardSkeleton key={i} />
      ))}
    </div>
  )
}

/** Full rooms-list page skeleton (route fallback for `/rooms`). */
export function RoomsListSkeleton() {
  return (
    <div className={ROOMS_LIST_SHELL} role="status" aria-busy="true">
      <span className="sr-only">Loading rooms</span>
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-4 min-h-9">
          <div className={`h-6 w-[180px] rounded-lg ${PULSE}`} />
        </div>
        {/* Static, like the real search input */}
        <div className="h-10 rounded-xl bg-[#1A1A1A] border border-white/[0.06]" />
      </div>
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 pt-5 pb-6">
          <RoomCardGridSkeleton />
        </div>
      </div>
    </div>
  )
}

// ─── Room view ────────────────────────────────────────────────────────────────

/** Mirrors the full (non-grouped) `MessageRow`: 40px avatar, name/time line, text lines. */
export function MessageListSkeleton({ rows = 6, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => {
        const w = MESSAGE_WIDTHS[i % MESSAGE_WIDTHS.length]
        return (
          <div key={i} className="flex gap-4 px-4 py-2.5 rounded-xl mt-2 first:mt-0">
            <div className={`w-10 h-10 rounded-xl shrink-0 ${PULSE}`} />
            <div className="flex-1 min-w-0">
              <div className="h-[21px] flex items-center gap-2.5 mb-1">
                <div className={`h-3.5 ${w.name} rounded ${PULSE}`} />
                <div className={`h-2.5 w-14 rounded ${PULSE}`} />
              </div>
              {w.lines.map((line, j) => (
                <div key={j} className="h-[24px] flex items-center">
                  <div className={`h-3.5 ${line} rounded ${PULSE}`} />
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Small uppercase section label (10px text) placeholder. */
function LabelBar({ width, className = "" }: { width: string; className?: string }) {
  return (
    <div className={`h-[15px] flex items-center ${className}`}>
      <div className={`h-2.5 ${width} rounded ${PULSE}`} />
    </div>
  )
}

/** Full room view skeleton: channel sidebar, chat column, right panel. */
export function RoomShellSkeleton() {
  return (
    <div className={ROOM_SHELL} data-chat-shell="" role="status" aria-busy="true">
      <span className="sr-only">Loading room</span>

      {/* Channel sidebar */}
      <div className="hidden md:flex w-[240px] shrink-0 flex-col bg-[#111111] border-r border-white/[0.06]" aria-hidden="true">
        <div className="px-5 pt-6 pb-4">
          <div className="h-[22.5px] flex items-center">
            <div className={`h-4 w-32 rounded ${PULSE}`} />
          </div>
        </div>
        <div className="flex-1 px-2 pb-4">
          <LabelBar width="w-16" className="px-2 mb-1.5" />
          <div className="flex flex-col gap-0.5">
            {["w-24", "w-20", "w-28"].map((w, i) => (
              <div key={i} className="h-9 px-3 rounded-[10px] flex items-center gap-2">
                <div className={`w-3.5 h-3.5 rounded ${PULSE}`} />
                <div className={`h-3 ${w} rounded ${PULSE}`} />
              </div>
            ))}
          </div>
        </div>
        <div className="px-3 py-3 border-t border-white/[0.06] flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl shrink-0 ${PULSE}`} />
          <div className="min-w-0 flex-1 flex flex-col gap-1.5">
            <div className={`h-3 w-20 rounded ${PULSE}`} />
            <div className={`h-2.5 w-28 rounded ${PULSE}`} />
          </div>
        </div>
      </div>

      {/* Chat column */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0A0A0A]">
        <div className="h-[56px] shrink-0 flex items-center px-5 border-b border-white/[0.06] gap-4" aria-hidden="true">
          <div className={`md:hidden w-5 h-5 rounded ${PULSE}`} />
          <div className="flex items-center gap-1.5">
            <div className={`w-4 h-4 rounded ${PULSE}`} />
            <div className={`h-4 w-24 rounded ${PULSE}`} />
          </div>
        </div>
        {/* Top-aligned like the real feed (short rooms start at the top; long ones fill it) */}
        <div className="flex-1 overflow-hidden px-5 py-5 flex flex-col">
          <MessageListSkeleton />
        </div>
        <div className="shrink-0 px-5 pb-5 pt-2" aria-hidden="true">
          <div className="h-[51px] rounded-2xl bg-[#161616] border border-white/[0.05]" />
        </div>
      </div>

      {/* Right panel */}
      <div className="hidden lg:flex w-[280px] shrink-0 flex-col bg-[#111111] border-l border-white/[0.06]" aria-hidden="true">
        <div className="p-5 border-b border-white/[0.06]">
          <LabelBar width="w-28" className="mb-3" />
          <div className="h-[92px] rounded-xl bg-white/[0.03] animate-pulse motion-reduce:animate-none" />
        </div>
        <div className="p-5 flex-1">
          <LabelBar width="w-24" className="mb-3" />
          <div className="flex flex-col gap-0.5">
            {MEMBER_WIDTHS.map((w, i) => (
              <div key={i} className="flex items-center gap-2.5 px-2 py-1.5">
                <div className={`w-[30px] h-[30px] rounded-full shrink-0 ${PULSE}`} />
                <div className={`h-3 ${w} rounded ${PULSE}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
