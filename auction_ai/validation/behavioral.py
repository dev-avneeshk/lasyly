"""Behavioral intelligence tests + human-evaluation guardrail (spec §15–17).

Winning games is not enough — the BIDDING must look intelligent to a human. This
module runs constructed scenarios and auction telemetry to score whether a
policy exhibits sensible behavior:

  * doesn't overpay for a redundant player when the slot is covered
  * recognizes a major roster hole (values a needed position up)
  * respects opportunity cost / budget pressure (doesn't blow the bank early)
  * knows when to walk away (doesn't mechanically counter every bid)
  * pounces on a genuine bargain
  * doesn't leave the roster full of $1 auto-fill scrubs

The behavior score is a GUARDRAIL, not a reward: a policy that wins statistically
but behaves absurdly should be rejected, but a high behavior score can never by
itself promote a policy over real-game win rate (spec §17).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Tuple

from ..ai.policy import Policy, decide, walk_away_price
from ..simulation.auction import create_game, open_next_lot, place_bid, resolve_lot
from ..simulation.auction_state import ArenaState, AuctionLot, GameConfig, TEAMS
from ..simulation.player_model import players_by_id
from ..simulation.roster import is_roster_complete, ordered_roster, place_player
from ..simulation.value import scaled_opening_bid


def _find(pid_substr: str, season: str = "2025-26"):
    for p in players_by_id(season).values():
        if pid_substr in p.id:
            return p
    raise KeyError(pid_substr)


def _fresh_state(budget: int = 25) -> ArenaState:
    cfg = GameConfig(budget_per_player=budget, bid_increment=GameConfig.bid_increment_for_budget(budget))
    st = create_game("behav", cfg, seed=1)
    return st


def _walkaway_for(state: ArenaState, team: str, player, policy: Policy) -> int:
    """Set up a synthetic lot for `player` and read the policy's walk-away."""
    opening = scaled_opening_bid(player, state.config.budget_per_player, state.config.roster_size)
    state.lot = AuctionLot(player_id=player.id, current_bid=opening, high_bidder=None, opening_bid=opening)
    wa, _ = walk_away_price(state, team, policy)
    return wa


@dataclass
class BehaviorScore:
    redundancy_discipline: float   # values a redundant player LESS than a needed one
    hole_awareness: float          # values a needed position UP
    bargain_aggression: float      # pays more when a stud is cheap/needed
    walk_away_discipline: float    # walk-away below cap (doesn't spend to the max on everything)
    roster_completeness: float     # finishes with real buys, not $1 scrubs
    total: float
    details: Dict[str, float] = field(default_factory=dict)


