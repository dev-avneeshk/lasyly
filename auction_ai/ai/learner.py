"""Policy learner (spec §8, §11, §12).

A gradient-free evolutionary strategy over the compact weight vector. Each
generation:

  1. Sample a POPULATION of candidate policies by perturbing the current best
     (Gaussian mutation whose scale = the exploration rate, which DECAYS over
     generations — spec §12).
  2. Evaluate each candidate by SELF-PLAY on a batch of TRAIN scenarios: the
     candidate plays seat P1, a fixed opponent (the current best) plays P2, so
     the ecosystem co-evolves rather than beating a dumb bot (spec §9).
  3. Score each candidate by mean reward (context-aware, spec §7).
  4. The best candidate becomes the parent of the next generation.

This is intentionally NOT a neural network — the search space is ~14 weights, so
ES converges fast, stays interpretable, and exports to a tiny JSON (spec §11).
"""
from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from ..simulation.auction_simulator import run_auction
from ..training.scenarios import Scenario
from .evaluator import evaluate_game
from .policy import DEFAULT_WEIGHTS, WEIGHT_KEYS, Policy

# Sane bounds so mutation can't drive a weight to an absurd value that breaks the
# (hard-constrained) auction math or produces degenerate strategies.
WEIGHT_BOUNDS: Tuple[float, float] = (0.0, 3.0)

# The extended opponent-modeling / timing terms are ADDITIVE and neutral at 0, so
# a NEGATIVE value is meaningful (e.g. "avoid bidding wars", "buy early not late").
# They get a symmetric range so the search can discover either direction.
_SIGNED_KEYS = (
    "rival_demand_weight", "rival_desperation_weight", "snipe_weight",
    "opportunity_cost_weight", "auction_stage_weight",
)
_SIGNED_BOUNDS: Tuple[float, float] = (-2.0, 2.0)


@dataclass
class LearnerConfig:
    population: int = 12
    exploration_start: float = 0.35
    exploration_end: float = 0.05
    generations: int = 50


def _clamp_weights(w: Dict[str, float]) -> Dict[str, float]:
    lo, hi = WEIGHT_BOUNDS
    slo, shi = _SIGNED_BOUNDS
    out = {}
    for k, v in w.items():
        if k in _SIGNED_KEYS:
            out[k] = max(slo, min(shi, v))
        else:
            out[k] = max(lo, min(hi, v))
    return out


_FROZEN = ("age_weight", "potential_weight")


def mutate(parent: Policy, sigma: float, rng: random.Random) -> Policy:
    """Gaussian perturbation of the parent's weights. `sigma` is the exploration
    scale for this generation."""
    child = parent.clone()
    child.version = parent.version + 1
    for k in WEIGHT_KEYS:
        # Reserved (unused) weights stay pinned at their defaults so we don't
        # waste search budget on parameters with no data behind them yet.
        if k in _FROZEN:
            continue
        child.weights[k] = parent.weights[k] + rng.gauss(0.0, sigma)
    child.weights = _clamp_weights(child.weights)
    return child


@dataclass
class MutationMix:
    """Tiered mutation around a strong champion (spec §2). Most candidates stay
    close; a few explore wider. All sigmas configurable."""

    small_sigma: float = 0.06
    medium_sigma: float = 0.18
    large_sigma: float = 0.45
    small_frac: float = 0.80
    medium_frac: float = 0.15
    # large_frac is the remainder (≈0.05)

    def pick_sigma(self, rng: random.Random) -> float:
        r = rng.random()
        if r < self.small_frac:
            return self.small_sigma
        if r < self.small_frac + self.medium_frac:
            return self.medium_sigma
        return self.large_sigma


def mutate_around(champion: Policy, mix: MutationMix, rng: random.Random) -> Policy:
    """One tiered mutation around the champion. Used by the champion/challenger
    search to explore the LOCAL neighborhood of an already-strong policy."""
    sigma = mix.pick_sigma(rng)
    return mutate(champion, sigma, rng)


def mutate_pair(parent: Policy, sigma: float, rng: random.Random) -> tuple[Policy, Policy]:
    """Antithetic sampling: draw one perturbation ε and return parent+ε and
    parent-ε. Evaluating mirrored pairs cancels a lot of scenario noise and gives
    a cleaner ascent direction than independent samples."""
    pos = parent.clone()
    neg = parent.clone()
    pos.version = neg.version = parent.version + 1
    for k in WEIGHT_KEYS:
        if k in _FROZEN:
            continue
        eps = rng.gauss(0.0, sigma)
        pos.weights[k] = parent.weights[k] + eps
        neg.weights[k] = parent.weights[k] - eps
    pos.weights = _clamp_weights(pos.weights)
    neg.weights = _clamp_weights(neg.weights)
    return pos, neg


def evaluate_policy_on_scenarios(
    candidate: Policy,
    opponent: Policy,
    scenarios: List[Scenario],
    *,
    seat: str = "P1",
) -> float:
    """Mean reward for `candidate` (playing `seat`) against `opponent` across
    the given scenarios. Deterministic given the scenarios + policies."""
    opp_seat = "P2" if seat == "P1" else "P1"
    total = 0.0
    for scn in scenarios:
        policies = {seat: candidate, opp_seat: opponent}
        out = run_auction(
            scn.game_id,
            scn.config(),
            policies,
            seat_configs=scn.seat_configs(),
            seed=scn.seed,
            record_decisions=False,
        )
        ev = evaluate_game(out.state)
        # Fitness blends the context-aware roster reward (spec §7) with the
        # self-play head-to-head win signal (spec §9) so the learner is pushed to
        # build rosters that are both objectively good AND beat the current best.
        total += ev.reward[seat].total + ev.win_prob[seat] * 40.0
    return total / max(1, len(scenarios))


def exploration_for(gen: int, cfg: LearnerConfig) -> float:
    """Linearly anneal exploration from start → end over the generations."""
    if cfg.generations <= 1:
        return cfg.exploration_end
    frac = gen / (cfg.generations - 1)
    return cfg.exploration_start + (cfg.exploration_end - cfg.exploration_start) * frac
