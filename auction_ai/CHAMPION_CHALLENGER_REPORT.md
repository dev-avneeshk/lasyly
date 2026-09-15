# Champion/Challenger experiment — did anything beat v6?

**Short answer: no.** Under paired, common-random-number, real-game evaluation
across all opponent archetypes, no challenger in the neighborhood of the
production champion (v6) beat it with statistical confidence. **v6 survives.**

This document reports the first controlled experiment honestly, including the
result that contradicts an early, misleading signal.

---

## Setup

- **Champion:** production v6 (`lib/arena/data/cpu-policy.json`), anchored at
  `models/champion/champion_policy.json` and never overwritten during search.
- **Search:** tiered mutation around v6 — 80% small (σ≈0.06), 15% medium
  (σ≈0.18), 5% large (σ≈0.45). This explores the *local* neighborhood of an
  already-strong policy rather than restarting from scratch.
- **Stage 1 (proxy filter):** all candidates scored by the fast proxy; top ~20–25%
  advance.
- **Stage 2 (ground truth):** survivors compared to v6 with **paired CRN** —
  challenger and champion build rosters against the *same* opponent and play the
  *same* game seeds, across six opponent archetypes (aggressive, balanced,
  defense, value, star-chaser, offense). The statistic is the mean paired
  difference `Δ = WR_challenger − WR_champion` with a normal CI.
- **Guardrails:** behavior scenarios A–E, action-distribution / collapse check,
  hard-rule-violation count, and per-archetype regression.
- **Data:** unseen VALIDATION partition only (the TEST partition was untouched).
- **Simulator:** `SIMULATION_VERSION = gt-1.0.0`, parity with the TS engine
  re-verified before the run (win-rate MAE 0.000).

## Promotion rule (all configurable)

A challenger becomes a `CHAMPION_CANDIDATE` only if **all** hold:

- `Δ` confidence-interval lower bound `> 0` (confidently better),
- `Δ ≥ min_margin` (default 0.01),
- no archetype regression worse than `−0.03`,
- behavior guardrail passes and all A–E scenarios pass,
- action distribution not collapsed,
- zero hard-rule violations.

## Results

Two independent seeds, 24 candidates each → 6 survivors evaluated on
6 archetypes × 3 validation scenarios, paired CRN, ~2,700 paired game-units per
survivor:

**Seed 7**

| candidate | Δ vs v6 | 95% CI | worst archetype | behavior | violations | status |
|-----------|:-------:|:------:|:---------------:|:--------:|:----------:|:------:|
| cand-7-3  | +0.0000 | [+0.000,+0.000] | +0.000 | 5/5 | 0 | REJECTED (no-op mutation) |
| cand-7-5  | −0.0052 | [−0.019,+0.008] | −0.049 | 5/5 | 0 | INSUFFICIENT |
| cand-7-2  | −0.0144 | [−0.029,−0.000] | −0.062 | 5/5 | 0 | REJECTED |
| cand-7-0  | −0.0152 | [−0.029,−0.002] | −0.067 | 5/5 | 0 | REJECTED |
| cand-7-4  | −0.0152 | [−0.029,−0.001] | −0.040 | 5/5 | 0 | REJECTED |
| cand-7-1  | −0.0185 | [−0.032,−0.005] | −0.056 | 5/5 | 0 | REJECTED |

**Seed 99**: best Δ = +0.0000 (a no-op mutation); every real mutation −0.045 to
−0.056; all REJECTED.

**No candidate beat v6.** The best any mutation achieved was to *tie* it (a
mutation small enough to reproduce the champion's rosters, giving Δ exactly
0.000 across 2,700 games — a nice confirmation that the CRN pairing removes all
shared variance, so a nonzero Δ would be pure signal).

## The honest caveat: an early false positive

An initial small-scale probe (seed 42, ladder [100,400], only 3 validation
scenarios) showed candidates "beating" v6 by **+5–7%** win rate. Those were
**artifacts of a tiny validation set and a lucky seed** — the candidates were
overfit to those specific scenarios. On the cleaner setup (more proxy scenarios,
two independent seeds, per-archetype breakdown) the effect vanished and reversed.

This is exactly the failure mode the framework is built to catch:

- it evaluates on **diverse archetypes** (those early winners regressed badly
  against at least one archetype, e.g. worst-archetype −0.06 to −0.10),
- it requires a **positive CI lower bound** and a **margin**, and
- it never promotes on the proxy or on a single favorable matchup.

## Verdict

> The champion (production **v6**) remains champion. The system correctly
> refused to promote, and correctly refused to be fooled by an early
> small-sample false positive.

This is a *successful* run of the champion/challenger system: it did not
manufacture improvement. v6's interpretable weight vector appears to be at (or
very near) a local optimum for this auction + game simulator; beating it will
likely require either a larger/architecturally-different search or a change to
the game itself (new players, rules, or simulator).

## How to push further (next steps, not run here)

- Wider search: more candidates, occasional larger mutations, and an **elite
  pool** seeded from several distinct strong points (already supported).
- More validation scenarios + a longer ladder (200 → 1k → 5k → 20k) for tighter
  CIs — this is compute-bound; run it on a bigger box or overnight.
- Incremental champions: once a challenger is verified, promote with `--promote`
  and start the next search from the new champion (v7 → v8 → …).
- Re-run after any player-pool or game-engine change (parity + drift checks
  gate this automatically).

## Reproduce

```bash
python -m auction_ai.validation.parity                    # confirm sim parity first
python -m auction_ai.training.challenger \
    --candidates 24 --proxy-scenarios 16 --gt-scenarios 3 \
    --ladder 150 400 --min-margin 0.01 --seed 7 --budgets 25
# add --promote only if a CHAMPION_CANDIDATE emerges
```
