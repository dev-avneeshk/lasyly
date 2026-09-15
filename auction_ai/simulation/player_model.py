"""Player + constants model — port of the relevant parts of lib/arena/types.ts
and the season data loader.

Players are loaded from data/players.json, which is generated from the app's
canonical TypeScript pool (see data/README) so ratings are identical.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Dict, List

# ─── Positional / roster constants (mirror types.ts) ────────────────────────
POSITIONS: List[str] = ["PG", "SG", "SF", "PF", "C"]
ROSTER_SLOTS: List[str] = ["PG", "SG", "SF", "PF", "C", "BENCH"]

# ─── Auction constants (mirror auction.ts / budget.ts) ──────────────────────
MIN_BID = 1
MAX_LOTS = 26
MIN_PER_POSITION = 4
MAX_REOFFERS = 8

_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")


@dataclass(frozen=True)
class Player:
    """A season-scoped player. Frozen so it can be shared across simulations
    without accidental mutation. Mirrors SeasonPlayer in types.ts."""

    id: str
    name: str
    team: str
    season: str
    primary_position: str
    secondary_positions: List[str]
    overall: int
    tier: int
    starting_bid: int
    attributes: Dict[str, int]
    strengths: List[str] = field(default_factory=list)
    weaknesses: List[str] = field(default_factory=list)

    def eligible_positions(self) -> List[str]:
        """primary + secondary — port of roster.eligiblePositions()."""
        return [self.primary_position, *self.secondary_positions]

    def a(self, key: str) -> int:
        return self.attributes[key]


def _from_json(obj: dict) -> Player:
    return Player(
        id=obj["id"],
        name=obj["name"],
        team=obj["team"],
        season=obj["season"],
        primary_position=obj["primaryPosition"],
        secondary_positions=list(obj.get("secondaryPositions", [])),
        overall=obj["overall"],
        tier=obj["tier"],
        starting_bid=obj["startingBid"],
        attributes=dict(obj["attributes"]),
        strengths=list(obj.get("strengths", [])),
        weaknesses=list(obj.get("weaknesses", [])),
    )


@lru_cache(maxsize=None)
def get_season_players(season: str = "2025-26") -> List[Player]:
    """Load the player pool for a season. Cached so repeated simulations reuse
    the same immutable list. Mirrors data/index.ts getSeasonPlayers()."""
    path = os.path.join(_DATA_DIR, "players.json")
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    if data.get("season") != season:
        # Only one season is bundled; fall back rather than crash.
        pass
    return [_from_json(p) for p in data["players"]]


def players_by_id(season: str = "2025-26") -> Dict[str, Player]:
    return {p.id: p for p in get_season_players(season)}
