"""Full game simulation — faithful port of simulateGame() in
lib/arena/simulation.ts.

This is the GROUND TRUTH for training: it runs the same possession-based game
the user experiences and returns the winner + final score. Box-score narration,
MVP, and analysis text from the TS version are intentionally omitted — training
only needs the outcome.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional

from ..simulation.player_model import Player
from ..simulation.roster import Roster, starters
from ..simulation.rng import mulberry32
from ..simulation.team_simulator import build_team_profile, usage_shares
from .fatigue import credit_minutes, decay_stamina, manage_rotation
from .matchup import assign_matchups
from .possession import on_court_players, simulate_possession

QUARTERS = 4
POSSESSIONS_PER_QUARTER = 27
CLUTCH_CLOCK = 5 * 60
QUARTER_SECONDS = 12 * 60


def difficulty_edge(difficulty: str) -> float:
    """Port of difficultyEdge()."""
    if difficulty == "easy":
        return -0.03
    if difficulty == "hard":
        return 0.035
    return 0.0


@dataclass
class _TeamBox:
    points: int = 0
    fga: int = 0
    tpa: int = 0
    fgm: int = 0
    tpm: int = 0
    ftm: int = 0
    fta: int = 0
    reb: int = 0
    ast: int = 0
    tov: int = 0
    stl: int = 0
    blk: int = 0
    paint_points: int = 0
    fast_break_points: int = 0
    second_chance_points: int = 0


class _SimPlayer:
    __slots__ = (
        "owned", "team", "usage", "stamina", "on_court",
        "box_pts", "box_reb", "box_ast", "box_stl", "box_blk", "box_tov",
        "box_fgm", "box_fga", "box_tpm", "box_tpa", "box_ftm", "box_fta", "box_min",
    )

    def __init__(self, owned, team: str, usage: float):
        self.owned = owned
        self.team = team
        self.usage = usage
        self.stamina = float(owned.player.attributes["stamina"])
        self.on_court = False
        self.box_pts = self.box_reb = self.box_ast = 0
        self.box_stl = self.box_blk = self.box_tov = 0
        self.box_fgm = self.box_fga = self.box_tpm = self.box_tpa = 0
        self.box_ftm = self.box_fta = 0
        self.box_min = 0.0


class _SimTeam:
    def __init__(self, team: str, roster: Roster, opp_roster: Roster, edge: float):
        self.team = team
        self.profile = build_team_profile(team, roster)
        shares = usage_shares(roster)
        start = starters(roster)
        bench_owned = roster.slots["BENCH"]

        self.players: List[_SimPlayer] = []
        self.starters: List[_SimPlayer] = []
        for o in start:
            sp = _SimPlayer(o, team, shares.get(o.player.id, 0.2))
            sp.on_court = True
            self.players.append(sp)
            self.starters.append(sp)
        self.bench: Optional[_SimPlayer] = None
        if bench_owned:
            sp = _SimPlayer(bench_owned, team, 0.16)
            sp.on_court = False
            self.players.append(sp)
            self.bench = sp

        self.matchups = assign_matchups(roster, opp_roster)
        self.box = _TeamBox()
        self.score = 0
        self.edge = edge


@dataclass
class GameOutcome:
    winner: str
    p1: int
    p2: int
    ot: int = 0


def simulate_game(
    roster_p1: Roster,
    roster_p2: Roster,
    season: str,
    seed: int,
    edges: Optional[Dict[str, float]] = None,
) -> GameOutcome:
    edges = edges or {"P1": 0.0, "P2": 0.0}
    rng = mulberry32(seed & 0xFFFFFFFF)
    p1 = _SimTeam("P1", roster_p1, roster_p2, edges.get("P1", 0.0))
    p2 = _SimTeam("P2", roster_p2, roster_p1, edges.get("P2", 0.0))

    offense = p1 if rng() < 0.5 else p2

    for _q in range(1, QUARTERS + 1):
        clock = QUARTER_SECONDS
        per_poss = QUARTER_SECONDS / (POSSESSIONS_PER_QUARTER * 2)
        after_oreb = False
        for poss in range(POSSESSIONS_PER_QUARTER * 2):
            defense = p2 if offense is p1 else p1
            clutch = _q == QUARTERS and clock <= CLUTCH_CLOCK
            transition = rng() < 0.14 + (offense.profile.transition_offense - defense.profile.transition_defense) / 900
            if poss % 4 == 0:
                manage_rotation(offense, rng, clutch)
                manage_rotation(defense, rng, clutch)
            decay_stamina(offense)
            decay_stamina(defense)
            res = simulate_possession(offense, defense, rng, clutch, transition)
            if after_oreb and res.points > 0:
                offense.box.second_chance_points += res.points
            clock -= per_poss * (0.6 if transition else 1)
            credit_minutes(offense, per_poss)
            credit_minutes(defense, per_poss)
            kept = res.second_chance
            after_oreb = kept
            if not kept:
                offense = defense
            if clock <= 0:
                break
        for t in (p1, p2):
            for pl in t.players:
                if not pl.on_court:
                    pl.stamina = min(pl.owned.player.attributes["stamina"], pl.stamina + 12)

    ot = 0
    while p1.score == p2.score and ot < 8:
        ot += 1
        clock = 5 * 60
        per_poss = (5 * 60) / (12 * 2)
        after_oreb = False
        for poss in range(24):
            defense = p2 if offense is p1 else p1
            if poss % 4 == 0:
                manage_rotation(offense, rng, True)
                manage_rotation(defense, rng, True)
            decay_stamina(offense)
            decay_stamina(defense)
            res = simulate_possession(offense, defense, rng, True, rng() < 0.12)
            if after_oreb and res.points > 0:
                offense.box.second_chance_points += res.points
            clock -= per_poss
            credit_minutes(offense, per_poss)
            credit_minutes(defense, per_poss)
            kept = res.second_chance
            after_oreb = kept
            if not kept:
                offense = defense
            if clock <= 0:
                break

    if p1.score == p2.score:
        # Tiebreak: a made FT by the higher-overall team (port of the guarantee).
        winner_team = p1 if p1.profile.overall >= p2.profile.overall else p2
        winner_team.score += 1

    winner = "P1" if p1.score > p2.score else "P2"
    return GameOutcome(winner=winner, p1=p1.score, p2=p2.score, ot=ot)
