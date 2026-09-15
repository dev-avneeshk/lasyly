# Expanded policy (opponent modeling) — did a richer state space beat v6?

**Short answer: no — but for an interesting and honest reason.** Expanding the
CPU's state/action space with opponent modeling, opportunity cost, and
auction-stage awareness did *not* produce a challenger that beats production v6
on real games. The new features are wired correctly and demonstrably change
behavior; they just don't help in *this* auction.

---

## What was added

The policy grew from 12 hand-designed coefficients to **17 learnable
parameters**, adding a richer state representation (all no-ops at their neutral
default, so v6 is reproduced exactly):

| new weight | reasons about | neutral |
|------------|---------------|:-------:|
| `rival_demand_weight` | does a rival both *can* and *would* want this lot? | 0 |
| `rival_desperation_weight` | how badly does the rival need this slot, given how few alternatives remain? | 0 |
| `snipe_weight` | is the lot *uncontested* (nobody else can take it) → buy cheap | 0 |
| `opportunity_cost_weight` | explicit penalty for spending now vs future needs | 0 |
| `auction_stage_weight` | early vs late auction aggression | 0 |

The opponent features are computed from **open information** the human also sees
(rosters, budgets, remaining queue), so they're cheap features, not a
simulation — safe for Vercel inference. They are implemented identically in
Python (`ai/policy.py`) and TypeScript (`ai.ts`), and verified as exact no-ops
at neutral: **480 walk-away decisions, 0 mismatches** vs a policy without them.

## The behavior is real (guardrail proof)

Scenario F (`opponent_modeling_response`) sets up the *same* lot in two worlds
that differ ONLY in the opponent's roster (contested+desperate vs full),
holding the queue fixed. Result:

- **v6 (neutral):** contested == uncontested → correctly unaffected.
- **opponent-averse policy (`rival_demand_weight = −1`):** bids $3 contested vs
  $7 uncontested → it actively *avoids bidding wars*. Detected and, here,
  flagged as reducing willingness.

So the feature genuinely fires and is direction-controllable. It is not dead code.

## But it doesn't beat v6

Champion/challenger over the expanded 17-dim space, mutation biased toward
medium/large so the new dimensions are actually explored, paired CRN vs v6
across six archetypes:

| seed | best Δ vs v6 | outcome |
|:----:|:------------:|---------|
| 7    | +0.0000 (a no-op mutation); best real challenger −0.0007 (CI straddles 0) | no promotion |
| 123  | +0.0000; all real mutations −0.04 to −0.06 | no promotion |

A **directed single-dimension probe** (each new term alone, paired vs v6):

| dimension | Δ vs v6 | reading |
|-----------|:-------:|---------|
| `rival_demand +0.8` | ≈ 0 (tie) | fires, no material gain |
| `rival_desperation +0.8` | 0.000 | rarely activates in these lots |
| `snipe +0.8` | 0.000 | rarely activates |
| `auction_stage −0.8` | ≈ 0 (tie) | fires, no material gain |
| `opportunity_cost +0.8` | **−0.12** | clearly worse |
| `auction_stage +0.8` | **−0.12** | clearly worse |

No direction of the new features produced a confident win-rate improvement over
v6; two pushed performance meaningfully *down*.

## Why (the honest interpretation)

This is a **1v1, open-information** auction. Two structural facts blunt the value
of opponent modeling here:

1. **The budget-reserve hard rules already bound competition.** You can never
   overspend, so "how desperate is my rival" can't be exploited by out-bidding
   into an illegal position.
2. **The existing lookahead already prices competition implicitly.** v6's
   walk-away uses "marginal value over the best *future* alternative for this
   slot" — which is essentially "will I get another shot at filling this need?"
   Much of what explicit opponent modeling would add is already captured.

Opponent modeling delivers the most value in **multi-team** or **hidden-
information** auctions (where you can't see budgets/rosters and there are more
rivals to read). In this specific game it's a correct, believable behavior that
happens not to move the win rate.

## Verdict

> **v6 remains champion.** The richer state space is implemented, mirrored in
> production TS, proven to change behavior, and available for the learner — but
> under strict paired, multi-archetype, real-game evaluation it did not beat v6,
> so nothing was promoted or shipped.

This is again the framework working as intended: it added genuine new capability,
tested whether it *actually* helps, and honestly reported that it doesn't here —
rather than shipping a more "sophisticated-looking" policy on faith.

## When this could pay off (not run here)

- **Change the game to expose the feature:** more than two teams, or hidden
  budgets/rosters, would make reading rivals genuinely valuable.
- **Wider/longer search:** these runs were tractable-scale (25-league, short
  ladder). A larger search with a 200→1k→5k→20k ladder on more compute might find
  a small combined-dimension gain the local probes missed.
- **Different champion:** if the player pool or game simulator changes, re-run —
  v6 is only a local optimum for the *current* game.

## Reproduce

```bash
# no-op verification (v6 reproduced with extended features present):
#   see the 480-decision parity check in the session notes
python -m auction_ai.training.challenger \
    --candidates 24 --proxy-scenarios 16 --gt-scenarios 3 \
    --ladder 150 400 --min-margin 0.01 --seed 7 --budgets 25
```
