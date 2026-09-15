"""Paired common-random-number (CRN) evaluation with a progressive game budget
(spec §4, §5, §8, §19).

To compare a CHALLENGER against the CHAMPION with minimal Monte-Carlo noise, both
policies are evaluated on the EXACT same conditions:

  * same auction scenarios (so both build rosters under identical boards)
  * same opponent (roster + strategy)
  * same game seeds

The comparison is PAIRED per game: for a given (scenario, opponent, seed) we run
the challenger's game and the champion's game and compare their win/loss. The
statistic is the mean paired difference d_i = win_challenger_i − win_champion_i;
its mean is (WR_challenger − WR_champion) and we put a normal CI on it. Pairing
cancels the shared scenario/seed variance, so the delta CI is far tighter than
two independent win-rate CIs.

A progressive ladder (200 → 1k → 5k → 20k games) rejects clearly-inferior
challengers cheaply and only spends a large budget on genuine contenders.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Tuple

from ..ai.policy import Policy
from ..game.game_simulator import difficulty_edge, simulate_game
from ..simulation.roster import Roster
from .ground_truth import build_rosters
from .opponents import ARCHETYPE_PERSONALITIES
from .scenarios import Scenario

# Default progressive ladder: (games_per_matchup, keep-if-delta-CI-upper-bound
# is still ≥ this "give-up" threshold). Stage cutoffs are on the DELTA.
DEFAULT_LADDER = [200, 1000, 5000, 20000]


@dataclass
class PairedResult:
    """Paired challenger-vs-champion comparison on identical conditions."""

    challenger_wr: float
    champion_wr: float
    delta: float                 # challenger_wr − champion_wr
    delta_ci: Tuple[float, float]
    games: int
    # Per-archetype breakdown (opponent personality → delta), filled by caller.
    by_archetype: Dict[str, float] = field(default_factory=dict)


def _play_matchup(
    hero_roster: Roster,
    opp_roster: Roster,
    season: str,
    seed_base: int,
    games: int,
    hero_edge: float,
    opp_edge: float,
) -> List[int]:
    """Return a 0/1 win vector for `hero_roster` vs `opp_roster` over `games`
    seeded games. The seed sequence is fixed by seed_base for CRN pairing."""
    wins: List[int] = []
    edges = {"P1": hero_edge, "P2": opp_edge}
    for g in range(games):
        seed = (seed_base + g * 2654435761) & 0xFFFFFFFF
        res = simulate_game(hero_roster, opp_roster, season, seed, edges)
        wins.append(1 if res.winner == "P1" else 0)
    return wins


@dataclass
class _Matchup:
    """A prebuilt (scenario, archetype) matchup: rosters built ONCE and reused
    across every ladder stage/seed so the expensive auctions aren't repeated."""

    arch_name: str
    season: str
    hero_edge: float
    opp_edge: float
    seed_base: int
    chal_roster: Roster
    opp_roster_c: Roster
    champ_roster: Roster
    opp_roster_m: Roster


def build_matchups(
    challenger: Policy,
    champion: Policy,
    scenarios: List[Scenario],
    opponents: List[Tuple[str, Policy]],
    *,
    seed_salt: int = 0,
) -> List[_Matchup]:
    """Run the auctions ONCE per (scenario, archetype) to build all rosters. This
    is the expensive part; the progressive ladder replays games on these fixed
    rosters, so auctions are never repeated across stages."""
    matchups: List[_Matchup] = []
    for scn in scenarios:
        season = scn.config().season
        hero_edge = difficulty_edge(scn.difficulty_p1)
        opp_edge = difficulty_edge(scn.difficulty_p2)
        for arch_name, opp_pol in opponents:
            persona = ARCHETYPE_PERSONALITIES.get(arch_name)
            chal_roster, opp_roster_c = build_rosters(scn, challenger, opp_pol, hero_seat="P1", opponent_personality=persona)
            champ_roster, opp_roster_m = build_rosters(scn, champion, opp_pol, hero_seat="P1", opponent_personality=persona)
            seed_base = (scn.seed ^ (hash(arch_name) & 0xFFFF) ^ (seed_salt * 2654435761)) & 0xFFFFFFFF
            matchups.append(_Matchup(
                arch_name=arch_name, season=season, hero_edge=hero_edge, opp_edge=opp_edge,
                seed_base=seed_base, chal_roster=chal_roster, opp_roster_c=opp_roster_c,
                champ_roster=champ_roster, opp_roster_m=opp_roster_m,
            ))
    return matchups


