"use client"

/**
 * Shared "My Predictor" selection: the props a user has added from the Props
 * page. The page owns the parlay logic; this store only mirrors the legs so
 * the app sidebar can show them and so they survive navigating to a player
 * page and back (sessionStorage, per tab).
 */

import { useSyncExternalStore } from "react"
import type { ParlayLeg } from "@/components/props/ParlayBuilder"

export interface PredictorLeg extends ParlayLeg {
  headshotUrl?: string | null
  team?: string
}

const STORAGE_KEY = "lasyly:predictor-legs"
/** Fired to ask the parlay sheet to open (from the sidebar card). */
export const OPEN_PREDICTOR_EVENT = "lasyly:open-predictor"

let legs: PredictorLeg[] = []
let loaded = false
const listeners = new Set<() => void>()

function load() {
  if (loaded || typeof window === "undefined") return
  loaded = true
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as PredictorLeg[]) : []
    if (Array.isArray(parsed)) legs = parsed.slice(0, 10)
  } catch {
    legs = []
  }
}

export function getPredictorLegs(): PredictorLeg[] {
  load()
  return legs
}

export function setPredictorLegs(next: PredictorLeg[]) {
  load()
  legs = next
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Storage unavailable: the in-memory copy still drives the sidebar.
  }
  for (const l of listeners) l()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const EMPTY: PredictorLeg[] = []

/** Live predictor legs; empty during SSR and the first client render. */
export function usePredictorLegs(): PredictorLeg[] {
  return useSyncExternalStore(subscribe, getPredictorLegs, () => EMPTY)
}

export function openPredictor() {
  window.dispatchEvent(new Event(OPEN_PREDICTOR_EVENT))
}
