"""Auction lifecycle — faithful port of lib/arena/auction.ts.

Reproduces order building, lot selection, bidding, resolution, re-offers, and
end-of-auction auto-fill so the Python simulator plays by the EXACT rules the
production engine (and therefore real users) will experience.

The one intentional difference from the server: there is no wall clock. A CPU
that declines to raise "stands pat" (the same behavior as the live server's
driveAI), and the lot resolves once every biddable non-leader has effectively
declined. The simulator's drive loop (auction_simulator.py) reproduces the
"nobody will raise → resolve" settlement.
"""
from __future__ import annotations

from typing import Callable, Dict, List, Optional

from .auction_state import (
    ArenaState,
    AuctionLot,
    AuctionResultRow,
    BidRecord,
    GameConfig,
    TEAMS,
)
from .budget import max_affordable, remaining, validate_bid_amount
from .player_model import (
    MAX_LOTS,
    MAX_REOFFERS,
    MIN_BID,
    MIN_PER_POSITION,
    POSITIONS,
    Player,
    get_season_players,
    players_by_id,
)
from .rng import hash_seed, mulberry32, shuffle
from .roster import (
    auction_slot_for,
    can_add_player,
    can_force_add_player,
    empty_roster,
    is_roster_complete,
    open_starter_slots,
    owns_player,
    place_player,
)
from .value import scaled_opening_bid


# ─── Order building ─────────────────────────────────────────────────────────
def _ensure_positional_coverage(
    selected: List[Player], pool: List[Player]
) -> List[Player]:
    out = list(selected)
    in_board = {p.id for p in out}
    leftovers = [p for p in pool if p.id not in in_board]

    def count_for(pos: str, lst: List[Player]) -> int:
        return sum(1 for p in lst if pos in p.eligible_positions())

    for pos in POSITIONS:
        while count_for(pos, out) < MIN_PER_POSITION:
            cand_idx = next(
                (i for i, p in enumerate(leftovers) if pos in p.eligible_positions()),
                -1,
            )
            if cand_idx == -1:
                break
            drop_idx = -1
            for i in range(len(out) - 1, -1, -1):
                p = out[i]
                if pos in p.eligible_positions():
                    continue
                still_covered = all(
                    count_for(pp, out) > MIN_PER_POSITION
                    for pp in p.eligible_positions()
                )
                if still_covered:
                    drop_idx = i
                    break
            candidate = leftovers.pop(cand_idx)
            if drop_idx >= 0:
                out[drop_idx] = candidate
            else:
                out.append(candidate)
    return out


def build_auction_order(rng: Callable[[], float], pool: List[Player], budget: int = 25) -> List[str]:
    by_tier: Dict[int, List[Player]] = {1: [], 2: [], 3: [], 4: []}
    for p in pool:
        by_tier[p.tier].append(p)
    for t in (1, 2, 3, 4):
        by_tier[t] = shuffle(rng, by_tier[t])

    cap = min(MAX_LOTS, len(pool))

    if budget <= 25:
        star_count = min(4, len(by_tier[1]))
        stars = by_tier[1][:star_count]
        rest_quota = cap - len(stars)
        front = shuffle(rng, [*by_tier[4], *by_tier[3], *by_tier[2]])[:rest_quota]
        covered = _ensure_positional_coverage(
            front, [*by_tier[4], *by_tier[3], *by_tier[2]]
        )
        return [p.id for p in [*covered, *stars]]

    order: List[Player] = []
    buckets = [by_tier[3], by_tier[4], by_tier[2], by_tier[1]]
    idx = 0
    while any(len(b) > 0 for b in buckets) and len(order) < cap:
        bucket = buckets[idx % len(buckets)]
        if bucket:
            order.append(bucket.pop(0))
        idx += 1
        if idx % 4 == 0 and rng() < 0.4:
            idx += 1
    return [p.id for p in _ensure_positional_coverage(order[:cap], pool)]


def create_game(
    game_id: str,
    config: GameConfig,
    seed: Optional[int] = None,
) -> ArenaState:
    s = seed if seed is not None else hash_seed(game_id)
    rng = mulberry32(s)
    pool = get_season_players(config.season)
    queue = build_auction_order(rng, pool, config.budget_per_player)
    return ArenaState(
        game_id=game_id,
        seed=s,
        season=config.season,
        config=config,
        queue=queue,
        rosters={"P1": empty_roster(), "P2": empty_roster()},
    )


# ─── Lot lifecycle ──────────────────────────────────────────────────────────
def _player_by_id(state: ArenaState, pid: str) -> Player:
    p = players_by_id(state.season).get(pid)
    if p is None:
        raise ValueError(f"Unknown player id: {pid}")
    return p


