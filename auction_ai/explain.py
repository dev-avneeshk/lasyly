"""AI decision explainability (spec §24).

Runs a single auction with a policy in DEBUG mode and prints a human-readable
explanation for each CPU bid: player value, team fit, positional need, scarcity,
the rational ceiling, and the decision. Makes the learned behavior debuggable.

CLI:
    python -m auction_ai.explain --policy auction_ai/models/best_policy.json --seed 123
"""
from __future__ import annotations

import argparse
import json
import os

from .ai.policy import Policy, decide
from .simulation.auction import create_game, open_next_lot, place_bid, resolve_lot
from .simulation.auction_state import GameConfig, TEAMS
from .simulation.player_model import players_by_id
from .simulation.roster import is_roster_complete, ordered_roster

_ROOT = os.path.dirname(__file__)
BEST_PATH = os.path.join(_ROOT, "models", "best_policy.json")


def run_explained(policy: Policy, seed: int, budget: int) -> None:
    cfg = GameConfig(
        budget_per_player=budget,
        bid_increment=GameConfig.bid_increment_for_budget(budget),
        difficulty="hard",  # hard = no noise, so explanations are clean
        ai_personality="balanced",
    )
    state = create_game(f"explain-{seed}", cfg, seed=seed)
    by_id = players_by_id(state.season)
    open_next_lot(state)

    rounds = 0
    while state.status == "auction" and state.lot is not None and rounds < 5000:
        rounds += 1
        acted = False
        for team in TEAMS:
            if state.lot is None or state.lot.high_bidder == team:
                continue
            if is_roster_complete(state.rosters[team]):
                continue
            d = decide(state, team, policy, debug=True)
            if d.action == "bid":
                ex = d.explain or {}
                need = ex.get("positional_need", "?")
                print(
                    f"[{team}] BID ${d.amount} on {ex.get('player','?'):24s} "
                    f"| value={ex.get('player_value','?'):>3} fit={ex.get('team_fit','?'):>3} "
                    f"need={need:<4} scarcity={ex.get('scarcity','?')} "
                    f"| cur=${ex.get('current_bid','?')} ceil=${ex.get('ceiling','?')} "
                    f"maxRational=${ex.get('max_rational_bid','?')} rem=${ex.get('remaining_budget','?')}"
                )
                res = place_bid(state, team, d.amount)
                if res.ok:
                    acted = True
        if not acted:
            resolve_lot(state)

    print("\n─── Final rosters ───")
    for team in TEAMS:
        r = state.rosters[team]
        spent = sum(o.price for o in r.slots.values() if o)
        print(f"\n{team}  (spent ${spent}/{budget}):")
        for o in ordered_roster(r):
            print(f"   {o.slot:5s} {o.player.name:26s} ${o.price}  (OVR {o.player.overall})")


def main() -> None:
    ap = argparse.ArgumentParser(description="Explain a policy's auction decisions.")
    ap.add_argument("--policy", default=BEST_PATH)
    ap.add_argument("--seed", type=int, default=123)
    ap.add_argument("--budget", type=int, default=25)
    args = ap.parse_args()

    policy = Policy.default()
    if os.path.exists(args.policy):
        with open(args.policy, "r", encoding="utf-8") as fh:
            policy = Policy.from_dict(json.load(fh))
        print(f"Loaded policy v{policy.version}\n")
    else:
        print("No trained policy found — using default (baseline) policy.\n")

    run_explained(policy, args.seed, args.budget)


if __name__ == "__main__":
    main()
