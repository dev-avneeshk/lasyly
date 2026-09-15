"""Evaluate / benchmark a policy on UNSEEN test scenarios (spec §15/§16/§21).

Compares a trained policy against the deterministic baseline (default) policy on
the held-out TEST partition — never used in training — and reports the benchmark
metrics plus a head-to-head win rate.

CLI:
    python -m auction_ai.evaluate --policy auction_ai/models/best_policy.json --simulations 2000
    python -m auction_ai.evaluate --compare-baseline --simulations 2000
"""
from __future__ import annotations

import argparse
import json
import os

from .ai.policy import Policy
from .training.evaluation import benchmark_policy, head_to_head
from .training.scenarios import generate_scenarios

_ROOT = os.path.dirname(__file__)
BEST_PATH = os.path.join(_ROOT, "models", "best_policy.json")


def _load(path: str) -> Policy:
    with open(path, "r", encoding="utf-8") as fh:
        return Policy.from_dict(json.load(fh))


def main() -> None:
    ap = argparse.ArgumentParser(description="Evaluate a trained CPU policy on unseen scenarios.")
    ap.add_argument("--policy", default=BEST_PATH)
    ap.add_argument("--simulations", type=int, default=2000)
    ap.add_argument("--seed", type=int, default=99, help="scenario master seed (separate from training)")
    ap.add_argument("--compare-baseline", action="store_true", help="also run old-vs-new head-to-head")
    args = ap.parse_args()

    if not os.path.exists(args.policy):
        raise SystemExit(f"No policy at {args.policy}. Train and export first.")

    trained = _load(args.policy)
    baseline = Policy.default()

    # TEST partition: never seen during training (§15).
    test = generate_scenarios(args.simulations, master_seed=args.seed, partition="test")
    print(f"Evaluating policy v{trained.version} on {len(test)} unseen TEST scenarios...\n")

    trained_metrics = benchmark_policy(trained, test, opponent=baseline)
    baseline_metrics = benchmark_policy(baseline, test, opponent=baseline)

    def show(name: str, m) -> None:
        d = m.as_dict()
        print(f"{name:10s} | roster={d['roster_score']:.2f} eff={d['value_efficiency']:.3f} "
              f"overpay={d['avg_overpay']:.3f} balance={d['positional_balance']:.3f} "
              f"rem_budget={d['avg_remaining_budget']:.3f} win={d['win_rate']:.3f} reward={d['reward']:.2f}")

    show("TRAINED", trained_metrics)
    show("BASELINE", baseline_metrics)

    if args.compare_baseline:
        print("\nHead-to-head (TRAINED vs BASELINE, seat-balanced):")
        h2h = head_to_head(trained, baseline, test)
        print(f"  trained win rate: {h2h['a_win_rate_avg']:.3f} over {h2h['games']} scenarios "
              f"(P1 seat {h2h['a_win_rate']:.3f}, P2 seat {h2h['a_win_rate_reversed_seat']:.3f})")
        delta = trained_metrics.reward - baseline_metrics.reward
        print(f"\nReward improvement over baseline: {delta:+.2f} "
              f"({'better' if delta > 0 else 'worse'})")


if __name__ == "__main__":
    main()
