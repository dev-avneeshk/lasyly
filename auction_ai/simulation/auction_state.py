"""Auction state container — port of the ArenaState shape in lib/arena/auction.ts.

Two-seat (P1 vs P2) open-information auction. The simulator drives both seats
with CPU policies (self-play); there is no wall clock — lots resolve when bidding
settles or, in the simulator, deterministically by the "stand pat → timeout"
convention the production server uses.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

from .roster import Roster, empty_roster

TEAMS: List[str] = ["P1", "P2"]


def other_team(t: str) -> str:
    return "P2" if t == "P1" else "P1"


@dataclass
class AuctionLot:
    player_id: str
    current_bid: int
    high_bidder: Optional[str]  # "P1" | "P2" | None
    opening_bid: int


@dataclass
class BidRecord:
    player_id: str
    bidder: str
    amount: int


@dataclass
class AuctionResultRow:
    player_id: str
    winner: str
    price: int


@dataclass
class GameConfig:
    """Mirror of the relevant fields of ArenaGameConfig."""

    season: str = "2025-26"
    budget_per_player: int = 25  # (misnomer inherited from TS: it's the TEAM budget)
    roster_size: int = 6
    starters: int = 5
    bench: int = 1
    bid_increment: int = 1
    difficulty: str = "medium"  # easy | medium | hard
    ai_personality: str = "balanced"

    @staticmethod
    def bid_increment_for_budget(budget: int) -> int:
        if budget >= 100:
            return 5
        if budget >= 50:
            return 2
        return 1


@dataclass
class ArenaState:
    game_id: str
    seed: int
    season: str
    config: GameConfig
    queue: List[str]
    rosters: Dict[str, Roster] = field(
        default_factory=lambda: {"P1": empty_roster(), "P2": empty_roster()}
    )
    lot: Optional[AuctionLot] = None
    passed: List[str] = field(default_factory=list)
    history: List[BidRecord] = field(default_factory=list)
    results: List[AuctionResultRow] = field(default_factory=list)
    reoffers: Dict[str, int] = field(default_factory=dict)
    status: str = "auction"  # auction | lineup
    # Per-seat policy objects the simulator attaches (not part of the TS state).
    # Set by the simulator; keeps the engine itself policy-agnostic.
    seat_policy: Dict[str, object] = field(default_factory=dict)
    # Optional per-seat personality/difficulty overrides for self-play (so two
    # seats can differ). Falls back to config when a seat isn't overridden.
    seat_config: Dict[str, GameConfig] = field(default_factory=dict)

    def config_for(self, team: str) -> GameConfig:
        return self.seat_config.get(team, self.config)
