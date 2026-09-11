"use client"

import { motion } from "framer-motion"

/**
 * SOLD stamp — an overlay scoped to the PLAYER CARD (its positioned parent),
 * not the whole screen. It slams down like an ink stamp over the card, which
 * blurs behind it. A soft blue backdrop tints just the card area.
 *
 * Render this as a child of a `relative` container that wraps the PlayerCard.
 */
export function SoldStamp({
  name,
  winnerLabel,
  price,
}: {
  name: string
  winnerLabel: string
  price: number
}) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-hidden rounded-3xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
    >
      {/* very light blue haze so the stamp pops — card stays clearly visible */}
      <div className="absolute inset-0 rounded-3xl bg-[#1e3a8a]/15" />

      {/* shockwave ring on impact (kept inside the card bounds) */}
      <motion.div
        className="absolute rounded-full border-2 border-[var(--color-lime)]"
        initial={{ width: 20, height: 20, opacity: 0.8 }}
        animate={{ width: 300, height: 300, opacity: 0 }}
        transition={{ duration: 0.45, ease: "easeOut", delay: 0.1 }}
      />

      {/* the stamp — sized to sit within the card */}
      <motion.div
        initial={{ scale: 2.2, rotate: -20, opacity: 0 }}
        animate={{
          scale: [2.2, 0.92, 1.04, 1],
          rotate: [-20, -7, -6, -7],
          opacity: [0, 1, 1, 1],
        }}
        exit={{ scale: 1.2, opacity: 0, rotate: -7, transition: { duration: 0.2 } }}
        transition={{ duration: 0.4, times: [0, 0.55, 0.8, 1], ease: "easeOut" }}
        className="relative"
      >
        <div className="relative rounded-xl border-4 border-[var(--color-lime)] bg-black/85 px-7 py-4 text-center shadow-[0_0_50px_-8px_rgba(212,255,0,0.85)]">
          <span className="pointer-events-none absolute inset-1 rounded-lg border border-[var(--color-lime)]/40" />
          <div className="text-4xl font-black uppercase leading-none tracking-tighter text-[var(--color-lime)] drop-shadow-[0_2px_0_rgba(0,0,0,0.5)]">
            Sold
          </div>
          <div className="mt-1.5 text-base font-black text-white">{name}</div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
            {winnerLabel} · <span className="text-[var(--color-lime)]">${price}</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
