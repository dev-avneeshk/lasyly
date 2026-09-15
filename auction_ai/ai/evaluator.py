"""Evaluator: turns finished auctions into benchmark metrics (spec §16) and a
head-to-head self-play win signal (spec §9).

The evaluator is deliberately separate from the reward so we can benchmark a
policy on UNSEEN scenarios (validation/test) using the same metrics the reward
optimizes, and detect overfitting.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List

from ..simulation.auction_state import ArenaState
from ..simulation.team_simulator import build_team_profile, win_probability
from .reward import RewardBreakdown, evaluate_team


@dataclass
class GameEval:
    reward: Dict[str, RewardBreakdown]  # per team
    win_prob: Dict[str, float]          # per team, probability of beating the other


def evaluate_game(state: ArenaState, edges: Dict[str, float] | None = None) -> GameEval:
    edges = edges or {"P1": 0.0, "P2": 0.0}
    rb = {t: evaluate_team(state, t) for t in ("P1", "P2")}
    pa = build_team_profile("P1", state.rosters["P1"])
    pb = build_team_profile("P2", state.rosters["P2"])
    p1_win = win_probability(pa, pb, edge=edges.get("P1", 0.0) - edges.get("P2", 0.0))
    return GameEval(reward=rb, win_prob={"P1": p1_win, "P2": 1 - p1_win})


@dataclass
class Metrics:
    """Aggregated benchmark metrics across many games (spec §16)."""

    games: int = 0
    roster_score: float = 0.0
    value_efficiency: float = 0.0
    avg_overpay: float = 0.0
    positional_balance: float = 0.0
    avg_remaining_budget: float = 0.0
    avg_player_value: float = 0.0
    win_rate: float = 0.0  # of the policy-under-test seat in self-play
    reward: float = 0.0

    def as_dict(self) -> dict:
        return {
            "games": self.games,
            "roster_score": round(self.roster_score, 3),
            "value_efficiency": round(self.value_efficiency, 4),
            "avg_overpay": round(self.avg_overpay, 4),
            "positional_balance": round(self.positional_balance, 4),
            "avg_remaining_budget": round(self.avg_remaining_budget, 3),
            "avg_player_value": round(self.avg_player_value, 3),
            "win_rate": round(self.win_rate, 4),
            "reward": round(self.reward, 4),
        }


class MetricsAccumulator:
    """Accumulates per-game evals for ONE seat (the policy under test)."""

    def __init__(self):
        self.n = 0
        self.roster = 0.0
        self.eff = 0.0
        self.overpay = 0.0
        self.balance = 0.0
        self.rem = 0.0
        self.value = 0.0
        self.wins = 0.0
        self.reward = 0.0

    def add(self, ev: GameEval, seat: str, budget: int):
        rb = ev.reward[seat]
        self.n += 1
        self.roster += rb.roster_quality
        self.eff += rb.value_efficiency
        self.overpay += rb.overpay_penalty
        self.balance += rb.positional_balance
        self.rem += rb.extras.get("leftover", 0.0) / max(1, budget)
        self.value += rb.extras.get("total_value", 0.0)
        self.wins += ev.win_prob[seat]
        self.reward += rb.total

    def finalize(self) -> Metrics:
        n = max(1, self.n)
        return Metrics(
            games=self.n,
            roster_score=self.roster / n,
            value_efficiency=self.eff / n,
            avg_overpay=self.overpay / n,
            positional_balance=self.balance / n,
            avg_remaining_budget=self.rem / n,
            avg_player_value=self.value / n,
            win_rate=self.wins / n,
            reward=self.reward / n,
        )
