# auction_ai — self-learning NBA auction CPU

An **offline** training/simulation engine that learns a compact bidding policy
for the NBA auction arena through large-scale **self-play** and
**generation-based learning**, then exports a tiny JSON the Vercel app loads for
fast, safe **inference**.

> **Training happens outside Vercel. Inference happens inside Vercel.**
> Nothing in this package runs on the Vercel free tier. The production app only
> ever loads the exported `cpu-policy.json` and does a handful of multiplies.

---

## Architecture

```
        OFFLINE (this package, run locally / on any CPU box)
  ┌─────────────────────────────────────────────────────────┐
  │  Python simulator (faithful port of the TS auction rules) │
  │        ↓ thousands of self-play auctions                  │
  │  CPU self-play  →  reward/evaluation  →  policy learner    │
  │        ↓ validate on UNSEEN scenarios                     │
  │  keep best policy  →  export best_policy.json             │
  └───────────────────────────┬─────────────────────────────┘
                              │  export/export_policy.py
                              ▼
        PRODUCTION (Next.js / Vercel)
  ┌─────────────────────────────────────────────────────────┐
  │  lib/arena/policy.ts loads lib/arena/data/cpu-policy.json │
  │  lib/arena/ai.ts applies the weights in decideAI /        │
  │  walkAwayPrice → BID / PASS (fast, O(1) per decision)     │
  └─────────────────────────────────────────────────────────┘
```

## Why parameters, not a neural net

The learnable policy is a **~14-number weight vector** over interpretable
features (see `ai/policy.py` `DEFAULT_WEIGHTS`): `player_value_weight`,
`team_fit_weight`, `positional_need_weight`, `scarcity_weight`, `budget_weight`,
`future_value_weight`, `overpay_penalty`, `urgency_weight`, `risk_tolerance`,
etc. This is tiny to export, fast on Vercel, trivial to inspect/debug, and needs
no ML runtime in production.

Crucially, the policy is **two layers**:

```
HARD RULES (from the engine)  +  LEARNED STRATEGY (weights)  =  DECISION
```

The learner can only tune *strategy*. It can never break auction rules
(affordability, roster limits, duplicates, bench-before-starters, etc.) — those
are enforced by the ported engine and the min-raise/ceiling math regardless of
weights. Baseline weights (all `1.0`) reproduce the shipped hand-tuned CPU
exactly, so training moves *from* the current behavior rather than from noise.

## Layout

```
auction_ai/
├── simulation/        # faithful port of lib/arena (the auction rules)
│   ├── rng.py            # mulberry32 / hashSeed / djb2 — bit-exact vs the TS engine
│   ├── player_model.py   # Player + constants; loads data/players.json
│   ├── value.py          # offense/defense/spacing/scarcity/scaledOpeningBid
│   ├── budget.py         # maxAffordable + bid validation (the $1/slot reserve)
│   ├── roster.py         # slot rules, uniqueness, starters-before-bench
│   ├── auction.py        # order build, lot select, bid/pass/resolve, autofill
│   ├── auction_state.py  # ArenaState / GameConfig
│   ├── auction_simulator.py  # drives a full self-play auction
│   └── team_simulator.py     # team-profile port + head-to-head win model
├── ai/
│   ├── policy.py         # the LEARNABLE weight-vector policy + decide()
│   ├── reward.py         # context-aware reward (spec §7)
│   ├── evaluator.py      # per-game eval + aggregated benchmark metrics
│   └── learner.py        # evolution-strategy mutation + fitness
├── training/
│   ├── scenarios.py      # randomized scenarios + train/val/test split
│   ├── train.py          # the generation loop (CLI)
│   └── evaluation.py     # benchmark_policy + head_to_head
├── export/
│   └── export_policy.py  # write the compact production artifact (CLI)
├── evaluate.py           # benchmark on UNSEEN test scenarios / old-vs-new (CLI)
├── explain.py            # per-decision explainability (CLI, spec §24)
├── data/
│   └── players.json      # generated from lib/arena/data/players-2025-26.ts
└── models/
    ├── best_policy.json          # the best validated policy
    └── checkpoints/…             # per-generation checkpoints (resumable)
```

