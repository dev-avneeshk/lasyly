import type { SeasonPlayer } from "@/lib/arena/types"
import { headshotUrl } from "@/lib/arena/data"

export function ArenaMasthead({ player }: { player?: SeasonPlayer }) {
  const portrait = player ? headshotUrl(player) : null

  return (
    <header className="relative isolate overflow-hidden rounded-[1.5rem] border border-white/[0.07] bg-[#0d101a] px-5 py-5 sm:px-7">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(151,255,0,0.14),transparent_30%),radial-gradient(circle_at_92%_40%,rgba(76,57,255,0.25),transparent_42%)]" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      {portrait && (
        // Decorative atmosphere only; player identity is provided in the dossier below.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={portrait}
          alt=""
          className="pointer-events-none absolute -right-2 -top-12 h-48 w-48 object-cover object-top opacity-30 saturate-0 sm:right-8 sm:h-56 sm:w-56"
        />
      )}
      <div className="relative max-w-xl">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#b7c2d9]">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-[#d4ff00] text-[9px] font-black tracking-normal text-[#11150a]">NBA</span>
          Lasyly Arena
        </div>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.055em] text-[#f5f7ff] sm:text-4xl">
          NBA <span className="text-[#d4ff00]">Auction</span>
        </h1>
        <p className="mt-1 text-sm text-[#aab2c4]">Build your dream team. Outbid. Outplay.</p>
      </div>
      <p className="relative mt-5 max-w-[14rem] text-[9px] font-semibold uppercase leading-4 tracking-[0.3em] text-[#8390a8] sm:mt-0 sm:absolute sm:bottom-5 sm:right-7 sm:text-right">
        Make smarter moves
      </p>
    </header>
  )
}
