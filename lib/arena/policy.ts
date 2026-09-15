/**
 * Trained CPU policy — production INFERENCE side.
 *
 * The offline Python engine (see /auction_ai) learns a compact weight vector via
 * large-scale self-play and exports it to `data/cpu-policy.json`. This module
 * loads that artifact ONCE (module scope — Next.js server modules are
 * long-lived) and exposes the weights to the AI decision code.
 *
 * ── Vercel constraints (deliberate) ────────────────────────────────────────
 *   • No training here. No simulations. Just a tiny JSON of ~14 numbers.
 *   • Loading is O(1) and cached; inference is a handful of multiplies.
 *   • If the policy is missing / corrupt / the wrong shape, we fall back to a
 *     deterministic baseline (weights all = 1.0) that reproduces the original
 *     hand-tuned CPU. The auction must NEVER crash because of a bad policy.
 *
 * The weight semantics MUST match auction_ai/ai/policy.py exactly, so the CPU
 * behaves the same in production as it did in training.
 */

// Import is static so the JSON is bundled at build time (works on Vercel with
// no filesystem reads at request time). If the file is absent the try/catch in
// loadPolicy falls back — but since it's committed, this is the happy path.
import rawPolicy from "./data/cpu-policy.json"

/** The learnable weights. Names + defaults mirror DEFAULT_WEIGHTS in policy.py. */
export interface PolicyWeights {
  player_value_weight: number
  offense_weight: number
  defense_weight: number
  spacing_weight: number
  team_fit_weight: number
  positional_need_weight: number
  scarcity_weight: number
  budget_weight: number
  future_value_weight: number
  overpay_penalty: number
  urgency_weight: number
  risk_tolerance: number
  // Extended state/action space (opponent modeling + auction timing). These are
  // NO-OPS at their default (0), so an artifact without them reproduces the
  // original CPU exactly. Names/semantics mirror auction_ai/ai/policy.py.
  rival_demand_weight: number
  rival_desperation_weight: number
  snipe_weight: number
  opportunity_cost_weight: number
  auction_stage_weight: number
}

export interface CpuPolicy {
  version: number
  weights: PolicyWeights
}

/**
 * Deterministic baseline: every weight = 1.0 reproduces the ORIGINAL hand-tuned
 * CPU (the learnable terms were introduced as `weight * originalConstant`, so
 * 1.0 is a no-op). This is the safe fallback (spec §26) and also the value used
 * for any weight missing from the artifact.
 */
export const DEFAULT_WEIGHTS: PolicyWeights = {
  player_value_weight: 1,
  offense_weight: 1,
  defense_weight: 1,
  spacing_weight: 1,
  team_fit_weight: 1,
  positional_need_weight: 1,
  scarcity_weight: 1,
  budget_weight: 1,
  future_value_weight: 1,
  overpay_penalty: 1,
  urgency_weight: 1,
  risk_tolerance: 1,
  // Extended terms default to 0 = no-op (reproduces the original CPU).
  rival_demand_weight: 0,
  rival_desperation_weight: 0,
  snipe_weight: 0,
  opportunity_cost_weight: 0,
  auction_stage_weight: 0,
}

export const DEFAULT_POLICY: CpuPolicy = { version: 0, weights: { ...DEFAULT_WEIGHTS } }

const WEIGHT_KEYS = Object.keys(DEFAULT_WEIGHTS) as (keyof PolicyWeights)[]

// The extended opponent-modeling / timing terms are additive and may be
// negative (neutral at 0). Kept in sync with _SIGNED_KEYS in learner.py.
const SIGNED_KEYS = new Set<keyof PolicyWeights>([
  "rival_demand_weight",
  "rival_desperation_weight",
  "snipe_weight",
  "opportunity_cost_weight",
  "auction_stage_weight",
])

/**
 * Validate + sanitize an unknown blob into a usable policy. Any weight that is
 * missing, non-finite, or out of a sane range falls back to the default for
 * that key. Returns DEFAULT_POLICY if the blob is unusable entirely.
 */
export function sanitizePolicy(blob: unknown): CpuPolicy {
  try {
    if (!blob || typeof blob !== "object") return DEFAULT_POLICY
    const b = blob as { version?: unknown; weights?: unknown }
    const version = typeof b.version === "number" && Number.isFinite(b.version) ? b.version : 0
    const inWeights = (b.weights && typeof b.weights === "object" ? b.weights : {}) as Record<string, unknown>

    const weights = { ...DEFAULT_WEIGHTS }
    for (const key of WEIGHT_KEYS) {
      const v = inWeights[key]
      // Accept only finite numbers within a defensive range. Core multiplicative
      // weights are non-negative (trainer clamps to [0,3]); the extended
      // opponent-modeling / timing terms are SIGNED (trainer clamps to [-2,2]),
      // so allow a modest negative range for those. Anything outside signals a
      // corrupt file → fall back to that key's default.
      const signed = SIGNED_KEYS.has(key)
      const lo = signed ? -5 : 0
      const hi = signed ? 5 : 10
      if (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi) {
        weights[key] = v
      }
    }
    return { version, weights }
  } catch {
    return DEFAULT_POLICY
  }
}

// Load ONCE at module init. Never throws — a bad artifact degrades to baseline.
let cachedPolicy: CpuPolicy | null = null

export function loadPolicy(): CpuPolicy {
  if (cachedPolicy) return cachedPolicy
  try {
    cachedPolicy = sanitizePolicy(rawPolicy)
  } catch {
    cachedPolicy = DEFAULT_POLICY
  }
  return cachedPolicy
}

/** Read a single weight with the safe default baked in. */
export function weight(key: keyof PolicyWeights): number {
  return loadPolicy().weights[key] ?? DEFAULT_WEIGHTS[key]
}

/** Test seam: override the loaded policy (used by unit tests). */
export function __setPolicyForTest(p: CpuPolicy | null): void {
  cachedPolicy = p
}
