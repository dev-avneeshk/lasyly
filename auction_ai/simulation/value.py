"""Player value model — faithful port of lib/arena/value.ts.

Decouples *price* from raw OVR and provides the scoring primitives the CPU
policy (and the reward function) build on: offense/defense/spacing scores,
positional scarcity, and the budget-scaled opening bid.
"""
from __future__ import annotations

import math
from typing import Dict, List

from .player_model import POSITIONS, Player


def offense_score(p: Player) -> float:
    a = p.attributes
    return (
        a["scoring"] * 0.28
        + ((a["threePointShooting"] + a["midrange"] + a["finishing"]) / 3) * 0.22
        + a["playmaking"] * 0.18
        + a["efficiency"] * 0.16
        + (99 - a["turnoverRisk"]) * 0.06
        + a["ballHandling"] * 0.1
    )


def defense_score(p: Player) -> float:
    a = p.attributes
    return (
        a["perimeterDefense"] * 0.26
        + a["interiorDefense"] * 0.2
        + a["rimProtection"] * 0.16
        + a["steal"] * 0.14
        + a["block"] * 0.14
        + a["rebounding"] * 0.1
    )


def spacing_score(p: Player) -> float:
    return float(p.attributes["threePointShooting"])


def player_value(p: Player) -> int:
    off = offense_score(p)
    de = defense_score(p)
    balance = 1 - abs(off - de) / 100
    base = p.overall * 0.55 + off * 0.2 + de * 0.2
    return round(base * (0.9 + balance * 0.2))


def scarcity_by_position(pool: List[Player]) -> Dict[str, float]:
    counts = {pos: 0 for pos in POSITIONS}
    for p in pool:
        for pos in p.eligible_positions():
            counts[pos] += 1
    avg = (sum(counts.values()) / 5) or 1
    out = {pos: 1.0 for pos in POSITIONS}
    for pos in POSITIONS:
        c = counts[pos] or 1
        out[pos] = min(1.35, max(0.85, avg / c))
    return out


def scaled_opening_bid(
    p: Player, budget: int, roster_size: int, max_share: float | None = None
) -> int:
    """Budget-scaled opening bid — port of scaledOpeningBid() in value.ts."""
    slice_ = budget / roster_size
    t = max(0.0, min(1.0, (p.overall - 76) / 22))
    mult = 0.35 + (t ** 1.6) * 2.25
    price = slice_ * mult
    if max_share is None:
        share = 0.3 if budget <= 25 else 0.36 if budget <= 50 else 0.42
    else:
        share = max_share
    cap = max(2, math.floor(budget * share))
    price = min(cap, max(1, round(price)))
    return int(price)