## Setup

Pure standard-library Python (3.10+). No third-party deps, no GPU.

```bash
python3 --version   # 3.10+
```

## Commands

Train (self-play, generation-based, multiprocessing across all cores):

```bash
# quick run
python3 -m auction_ai.training.train --simulations 2000 --generations 100

# longer run
python3 -m auction_ai.training.train --simulations 100000 --generations 500 --seed 7

# resume from the latest checkpoint after an interruption
python3 -m auction_ai.training.train --resume

# demonstrate the learning loop recovering a deliberately weak policy
python3 -m auction_ai.training.train --init weak --simulations 2000 --generations 60
```

Evaluate a trained policy on **unseen** test scenarios and compare to the
shipped baseline (old vs new):

```bash
python3 -m auction_ai.evaluate --policy auction_ai/models/best_policy.json \
    --simulations 2000 --compare-baseline
```

Explain a policy's decisions (debug mode):

```bash
python3 -m auction_ai.explain --seed 123 --budget 25
```

Export the trained policy into the app:

```bash
python3 -m auction_ai.export.export_policy
# → writes lib/arena/data/cpu-policy.json (tiny; version + weights)
```

## Regenerating the player pool

`data/players.json` is generated from the app's canonical TypeScript pool so the
simulator uses identical ratings. To refresh after editing the TS data, run a
one-off exporter that imports `lib/arena/data/players-2025-26.ts` (e.g. via a
throwaway vitest that writes the JSON) — see the project notes. The simulator
never reads the `.ts` file directly.

## How the learning loop works (spec §29)

```
SIMULATE  → run N self-play auctions on fresh TRAIN scenarios
EVALUATE  → context-aware reward per team (roster quality, value efficiency,
            overpay, positional balance, completeness) + head-to-head win signal
LEARN     → evolution strategy: keep the best-scoring mutated policy
VALIDATE  → benchmark the winner on a fixed, held-out VALIDATION set (never
            trained on) against the shipped baseline
KEEP BEST → only replace best_policy.json if validation improved
REPEAT    → next generation, with exploration (mutation σ) annealed down
```

Early stopping triggers when validation hasn't improved for `--patience`
generations. Every generation writes a checkpoint and updates `best_policy.json`.

### Overfitting guard (spec §15)

Scenarios are deterministically partitioned **70 / 15 / 15** into
train / validation / test by hashing the scenario seed, so the validation and
test sets are never trained on. `evaluate.py` reports on the test partition.

### Measured improvement (old vs new)

A run of `--init weak --simulations 300 --generations ~17` (seed 3) recovered a
mis-tuned policy up to **v6**, then `evaluate.py` compared it to the shipped
baseline on **300 unseen TEST scenarios**:

| metric                | baseline | trained (v6) |
|-----------------------|:--------:|:------------:|
| reward                | 199.1    | **203.3**    |
| roster quality        | 79.5     | **80.2**     |
| unspent budget        | 18.9%    | **7.1%**     |
| head-to-head win rate | —        | **51.3%**    |

The trained CPU builds stronger rosters, deploys its budget instead of hoarding
it, and beats the old CPU head-to-head (seat-balanced) — while still behaving
differently from one team to another via the fixed personality layer.

The learned weights are interpretable, e.g. it discovered to lean on
`player_value`, `defense`, and `budget`/`urgency` (spend to fill needs) while
damping raw `offense`. The whole artifact is ~400 bytes.

> **Note on ceiling.** The shipped hand-tuned CPU is already strong for this
> tightly constrained 6-slot auction (shared board, hard `$1/slot` reserve, and
> auto-fill compress how different two competent rosters can be), so absolute
> gains from the *default* init are small. Training from `--init weak` makes the
> optimization visible; larger `--simulations`/`--generations` push further.

## Production safety (spec §26)

