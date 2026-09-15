"""Team rating + head-to-head win model — port of lib/arena/teamRating.ts.

buildTeamProfile is a faithful port so the reward's notion of "roster quality"
matches exactly what the production simulation rewards (spacing, two-way
balance, usage-overlap tax, chemistry) rather than naive OVR-stacking.

win_probability is a compact, deterministic head-to-head model derived from the
two team profiles. The production app runs a richer play-by-play simulation; for
SELF-PLAY training we only need a fast, monotonic "which roster is better"
signal, and offense/defense differentials are exactly what that sim integrates.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Callable, List

from .roster import Roster, starters
from .player_model import Player


def _a(p: Player, key: str) -> int:
    return p.attributes[key]


def _avg(players: List[Player], f: Callable[[Player], float]) -> float:
    if not players:
        return 0.0
    return sum(f(p) for p in players) / len(players)


def _top_avg(players: List[Player], f: Callable[[Player], float], n: int) -> float:
    vals = sorted((f(p) for p in players), reverse=True)[:n]
    if not vals:
        return 0.0
    return sum(vals) / len(vals)


def _clamp(v: float, lo: float = 1, hi: float = 99) -> float:
    return max(lo, min(hi, v))


def _usage_overlap(players: List[Player]) -> float:
    usages = sorted((_a(p, "usage") for p in players), reverse=True)
    overlap = 0.0
    for i, u in enumerate(usages):
        weight = 0 if i < 2 else (i - 1) * 0.35
        overlap += max(0, u - 70) * weight
    return min(99.0, overlap / 2)


def _chemistry(players: List[Player], usage_overlap: float) -> float:
    spacing = _avg(players, lambda p: _a(p, "threePointShooting"))
    shooters = sum(1 for p in players if _a(p, "threePointShooting") >= 72)
    playmakers = sum(1 for p in players if _a(p, "playmaking") >= 78)
    rim_protect = _top_avg(players, lambda p: _a(p, "rimProtection"), 1)
    two_way = _avg(players, lambda p: min(_a(p, "perimeterDefense"), _a(p, "scoring")))

    score = 55.0
    score += (spacing - 60) * 0.35
    score += min(shooters, 4) * 3
    score += 6 if playmakers >= 1 else -8
    score += 6 if rim_protect >= 75 else (-8 if rim_protect < 55 else 0)
    score += (two_way - 55) * 0.15
    score -= usage_overlap * 0.35
    return _clamp(score)


@dataclass
class TeamProfile:
    team: str
    spacing: float
    offense: float
    perimeter_defense: float
    interior_defense: float
    rim_protection: float
    rebounding: float
    defense: float
    usage_overlap: float
    chemistry: float
    bench_strength: float
    transition_offense: float
    transition_defense: float
    overall: int


def build_team_profile(team: str, roster: Roster) -> TeamProfile:
    start = [o.player for o in starters(roster)]
    bench_owned = roster.slots["BENCH"]
    bench_player = bench_owned.player if bench_owned else None

    usage_overlap = _usage_overlap(start)
    chemistry = _chemistry(start, usage_overlap)

    spacing = _clamp(_avg(start, lambda p: _a(p, "threePointShooting")))
    shot_creation = _clamp(
        _top_avg(start, lambda p: _a(p, "scoring") * 0.6 + _a(p, "ballHandling") * 0.4, 3)
    )
    playmaking = _clamp(
        _top_avg(start, lambda p: _a(p, "playmaking"), 2) * 0.7
        + _avg(start, lambda p: _a(p, "passing")) * 0.3
    )
    rim_pressure = _clamp(
        _top_avg(start, lambda p: _a(p, "finishing") * 0.6 + _a(p, "athleticism") * 0.4, 3)
    )

    perimeter_defense = _clamp(_avg(start, lambda p: _a(p, "perimeterDefense")))
    interior_defense = _clamp(_top_avg(start, lambda p: _a(p, "interiorDefense"), 2))
    rim_protection = _clamp(
        _top_avg(start, lambda p: _a(p, "rimProtection"), 1) * 0.7
        + _avg(start, lambda p: _a(p, "block")) * 0.3
    )
    rebounding = _clamp(_avg(start, lambda p: _a(p, "rebounding")))

    chem_mult = 0.9 + (chemistry / 99) * 0.2

    raw_offense = shot_creation * 0.34 + spacing * 0.24 + playmaking * 0.2 + rim_pressure * 0.22
    offense = _clamp(raw_offense * chem_mult - usage_overlap * 0.12)

    raw_defense = (
        perimeter_defense * 0.32
        + interior_defense * 0.24
        + rim_protection * 0.24
        + rebounding * 0.2
    )
    defense = _clamp(raw_defense * (0.95 + (chemistry / 99) * 0.1))

    bench_strength = (
        _clamp(
            bench_player.overall * 0.6
            + (_a(bench_player, "perimeterDefense") + _a(bench_player, "scoring")) / 2 * 0.4
        )
        if bench_player
        else 40.0
    )

    transition_offense = _clamp(_avg(start, lambda p: _a(p, "speed") * 0.5 + _a(p, "athleticism") * 0.5))
    transition_defense = _clamp(
        _avg(start, lambda p: _a(p, "speed") * 0.4 + _a(p, "basketballIQ") * 0.3 + _a(p, "stamina") * 0.3)
    )

    overall = round((offense + defense) / 2)

    return TeamProfile(
        team=team,
        spacing=spacing,
        offense=offense,
        perimeter_defense=perimeter_defense,
        interior_defense=interior_defense,
        rim_protection=rim_protection,
        rebounding=rebounding,
        defense=defense,
        usage_overlap=usage_overlap,
        chemistry=chemistry,
        bench_strength=bench_strength,
        transition_offense=transition_offense,
        transition_defense=transition_defense,
        overall=overall,
    )


def usage_shares(roster: Roster) -> dict:
    """Effective per-player usage share for STARTERS after overlap. Port of
    usageShares() in teamRating.ts (weights = (usage/100)^1.6, normalized)."""
    start = starters(roster)
    weights = [(_a(o.player, "usage") / 100) ** 1.6 for o in start]
    total = sum(weights) or 1.0
    return {o.player.id: weights[i] / total for i, o in enumerate(start)}


def team_strength(profile: TeamProfile) -> float:
    """A single scalar strength: offense+defense blend plus a small bench and
    chemistry contribution. Used for win probability and roster-quality reward."""
    return (
        profile.offense * 0.44
        + profile.defense * 0.44
        + profile.bench_strength * 0.06
        + profile.chemistry * 0.06
    )


def win_probability(a: TeamProfile, b: TeamProfile, edge: float = 0.0) -> float:
    """Logistic on the strength differential. `edge` optionally advantages A
    (e.g. difficulty edge). Deterministic — no RNG — so self-play outcomes are
    reproducible given the rosters."""
    diff = (team_strength(a) - team_strength(b)) + edge
    return 1.0 / (1.0 + math.exp(-diff / 6.0))