def rosters_done(state: ArenaState) -> bool:
    return is_roster_complete(state.rosters["P1"]) and is_roster_complete(
        state.rosters["P2"]
    )


def team_active(state: ArenaState, team: str) -> bool:
    return not is_roster_complete(state.rosters[team])


def active_teams(state: ArenaState) -> List[str]:
    return [t for t in TEAMS if not is_roster_complete(state.rosters[t])]


def _prune_unrosterable(state: ArenaState) -> None:
    def keep(pid: str) -> bool:
        p = _player_by_id(state, pid)
        return (
            not is_roster_complete(state.rosters["P1"])
            and can_force_add_player(state.rosters["P1"], p)
        ) or (
            not is_roster_complete(state.rosters["P2"])
            and can_force_add_player(state.rosters["P2"], p)
        )

    state.queue = [pid for pid in state.queue if keep(pid)]


def _relaxed_opening_floor(state: ArenaState, player: Player, team: str) -> Optional[int]:
    if player.tier <= 2:
        return None
    roster = state.rosters[team]
    if is_roster_complete(roster):
        return None
    if not can_add_player(roster, player):
        return None
    reserve = scaled_opening_bid(
        player, state.config.budget_per_player, state.config.roster_size
    )
    mx = max_affordable(state.config.budget_per_player, roster)
    if mx >= reserve:
        return None
    return mx if mx >= MIN_BID else None


def effective_opening_bid(state: ArenaState, player: Player) -> int:
    reserve = scaled_opening_bid(
        player, state.config.budget_per_player, state.config.roster_size
    )
    floor = reserve
    for t in TEAMS:
        clamp = _relaxed_opening_floor(state, player, t)
        if clamp is not None:
            floor = min(floor, max(MIN_BID, min(reserve, clamp)))
    return max(MIN_BID, floor)


def _select_next_lot(state: ArenaState) -> bool:
    teams = active_teams(state)
    if not teams:
        return False
    queued = [_player_by_id(state, pid) for pid in state.queue]

    def biddable_filter(p: Player) -> bool:
        opening = effective_opening_bid(state, p)
        return any(
            can_add_player(state.rosters[t], p)
            and max_affordable(state.config.budget_per_player, state.rosters[t]) >= opening
            for t in teams
        )

    biddable = [p for p in queued if biddable_filter(p)]
    if not biddable:
        return False

    demand = {
        pos: sum(1 for t in teams if state.rosters[t].slots[pos] is None)
        for pos in POSITIONS
    }
    supply = {
        pos: sum(1 for p in queued if pos in p.eligible_positions())
        for pos in POSITIONS
    }
    critical = {pos for pos in POSITIONS if demand[pos] > 0 and supply[pos] <= demand[pos]}

    def priority_of(p: Player) -> int:
        best = 0
        for t in teams:
            if not can_add_player(state.rosters[t], p):
                continue
            open_ = open_starter_slots(state.rosters[t])
            fills = [pos for pos in p.eligible_positions() if pos in open_]
            if not fills:
                continue
            best = max(best, 2 if any(pos in critical for pos in fills) else 1)
        return best

    best = biddable[0]
    best_score = -1
    for p in biddable:
        score = priority_of(p)
        if score > best_score:
            best_score = score
            best = p
            if score == 2:
                break

    idx = state.queue.index(best.id)
    if idx > 0:
        chosen = state.queue.pop(idx)
        state.queue.insert(0, chosen)
    return True


def open_next_lot(state: ArenaState) -> bool:
    if rosters_done(state):
        finalize_auction(state)
        return False
    _prune_unrosterable(state)
    if not state.queue:
        finalize_auction(state)
        return False
    if not _select_next_lot(state):
        finalize_auction(state)
        return False
    pid = state.queue[0]
    player = _player_by_id(state, pid)
    opening = effective_opening_bid(state, player)
    state.lot = AuctionLot(
        player_id=pid, current_bid=opening, high_bidder=None, opening_bid=opening
    )
    state.passed = []
    return True


# ─── Bidding ────────────────────────────────────────────────────────────────
class BidOutcome:
    def __init__(self, ok: bool, error: Optional[str] = None):
        self.ok = ok
        self.error = error


