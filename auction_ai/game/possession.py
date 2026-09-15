"""Single-possession resolution — faithful port of simulatePossession() and its
helpers (chooseBallHandler, chooseAction, defenderFor, pickCreator, grabRebound,
weightedPick) from lib/arena/simulation.ts.

RNG-consumption ORDER is preserved as closely as possible so the Python sim
tracks the TS sim statistically. We do not require identical individual
possessions (language float/RNG differences make that impossible); the parity
harness validates statistical agreement instead.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Callable, List, Optional

from ..simulation.player_model import Player
from .matchup import matchup_edge

RNG = Callable[[], float]

# Shot-diet multipliers (port of ACTION_FREQ).
ACTION_FREQ = {"spotup": 2.05, "drive": 1.15, "pnr": 1.0, "pullup": 0.9, "iso": 0.7, "post": 0.5}
ASSIST_BY_ACTION = {"spotup": 1.45, "pnr": 1.2, "transition": 1.15, "post": 0.85, "drive": 0.8, "pullup": 0.5, "iso": 0.35}
TEAM_REBOUND_RATE = 0.085
REB_SLOT_BIAS = {"PG": 0.6, "SG": 0.7, "SF": 0.95, "PF": 1.2, "C": 1.32, "BENCH": 1.0}


def _clamp01(v: float) -> float:
    return max(0.0, min(1.0, v))


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _a(p: Player, k: str) -> int:
    return p.attributes[k]


def on_court_players(team) -> List:
    return [p for p in team.players if p.on_court]


def weighted_pick(arr: List, weight: Callable, rng: RNG):
    """Port of weightedPick() — iterates arr in order, matching TS."""
    if not arr:
        return None
    total = 0.0
    for item in arr:
        total += max(0.0, weight(item))
    if total <= 0:
        return arr[int(rng() * len(arr))]
    r = rng() * total
    for item in arr:
        r -= max(0.0, weight(item))
        if r <= 0:
            return item
    return arr[-1]


def _max_by(arr: List, score: Callable):
    best = None
    best_s = float("-inf")
    for item in arr:
        s = score(item)
        if s > best_s:
            best_s = s
            best = item
    return best


def choose_ball_handler(team, rng: RNG):
    court = on_court_players(team)
    weights = [p.usage * (0.6 + (p.stamina / 100) * 0.4) for p in court]
    total = sum(weights) or 1.0
    r = rng() * total
    for i in range(len(court)):
        r -= weights[i]
        if r <= 0:
            return court[i]
    return court[-1]


def choose_action(p: Player, transition: bool, rng: RNG) -> str:
    if transition:
        return "transition"
    a = p.attributes
    opts = [
        ("iso", (a["scoring"] * 0.5 + a["ballHandling"] * 0.5) * ACTION_FREQ["iso"]),
        ("pnr", (a["playmaking"] * 0.6 + a["ballHandling"] * 0.4) * ACTION_FREQ["pnr"]),
        ("post", (a["strength"] * 0.5 + a["finishing"] * 0.5) * ACTION_FREQ["post"]),
        ("spotup", a["threePointShooting"] * ACTION_FREQ["spotup"]),
        ("drive", (a["speed"] * 0.5 + a["finishing"] * 0.5) * ACTION_FREQ["drive"]),
        ("pullup", (a["midrange"] * 0.6 + a["threePointShooting"] * 0.4) * ACTION_FREQ["pullup"]),
    ]
    total = sum(max(1.0, w) for _, w in opts)
    r = rng() * total
    for k, w in opts:
        r -= max(1.0, w)
        if r <= 0:
            return k
    return "iso"


def defender_for(offense, dfn_team):
    slot = offense.owned.slot
    court = on_court_players(dfn_team)
    matched = next((d for d in court if d.owned.slot == slot), None)
    if matched:
        return matched
    if court:
        return court[len(court) // 2]
    return dfn_team.players[0]


def pick_creator(off, handler, rng: RNG):
    others = [p for p in on_court_players(off) if p is not handler]
    if not others:
        return None
    weights = [(_a(p.owned.player, "playmaking") / 100) ** 2 for p in others]
    total = sum(weights) or 1.0
    r = rng() * total
    for i in range(len(others)):
        r -= weights[i]
        if r <= 0:
            return others[i]
    return others[0]


def _rebound_weight(sp, offensive: bool) -> float:
    a = sp.owned.player.attributes
    ability = (max(1, a["rebounding"]) / 100) ** 1.55
    bias = REB_SLOT_BIAS.get(sp.owned.slot, 1.0)
    oreb_tilt = bias ** 1.5 if offensive else bias
    height = 0.75 + (a["strength"] / 100) * 0.25
    return ability * oreb_tilt * height * (0.55 + (sp.stamina / 100) * 0.45) + 0.05


def grab_rebound(off, dfn, rng: RNG) -> str:
    off_reb = off.profile.rebounding * 0.36
    def_reb = dfn.profile.rebounding
    off_p = off_reb / (off_reb + def_reb + 1)
    offensive = rng() < off_p
    team = off if offensive else dfn
    if rng() < TEAM_REBOUND_RATE:
        return "off" if offensive else "def"
    r = weighted_pick(on_court_players(team), lambda p: _rebound_weight(p, offensive), rng)
    if r:
        r.box_reb += 1
        team.box.reb += 1
    return "off" if offensive else "def"


@dataclass
class PossessionResult:
    points: int
    kind: str
    second_chance: bool


def simulate_possession(off, dfn, rng: RNG, clutch: bool, transition: bool) -> PossessionResult:
    handler = choose_ball_handler(off, rng)
    hp = handler.owned.player
    action = choose_action(hp, transition, rng)
    defender = defender_for(handler, dfn)
    dp = defender.owned.player

    fat = 0.86 + (handler.stamina / 100) * 0.14
    def_fat = 0.86 + (defender.stamina / 100) * 0.14

    edge, _, _ = matchup_edge(hp, dp)

    help_rim = dfn.profile.rim_protection
    help_perim = dfn.profile.perimeter_defense
    team_off = off.profile.offense
    team_def = dfn.profile.defense
    clutch_boost = (_a(hp, "clutch") - 60) * 0.15 if clutch else 0.0

    steal_pressure = _a(dp, "steal") + dfn.profile.perimeter_defense * 0.2
    to_chance = (
        0.072
        + (_a(hp, "turnoverRisk") / 100) * 0.10
        + (off.profile.usage_overlap / 100) * 0.05
        + (steal_pressure / 100) * 0.05
        - (_a(hp, "basketballIQ") / 100) * 0.04
    )
    to_chance = _clamp01(to_chance)
    if rng() < to_chance:
        handler.box_tov += 1
        off.box.tov += 1
        stolen = rng() < 0.32 + (_a(dp, "steal") / 100) * 0.3
        if stolen:
            def _sw(p):
                a = p.owned.player.attributes
                w = (max(1, a["steal"]) / 100) ** 1.6 * (0.7 + (a["perimeterDefense"] / 100) * 0.5)
                return (w * 2.2 if p is defender else w) + 0.04
            stealer = weighted_pick(on_court_players(dfn), _sw, rng)
            if stealer:
                stealer.box_stl += 1
                dfn.box.stl += 1
        return PossessionResult(0, "turnover", False)

    wants_three = (
        action == "spotup"
        or (action == "pullup" and _a(hp, "threePointShooting") >= _a(hp, "midrange") - 6)
        or (action == "pnr" and rng() < 0.42 and _a(hp, "threePointShooting") > 68)
        or (action == "iso" and rng() < 0.22 and _a(hp, "threePointShooting") > 74)
    )
    at_rim = action in ("drive", "transition", "post")

    creator = pick_creator(off, handler, rng)
    assist_base = 0.305 + (_a(creator.owned.player, "playmaking") / 100 if creator else 0) * 0.4
    assisted = bool(creator) and rng() < _clamp01(assist_base * ASSIST_BY_ACTION[action])

    if at_rim:
        rim_def = _max_by(on_court_players(dfn), lambda p: _a(p.owned.player, "rimProtection"))
        block_chance = _clamp01(
            ((_a(rim_def.owned.player, "rimProtection") + _a(rim_def.owned.player, "block")) / 2 - _a(hp, "finishing")) / 170 + 0.105
        )
        if rng() < block_chance:
            def _bw(p):
                a = p.owned.player.attributes
                w = (max(1, (a["block"] + a["rimProtection"]) / 2) / 100) ** 2.0
                return (w * 2.5 if p is rim_def else w) + 0.03
            blocker = weighted_pick(on_court_players(dfn), _bw, rng) or rim_def
            handler.box_fga += 1
            off.box.fga += 1
            blocker.box_blk += 1
            dfn.box.blk += 1
            reb = grab_rebound(off, dfn, rng)
            return PossessionResult(0, "miss", reb == "off")

    if wants_three:
        make_prob = (
            0.248
            + (_a(hp, "threePointShooting") - 60) / 260
            + edge / 500
            + (team_off - team_def) / 900
            + (0.05 if assisted else -0.01)
            - (help_perim - 60) / 700
        )
        make_prob += clutch_boost / 100
    elif at_rim:
        make_prob = (
            0.522
            + (_a(hp, "finishing") - 60) / 240
            + edge / 380
            - (help_rim - 55) / 420
            + (0.08 if transition else 0)
        )
        make_prob += clutch_boost / 120
    else:
        make_prob = (
            0.388
            + (_a(hp, "midrange") - 60) / 260
            + edge / 420
            + (team_off - team_def) / 1000
        )
        make_prob += clutch_boost / 110
    make_prob *= fat
    make_prob /= 0.97 + (1 - def_fat) * 0.06
    make_prob += off.edge - dfn.edge * 0.5
    make_prob = _clamp(make_prob, 0.05, 0.92)

    handler.box_fga += 1
    off.box.fga += 1
    if wants_three:
        handler.box_tpa += 1
        off.box.tpa += 1

    if rng() < make_prob:
        pts = 3 if wants_three else 2
        handler.box_fgm += 1
        off.box.fgm += 1
        handler.box_pts += pts
        off.score += pts
        off.box.points += pts
        if wants_three:
            handler.box_tpm += 1
            off.box.tpm += 1
        if at_rim and not wants_three:
            off.box.paint_points += pts
        if transition:
            off.box.fast_break_points += pts
        if assisted and creator:
            creator.box_ast += 1
            off.box.ast += 1
        if at_rim and not wants_three:
            and_one = _clamp01(0.085 + (_a(hp, "strength") / 100) * 0.05 + (_a(hp, "athleticism") / 100) * 0.04)
            if rng() < and_one:
                handler.box_fta += 1
                off.box.fta += 1
                if rng() < _a(hp, "freeThrow") / 100:
                    handler.box_ftm += 1
                    off.box.ftm += 1
                    handler.box_pts += 1
                    off.score += 1
                    off.box.points += 1
        return PossessionResult(pts, "made3" if wants_three else "made2", False)

    foul_prob = _clamp01(
        0.095
        + (_a(hp, "athleticism") / 100) * 0.055
        + (_a(hp, "strength") / 100) * 0.035
        + (0.12 if at_rim else 0)
        - (0.05 if wants_three else 0)
    )
    if rng() < foul_prob:
        shots = 3 if wants_three else 2
        made = 0
        for _ in range(shots):
            handler.box_fta += 1
            off.box.fta += 1
            if rng() < _a(hp, "freeThrow") / 100:
                made += 1
                handler.box_ftm += 1
                off.box.ftm += 1
        handler.box_fga -= 1
        off.box.fga -= 1
        if wants_three:
            handler.box_tpa -= 1
            off.box.tpa -= 1
        handler.box_pts += made
        off.score += made
        off.box.points += made
        if made < shots:
            reb = grab_rebound(off, dfn, rng)
            return PossessionResult(made, "ftonly", reb == "off")
        return PossessionResult(made, "ftonly", False)

    reb = grab_rebound(off, dfn, rng)
    return PossessionResult(0, "miss", reb == "off")