def evaluate_behavior(policy: Policy, season: str = "2025-26") -> BehaviorScore:
    d: Dict[str, float] = {}

    # ── 1. Redundancy discipline: with EITHER an open wing (need) or a flex
    #      player that only duplicates covered strength, the needed wing should
    #      be valued higher. Both are legally addable (SF open), so this probes
    #      the POLICY, not the hard-constraint layer. ─────────────────────────
    st = _fresh_state()
    # Fill PG only → SG,SF,PF,C open. A pure-SG shooter vs a strong SF: both fit
    # an open slot, but the SF fills the truly scarce wing need vs a covered-ish
    # backcourt. We compare a lower-impact guard-type vs a needed wing.
    pg = _find("jalen-brunson", season)
    st.rosters["P1"] = place_player(st.rosters["P1"], pg, 5, "PG")
    # og-anunoby (SF/PF/SG) is a needed 3&D wing; naz-reid is a stretch big that
    # would take PF/C — also needed but lower two-way impact. The disciplined
    # policy should value the higher-fit needed wing at least as much.
    needed_wing = _find("og-anunoby", season)
    fringe = _find("immanuel-quickley", season)  # SG-type, lower defensive fit
    wa_needed = _walkaway_for(st, "P1", needed_wing, policy)
    wa_fringe = _walkaway_for(st, "P1", fringe, policy)
    d["wa_needed_wing"] = wa_needed
    d["wa_fringe_guard"] = wa_fringe
    redundancy = 1.0 if wa_needed >= wa_fringe else 0.4

    # ── 2. Hole awareness: with a weak/empty center slot, a strong center should
    #      be valued higher than when the C slot is already filled. ─────────────
    st_hole = _fresh_state()
    st_hole.rosters["P1"] = place_player(st_hole.rosters["P1"], _find("jalen-brunson", season), 5, "PG")
    center = _find("rudy-gobert", season)
    wa_center_open = _walkaway_for(st_hole, "P1", center, policy)
    st_filled = _fresh_state()
    st_filled.rosters["P1"] = place_player(st_filled.rosters["P1"], _find("jalen-brunson", season), 5, "PG")
    st_filled.rosters["P1"] = place_player(st_filled.rosters["P1"], _find("bam-adebayo", season), 5, "C")
    # With C filled, gobert can only go bench (or nowhere) → should be wanted less.
    wa_center_filled = _walkaway_for(st_filled, "P1", center, policy)
    d["wa_center_open"] = wa_center_open
    d["wa_center_filled"] = wa_center_filled
    hole = 1.0 if wa_center_open >= wa_center_filled else 0.4

    # ── 3. Bargain aggression: walk-away should be at/above the (low) opening for
    #      a genuinely good, needed player — the CPU is willing to buy value. ────
    st_b = _fresh_state()
    star = _find("nikola-jokic", season)
    wa_star = _walkaway_for(st_b, "P1", star, policy)
    opening_star = scaled_opening_bid(star, st_b.config.budget_per_player, st_b.config.roster_size)
    d["wa_star"] = wa_star
    d["opening_star"] = opening_star
    bargain = 1.0 if wa_star >= opening_star else 0.3

    # ── 4. Walk-away discipline: on a mid role player the CPU should NOT be
    #      willing to spend its entire max-affordable (that's mechanical). ──────
    st_w = _fresh_state()
    role = _find("naz-reid", season)
    from ..simulation.budget import max_affordable
    wa_role = _walkaway_for(st_w, "P1", role, policy)
    cap = max_affordable(st_w.config.budget_per_player, st_w.rosters["P1"])
    d["wa_role"] = wa_role
    d["cap_role"] = cap
    walk_away_disc = 1.0 if wa_role < cap else 0.5

    # ── 5. Roster completeness: play a full auction; penalize $1 auto-fill scrubs.
    st_full = create_game("behav-full", GameConfig(budget_per_player=25, bid_increment=1), seed=3)
    open_next_lot(st_full)
    rounds = 0
    while st_full.status == "auction" and st_full.lot is not None and rounds < 1500:
        rounds += 1
        acted = False
        for team in TEAMS:
            if st_full.lot is None or st_full.lot.high_bidder == team:
                continue
            if is_roster_complete(st_full.rosters[team]):
                continue
            dec = decide(st_full, team, policy if team == "P1" else Policy.default())
            if dec.action == "bid":
                if place_bid(st_full, team, dec.amount).ok:
                    acted = True
        if not acted:
            resolve_lot(st_full)
    owned = ordered_roster(st_full.rosters["P1"])
    autofills = sum(1 for o in owned if o.price <= 1)
    completeness = 1 - autofills / max(1, len(owned))
    d["autofills"] = autofills

    total = (
        redundancy * 0.22
        + hole * 0.24
        + bargain * 0.18
        + walk_away_disc * 0.16
        + completeness * 0.20
    )
    return BehaviorScore(
        redundancy_discipline=redundancy,
        hole_awareness=hole,
        bargain_aggression=bargain,
        walk_away_discipline=walk_away_disc,
        roster_completeness=completeness,
        total=total,
        details=d,
    )


# The guardrail threshold: below this, a policy is "obviously broken" and must be
# rejected regardless of how well it does statistically (spec §17).
BEHAVIOR_GUARDRAIL = 0.55


def passes_guardrail(score: BehaviorScore) -> bool:
    return score.total >= BEHAVIOR_GUARDRAIL


# ─── Harder scenario tests (spec §12 A–E) ───────────────────────────────────
# These probe genuine STRATEGY where the hard-constraint layer offers no
# shortcut — they distinguish a smart policy from one that merely obeys rules.
from dataclasses import dataclass as _dc


@_dc
class ScenarioChecks:
    redundant_guard: bool      # A: values needed wing ≥ a redundant-ish guard
    cheap_elite: bool          # B: bids UP when an elite is unexpectedly cheap
    scarce_archetype: bool     # C: values a scarce rim protector higher
    opportunity_cost: bool     # D: spending now lowers later willingness
    bidding_war_ceiling: bool  # E: has a finite valuation ceiling (won't counter forever)
    passed: int
    total: int


