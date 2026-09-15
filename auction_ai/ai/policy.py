"""The learnable CPU policy.

Design (per the spec): NOT a big neural net. A compact, inspectable *weight
vector* over interpretable features. The weights are what training adjusts.

The policy is split into two layers, and only the second is learnable:

    HARD RULES  (fixed, from the engine)   →  what is even legal / affordable
        +
    LEARNED STRATEGY (weights)             →  how much to want it & pay
        =
    FINAL DECISION (BID / PASS)

Hard rules the learner can NEVER override (all enforced by the engine + here):
  * cannot bid above max_affordable (keeps $1 per remaining slot)
  * cannot exceed roster limits / fill bench before starters
  * cannot buy a sold/duplicate player / bid when ineligible

Everything else — desirability weighting, willingness to pay, scarcity/urgency
premiums, overpay aversion — is a linear-ish blend of features scaled by the
learned weights. This mirrors the shape of lib/arena/ai.ts (desirability +
walkAwayPrice + decideAI) but exposes the constants as parameters.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from ..simulation.auction import biddable_teams, effective_opening_bid
from ..simulation.auction_state import ArenaState, GameConfig
from ..simulation.budget import max_affordable, remaining
from ..simulation.player_model import MIN_BID, Player, get_season_players, players_by_id
from ..simulation.rng import djb2
from ..simulation.roster import (
    can_add_player,
    is_roster_complete,
    open_slots,
    open_starter_slots,
    owned_players,
)
from ..simulation.value import (
    defense_score,
    offense_score,
    scaled_opening_bid,
    scarcity_by_position,
    spacing_score,
)

# ─── Fixed reference tables (ported from ai.ts) ─────────────────────────────
# Personalities are a fixed "flavor" layer applied on TOP of the learned base
# policy (spec §13: base policy + personality modifiers + team state). Training
# learns the base weights; personalities remain interpretable tilts so the CPUs
# still behave differently from one team to another.
PERSONALITIES: Dict[str, Dict[str, float]] = {
    "balanced": {"aggression": 1.08, "offenseBias": 1.0, "defenseBias": 1.0, "superstarBias": 1.05, "valueDiscipline": 0.25},
    "aggressive": {"aggression": 1.35, "offenseBias": 1.05, "defenseBias": 1.0, "superstarBias": 1.2, "valueDiscipline": 0.12},
    "value": {"aggression": 1.0, "offenseBias": 1.0, "defenseBias": 1.0, "superstarBias": 0.95, "valueDiscipline": 0.5},
    "superstar": {"aggression": 1.2, "offenseBias": 1.0, "defenseBias": 0.95, "superstarBias": 1.5, "valueDiscipline": 0.15},
    "defense": {"aggression": 1.1, "offenseBias": 0.9, "defenseBias": 1.35, "superstarBias": 1.05, "valueDiscipline": 0.25},
    "offense": {"aggression": 1.12, "offenseBias": 1.4, "defenseBias": 0.85, "superstarBias": 1.1, "valueDiscipline": 0.2},
}

DIFFICULTY: Dict[str, Dict[str, float]] = {
    "easy": {"aggression": 0.9, "mistakeChance": 0.45, "jitter": 4.0},
    "medium": {"aggression": 0.97, "mistakeChance": 0.18, "jitter": 1.5},
    "hard": {"aggression": 1.0, "mistakeChance": 0.0, "jitter": 0.0},
}


# ─── The learnable weight vector ────────────────────────────────────────────
# These are the parameters the training engine adjusts. Names mirror the spec's
# requested parameter list (§11). Defaults ≈ the current hand-tuned engine, so a
# freshly-initialized policy behaves like today's CPU and training moves from
# there rather than from noise.
DEFAULT_WEIGHTS: Dict[str, float] = {
    # desirability blend
    "player_value_weight": 1.0,     # weight on overall/two-way base score
    "offense_weight": 1.0,          # extra tilt toward offense
    "defense_weight": 1.0,          # extra tilt toward defense
    "spacing_weight": 1.0,          # shooting/gravity contribution
    "team_fit_weight": 1.0,         # roster-gap (needs shooting/rim/stopper) bonus
    "potential_weight": 0.0,        # reserved: no age/potential data yet (kept for export shape)
    "age_weight": 0.0,              # reserved: no age data yet
    # willingness-to-pay
    "positional_need_weight": 1.0,  # premium for filling a needed starter slot
    "scarcity_weight": 1.0,         # premium for scarce needed positions
    "budget_weight": 1.0,           # how freely to spend down remaining budget
    "future_value_weight": 1.0,     # how strongly a comparable future player suppresses the bid
    "overpay_penalty": 1.0,         # aversion to paying above the ceiling share
    "urgency_weight": 1.0,          # premium as open slots outnumber remaining fits
    "risk_tolerance": 1.0,          # global aggressiveness multiplier on the target price
    # ── Extended state/action space (opponent modeling + timing). All default to
    #    a NO-OP value so a policy without them (e.g. v6) is reproduced exactly;
    #    the champion/challenger search explores these new dimensions. ──────────
    "rival_demand_weight": 0.0,     # bid UP when a rival also wants this lot (contested)
    "rival_desperation_weight": 0.0,  # bid UP more when the rival is desperate (few options / needs slot)
    "snipe_weight": 0.0,            # bid DOWN when NO rival can take the lot (win it cheap)
    "opportunity_cost_weight": 0.0,  # explicit penalty for committing budget vs future needs
    "auction_stage_weight": 0.0,    # tilt willingness by early/mid/late auction stage
}

WEIGHT_KEYS: List[str] = list(DEFAULT_WEIGHTS.keys())

# The value each weight takes to be a NO-OP (so the baseline/v6 is reproduced).
# Multiplicative weights are neutral at 1.0; additive opponent/timing terms are
# neutral at 0.0. Used by mutation + sanitizers + parity checks.
NEUTRAL_WEIGHTS: Dict[str, float] = {
    **{k: 1.0 for k in DEFAULT_WEIGHTS},
    "potential_weight": 0.0,
    "age_weight": 0.0,
    "rival_demand_weight": 0.0,
    "rival_desperation_weight": 0.0,
    "snipe_weight": 0.0,
    "opportunity_cost_weight": 0.0,
    "auction_stage_weight": 0.0,
}

# Weights the learner is allowed to explore (excludes reserved no-data terms).
LEARNABLE_KEYS: List[str] = [k for k in DEFAULT_WEIGHTS if k not in ("age_weight", "potential_weight")]


@dataclass
class Policy:
    """A trained (or default) CPU policy: just a version + weight vector."""

    version: int = 0
    weights: Dict[str, float] = field(default_factory=lambda: dict(DEFAULT_WEIGHTS))

    def w(self, key: str) -> float:
        return self.weights.get(key, DEFAULT_WEIGHTS.get(key, 1.0))

    def clone(self) -> "Policy":
        return Policy(version=self.version, weights=dict(self.weights))

    def to_dict(self) -> dict:
        return {"version": self.version, "weights": {k: round(self.weights[k], 6) for k in self.weights}}

    @staticmethod
    def from_dict(d: dict) -> "Policy":
        weights = dict(DEFAULT_WEIGHTS)
        weights.update(d.get("weights", {}))
        return Policy(version=int(d.get("version", 0)), weights=weights)

    @staticmethod
    def default() -> "Policy":
        return Policy()


# ─── Decision output ────────────────────────────────────────────────────────
@dataclass
class Decision:
    action: str  # "bid" | "pass"
    amount: int = 0
    # Debug/explainability payload (spec §24) — only populated in debug mode.
    explain: Optional[dict] = None


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


# Difficulty valuation-noise is a deterministic function of (player, team, game,
# jitter) — constant for the whole game — so cache it. This is a hot path
# (desirability is evaluated for every future candidate on every decision).
_noise_cache: Dict[tuple, float] = {}


def _noise_for(player_id: str, team: str, game_id: str, jitter: float) -> float:
    key = (player_id, team, game_id, jitter)
    v = _noise_cache.get(key)
    if v is None:
        v = (((djb2(player_id + team + game_id) % 200) / 100) - 1) * jitter * 3
        _noise_cache[key] = v
    return v


def desirability(state: ArenaState, team: str, player: Player, policy: Policy) -> float:
    """How much this seat wants `player`, on a ~0..120 scale.

    Port of ai.ts desirability(), with the fixed coefficients replaced by
    policy weights. Personality + difficulty distortion are preserved as fixed
    layers so behavior stays interpretable and difficulty still means something.
    """
    cfg = state.config_for(team)
    persona = PERSONALITIES[cfg.ai_personality]
    roster = state.rosters[team]
    off = offense_score(player)
    de = defense_score(player)
    spacing = spacing_score(player)

    # Base two-way score, scaled by the learned value/offense/defense/spacing weights.
    d = (
        player.overall * 0.5 * policy.w("player_value_weight")
        + off * 0.22 * policy.w("offense_weight")
        + de * 0.22 * policy.w("defense_weight")
        + spacing * 0.06 * policy.w("spacing_weight")
    )

    # Personality tilt (fixed layer).
    d += (off - 60) * (persona["offenseBias"] - 1) * 0.6
    d += (de - 60) * (persona["defenseBias"] - 1) * 0.6

    # Team-gap awareness, scaled by the learned team_fit weight.
    owned = owned_players(roster)
    fit_w = policy.w("team_fit_weight")
    if owned:
        avg_spacing = sum(p.a("threePointShooting") for p in owned) / len(owned)
        best_rim = max((p.a("rimProtection") for p in owned), default=0)
        avg_perim_d = sum(p.a("perimeterDefense") for p in owned) / len(owned)
        if avg_spacing < 68 and spacing >= 76:
            d += 8 * fit_w
        if best_rim < 65 and player.a("rimProtection") >= 80:
            d += 10 * fit_w
        if avg_perim_d < 66 and player.a("perimeterDefense") >= 82:
            d += 7 * fit_w

    # Star premium (fixed) then personality superstar bias.
    if player.tier == 1:
        d += 10
    elif player.tier == 2:
        d += 5
    d *= persona["superstarBias"] if player.tier <= 2 else 1.0

    # Difficulty distorts VALUATION ACCURACY (fixed layer, deterministic).
    diff = DIFFICULTY[cfg.difficulty]
    if diff["jitter"] > 0:
        noise = _noise_for(player.id, team, state.game_id, diff["jitter"])
        flatten = 0.35 if cfg.difficulty == "easy" else 0.12 if cfg.difficulty == "medium" else 0.0
        d = d * (1 - flatten) + 70 * flatten + noise

    return _clamp(d, 0.0, 120.0)


def _other_team(team: str) -> str:
    return "P2" if team == "P1" else "P1"


def _opponent_features(state: ArenaState, team: str, player: Player, policy: Policy) -> Dict[str, float]:
    """Open-information opponent model for the CURRENT lot.

    Returns three signals in [0,1]:
      * demand       — does a rival both CAN and WOULD want this player?
      * desperation  — how badly does that rival need this player's slot,
                       given how few alternatives remain for them?
      * uncontested  — 1.0 if NO rival can legally take this lot (snipe chance).

    All are derived from state the human can also see (rosters, budgets, queue),
    so this is a cheap feature, not a simulation — safe for Vercel inference.
    """
    opp = _other_team(team)
    opp_roster = state.rosters[opp]
    # Can the rival even take this player (open slot + affordable)?
    if is_roster_complete(opp_roster) or not can_add_player(opp_roster, player):
        return {"demand": 0.0, "desperation": 0.0, "uncontested": 1.0}

    opp_cfg = state.config_for(opp)
    opp_cap = max_affordable(opp_cfg.budget_per_player, opp_roster)
    opening = state.lot.opening_bid if state.lot else 0
    if opp_cap < opening:
        return {"demand": 0.0, "desperation": 0.0, "uncontested": 1.0}

    # How much does the rival want THIS player (their desirability, normalized)?
    opp_desire = desirability(state, opp, player, policy)
    demand = _clamp((opp_desire - 45) / 55, 0.0, 1.0)  # ~0 below "wants at all", →1 for studs

    # Desperation: does the player fill a rival OPEN starter slot, and how scarce
    # are that slot's remaining options for the rival?
    opp_open = open_starter_slots(opp_roster)
    fills = [pos for pos in player.eligible_positions() if pos in opp_open]
    desperation = 0.0
    if fills:
        pool = get_season_players(state.season)
        by_id = {p.id: p for p in pool}
        future = [by_id[pid] for pid in state.queue if pid in by_id and pid != player.id]
        # Fewest remaining eligible options across the slots this player fills for them.
        min_supply = min(
            sum(1 for p in future if pos in p.eligible_positions()) for pos in fills
        )
        # 0 alternatives → maximally desperate; ≥3 → not desperate.
        desperation = _clamp((3 - min_supply) / 3, 0.0, 1.0)

    return {"demand": demand, "desperation": desperation, "uncontested": 0.0}


def _auction_stage(state: ArenaState) -> float:
    """How far through the auction we are, in [0,1]. Early lots → ~0, late → ~1.
    Uses filled roster slots as a stable proxy (queue length varies with
    re-offers)."""
    total_slots = 2 * state.config.roster_size
    filled = 0
    for t in ("P1", "P2"):
        filled += sum(1 for o in state.rosters[t].slots.values() if o is not None)
    return _clamp(filled / max(1, total_slots), 0.0, 1.0)


def walk_away_price(
    state: ArenaState, team: str, policy: Policy, explain: bool = False
) -> tuple[int, Optional[dict]]:
    """The most this seat will pay for the current lot — a learnable
    "walk-away price". Port of ai.ts walkAwayPrice() with fixed constants
    replaced by policy weights, but the BUDGET-RESERVE and CEILING structure
    (the hard rules) preserved exactly."""
    if state.lot is None:
        return 0, None
    player = players_by_id(state.season)[state.lot.player_id]
    roster = state.rosters[team]
    if is_roster_complete(roster):
        return 0, None
    if not can_add_player(roster, player):
        return 0, None

    cfg = state.config_for(team)
    total = cfg.budget_per_player
    rem = remaining(total, roster)
    cap = max_affordable(total, roster)
    diff = DIFFICULTY[cfg.difficulty]
    persona = PERSONALITIES[cfg.ai_personality]

    pool = get_season_players(state.season)
    by_id = {p.id: p for p in pool}
    future_ids = [pid for pid in state.queue if pid != player.id]
    future: List[Player] = [by_id[pid] for pid in future_ids if pid in by_id]

    open_starters = open_starter_slots(roster)
    needs_bench = roster.slots["BENCH"] is None
    open_count = len(open_slots(roster))

    def fair_price(p: Player) -> int:
        return max(1, round(scaled_opening_bid(p, total, cfg.roster_size) * 1.15))

    fills_slots = player.eligible_positions()
    claim_starter = next((pos for pos in open_starters if pos in fills_slots), None)

    used_future: set[str] = set()
    # Desirability only depends on (this seat's roster state, player) within this
    # call — the roster doesn't change mid-decision — so memoize it. This is the
    # single hottest path (evaluating every future candidate for every slot).
    _des_cache: Dict[str, float] = {}

    def des(p: Player) -> float:
        v = _des_cache.get(p.id)
        if v is None:
            v = desirability(state, team, p, policy)
            _des_cache[p.id] = v
        return v

    def best_future_for(position: Optional[str]) -> Optional[Player]:
        best = None
        best_score = float("-inf")
        for cand in future:
            if cand.id in used_future:
                continue
            if position and position not in cand.eligible_positions():
                continue
            score = des(cand)
            if score > best_score:
                best = cand
                best_score = score
        if best:
            used_future.add(best.id)
        return best

    slot_weights: List[dict] = []
    for pos in open_starters:
        is_current = pos == claim_starter
        candidate = player if is_current else best_future_for(pos)
        slot_weights.append(
            {"weight": fair_price(candidate) if candidate else MIN_BID, "isCurrent": is_current}
        )
    if needs_bench:
        is_current = claim_starter is None
        candidate = player if is_current else best_future_for(None)
        slot_weights.append(
            {"weight": fair_price(candidate) if candidate else MIN_BID, "isCurrent": is_current}
        )

    total_weight = sum(item["weight"] for item in slot_weights) or 1
    current_weight = next(
        (item["weight"] for item in slot_weights if item["isCurrent"]), fair_price(player)
    )
    # budget_weight controls how much of remaining budget the plan is willing to
    # earmark for the current slot.
    planned_allocation = (current_weight / total_weight) * rem * policy.w("budget_weight")

    reserve_used: set[str] = set()

    def cheapest_future_opening(position: Optional[str]) -> int:
        best_price = math.inf
        best = None
        for cand in future:
            if cand.id in reserve_used:
                continue
            if position and position not in cand.eligible_positions():
                continue
            price = scaled_opening_bid(cand, total, cfg.roster_size)
            if price < best_price:
                best_price = price
                best = cand
        if best:
            reserve_used.add(best.id)
        return int(best_price) if best_price != math.inf else MIN_BID

    future_reserve = 0
    for pos in open_starters:
        if pos != claim_starter:
            future_reserve += cheapest_future_opening(pos)
    if needs_bench and claim_starter is not None:
        future_reserve += cheapest_future_opening(None)
    reserve_aware_cap = max(MIN_BID, rem - future_reserve)

    ceiling_raw = max(MIN_BID, round(planned_allocation * 1.8))
    ceiling = min(cap, reserve_aware_cap, ceiling_raw)

    # Marginal value: is a comparable player coming for the same slot?
    my_desire = des(player)
    best_alt = 0.0
    for p in future:
        if not can_add_player(roster, p):
            continue
        shares_slot = any(
            pos in fills_slots and (pos in open_starters or needs_bench)
            for pos in p.eligible_positions()
        )
        if not shares_slot:
            continue
        dscore = des(p)
        if dscore > best_alt:
            best_alt = dscore

    # future_value_weight scales how strongly a good alternative suppresses this bid.
    gap = my_desire - best_alt * policy.w("future_value_weight")
    commit_frac = 0.25 + 0.75 / (1 + math.exp(-gap / 6))
    commit_frac = _clamp(commit_frac, 0.0, 1.0)

    fills_needed_starter = claim_starter is not None
    bench_is_last_slot = len(open_starters) == 0 and needs_bench
    if not fills_needed_starter and not bench_is_last_slot:
        ceiling = min(ceiling, max(MIN_BID, round(rem * 0.18)))
        commit_frac *= 0.7
    elif bench_is_last_slot:
        ceiling = cap
        commit_frac = max(commit_frac, 0.6)

    # positional_need premium: extra willingness when filling a needed starter.
    # NO-OP at weight 1.0 so the baseline reproduces the original engine exactly;
    # the learner only adds/removes effect as the weight deviates from 1.
    if fills_needed_starter:
        commit_frac = _clamp(
            commit_frac * (1 + 0.15 * (policy.w("positional_need_weight") - 1)), 0.0, 1.0
        )

    # urgency: as open slots grow relative to the future supply that fits them,
    # spend more freely (don't get stranded). NO-OP at weight 1.0.
    if open_count > 1 and future:
        fit_supply = sum(
            1 for p in future if any(pos in fills_slots for pos in p.eligible_positions())
        )
        pressure = open_count / max(1, fit_supply)
        commit_frac = _clamp(
            commit_frac * (1 + (pressure - 1) * 0.1 * (policy.w("urgency_weight") - 1)), 0.0, 1.0
        )

    # Scarcity premium, scaled by scarcity_weight.
    scarcity = scarcity_by_position(future)
    sc_mult = 1.0
    for pos in fills_slots:
        if pos in open_starters:
            sc_mult = max(sc_mult, scarcity.get(pos, 1.0))
    sc_mult = 1 + (sc_mult - 1) * policy.w("scarcity_weight")

    # ── OPPONENT MODELING (open-information features, all NO-OP at weight 0) ──
    # "Who else wants this player, and how desperate are they?" This is the
    # human-like reasoning the flat weight vector lacked. Every term is neutral
    # at weight 0 so the baseline/v6 is reproduced exactly.
    rival = _opponent_features(state, team, player, policy)
    # rival_demand: a contested lot (a rival can & would want it) is worth paying
    # a bit more for — you won't get another shot at it.
    commit_frac = _clamp(commit_frac * (1 + rival["demand"] * policy.w("rival_demand_weight")), 0.0, 1.0)
    # rival_desperation: if the rival NEEDS this slot and has few alternatives,
    # they'll bid hard — lean in further (or, learned negative, refuse the war).
    commit_frac = _clamp(commit_frac * (1 + rival["desperation"] * policy.w("rival_desperation_weight")), 0.0, 1.0)
    # snipe: if NO rival can take this lot, there's no competition — buy it cheap
    # (pull the target DOWN). rival["uncontested"] is 1 when nobody contests.
    commit_frac = _clamp(commit_frac * (1 - rival["uncontested"] * 0.5 * policy.w("snipe_weight")), 0.0, 1.0)

    # ── AUCTION-STAGE awareness (NO-OP at weight 0) ──
    # Early vs late in the auction changes optimal aggression. stage∈[0,1].
    stage = _auction_stage(state)
    # Positive weight → more willing late (fill needs before the board dries up);
    # the (stage-0.5) centering makes weight 0 a no-op and lets the learner pick
    # either direction.
    commit_frac = _clamp(commit_frac * (1 + (stage - 0.5) * 0.4 * policy.w("auction_stage_weight")), 0.0, 1.0)

    target = ceiling * commit_frac * sc_mult

    # ── OPPORTUNITY COST (explicit, NO-OP at weight 0) ──
    # Committing budget now reduces what's left for future needs. Penalize the
    # target in proportion to how much of the remaining budget this bid consumes
    # AND how many needs remain unfilled — a learned, direction-flexible term.
    if policy.w("opportunity_cost_weight") != 0 and rem > 0 and open_count > 1:
        consume_frac = min(1.0, target / rem)
        future_needs = open_count - 1
        oc = consume_frac * (future_needs / max(1, open_count))
        target *= max(0.3, 1 - oc * 0.5 * policy.w("opportunity_cost_weight"))

    # Difficulty + personality (fixed layers) then the learned global risk knob.
    target *= diff["aggression"]
    persona_aggression = (
        persona["aggression"] * persona["superstarBias"]
        if player.tier <= 2
        else persona["aggression"]
    )
    target *= persona_aggression
    target *= 1 - persona["valueDiscipline"] * 0.15
    target *= policy.w("risk_tolerance")

    # Overpay penalty: pull the target back toward the planned allocation. A
    # higher overpay_penalty means the CPU is more reluctant to exceed its plan.
    if target > planned_allocation and planned_allocation > 0:
        excess = target - planned_allocation
        target = planned_allocation + excess / max(1.0, policy.w("overpay_penalty"))

    price = min(ceiling, round(target))

    wants_at_all = my_desire >= 45 or fills_needed_starter or bench_is_last_slot
    floor = min(state.lot.opening_bid, ceiling) if wants_at_all else 0
    price = max(floor, price)

    if diff["jitter"] > 0:
        jitter = -round(diff["jitter"] * ((djb2(player.id + team) % 100) / 100))
        price = max(floor, min(ceiling, price + jitter))

    price = max(0, min(cap, price))

    explain_payload = None
    if explain:
        explain_payload = {
            "player": player.name,
            "player_value": round(player_value_debug(player)),
            "team_fit": round(my_desire),
            "positional_need": "HIGH" if fills_needed_starter and claim_starter in _critical_positions(state, team) else ("MED" if fills_needed_starter else "LOW"),
            "scarcity": round(sc_mult, 2),
            "current_bid": state.lot.current_bid,
            "ceiling": ceiling,
            "commit_frac": round(commit_frac, 2),
            "max_rational_bid": price,
            "remaining_budget": rem,
        }
    return price, explain_payload


def player_value_debug(p: Player) -> float:
    return p.overall * 0.5 + offense_score(p) * 0.25 + defense_score(p) * 0.25


def _critical_positions(state: ArenaState, team: str) -> set[str]:
    roster = state.rosters[team]
    future = [players_by_id(state.season)[pid] for pid in state.queue]
    open_ = open_starter_slots(roster)
    crit = set()
    for pos in open_:
        supply = sum(1 for p in future if pos in p.eligible_positions())
        if supply <= 1:
            crit.add(pos)
    return crit


def decide(
    state: ArenaState, team: str, policy: Policy, debug: bool = False
) -> Decision:
    """Decide the seat's move on the current lot. Port of ai.ts decideAI(),
    delegating the strategic ceiling to the learned walk_away_price. Hard rules
    (affordability, min-raise, eligibility) are enforced regardless of weights."""
    if state.lot is None:
        return Decision("pass")
    if state.lot.high_bidder == team:
        return Decision("pass")

    cfg = state.config_for(team)
    step = cfg.bid_increment or 1
    cap = max_affordable(cfg.budget_per_player, state.rosters[team])
    walk_away, explain = walk_away_price(state, team, policy, explain=debug)

    opening_claim = state.lot.high_bidder is None
    nxt = state.lot.current_bid if opening_claim else state.lot.current_bid + step

    if not opening_claim and (nxt > cap or nxt > walk_away):
        nxt = state.lot.current_bid + 1

    if nxt > cap:
        return Decision("pass", explain=explain)
    if nxt > walk_away:
        return Decision("pass", explain=explain)

    # Difficulty mistake (fixed layer): easier CPUs sometimes bail near value.
    diff = DIFFICULTY[cfg.difficulty]
    marginal = nxt >= walk_away * 0.85
    if diff["mistakeChance"] > 0 and marginal and state.lot.current_bid > state.lot.opening_bid:
        roll = (djb2(state.game_id + state.lot.player_id + team + str(state.lot.current_bid)) % 1000) / 1000
        if roll < diff["mistakeChance"]:
            return Decision("pass", explain=explain)

    return Decision("bid", amount=nxt, explain=explain)
