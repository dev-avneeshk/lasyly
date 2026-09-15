"""Benchmark a policy on a set of scenarios (spec §15/§16).

Runs a policy as seat P1 against a reference opponent (default policy) across a
partition of UNSEEN scenarios and aggregates the benchmark metrics. Used for
validation during training and for the `evaluate.py` CLI.
"""
from __future__ import annotations

from typing import Dict, List

from ..ai.evaluator import Metrics, MetricsAccumulator, evaluate_game
from ..ai.policy import Policy
from ..simulation.auction_simulator import run_auction
from .scenarios import Scenario


def benchmark_policy(
    policy: Policy,
    scenarios: List[Scenario],
    *,
    opponent: Policy | None = None,
    seat: str = "P1",
) -> Metrics:
    opponent = opponent or Policy.default()
    opp_seat = "P2" if seat == "P1" else "P1"
    acc = MetricsAccumulator()
    for scn in scenarios:
        policies = {seat: policy, opp_seat: opponent}
        out = run_auction(
            scn.game_id,
            scn.config(),
            policies,
            seat_configs=scn.seat_configs(),
            seed=scn.seed,
            record_decisions=False,
        )
        ev = evaluate_game(out.state)
        acc.add(ev, seat, scn.budget)
    return acc.finalize()


def head_to_head(
    policy_a: Policy,
    policy_b: Policy,
    scenarios: List[Scenario],
) -> Dict[str, float]:
    """Win rate of A vs B across scenarios (A=P1, B=P2). Also returns the
    reverse-seat win rate to control for any seat bias, and the average."""
    a_wins = 0.0
    a_wins_rev = 0.0
    for scn in scenarios:
        out = run_auction(
            scn.game_id, scn.config(), {"P1": policy_a, "P2": policy_b},
            seat_configs=scn.seat_configs(), seed=scn.seed, record_decisions=False,
        )
        a_wins += evaluate_game(out.state).win_prob["P1"]
        out2 = run_auction(
            scn.game_id, scn.config(), {"P1": policy_b, "P2": policy_a},
            seat_configs=scn.seat_configs(), seed=scn.seed, record_decisions=False,
        )
        a_wins_rev += evaluate_game(out2.state).win_prob["P2"]
    n = max(1, len(scenarios))
    return {
        "a_win_rate": a_wins / n,
        "a_win_rate_reversed_seat": a_wins_rev / n,
        "a_win_rate_avg": (a_wins + a_wins_rev) / (2 * n),
        "games": len(scenarios),
    }