def place_bid(state: ArenaState, team: str, amount: int) -> BidOutcome:
    if state.status != "auction" or state.lot is None:
        return BidOutcome(False, "No active lot.")
    if not team_active(state, team):
        return BidOutcome(False, "Your roster is already full.")
    if state.lot.high_bidder == team:
        return BidOutcome(False, "You're already the high bidder.")
    player = _player_by_id(state, state.lot.player_id)
    if owns_player(state.rosters[team], player.id):
        return BidOutcome(False, "You already own this player.")
    if not can_add_player(state.rosters[team], player):
        return BidOutcome(False, f"No open slot for {player.name}.")
    total = state.config.budget_per_player
    allow_equal = state.lot.high_bidder is None
    err = validate_bid_amount(
        amount, state.lot.current_bid, total, state.rosters[team], allow_equal
    )
    if err:
        return BidOutcome(False, err)

    state.lot.current_bid = amount
    state.lot.high_bidder = team
    state.passed = []
    state.history.append(BidRecord(player_id=player.id, bidder=team, amount=amount))
    return BidOutcome(True)


def min_raise(state: ArenaState, team: str) -> Optional[int]:
    if state.lot is None:
        return None
    mx = max_affordable(state.config.budget_per_player, state.rosters[team])
    if state.lot.high_bidder is None:
        opening = state.lot.current_bid
        return opening if opening <= mx else None
    step = state.config.bid_increment or 1
    nxt = state.lot.current_bid + step
    if nxt > mx:
        one = state.lot.current_bid + 1
        return one if one <= mx else None
    return nxt


def passes(state: ArenaState, team: str) -> BidOutcome:
    if state.status != "auction" or state.lot is None:
        return BidOutcome(False, "No active lot.")
    if team not in state.passed:
        state.passed.append(team)
    maybe_resolve_lot(state)
    return BidOutcome(True)


def _can_bid_on_lot(state: ArenaState, team: str) -> bool:
    if state.lot is None:
        return False
    if not team_active(state, team):
        return False
    player = _player_by_id(state, state.lot.player_id)
    if owns_player(state.rosters[team], player.id):
        return False
    if not can_add_player(state.rosters[team], player):
        return False
    if state.lot.high_bidder == team:
        return True
    nxt = state.lot.current_bid + 1
    return nxt <= max_affordable(state.config.budget_per_player, state.rosters[team])


def biddable_teams(state: ArenaState) -> List[str]:
    return [t for t in TEAMS if _can_bid_on_lot(state, t)]


def maybe_resolve_lot(state: ArenaState) -> None:
    if state.lot is None:
        return
    eligible = [t for t in biddable_teams(state) if t != state.lot.high_bidder]
    if all(t in state.passed for t in eligible):
        resolve_lot(state)


def resolve_lot(state: ArenaState) -> None:
    if state.lot is None:
        return
    lot = state.lot
    player = _player_by_id(state, lot.player_id)
    sold = False
    if lot.high_bidder and team_active(state, lot.high_bidder):
        roster = state.rosters[lot.high_bidder]
        slot = auction_slot_for(roster, player)
        if slot:
            state.rosters[lot.high_bidder] = place_player(
                roster, player, lot.current_bid, slot
            )
            state.results.append(
                AuctionResultRow(
                    player_id=player.id, winner=lot.high_bidder, price=lot.current_bid
                )
            )
            sold = True

    state.queue = [pid for pid in state.queue if pid != player.id]

    if not sold:
        seen = state.reoffers.get(player.id, 0)
        anyone_needs = not is_roster_complete(state.rosters["P1"]) or not is_roster_complete(
            state.rosters["P2"]
        )
        if anyone_needs and seen < MAX_REOFFERS:
            state.reoffers[player.id] = seen + 1
            state.queue.append(player.id)

    state.lot = None
    state.passed = []
    open_next_lot(state)


# ─── Finalization ─────────────────────────────────────────────────────────
def finalize_auction(state: ArenaState) -> None:
    _auto_fill_if_needed(state, "P1")
    _auto_fill_if_needed(state, "P2")
    state.lot = None
    state.passed = []
    state.status = "lineup"


def _auto_fill_if_needed(state: ArenaState, team: str) -> None:
    if is_roster_complete(state.rosters[team]):
        return
    pool = get_season_players(state.season)
    owned = set()
    for t in TEAMS:
        for o in state.rosters[t].slots.values():
            if o:
                owned.add(o.player.id)
    available = sorted(
        (p for p in pool if p.id not in owned),
        key=lambda p: (p.overall, p.starting_bid),
    )
    guard = 0
    while not is_roster_complete(state.rosters[team]) and guard < 50:
        guard += 1
        placed = False
        for p in available:
            if p.id in owned:
                continue
            if not can_force_add_player(state.rosters[team], p):
                continue
            rem = remaining(state.config.budget_per_player, state.rosters[team])
            price = min(MIN_BID, max(0, rem))
            state.rosters[team] = place_player(state.rosters[team], p, price)
            owned.add(p.id)
            state.results.append(
                AuctionResultRow(player_id=p.id, winner=team, price=price)
            )
            placed = True
            break
        if not placed:
            break
