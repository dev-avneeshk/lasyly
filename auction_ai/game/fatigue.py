"""Stamina / rotation helpers — faithful port of the fatigue logic in
lib/arena/simulation.ts (decayStamina, creditMinutes, manageRotation,
fatigueFactor)."""
from __future__ import annotations

from typing import Callable, List

from ..simulation.player_model import Player


def fatigue_factor(stamina: float) -> float:
    """1.0 fresh → ~0.86 gassed. Port of fatigueFactor()."""
    return 0.86 + (stamina / 100) * 0.14


def decay_stamina(team) -> None:
    """On-court -0.6 (floor 35), bench +1.4 (cap base stamina). Port of
    decayStamina()."""
    for p in team.players:
        base = p.owned.player.attributes["stamina"]
        if p.on_court:
            p.stamina = max(35.0, p.stamina - 0.6)
        else:
            p.stamina = min(base, p.stamina + 1.4)


def credit_minutes(team, seconds: float) -> None:
    for p in team.players:
        if p.on_court:
            p.box_min += seconds / 60


def manage_rotation(team, rng: Callable[[], float], clutch: bool) -> None:
    """Bench the most-tired starter periodically. Faithful port of
    manageRotation() — preserves RNG consumption order/branches."""
    if team.bench is None:
        return
    on_court = [p for p in team.starters if p.on_court]
    benched = next((p for p in team.starters if not p.on_court), None)

    if team.bench.on_court:
        rested = benched
        if rested is not None:
            bench_is_stopper = team.bench.owned.player.attributes["perimeterDefense"] >= 82
            keep_bench = (bench_is_stopper and rng() < 0.5) if clutch else (rng() < 0.35)
            if not keep_bench:
                team.bench.on_court = False
                rested.on_court = True
        return

    if not on_court:
        return
    tired = sorted(on_court, key=lambda p: p.stamina)[0]
    should_sub = (tired.stamina < 55) if clutch else (tired.stamina < 68 or rng() < 0.25)
    if should_sub:
        tired.on_court = False
        team.bench.on_court = True
