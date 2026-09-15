"""Diverse opponent pool (spec §13, §14).

Training/evaluating against a single fixed opponent overfits. This builds a
rotating pool of opponents spanning the engine's personality archetypes plus
previous policy versions, so a candidate must be robust across styles rather
than beating one bot.

A single Policy carries only strategy WEIGHTS; personality/difficulty live on the
per-seat GameConfig. So "an aggressive opponent" = the (default or prior) policy
weights played through an aggressive seat config, which the scenario's
seat_configs already control. Here we assemble the set of policy weight-vectors
to rotate through as opponents.
"""
from __future__ import annotations

from typing import List

from ..ai.policy import Policy


# The engine personalities that define opponent "archetypes" for diversity
# testing (spec §10). A candidate must not win overall by tanking one archetype.
ARCHETYPE_PERSONALITIES = {
    "aggressive": "aggressive",
    "balanced": "balanced",
    "defense": "defense",
    "value": "value",
    "star_chaser": "superstar",
    "offense": "offense",
}


def archetype_opponents(champion: Policy) -> List[tuple]:
    """Return [(archetype_name, opponent_policy)] spanning the engine's
    personality archetypes. The opponent uses the CHAMPION's weights (a strong,
    fixed reference) played through different personality seats — the personality
    is applied via the scenario opponent seat config at evaluation time.

    Using the champion's weights as the opponent brain means the challenger must
    beat a STRONG opponent in every style, not a dumb bot."""
    return [(name, champion) for name in ARCHETYPE_PERSONALITIES]


def build_opponent_pool(baseline: Policy, history_bests: List[Policy], k: int = 4) -> List[Policy]:
    """Assemble a diverse opponent set: the shipped baseline always, plus up to
    k-1 recent best policies (previous versions). Personalities/difficulties are
    applied via each scenario's seat config, so style diversity comes from the
    scenario generator; version diversity comes from here."""
    pool: List[Policy] = [baseline]
    # Add distinct recent versions (most recent first), de-duplicated by version.
    seen = {baseline.version}
    for p in reversed(history_bests):
        if p.version in seen:
            continue
        pool.append(p)
        seen.add(p.version)
        if len(pool) >= k:
            break
    return pool
