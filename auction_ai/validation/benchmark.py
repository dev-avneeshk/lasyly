"""Final benchmark: CURRENT PRODUCTION CPU vs NEW LEARNED CPU (spec §25, §26).

Runs on the unseen TEST partition (never used for training or calibration). The
new policy ships only if it shows a meaningful, statistically-supported real-game
improvement while keeping believable behavior and zero hard-rule violations.

CLI:
    python -m auction_ai.validation.benchmark \
        --new auction_ai/models/ground_truth/best_ground_truth_policy.json \
        --games 200 --scenarios 40
"""
from __future__ import annotations

import argparse
import json
import os
from typing import List, Tuple

from ..ai.policy import Policy
from ..game import SIMULATION_VERSION
from ..game.game_simulator import difficulty_edge, simulate_game
from ..simulation.roster import Roster, is_roster_complete, ordered_roster
from ..training.ground_truth import build_rosters, wilson_interval
from ..training.scenarios import generate_scenarios, Scenario
from .behavioral import evaluate_behavior, passes_guardrail

_ROOT = os.path.dirname(os.path.dirname(__file__))
PROD_POLICY = os.path.join(_ROOT, "..", "lib", "arena", "data", "cpu-policy.json")
NEW_DEFAULT = os.path.join(_ROOT, "models", "ground_truth", "best_ground_truth_policy.json")


def _load(path: str) -> Policy:
    with open(path, "r", encoding="utf-8") as fh:
        return Policy.from_dict(json.load(fh))


def _hard_rule_violations(roster: Roster, budget: int) -> int:
    v = 0
    if not is_roster_complete(roster):
        v += 1
    owned = ordered_roster(roster)
    if sum(o.price for o in owned) > budget:
        v += 1
    ids = [o.player.id for o in owned]
    if len(ids) != len(set(ids)):
        v += 1
    return v


def head_to_head_real(
    new: Policy, prod: Policy, scenarios: List[Scenario], games: int
) -> dict:
    """New vs Prod head-to-head on REAL games, seat-balanced, with total-games
    Wilson CI. Also counts hard-rule violations across all built rosters."""
    new_wins = 0
    total = 0
    violations = 0
    for scn in scenarios:
        season = scn.config().season
        budget = scn.budget
        # New = P1, Prod = P2
        r_new, r_prod = build_rosters(scn, new, prod, hero_seat="P1")
        violations += _hard_rule_violations(r_new, budget) + _hard_rule_violations(r_prod, budget)
        edges = {"P1": difficulty_edge(scn.difficulty_p1), "P2": difficulty_edge(scn.difficulty_p2)}
        for g in range(games):
            seed = (scn.seed + g * 2654435761) & 0xFFFFFFFF
            res = simulate_game(r_new, r_prod, season, seed, edges)
            if res.winner == "P1":
                new_wins += 1
            total += 1
        # Reverse seats to cancel any seat bias: New = P2, Prod = P1
        r_prod2, r_new2 = build_rosters(scn, prod, new, hero_seat="P1")
        violations += _hard_rule_violations(r_new2, budget) + _hard_rule_violations(r_prod2, budget)
        edges2 = {"P1": difficulty_edge(scn.difficulty_p1), "P2": difficulty_edge(scn.difficulty_p2)}
        for g in range(games):
            seed = (scn.seed + 7 + g * 40503) & 0xFFFFFFFF
            res = simulate_game(r_prod2, r_new2, season, seed, edges2)
            if res.winner == "P2":
                new_wins += 1
            total += 1
    lo, hi = wilson_interval(new_wins, total)
    return {"new_win_rate": new_wins / max(1, total), "games": total, "ci": (lo, hi), "violations": violations}


def main() -> None:
    ap = argparse.ArgumentParser(description="Final TEST-set benchmark: production vs new CPU.")
    ap.add_argument("--prod", default=PROD_POLICY, help="current production policy JSON")
    ap.add_argument("--new", default=NEW_DEFAULT, help="new candidate policy JSON")
    ap.add_argument("--scenarios", type=int, default=40)
    ap.add_argument("--games", type=int, default=150)
    ap.add_argument("--seed", type=int, default=777)
    args = ap.parse_args()

    prod = _load(args.prod) if os.path.exists(args.prod) else Policy.default()
    if not os.path.exists(args.new):
        raise SystemExit(f"No new policy at {args.new}. Train first (train_gt).")
    new = _load(args.new)

    # UNSEEN test partition — never touched by training or calibration.
    test = generate_scenarios(args.scenarios, master_seed=args.seed, partition="test")
    print(f"Final benchmark on {len(test)} unseen TEST scenarios "
          f"(SIMULATION_VERSION={SIMULATION_VERSION})")
    print(f"  production policy v{prod.version}  vs  new policy v{new.version}\n")

    h2h = head_to_head_real(new, prod, test, args.games)
    beh_new = evaluate_behavior(new)
    beh_prod = evaluate_behavior(prod)

    lo, hi = h2h["ci"]
    print(f"  head-to-head REAL-game win rate (new vs production): {h2h['new_win_rate']:.3f} "
          f"[{lo:.3f}, {hi:.3f}] over {h2h['games']} games")
    print(f"  behavior score:   new={beh_new.total:.2f} ({'ok' if passes_guardrail(beh_new) else 'FAIL'})  "
          f"production={beh_prod.total:.2f}")
    print(f"  hard-rule violations across all built rosters: {h2h['violations']}")

    # Ship criteria (spec §26): meaningful improvement (CI low > 0.5), behavior
    # guardrail passes, zero hard-rule violations.
    meaningful = lo > 0.5
    ship = meaningful and passes_guardrail(beh_new) and h2h["violations"] == 0
    print()
    if ship:
        print("  VERDICT: SHIP ✓ — new CPU beats production with statistical confidence, "
              "believable behavior, and zero hard-rule violations.")
    elif h2h["violations"] > 0:
        print("  VERDICT: DO NOT SHIP ✗ — hard-rule violations detected.")
    elif not passes_guardrail(beh_new):
        print("  VERDICT: DO NOT SHIP ✗ — behavior guardrail failed (wins but bids absurdly).")
    elif not meaningful:
        print(f"  VERDICT: HOLD — win rate {h2h['new_win_rate']:.3f} not confidently above 0.5 "
              f"(CI low {lo:.3f}). Need more games or more training before shipping.")
    raise SystemExit(0 if ship else 1)


if __name__ == "__main__":
    main()