`lib/arena/policy.ts` loads the artifact once and **sanitizes** it: any missing,
non-finite, or out-of-range weight falls back to `1.0` (the baseline no-op), and
a completely unusable file falls back to `DEFAULT_POLICY`. The live auction never
crashes because of a bad policy.

---

# Ground-truth upgrade — optimizing for REAL game performance

The original loop above optimizes a **proxy reward** (a fast `teamRating`
logistic). That's only an approximation of the game the user actually plays. The
ground-truth upgrade makes the **real possession simulator the ultimate judge**,
while keeping the proxy as a cheap search shortcut.

## What "ground truth" means here

The production outcome comes from `lib/arena/simulation.ts` (`simulateGame`) — a
possession-by-possession engine with matchups, fatigue/usage, clutch, difficulty
edge, and real variance. We ported it faithfully to Python under
`auction_ai/game/`:

```
game/
  matchup.py        # port of matchup.ts (per-matchup offensive edge)
  fatigue.py        # stamina decay, rotation, fatigue factor
  possession.py     # port of simulatePossession (actions, shots, TO, blocks, rebounds)
  game_simulator.py # port of simulateGame (quarters, OT, winner) + SIMULATION_VERSION
```

### Parity is proven, not assumed

`scripts/parity-fixture.test.ts` runs the REAL TS `simulateGame` over many
seeded roster pairs and writes `validation/parity_fixtures.json`.
`validation/parity.py` replays the identical rosters + seeds through the Python
port and compares.

```bash
npx vitest run scripts/parity-fixture.test.ts     # export TS fixtures
python -m auction_ai.validation.parity --verbose  # compare
```

Because `mulberry32` is bit-exact and the RNG-consumption order was preserved,
the current result is **exact parity** (win-rate MAE 0.000, all pairs identical).
The harness still enforces an explicit statistical tolerance so language-level
float drift would be caught rather than silently accepted.

## The hierarchical training loop (proxy filter → real games)

Running a full game sim for every candidate would be far too expensive, so
selection is two-stage (`ai/selection.py`):

```
GENERATE population (mutate best)
   → STAGE 1  fast PROXY scores everyone; keep top ~20%
   → STAGE 2  REAL game simulation ranks the survivors (common random seeds)
   → WINNER  by ground-truth win rate (Wilson confidence), not proxy
   → behavior guardrail on the winner
   → every N gens: ground-truth TOURNAMENT + proxy CALIBRATION refresh
   → keep 3 tracks: best_ground_truth / best_proxy / best_behavior
REPEAT
```

Run it:

```bash
python -m auction_ai.training.train_gt \
    --generations 20 --population 24 \
    --proxy-scenarios 60 --gt-scenarios 10 --games 120 \
    --survivor-fraction 0.2 --gt-every 4 --init weak
```

Outputs live under `auction_ai/models/ground_truth/`:
`best_ground_truth_policy.json`, `best_proxy_policy.json`,
`best_behavior_policy.json`, `learning_curve.json`, `training_data.jsonl`,
`checkpoints/`.

## Proxy is demoted to a shortcut — and audited

- `training/ground_truth.py` — real-game win rate over N games with **common
  random seeds** (paired comparison) and **Wilson confidence intervals** so a
  52.0% vs 51.7% gap isn't mistaken for signal.
- `training/calibration.py` — fits `proxy → real win rate`, records the residual
  error and rank correlation, and flags **proxy hacking** (high proxy, low real).
- `validation/proxy_correlation.py` — a diagnostic that measures how well proxy
  ranks policies vs real games. (Measured: Spearman ≈ +0.79 overall, but the
  proxy is *compressed near the top* — many strong policies share ~identical
  proxy while real win rates differ — which is exactly why ground truth decides.)

## Behavior guardrail (feels-smart, not just wins)

`validation/behavioral.py` scores whether the bidding looks intelligent to a
human: redundancy discipline, roster-hole awareness, bargain aggression,
walk-away discipline, and roster completeness (no $1 auto-fill scrubs). It is a
**guardrail, not a reward** — a policy that wins statistically but bids absurdly
is rejected; a high behavior score can never by itself promote a weaker policy.

