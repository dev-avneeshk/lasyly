"""Budget math — faithful port of lib/arena/budget.ts.

The single most important safety rule of the auction: a team can never bid more
than it can afford while still keeping $1 for every remaining slot. The learning
system optimizes strategy INSIDE this constraint; it can never break it.
"""
from __future__ import annotations

from typing import Optional

from .player_model import MIN_BID
from .roster import Roster, open_slots


def spent(roster: Roster) -> int:
    return sum((o.price if o else 0) for o in roster.slots.values())


def remaining(total: int, roster: Roster) -> int:
    return total - spent(roster)


def max_affordable(total: int, roster: Roster) -> int:
    """Reserve MIN_BID for every OTHER open slot. Port of maxAffordable()."""
    open_ = len(open_slots(roster))
    if open_ == 0:
        return 0
    rem = remaining(total, roster)
    reserve = (open_ - 1) * MIN_BID
    return max(0, rem - reserve)


def validate_bid_amount(
    amount: int,
    current_bid: int,
    total: int,
    roster: Roster,
    allow_equal: bool = False,
) -> Optional[str]:
    """Return an error string, or None if the bid is legal. Port of
    validateBidAmount()."""
    if not float(amount).is_integer():
        return "Bids must be whole dollars."
    if amount < MIN_BID:
        return f"Minimum bid is ${MIN_BID}."
    if (amount < current_bid) if allow_equal else (amount <= current_bid):
        floor = current_bid if allow_equal else current_bid + 1
        return f"Bid must be at least ${floor}."
    mx = max_affordable(total, roster)
    if amount > mx:
        return f"You can only bid up to ${mx}."
    return None
