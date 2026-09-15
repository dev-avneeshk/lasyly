"""Measure proxy-vs-real-game correlation (spec §4, §9, §10).

Quantifies how well the cheap proxy reward predicts real-game win rate across a
set of diverse policies. Low/negative correlation is the evidence that motivates
using ground truth; high correlation means the proxy is a safe fast filter.

CLI:
    python -m auction_ai.validation.proxy_correlation --policies 24 --games 120
"""
from __future__ import annotations

import argparse
import random
from typing import List

from ..ai.policy import DEFAULT_WEIGHTS, Policy
from ..training.evaluation import benchmark_policy
from ..training.ground_truth import (
    evaluate_policy_ground_truth,
    pearson,
    spearman,
)
from ..training.scenarios import generate_scenarios


def random_policy(rng: random.Random, version: int) -> Policy:
    p = Policy.default()
    p.version = version
    for k in list(p.weights.keys()):
        if k in ("age_weight", "potential_weight"):
            continue
        p.weights[k] = round(rng.uniform(0.2, 2.2), 3)
    return p


def main() -> None:
    ap = argparse.ArgumentParser(description="Proxy-vs-real correlation diagnostic.")
    ap.add_argument("--policies", type=int, default=20)
    ap.add_argument("--scenarios", type=int, default=40)
    ap.add_argument("--games", type=int, default=120)
    ap.add_argument("--seed", type=int, default=123)
    args = ap.parse_args()

    rng = random.Random(args.seed)
    baseline = Policy.default()

    # A spread of policies: the baseline + random ones, so proxy and real scores
    # both vary enough to correlate meaningfully.
    policies: List[Policy] = [baseline] + [random_policy(rng, i + 1) for i in range(args.policies - 1)]

    # Fixed scenario set (validation partition) shared across all policies.
    scenarios = generate_scenarios(args.scenarios, master_seed=args.seed + 1, partition="validation")

    proxy_scores: List[float] = []
    real_wr: List[float] = []
    rows = []
    for i, pol in enumerate(policies):
        proxy = benchmark_policy(pol, scenarios, opponent=baseline).reward
        gt = evaluate_policy_ground_truth(
            pol, baseline, scenarios, games_per_matchup=args.games
        )
        proxy_scores.append(proxy)
        real_wr.append(gt.win_rate)
        rows.append((i, proxy, gt.win_rate, gt.ci_low, gt.ci_high))
        print(f"policy {i:2d}: proxy={proxy:8.2f}  real_wr={gt.win_rate:.3f} "
              f"[{gt.ci_low:.3f},{gt.ci_high:.3f}]")

    sp = spearman(proxy_scores, real_wr)
    pe = pearson(proxy_scores, real_wr)
    print(f"\nProxy → real-game win rate correlation over {len(policies)} policies:")
    print(f"  Spearman (rank agreement): {sp:+.3f}")
    print(f"  Pearson  (linear):         {pe:+.3f}")
    if sp < 0.3:
        print("  ! Weak/negative ranking agreement — proxy is a POOR selector; "
              "ground-truth evaluation is essential (this is exactly the mismatch to fix).")
    elif sp < 0.6:
        print("  Moderate agreement — proxy is a usable FAST FILTER but must be "
              "confirmed by ground truth.")
    else:
        print("  Strong agreement — proxy tracks real games well; still verify with ground truth.")


if __name__ == "__main__":
    main()