```bash
python -m auction_ai.validation.behavioral --policy auction_ai/models/ground_truth/best_ground_truth_policy.json
```

Note: the auction's **hard-constraint layer** already prevents the worst
behaviors (a redundant or slot-blocked player gets a $0 walk-away; the
`$1/slot` reserve caps spending), so the guardrail mainly catches policies that
pass the hard rules yet still bid irrationally.

## Final benchmark + ship decision

`validation/benchmark.py` plays the **current production CPU vs the new CPU** on
the unseen **TEST** partition (never used in training or calibration), seat-
balanced, and only recommends shipping when the new CPU:

1. wins with statistical confidence (Wilson CI low > 0.5),
2. passes the behavior guardrail, and
3. produces **zero hard-rule violations**.

```bash
python -m auction_ai.validation.benchmark \
    --new auction_ai/models/ground_truth/best_ground_truth_policy.json \
    --games 200 --scenarios 40
```

Only then export the compact policy to Vercel:

```bash
python -m auction_ai.export.export_policy \
    --policy auction_ai/models/ground_truth/best_ground_truth_policy.json
```

## Simulator-version drift (spec §28–29)

The Python port can go stale if the TS engine changes (`simulation.ts`,
`matchup.ts`, ratings, fatigue, usage, difficulty). `game/__init__.py` carries a
`SIMULATION_VERSION`, and every training run records it. After any game-engine
change:

```bash
npx vitest run scripts/parity-fixture.test.ts   # regenerate TS fixtures
python -m auction_ai.validation.drift            # re-check parity
```

If parity now fails, `drift.py` writes `models/STALE_POLICY.txt` and the current
learned policy must be revalidated/retrained after the port is updated and
`SIMULATION_VERSION` is bumped.

## Retraining guidance

Retrain when any of these change: the player pool/ratings, the auction rules, or
the game simulator (`simulation.ts`/`matchup.ts`). A new policy is considered
genuinely better **only** when its real-game TEST win rate improves with
statistical confidence, its behavior score stays above the guardrail, and it
commits zero hard-rule violations — not merely because the proxy reward rose.

---

# Champion/challenger — beating the current production CPU

Once a strong policy is deployed, the goal shifts from "recover a weak policy" to
"find a challenger that genuinely beats the reigning champion on real games". The
champion/challenger system (`training/champion.py`, `training/challenger.py`,
`training/progressive.py`) does exactly that.

- **Champion = production v6**, anchored at `models/champion/champion_policy.json`
  and never overwritten during search. Each policy carries a **model id**
  (`policy_version`, `parent_policy`, `simulation_version`, `player_data_version`,
  `training_seed`) so a policy validated against simulator version N is never
  silently treated as valid against N+1. A `last_known_good` copy enables
  automatic revert.
- **Local search:** tiered mutation around the champion (configurable
  80% small / 15% medium / 5% large), not a from-scratch restart.
- **Paired CRN evaluation:** challenger and champion face identical scenarios,
  opponents, and game seeds. The statistic is the paired win-rate delta with a
  tight CI (a no-op mutation gives Δ = exactly 0.000, confirming the pairing).
- **Progressive budget:** a 200 → 1k → 5k → 20k ladder rejects weak candidates
  cheaply and only spends big on genuine contenders.
- **Diverse opponents:** every challenger is tested against six archetypes
  (aggressive/balanced/defense/value/star-chaser/offense); it cannot win overall
  by tanking one style.
- **Behavior guardrail + harder scenarios A–E** (redundant guard, cheap elite,
  scarce archetype, opportunity cost, bidding-war ceiling) + action-distribution
  collapse detection.
- **Promotion rule (configurable):** positive CI lower bound AND margin AND no
  archetype regression AND behavior pass AND no collapse AND zero hard-rule
  violations AND valid parity. Training never auto-ships; `--promote` is explicit.
- **Leaderboard + report:** `models/champion/leaderboard.json` and
  `experiment_report.json`.

Run the controlled experiment:

