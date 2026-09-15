"""Drives a complete self-play auction to the finished-roster state.

This reproduces the production server's settlement without a wall clock: on each
lot, non-leader seats are polled in turn for a raise; when a full round passes
with no raise, the lot resolves (the "going once… SOLD" beat). Both seats are
driven by (possibly different) policies — this is the CPU self-play core.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from ..ai.policy import Decision, Policy, decide
from .auction import create_game, open_next_lot, place_bid, resolve_lot
from .auction_state import ArenaState, GameConfig, TEAMS


class AuctionOutcome:
    def __init__(self, state: ArenaState, decisions: List[dict]):
        self.state = state
        self.decisions = decisions  # per-decision log (for reward assignment)


def run_auction(
    game_id: str,
    config: GameConfig,
    policies: Dict[str, Policy],
    *,
    seat_configs: Optional[Dict[str, GameConfig]] = None,
    seed: Optional[int] = None,
    record_decisions: bool = True,
    debug: bool = False,
    max_rounds: int = 1200,
) -> AuctionOutcome:
    """Play one full auction. `policies` maps seat → Policy; `seat_configs`
    optionally overrides personality/difficulty per seat for self-play."""
    state = create_game(game_id, config, seed=seed)
    if seat_configs:
        state.seat_config = dict(seat_configs)

    decisions: List[dict] = []
    open_next_lot(state)

    rounds = 0
    consecutive_unsold = 0
    # If neither seat will bid on this many lots in a row, the board is stuck in
    # a re-offer cycle (a very passive policy). Rather than churn through all
    # MAX_REOFFERS × lots, finalize — the engine auto-fills any empty slots,
    # which is the same legal terminal state the real server reaches when the
    # board dies. This bounds the wall-time cost of degenerate policies without
    # changing the outcome of a normal, competitive auction.
    from .auction import finalize_auction

    while state.status == "auction" and state.lot is not None and rounds < max_rounds:
        rounds += 1
        acted = False
        # Poll each non-leader seat once (mirrors driveAI's single pass).
        for team in TEAMS:
            if state.lot is None:
                break
            if state.lot.high_bidder == team:
                continue
            if is_full(state, team):
                continue
            d: Decision = decide(state, team, policies[team], debug=debug)
            if d.action == "bid":
                # Capture the pre-bid features for reward assignment.
                if record_decisions:
                    decisions.append(
                        {
                            "team": team,
                            "player_id": state.lot.player_id,
                            "amount": d.amount,
                            "current_bid": state.lot.current_bid,
                            "opening_bid": state.lot.opening_bid,
                            "explain": d.explain,
                        }
                    )
                res = place_bid(state, team, d.amount)
                if res.ok:
                    acted = True
        if not acted:
            # A full round with no raise → the lot settles. Award to the current
            # high bidder (or drop/re-offer if nobody bid), then open the next.
            had_bidder = state.lot.high_bidder is not None
            before = len(state.results)
            resolve_lot(state)
            sold = len(state.results) > before
            consecutive_unsold = 0 if (had_bidder and sold) else consecutive_unsold + 1
            if consecutive_unsold >= 30 and state.status == "auction":
                finalize_auction(state)
                break

    return AuctionOutcome(state=state, decisions=decisions)


def is_full(state: ArenaState, team: str) -> bool:
    from .roster import is_roster_complete

    return is_roster_complete(state.rosters[team])