def scenario_tests(policy: Policy, season: str = "2025-26") -> ScenarioChecks:
    from ..simulation.budget import max_affordable

    # ── A. Redundant guard vs needed wing (SG filled, SF/PF/C open). ──────────
    st = _fresh_state()
    st.rosters["P1"] = place_player(st.rosters["P1"], _find("jalen-brunson", season), 5, "PG")
    st.rosters["P1"] = place_player(st.rosters["P1"], _find("donovan-mitchell", season), 5, "SG")
    wing = _find("og-anunoby", season)   # fills open SF (needed)
    # A borderline extra guard that can still slot (SG taken → only bench/none),
    # compared against the needed wing.
    guard = _find("immanuel-quickley", season)
    wa_wing = _walkaway_for(st, "P1", wing, policy)
    wa_guard = _walkaway_for(st, "P1", guard, policy)
    a_ok = wa_wing >= wa_guard

    # ── B. Cheap elite: the same elite should be wanted at least as much when
    #      its lot opens cheap as at its normal reserve (recognizes a bargain). ─
    st_b = _fresh_state()
    st_b.rosters["P1"] = place_player(st_b.rosters["P1"], _find("jalen-brunson", season), 5, "PG")
    elite = _find("jayson-tatum", season)  # SF/PF elite, fills open SF
    opening = scaled_opening_bid(elite, st_b.config.budget_per_player, st_b.config.roster_size)
    # Normal reserve lot:
    st_b.lot = AuctionLot(player_id=elite.id, current_bid=opening, high_bidder=None, opening_bid=opening)
    wa_normal, _ = walk_away_price(st_b, "P1", policy)
    # Cheap lot (opens at $1): a smart policy's ceiling shouldn't DROP just
    # because the asking price is low — the player is the same, now a bargain.
    st_b.lot = AuctionLot(player_id=elite.id, current_bid=1, high_bidder=None, opening_bid=1)
    wa_cheap, _ = walk_away_price(st_b, "P1", policy)
    b_ok = wa_cheap >= wa_normal - 1  # allow $1 slack

    # ── C. Scarcity: a rim protector when few remain should be valued at least
    #      as high as when the queue is full of them. We compare walk-away with a
    #      near-empty future queue (scarce) vs a full one. ─────────────────────
    st_c = _fresh_state()
    st_c.rosters["P1"] = place_player(st_c.rosters["P1"], _find("jalen-brunson", season), 5, "PG")
    rim = _find("rudy-gobert", season)  # C, strong rim protection
    # Scarce: queue has only this rim protector left for the C need.
    st_c.queue = [rim.id, _find("immanuel-quickley", season).id, _find("og-anunoby", season).id]
    wa_scarce = _walkaway_for(st_c, "P1", rim, policy)
    # Plentiful: queue also has other centers.
    st_c.queue = [rim.id, _find("myles-turner", season).id, _find("evan-mobley", season).id,
                  _find("bam-adebayo", season).id, _find("naz-reid", season).id]
    wa_plenty = _walkaway_for(st_c, "P1", rim, policy)
    c_ok = wa_scarce >= wa_plenty

    # ── D. Opportunity cost: with LESS remaining budget (already spent), the
    #      walk-away for the same player should not INCREASE. ──────────────────
    st_d1 = _fresh_state()
    st_d1.rosters["P1"] = place_player(st_d1.rosters["P1"], _find("jalen-brunson", season), 3, "PG")
    target = _find("kawhi-leonard", season)
    wa_rich = _walkaway_for(st_d1, "P1", target, policy)
    st_d2 = _fresh_state()
    # Spent a lot on PG → less budget left for the same SF target.
    st_d2.rosters["P1"] = place_player(st_d2.rosters["P1"], _find("jalen-brunson", season), 18, "PG")
    wa_poor = _walkaway_for(st_d2, "P1", target, policy)
    d_ok = wa_poor <= wa_rich

    # ── E. Bidding-war ceiling: walk-away must be finite and ≤ max affordable
    #      (the CPU won't counter indefinitely). ───────────────────────────────
    st_e = _fresh_state()
    star = _find("nikola-jokic", season)
    wa_star = _walkaway_for(st_e, "P1", star, policy)
    cap = max_affordable(st_e.config.budget_per_player, st_e.rosters["P1"])
    e_ok = 0 < wa_star <= cap

    checks = [a_ok, b_ok, c_ok, d_ok, e_ok]
    return ScenarioChecks(
        redundant_guard=a_ok, cheap_elite=b_ok, scarce_archetype=c_ok,
        opportunity_cost=d_ok, bidding_war_ceiling=e_ok,
        passed=sum(checks), total=len(checks),
    )