```bash
python -m auction_ai.validation.parity   # gate: sim must be in parity first
python -m auction_ai.training.challenger \
    --candidates 60 --proxy-scenarios 40 --gt-scenarios 12 \
    --ladder 200 1000 5000 --min-margin 0.01 --seed 42 --budgets 25 50
```

**First-experiment result (honest):** no challenger beat v6. Two independent
seeds agreed — the best any mutation achieved was to *tie* v6; real mutations
were worse, and an early +5% "win" turned out to be a small-sample/seed artifact
that vanished under diverse-archetype, multi-seed evaluation. See
`CHAMPION_CHALLENGER_REPORT.md`. v6's interpretable weights appear to sit at (or
near) a local optimum for the current game; the system correctly declined to
manufacture an improvement.

---

# Richer policy: opponent modeling & auction timing

Because v6 sits at a local optimum for its 12 coefficients, the next step was to
*expand the state/action space* rather than shake the same weights harder. The
policy now has **17 learnable parameters**, adding human-like reasoning:

- `rival_demand_weight` — "does a rival also want this player?"
- `rival_desperation_weight` — "how badly do they need this slot, and how few
  alternatives do they have?"
- `snipe_weight` — "nobody else can take this lot → buy it cheap"
- `opportunity_cost_weight` — "spending now costs me later needs"
- `auction_stage_weight` — early vs late auction aggression

The opponent features come from **open information** (rosters, budgets, queue) —
cheap to compute, safe for Vercel. All five default to **0 = no-op**, so v6 is
reproduced exactly (verified: 480 walk-away decisions, 0 mismatches), and they're
mirrored bit-for-bit in `lib/arena/ai.ts` / `policy.ts`. Behavioral scenario F
proves the features fire and are direction-controllable (a negative
`rival_demand_weight` makes the CPU actively avoid bidding wars).

**Result (honest):** across three seeds and a directed single-dimension probe,
the expanded search did **not** beat v6 on real games — some directions tied,
two hurt (−0.12). This 1v1 open-information auction already bounds competition via
the budget-reserve rules and prices it implicitly via the lookahead planner, so
explicit opponent modeling adds believable behavior but no win-rate gain here. It
would matter more in multi-team or hidden-information auctions. Nothing was
promoted; v6 remains champion. Details in `EXPANDED_POLICY_REPORT.md`.

---

# Hierarchical bidding strategy (timing, not valuation)

Because expanding *valuation* features didn't beat v6, the next experiment
changed *what* is learned: a **strategy head** that decides **how** to bid toward
the (fixed) valuation ceiling — escalation size, waiting, early-passing, and
reacting to an opponent's escalation.

- Valuation (`walk_away_price`) is **frozen** at v6; the search runs
  `--strategy-only` (strategy first, valuation second).
- Four interpretable, deterministic strategy params — `jump_bid_frac`,
  `hold_threshold`, `early_pass_margin`, `response_aggression` — all **no-op at
  neutral** (verified: 0/240 decisions differ from v6, identical rosters), and
  mirrored bit-for-bit in `lib/arena/ai.ts`.
- Bounded against collapse (a waiting policy can't strand its roster; jumps fall
  back to legal raises), judged by the same paired-CRN real-game evaluator.

Run it:

```bash
python -m auction_ai.training.challenger --strategy-only \
    --candidates 24 --proxy-scenarios 16 --gt-scenarios 3 \
    --ladder 150 400 --seed 7 --budgets 25
```

**Result (honest):** no timing strategy beat v6. A directed probe showed the
aggressive knobs (`jump`, `response`) are **outcome-neutral** (Δ = 0.000 — they
reach the same player, just differently) and the passive knobs (`early_pass`,
conceding) are **worse** (−0.08 to −0.20). This is structural: in a **1v1,
ascending, open-information** auction the winner is set by *valuation*, not
timing — there's no third party to bluff and no hidden information. Timing pays
off in multi-party, sealed-bid, or hidden-budget formats. Details in
`STRATEGY_POLICY_REPORT.md`. v6 remains champion; nothing shipped.
