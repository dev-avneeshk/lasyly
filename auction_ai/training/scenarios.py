"""Scenario generation + randomization (spec §5, §14, §15).

A scenario is a fully-specified, reproducible auction setup: budget, bid
increment, per-seat difficulty/personality, and a seed. Randomization stays
inside REALISTIC ranges (no impossible NBA setups). We deterministically split
the scenario space into TRAIN / VALIDATION / TEST partitions by hashing the
seed, so validation/test scenarios are never trained on (overfitting guard).
"""
from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Dict, List, Optional

from ..simulation.auction_state import GameConfig
from ..simulation.rng import hash_seed

# Team "personalities" the spec asks for (§5). We map the spec's conceptual
# archetypes onto the engine's six supported personality tilts + difficulty so
# self-play covers a spread of strategies without inventing behaviors the
# production engine can't express.
ARCHETYPES: Dict[str, Dict[str, str]] = {
    "STAR_CHASER": {"personality": "superstar"},
    "VALUE_HUNTER": {"personality": "value"},
    "DEFENSE_FIRST": {"personality": "defense"},
    "OFFENSE_FIRST": {"personality": "offense"},
    "AGGRESSIVE": {"personality": "aggressive"},
    "CONSERVATIVE": {"personality": "value"},
    "POSITION_NEED": {"personality": "balanced"},
    "BALANCED": {"personality": "balanced"},
}

ARCHETYPE_NAMES: List[str] = list(ARCHETYPES.keys())

# All three production budget presets are represented. 25/50 are weighted more
# heavily than 100 — not only are they the common presets, the 100-league
# auction is ~7x more expensive to simulate, so this keeps training throughput
# high while still learning the big-budget dynamics.
BUDGETS = [25, 50, 100]
BUDGET_WEIGHTS = [5, 4, 2]
DIFFICULTIES = ["easy", "medium", "hard"]


@dataclass
class Scenario:
    game_id: str
    seed: int
    budget: int
    difficulty_p1: str
    difficulty_p2: str
    personality_p1: str
    personality_p2: str
    archetype_p1: str
    archetype_p2: str

    def config(self) -> GameConfig:
        return GameConfig(
            budget_per_player=self.budget,
            bid_increment=GameConfig.bid_increment_for_budget(self.budget),
            difficulty=self.difficulty_p1,
            ai_personality=self.personality_p1,
        )

    def seat_configs(self) -> Dict[str, GameConfig]:
        return {
            "P1": GameConfig(
                budget_per_player=self.budget,
                bid_increment=GameConfig.bid_increment_for_budget(self.budget),
                difficulty=self.difficulty_p1,
                ai_personality=self.personality_p1,
            ),
            "P2": GameConfig(
                budget_per_player=self.budget,
                bid_increment=GameConfig.bid_increment_for_budget(self.budget),
                difficulty=self.difficulty_p2,
                ai_personality=self.personality_p2,
            ),
        }


def _partition(seed: int) -> str:
    """Deterministic train/val/test split by seed hash (70/15/15)."""
    bucket = hash_seed(f"partition-{seed}") % 100
    if bucket < 70:
        return "train"
    if bucket < 85:
        return "validation"
    return "test"


def make_scenario(rng: random.Random, index: int) -> Scenario:
    seed = rng.randint(1, 2**31 - 1)
    budget = rng.choices(BUDGETS, weights=BUDGET_WEIGHTS, k=1)[0]
    # Difficulty is a self-play knob: mostly medium/hard so the ecosystem learns
    # against competent opponents, with occasional easy for robustness.
    diff_choices = ["medium", "medium", "hard", "hard", "easy"]
    arch_p1 = rng.choice(ARCHETYPE_NAMES)
    arch_p2 = rng.choice(ARCHETYPE_NAMES)
    return Scenario(
        game_id=f"scn-{seed}",
        seed=seed,
        budget=budget,
        difficulty_p1=rng.choice(diff_choices),
        difficulty_p2=rng.choice(diff_choices),
        personality_p1=ARCHETYPES[arch_p1]["personality"],
        personality_p2=ARCHETYPES[arch_p2]["personality"],
        archetype_p1=arch_p1,
        archetype_p2=arch_p2,
    )


def generate_scenarios(
    count: int,
    master_seed: int,
    partition: Optional[str] = None,
    budgets: Optional[List[int]] = None,
) -> List[Scenario]:
    """Generate `count` scenarios. If `partition` is given, only scenarios in
    that partition are returned (so train never overlaps val/test). If `budgets`
    is given, only scenarios with those league budgets are kept — used to keep a
    controlled experiment tractable (the $100 league is ~7x slower to simulate)."""
    rng = random.Random(master_seed)
    out: List[Scenario] = []
    guard = 0
    # Over-generate and filter by partition to hit the requested count.
    while len(out) < count and guard < count * 80 + 2000:
        guard += 1
        s = make_scenario(rng, guard)
        if partition is not None and _partition(s.seed) != partition:
            continue
        if budgets is not None and s.budget not in budgets:
            continue
        out.append(s)
    return out