def opponent_modeling_response(policy: Policy, season: str = "2025-26") -> dict:
    """Scenario F — opponent modeling (spec: 'who else wants this player?').

    Sets up the SAME lot in two worlds that differ ONLY in the opponent's state:
      (1) the rival visibly NEEDS this player's slot and has no alternatives
          (contested + desperate), vs
      (2) the rival's roster is full (uncontested).

    A policy that USES opponent modeling should bid at least as high when the lot
    is contested/desperate as when it's uncontested. A neutral policy (v6) is
    unaffected — this measures whether the extended terms produce sensible,
    human-like behavior, not whether v6 has it.
    """
    from ..simulation.auction import create_game
    from ..simulation.auction_state import AuctionLot, GameConfig

    wing = _find("og-anunoby", season)  # SF, the contested lot
    # A FIXED queue used in BOTH worlds so the hero's own scarcity/future
    # reasoning is identical — the ONLY difference is the opponent's roster.
    fixed_queue = [wing.id, _find("rudy-gobert", season).id, _find("myles-turner", season).id]

    def make(opp_full: bool):
        cfg = GameConfig(budget_per_player=25, bid_increment=1)
        st = create_game("behav-F", cfg, seed=2)
        st.rosters["P1"] = place_player(st.rosters["P1"], _find("jalen-brunson", season), 5, "PG")
        if opp_full:
            # Rival roster complete → cannot contest (uncontested world).
            for slot, pid in [("PG", "de-aaron-fox"), ("SG", "donovan-mitchell"),
                              ("SF", "kawhi-leonard"), ("PF", "evan-mobley"),
                              ("C", "rudy-gobert"), ("BENCH", "myles-turner")]:
                st.rosters["P2"] = place_player(st.rosters["P2"], _find(pid, season), 3, slot)
        else:
            # Rival needs a wing (SF open) and, given the fixed short queue, has
            # few alternatives → contested + desperate.
            st.rosters["P2"] = place_player(st.rosters["P2"], _find("de-aaron-fox", season), 5, "PG")
        st.queue = list(fixed_queue)  # identical in both worlds
        opening = scaled_opening_bid(wing, st.config.budget_per_player, st.config.roster_size)
        st.lot = AuctionLot(player_id=wing.id, current_bid=opening, high_bidder=None, opening_bid=opening)
        wa, _ = walk_away_price(st, "P1", policy)
        return wa

    wa_contested = make(opp_full=False)
    wa_uncontested = make(opp_full=True)
    uses_opp_model = wa_contested != wa_uncontested
    sensible = wa_contested >= wa_uncontested  # willing to pay ≥ when contested
    return {
        "wa_contested": wa_contested,
        "wa_uncontested": wa_uncontested,
        "uses_opponent_model": uses_opp_model,
        "sensible": sensible,
    }


@_dc
class ActionMix:
    """Action distribution over a full auction — used for policy-collapse
    detection (spec §14). A policy that always-bids or always-passes, or shifts
    dramatically from the champion, is flagged for investigation."""

    bid_rate: float          # fraction of decisions that were a bid
    avg_bids_per_player: float
    collapsed: bool


def action_distribution(policy: Policy, season: str = "2025-26", games: int = 6) -> ActionMix:
    from ..simulation.auction import create_game, open_next_lot, place_bid, resolve_lot
    from ..simulation.auction_state import GameConfig, TEAMS
    from ..simulation.roster import is_roster_complete

    bids = 0
    decisions = 0
    players_won = 0
    for gseed in range(games):
        st = create_game(f"actmix-{gseed}", GameConfig(budget_per_player=25, bid_increment=1), seed=gseed + 1)
        open_next_lot(st)
        rounds = 0
        while st.status == "auction" and st.lot is not None and rounds < 1500:
            rounds += 1
            acted = False
            for team in TEAMS:
                if st.lot is None or st.lot.high_bidder == team:
                    continue
                if is_roster_complete(st.rosters[team]):
                    continue
                pol = policy if team == "P1" else Policy.default()
                dec = decide(st, team, pol)
                if team == "P1":
                    decisions += 1
                    if dec.action == "bid":
                        bids += 1
                if dec.action == "bid":
                    if place_bid(st, team, dec.amount).ok:
                        acted = True
            if not acted:
                resolve_lot(st)
        players_won += sum(1 for o in st.rosters["P1"].slots.values() if o)

    bid_rate = bids / max(1, decisions)
    # Collapse = pathological extremes (never bids or bids on literally everything).
    collapsed = bid_rate < 0.02 or bid_rate > 0.98
    return ActionMix(
        bid_rate=bid_rate,
        avg_bids_per_player=bids / max(1, players_won),
        collapsed=collapsed,
    )


def main() -> None:
    import argparse
    import json
    import os

    ap = argparse.ArgumentParser(description="Behavioral intelligence report for a policy.")
    ap.add_argument("--policy", default=os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "best_policy.json"))
    args = ap.parse_args()

    pol = Policy.default()
    if os.path.exists(args.policy):
        with open(args.policy) as fh:
            pol = Policy.from_dict(json.load(fh))

    s = evaluate_behavior(pol)
    print(f"Behavior score for policy v{pol.version}: {s.total:.3f} "
          f"({'PASS' if passes_guardrail(s) else 'FAIL — looks broken'} guardrail {BEHAVIOR_GUARDRAIL})")
    print(f"  redundancy discipline: {s.redundancy_discipline:.2f}")
    print(f"  hole awareness:        {s.hole_awareness:.2f}")
    print(f"  bargain aggression:    {s.bargain_aggression:.2f}")
    print(f"  walk-away discipline:  {s.walk_away_discipline:.2f}")
    print(f"  roster completeness:   {s.roster_completeness:.2f}")
    print(f"  details: {s.details}")


if __name__ == "__main__":
    main()
