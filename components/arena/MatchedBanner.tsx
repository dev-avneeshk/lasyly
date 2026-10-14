"use client"

import { AnimatePresence, motion } from "framer-motion"

/**
 * The matched moment of a global 1v1 ("You matched against <name>"), shown for
 * a couple of seconds as the auction opens. ServerArena owns the text and its
 * timer; this only renders it.
 *
 * The live region is always mounted, so screen readers already know it when the
 * text appears, and it announces politely without moving focus. It holds no
 * focusable content and lets every click through (pointer-events-none), so it
 * never blocks a bid. The slide is a transform, which the app-wide
 * MotionConfig (reducedMotion="user") drops for reduced-motion users.
 */
export function MatchedBanner({ text }: { text: string | null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4rem)] z-40 flex justify-center px-4"
    >
      <AnimatePresence>
        {text && (
          <motion.div
            key={text}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
            className="max-w-[min(92vw,26rem)] truncate rounded-full border border-[#d4ff00]/40 bg-[#11141e]/95 px-4 py-2 text-sm font-bold text-[#f4f6fb] shadow-[0_14px_32px_rgba(0,0,0,0.35)]"
          >
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
