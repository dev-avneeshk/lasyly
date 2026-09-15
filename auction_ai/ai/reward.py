"""Reward system (spec §6/§7).

Rewards are computed per-team from the FINISHED auction, but decomposed into
context-aware components so a decision can be judged good or bad on its own
merits — not just by whether the team won the final game. The components mirror
the spec's list:

  + value purchase (paid at/below fair value)
  + team fit / roster quality (via the team-profile port)
  + fills critical need
  + maintains financial room / low waste
  - major overpay
  - poor positional fit / incomplete roster
  - wasted budget early

The scalar `total` is what the learner maximizes; the components are surfaced in
metrics for explainability and debugging.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List

from ..simulation.auction_state import ArenaState
from ..simulation.player_model import Player, players_by_id
from ..simulation.roster import Roster, ordered_roster
from ..simulation.team_simulator import build_team_profile, team_strength
from ..simulation.value import player_value, scaled_opening_bid


@dataclass
class RewardBreakdown:
    roster_quality: float = 0.0
    value_efficiency: float = 0.0
    overpay_penalty: float = 0.0
    budget_waste_penalty: float = 0.0
    positional_balance: float = 0.0
    completeness: float = 0.0
    total: float = 0.0
    extras: Dict[str, float] = field(default_factory=dict)


def _fair_value(p: Player, budget: int, roster_size: int) -> float:
    """A fair acquisition price ≈ contested opener. Same basis the CPU plans on."""
    return scaled_opening_bid(p, budget, roster_size) * 1.15


def evaluate_team(state: ArenaState, team: str) -> RewardBreakdown:
    roster: Roster = state.rosters[team]
    cfg = state.config_for(team)
    budget = cfg.budget_per_player
    profile = build_team_profile(team, roster)

    b = RewardBreakdown()

    # Roster quality: the team-strength scalar (0..99-ish), normalized.
    b.roster_quality = team_strength(profile)

    owned = ordered_roster(roster)
    spent = sum(o.price for o in owned)

    # Value efficiency: total player_value acquired per dollar committed. This is
    # CAPPED because "spend almost nothing, get auto-filled scrubs" would
    # otherwise show fake-infinite efficiency (reward hacking). We measure
    # efficiency against the budget actually available, and clamp it.
    total_value = sum(player_value(o.player) for o in owned)
    # value per dollar of the FULL budget (not just what was spent), so hoarding
    # cash is not rewarded as "efficient".
    b.value_efficiency = min(3.0, total_value / max(1, budget))

    overpay = 0.0
    for o in owned:
        if o.price <= 1:
            continue  # auto-fill / min bids aren't overpays
        fair = _fair_value(o.player, budget, cfg.roster_size)
        if o.price > fair:
            overpay += (o.price - fair) / max(1.0, fair)
    b.overpay_penalty = overpay

    # Budget waste: money left on the table once the roster is complete is dead
    # value (you could have upgraded a slot). Penalize proportionally.
    leftover = max(0, budget - spent)
    b.budget_waste_penalty = leftover / max(1, budget)

    # Positional balance: reward two-way balance (offense vs defense not lopsided).
    b.positional_balance = 1 - abs(profile.offense - profile.defense) / 99

    # Completeness: did the team win real players, or get stuck with $1 auto-fill
    # scrubs? A roster full of auto-fills means the bidding strategy failed to
    # compete — a strong negative signal.
    autofills = sum(1 for o in owned if o.price <= 1)
    b.completeness = 1 - autofills / max(1, len(owned))

    # Blend into a single scalar. ROSTER QUALITY dominates (it's what the win
    # model integrates), with efficiency/overpay/waste as shaping terms. The
    # completeness term strongly punishes strategies that fail to buy real
    # players and get auto-filled. (spec §7: a decision can be good or bad on its
    # own merits, not just via the final winner.)
    b.total = (
        b.roster_quality * 2.0
        + b.value_efficiency * 6.0
        + b.positional_balance * 6.0
        + b.completeness * 20.0
        - b.overpay_penalty * 6.0
        - b.budget_waste_penalty * 6.0
    )
    b.extras = {
        "spent": float(spent),
        "leftover": float(leftover),
        "total_value": float(total_value),
        "offense": profile.offense,
        "defense": profile.defense,
        "chemistry": profile.chemistry,
        "usage_overlap": profile.usage_overlap,
    }
    return b
