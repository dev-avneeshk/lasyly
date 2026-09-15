"""Matchup engine — faithful port of lib/arena/matchup.ts.

Assigns position-vs-position defensive matchups and scores each offensive
player's edge over their defender. The possession sim consumes `edge`.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from ..simulation.player_model import POSITIONS, Player
from ..simulation.roster import Roster, starters


def _a(p: Player, k: str) -> int:
    return p.attributes[k]


def matchup_edge(off: Player, dfn: Player) -> Tuple[float, str, str]:
    """Return (edge, kind, note). Port of matchupEdge()."""
    ao, ad = off.attributes, dfn.attributes
    weapons = [
        ("shooting", ao["threePointShooting"] * 0.6 + ao["midrange"] * 0.4, ad["perimeterDefense"]),
        ("iso", ao["scoring"] * 0.5 + ao["ballHandling"] * 0.5, ad["perimeterDefense"] * 0.6 + ad["athleticism"] * 0.4),
        ("post", ao["finishing"] * 0.5 + ao["strength"] * 0.5, ad["interiorDefense"] * 0.6 + ad["strength"] * 0.4),
        ("speed", ao["speed"] * 0.6 + ao["finishing"] * 0.4, ad["perimeterDefense"] * 0.5 + ad["speed"] * 0.5),
    ]
    weapons.sort(key=lambda w: w[1], reverse=True)
    primary = weapons[0]

    physical = 0.0
    if ao["speed"] - ad["speed"] > 15:
        physical += (ao["speed"] - ad["speed"]) * 0.2
    if ao["strength"] - ad["strength"] > 15 and ao["finishing"] > 70:
        physical += (ao["strength"] - ad["strength"]) * 0.15
    rim_tax = ad["rimProtection"] * 0.12 if primary[0] in ("speed", "post") else 0.0

    edge = (primary[1] - primary[2]) * 0.6 + physical - rim_tax
    edge = max(-40.0, min(40.0, edge))
    kind = "even" if abs(edge) < 6 else primary[0]
    return edge, kind, ""


@dataclass
class Matchup:
    offense: Player
    defense: Player
    position: str
    edge: float
    kind: str


@dataclass
class MatchupSet:
    matchups: List[Matchup]
    net_edge: float


def _starters_by_slot(roster: Roster) -> Dict[str, Optional[object]]:
    out: Dict[str, Optional[object]] = {p: None for p in POSITIONS}
    for o in starters(roster):
        if o.slot != "BENCH":
            out[o.slot] = o
    return out


def assign_matchups(off_roster: Roster, def_roster: Roster) -> MatchupSet:
    off_by_slot = _starters_by_slot(off_roster)
    def_by_slot = _starters_by_slot(def_roster)
    def_list = starters(def_roster)

    matchups: List[Matchup] = []
    net = 0.0
    for pos in POSITIONS:
        off = off_by_slot[pos]
        if off is None:
            continue
        dfn = def_by_slot[pos]
        if dfn is None:
            dfn = def_list[0] if def_list else None
        if dfn is None:
            continue
        edge, kind, _ = matchup_edge(off.player, dfn.player)
        matchups.append(Matchup(off.player, dfn.player, pos, edge, kind))
        net += edge
    return MatchupSet(matchups=matchups, net_edge=net)
