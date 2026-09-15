"""Ground-truth game evaluation (spec §3, §6, §7, §24).

The AUTHORITATIVE fitness signal: run the real (ported) possession game
simulator many times on a completed roster pair and measure the actual win rate.
One game is noisy, so we average over N games and use COMMON RANDOM SEEDS when
comparing policies so the comparison is paired (variance-reduced).

Also provides a Wilson confidence interval so we never over-interpret a small
win-rate gap (spec §24), and a helper to measure proxy-vs-real correlation
(spec §9).
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from ..ai.evaluator import evaluate_game
from ..ai.policy import Policy
from ..game.game_simulator import difficulty_edge, simulate_game
from ..simulation.auction_simulator import run_auction
from ..simulation.auction_state import GameConfig
from ..simulation.roster import Roster
from .scenarios import Scenario


# ─── Confidence ─────────────────────────────────────────────────────────────
def wilson_interval(wins: float, n: int, z: float = 1.96) -> Tuple[float, float]:
    """Wilson score interval for a binomial proportion. Used so a 52% vs 51.7%
    difference isn't treated as meaningful without support (spec §24)."""
    if n == 0:
        return (0.0, 1.0)
    p = wins / n
    denom = 1 + z * z / n
    center = (p + z * z / (2 * n)) / denom
    margin = (z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / denom
    return (max(0.0, center - margin), min(1.0, center + margin))


@dataclass
class GroundTruthResult:
    win_rate: float          # of the "hero" seat (the policy under test)
    games: int
    ci_low: float
    ci_high: float
    avg_margin: float        # avg (hero_score - opp_score)


def ground_truth_win_rate(
    hero_roster: Roster,
    opp_roster: Roster,
    *,
    season: str = "2025-26",
    games: int = 200,
    seed_base: int = 0,
    hero_seat: str = "P1",
    hero_difficulty: str = "medium",
    opp_difficulty: str = "medium",
) -> GroundTruthResult:
    """Real-game win rate of `hero_roster` vs `opp_roster` over `games` seeded
    games. `seed_base` fixes the seed sequence so two policies can be compared on
    identical games (common random numbers)."""
    # Map difficulty to the per-possession execution edge the real sim applies.
    if hero_seat == "P1":
        edges = {"P1": difficulty_edge(hero_difficulty), "P2": difficulty_edge(opp_difficulty)}
        a, b = hero_roster, opp_roster
    else:
        edges = {"P1": difficulty_edge(opp_difficulty), "P2": difficulty_edge(hero_difficulty)}
        a, b = opp_roster, hero_roster

    wins = 0
    margin = 0
    for g in range(games):
        seed = (seed_base + g * 2654435761) & 0xFFFFFFFF
        res = simulate_game(a, b, season, seed, edges)
        hero_score = res.p1 if hero_seat == "P1" else res.p2
        opp_score = res.p2 if hero_seat == "P1" else res.p1
        if res.winner == hero_seat:
            wins += 1
        margin += hero_score - opp_score

    wr = wins / max(1, games)
    lo, hi = wilson_interval(wins, games)
    return GroundTruthResult(win_rate=wr, games=games, ci_low=lo, ci_high=hi, avg_margin=margin / max(1, games))


def build_rosters(
    scenario: Scenario,
    hero: Policy,
    opponent: Policy,
    hero_seat: str = "P1",
    opponent_personality: Optional[str] = None,
) -> Tuple[Roster, Roster]:
    """Run the auction to completion and return (hero_roster, opp_roster).

    `opponent_personality` optionally overrides the opponent seat's personality
    (used to build diverse ARCHETYPE opponents for robustness testing) without
    changing the hero seat, so the same hero policy is tested against many
    opponent styles."""
    opp_seat = "P2" if hero_seat == "P1" else "P1"
    seat_configs = scenario.seat_configs()
    if opponent_personality is not None:
        oc = seat_configs[opp_seat]
        seat_configs[opp_seat] = GameConfig(
            season=oc.season,
            budget_per_player=oc.budget_per_player,
            bid_increment=oc.bid_increment,
            difficulty=oc.difficulty,
            ai_personality=opponent_personality,
        )
    out = run_auction(
        scenario.game_id,
        scenario.config(),
        {hero_seat: hero, opp_seat: opponent},
        seat_configs=seat_configs,
        seed=scenario.seed,
        record_decisions=False,
    )
    return out.state.rosters[hero_seat], out.state.rosters[opp_seat]


def evaluate_policy_ground_truth(
    hero: Policy,
    opponent: Policy,
    scenarios: List[Scenario],
    *,
    games_per_matchup: int = 120,
    hero_seat: str = "P1",
) -> GroundTruthResult:
    """Across many auction scenarios, build rosters then play real games. Returns
    an aggregate real-game win rate + Wilson CI over the TOTAL games played."""
    total_wins = 0
    total_games = 0
    total_margin = 0.0
    for scn in scenarios:
        hero_roster, opp_roster = build_rosters(scn, hero, opponent, hero_seat)
        # Seed base tied to the scenario so comparisons across policies on the
        # SAME scenario use the SAME game seeds (common random numbers).
        res = ground_truth_win_rate(
            hero_roster,
            opp_roster,
            season=scn.config().season,
            games=games_per_matchup,
            seed_base=scn.seed,
            hero_seat=hero_seat,
            hero_difficulty=scn.difficulty_p1 if hero_seat == "P1" else scn.difficulty_p2,
            opp_difficulty=scn.difficulty_p2 if hero_seat == "P1" else scn.difficulty_p1,
        )
        total_wins += round(res.win_rate * games_per_matchup)
        total_games += games_per_matchup
        total_margin += res.avg_margin * games_per_matchup

    wr = total_wins / max(1, total_games)
    lo, hi = wilson_interval(total_wins, total_games)
    return GroundTruthResult(
        win_rate=wr, games=total_games, ci_low=lo, ci_high=hi,
        avg_margin=total_margin / max(1, total_games),
    )


# ─── Proxy-vs-real correlation (spec §9) ────────────────────────────────────
def spearman(xs: List[float], ys: List[float]) -> float:
    """Spearman rank correlation — measures whether the proxy RANKS policies the
    same way real games do (ranking agreement matters more than absolute fit)."""
    n = len(xs)
    if n < 2:
        return 0.0

    def ranks(v: List[float]) -> List[float]:
        order = sorted(range(n), key=lambda i: v[i])
        r = [0.0] * n
        i = 0
        while i < n:
            j = i
            while j + 1 < n and v[order[j + 1]] == v[order[i]]:
                j += 1
            avg = (i + j) / 2 + 1
            for k in range(i, j + 1):
                r[order[k]] = avg
            i = j + 1
        return r

    rx, ry = ranks(xs), ranks(ys)
    mx = sum(rx) / n
    my = sum(ry) / n
    cov = sum((rx[i] - mx) * (ry[i] - my) for i in range(n))
    vx = math.sqrt(sum((rx[i] - mx) ** 2 for i in range(n)))
    vy = math.sqrt(sum((ry[i] - my) ** 2 for i in range(n)))
    if vx == 0 or vy == 0:
        return 0.0
    return cov / (vx * vy)


def pearson(xs: List[float], ys: List[float]) -> float:
    n = len(xs)
    if n < 2:
        return 0.0
    mx = sum(xs) / n
    my = sum(ys) / n
    cov = sum((xs[i] - mx) * (ys[i] - my) for i in range(n))
    vx = math.sqrt(sum((x - mx) ** 2 for x in xs))
    vy = math.sqrt(sum((y - my) ** 2 for y in ys))
    if vx == 0 or vy == 0:
        return 0.0
    return cov / (vx * vy)
