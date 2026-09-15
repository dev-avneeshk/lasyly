"""Two-stage policy selection (spec §11).

Stage 1 (cheap): score every candidate with the fast proxy reward; keep the top
fraction. Stage 2 (expensive): evaluate ONLY the survivors with the real game
simulator (ground truth) using common random seeds, and pick the winner by
actual win rate with a statistical-confidence tie-break.

This makes ground-truth evaluation affordable: e.g. 10,000 candidates → proxy →
top 500 → real games → top 50 (spec §11).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, List, Optional, Tuple

from ..training.evaluation import benchmark_policy
from ..training.ground_truth import evaluate_policy_ground_truth
from ..training.scenarios import Scenario
from .policy import Policy


@dataclass
class CandidateScore:
    policy: Policy
    proxy: float
    ground_truth_wr: Optional[float] = None
    ci_low: Optional[float] = None
    ci_high: Optional[float] = None
    avg_margin: Optional[float] = None
    evaluated_gt: bool = False


@dataclass
class SelectionResult:
    winner: Policy
    winner_score: CandidateScore
    proxy_ranked: List[CandidateScore]     # all candidates, proxy order
    survivors: List[CandidateScore]        # the ground-truth-evaluated subset
    proxy_hacking_detected: bool           # top-proxy != top-real


def two_stage_select(
    candidates: List[Policy],
    proxy_opponent: Policy,
    gt_opponent: Policy,
    proxy_scenarios: List[Scenario],
    gt_scenarios: List[Scenario],
    *,
    survivor_fraction: float = 0.2,
    min_survivors: int = 3,
    games_per_matchup: int = 120,
    proxy_score_fn: Optional[Callable[[Policy], float]] = None,
) -> SelectionResult:
    """Run the two-stage funnel and return the ground-truth winner.

    `proxy_score_fn` lets the caller inject a parallelized proxy scorer; if None
    we score serially with benchmark_policy.
    """
    # ── Stage 1: proxy filter ────────────────────────────────────────────────
    scored: List[CandidateScore] = []
    for pol in candidates:
        proxy = (
            proxy_score_fn(pol)
            if proxy_score_fn is not None
            else benchmark_policy(pol, proxy_scenarios, opponent=proxy_opponent).reward
        )
        scored.append(CandidateScore(policy=pol, proxy=proxy))

    scored.sort(key=lambda c: c.proxy, reverse=True)
    n_survivors = max(min_survivors, round(len(scored) * survivor_fraction))
    n_survivors = min(n_survivors, len(scored))
    survivors = scored[:n_survivors]

    # ── Stage 2: ground-truth on survivors (common random seeds) ─────────────
    for cs in survivors:
        gt = evaluate_policy_ground_truth(
            cs.policy, gt_opponent, gt_scenarios, games_per_matchup=games_per_matchup
        )
        cs.ground_truth_wr = gt.win_rate
        cs.ci_low = gt.ci_low
        cs.ci_high = gt.ci_high
        cs.avg_margin = gt.avg_margin
        cs.evaluated_gt = True

    # Winner = highest real-game win rate. Tie-break by avg margin then proxy so
    # we don't over-interpret win-rate noise (confidence handled by caller).
    survivors_by_gt = sorted(
        survivors,
        key=lambda c: (c.ground_truth_wr or 0.0, c.avg_margin or 0.0, c.proxy),
        reverse=True,
    )
    winner_score = survivors_by_gt[0]

    # Proxy hacking (spec §10): the best-by-proxy survivor is NOT the best-by-real.
    best_by_proxy = survivors[0]  # already proxy-sorted
    proxy_hacking = best_by_proxy is not winner_score

    return SelectionResult(
        winner=winner_score.policy,
        winner_score=winner_score,
        proxy_ranked=scored,
        survivors=survivors_by_gt,
        proxy_hacking_detected=proxy_hacking,
    )
