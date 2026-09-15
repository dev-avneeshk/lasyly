"""Roster state + slot rules — faithful port of lib/arena/roster.ts.

This is where player uniqueness and the starters-before-bench rule live. The
learning system may NEVER override these; they are hard auction constraints.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

from .player_model import POSITIONS, ROSTER_SLOTS, Player


@dataclass
class OwnedPlayer:
    player: Player
    price: int
    slot: str


@dataclass
class Roster:
    """slots maps each RosterSlot → OwnedPlayer | None."""

    slots: Dict[str, Optional[OwnedPlayer]] = field(
        default_factory=lambda: {s: None for s in ROSTER_SLOTS}
    )

    def clone(self) -> "Roster":
        return Roster(slots=dict(self.slots))


def empty_roster() -> Roster:
    return Roster()


def can_fill_slot(player: Player, slot: str) -> bool:
    if slot == "BENCH":
        return True
    return slot in player.eligible_positions()


def roster_count(roster: Roster) -> int:
    return sum(1 for s in ROSTER_SLOTS if roster.slots[s] is not None)


def is_roster_complete(roster: Roster) -> bool:
    return all(roster.slots[s] is not None for s in ROSTER_SLOTS)


def open_slots(roster: Roster) -> List[str]:
    return [s for s in ROSTER_SLOTS if roster.slots[s] is None]


def open_starter_slots(roster: Roster) -> List[str]:
    return [p for p in POSITIONS if roster.slots[p] is None]


def owns_player(roster: Roster, player_id: str) -> bool:
    return any(
        roster.slots[s] is not None and roster.slots[s].player.id == player_id
        for s in ROSTER_SLOTS
    )


def owned_players(roster: Roster) -> List[Player]:
    return [o.player for o in roster.slots.values() if o is not None]


def best_slot_for(roster: Roster, player: Player) -> Optional[str]:
    for pos in player.eligible_positions():
        if roster.slots[pos] is None:
            return pos
    if roster.slots["BENCH"] is None:
        return "BENCH"
    return None


def auction_slot_for(roster: Roster, player: Player) -> Optional[str]:
    """Starters-before-bench: the bench is only legal once all five starter
    positions are accounted for. Port of auctionSlotFor()."""
    for pos in player.eligible_positions():
        if roster.slots[pos] is None:
            return pos
    if len(open_starter_slots(roster)) > 0:
        return None
    return "BENCH" if roster.slots["BENCH"] is None else None


def place_player(
    roster: Roster, player: Player, price: int, forced_slot: Optional[str] = None
) -> Roster:
    """Return a NEW roster with the player placed, or raise on illegal add."""
    if owns_player(roster, player.id):
        raise ValueError(f"Duplicate player: {player.name} already on roster.")
    slot = forced_slot if forced_slot is not None else best_slot_for(roster, player)
    if slot is None:
        raise ValueError(f"No legal roster slot for {player.name}.")
    if roster.slots[slot] is not None:
        raise ValueError(f"Slot {slot} already filled.")
    if not can_fill_slot(player, slot):
        raise ValueError(f"{player.name} cannot play {slot}.")
    new = roster.clone()
    new.slots[slot] = OwnedPlayer(player=player, price=price, slot=slot)
    return new


def can_add_player(roster: Roster, player: Player) -> bool:
    if owns_player(roster, player.id):
        return False
    return auction_slot_for(roster, player) is not None


def can_force_add_player(roster: Roster, player: Player) -> bool:
    if owns_player(roster, player.id):
        return False
    return best_slot_for(roster, player) is not None


def ordered_roster(roster: Roster) -> List[OwnedPlayer]:
    return [roster.slots[s] for s in ROSTER_SLOTS if roster.slots[s] is not None]


def starters(roster: Roster) -> List[OwnedPlayer]:
    return [roster.slots[p] for p in POSITIONS if roster.slots[p] is not None]