def paired_compare(
    challenger: Policy,
    champion: Policy,
    scenarios: List[Scenario],
    opponents: List[Tuple[str, Policy]],
    *,
    games_per_matchup: int,
    seed_salt: int = 0,
    matchups: Optional[List["_Matchup"]] = None,
) -> PairedResult:
    """Paired CRN comparison. For every (scenario, opponent) the challenger and
    the champion EACH build their roster against the SAME opponent roster and
    play the SAME game seeds; we compare their per-game wins pairwise.

    Pass `matchups` (from build_matchups) to reuse prebuilt rosters and avoid
    re-running auctions on every ladder stage.
    """
    diffs: List[float] = []
    chal_wins = 0
    champ_wins = 0
    n = 0
    if matchups is None:
        matchups = build_matchups(challenger, champion, scenarios, opponents, seed_salt=seed_salt)
    arch_diffs: Dict[str, List[float]] = {m.arch_name: [] for m in matchups}

    for m in matchups:
        arch_name = m.arch_name
        chal_v = _play_matchup(m.chal_roster, m.opp_roster_c, m.season, m.seed_base, games_per_matchup, m.hero_edge, m.opp_edge)
        champ_v = _play_matchup(m.champ_roster, m.opp_roster_m, m.season, m.seed_base, games_per_matchup, m.hero_edge, m.opp_edge)

        for i in range(games_per_matchup):
            d = chal_v[i] - champ_v[i]
            diffs.append(d)
            arch_diffs[arch_name].append(d)
            chal_wins += chal_v[i]
            champ_wins += champ_v[i]
            n += 1

    if n == 0:
        return PairedResult(0.5, 0.5, 0.0, (0.0, 0.0), 0)

    mean_d = sum(diffs) / n
    # Sample std of paired diffs → normal CI on the mean difference.
    if n > 1:
        var = sum((d - mean_d) ** 2 for d in diffs) / (n - 1)
        se = math.sqrt(var / n)
    else:
        se = 0.0
    ci = (mean_d - 1.96 * se, mean_d + 1.96 * se)

    by_arch = {name: (sum(v) / len(v) if v else 0.0) for name, v in arch_diffs.items()}
    return PairedResult(
        challenger_wr=chal_wins / n,
        champion_wr=champ_wins / n,
        delta=mean_d,
        delta_ci=ci,
        games=n,
        by_archetype=by_arch,
    )


@dataclass
class ProgressiveVerdict:
    result: PairedResult
    stage_reached: int
    stages: List[dict]
    survived: bool          # still a contender after the ladder
    reason: str


def progressive_compare(
    challenger: Policy,
    champion: Policy,
    scenarios: List[Scenario],
    opponents: List[Tuple[str, Policy]],
    *,
    ladder: Optional[List[int]] = None,
    min_margin: float = 0.005,
    seed_salt: int = 0,
) -> ProgressiveVerdict:
    """Run the progressive ladder. At each stage we re-evaluate on MORE games
    (the stage count is games-per-matchup) and gate:

      * give up early if the delta CI UPPER bound is below `min_margin`
        (the challenger is very unlikely to be a real improvement), OR if the
        delta is clearly negative.
      * otherwise advance to the next, larger stage.

    Survives the ladder ⇒ the challenger is a genuine contender worth a full,
    statistically-meaningful evaluation.
    """
    ladder = ladder or DEFAULT_LADDER
    stages: List[dict] = []
    last: Optional[PairedResult] = None

    # Build rosters ONCE (the expensive auctions) and reuse across all stages.
    # Note: all stages share the same rosters; the growing game count is what
    # tightens the CI, and each stage uses a different seed_salt so the game
    # seeds differ stage-to-stage (fresh samples, not re-runs).
    matchups = build_matchups(challenger, champion, scenarios, opponents, seed_salt=seed_salt)

    for i, games in enumerate(ladder):
        # Re-seed the game stream per stage for independent samples, but keep the
        # SAME rosters. seed_salt shifts the seed_base inside each matchup.
        for m in matchups:
            m.seed_base = (m.seed_base + (i + 1) * 1013904223) & 0xFFFFFFFF
        res = paired_compare(
            challenger, champion, scenarios, opponents,
            games_per_matchup=games, seed_salt=seed_salt + i, matchups=matchups,
        )
        last = res
        stages.append({
            "stage": i,
            "games_per_matchup": games,
            "total_games": res.games,
            "delta": round(res.delta, 5),
            "delta_ci": [round(res.delta_ci[0], 5), round(res.delta_ci[1], 5)],
            "challenger_wr": round(res.challenger_wr, 4),
            "champion_wr": round(res.champion_wr, 4),
        })
        # Cutoff: the challenger cannot plausibly clear the margin.
        if res.delta_ci[1] < min_margin:
            return ProgressiveVerdict(res, i, stages, survived=False,
                                      reason=f"delta CI upper {res.delta_ci[1]:+.4f} < min_margin {min_margin} at stage {i}")

    return ProgressiveVerdict(last, len(ladder) - 1, stages, survived=True,
                              reason="survived the full ladder — genuine contender")
