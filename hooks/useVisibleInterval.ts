"use client"

import { useEffect, useRef } from "react"

/**
 * setInterval that only runs while the tab is visible.
 *
 * Every tick of a plain setInterval is a serverless invocation (proxy + route),
 * and browsers keep firing them for background tabs — throttled, but never
 * stopped. On Vercel that is billed Active CPU for a screen nobody is looking
 * at. This pauses while `document.hidden` and fires once immediately on return
 * so the UI catches up.
 */
export function useVisibleInterval(callback: () => void, delayMs: number): void {
  const savedCallback = useRef(callback)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null

    const start = () => {
      if (timer === null) timer = setInterval(() => savedCallback.current(), delayMs)
    }
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer)
        timer = null
      }
    }
    const onVisibilityChange = () => {
      if (document.hidden) {
        stop()
      } else {
        savedCallback.current()
        start()
      }
    }

    if (!document.hidden) start()
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      stop()
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [delayMs])
}
