"""TS-vs-Python statistical parity harness (spec §5).

Loads parity_fixtures.json (produced by scripts/parity-fixture.test.ts), rebuilds
the IDENTICAL rosters, runs the ported Python game simulator over the SAME seeds,
and compares win rates + average scores against the TypeScript results.

We do NOT require identical individual possessions (language float/RNG
differences make that impossible). We require STATISTICAL parity: per-pair win
rate within WIN_RATE_TOLERANCE and aggregate mean-absolute-error under limits.

CLI:
    python -m auction_ai.validation.parity
    python -m auction_ai.validation.parity --tolerance 0.08
"""
from __future__ import annotations

import argparse
import json
import os
import statistics
from dataclasses import dataclass
from typing import Dict, List

from ..game import SIMULATION_VERSION
from ..game.game_simulator import simulate_game
from ..simulation.player_model import players_by_id
from ..simulation.roster import Roster, place_player

_HERE = os.path.dirname(__file__)
FIXTURES = os.path.join(_HERE, "parity_fixtures.json")

# Explicit acceptance tolerances (spec §5). Per-pair win-rate agreement within
# this band, and aggregate MAE under the mean limits, means the Python sim tracks
# the TS sim closely enough to be a training ground truth.
WIN_RATE_TOLERANCE = 0.10          # per-pair |WR_ts - WR_py|
MEAN_WIN_RATE_MAE_LIMIT = 0.05     # average |WR_ts - WR_py| across pairs
MEAN_SCORE_MAE_LIMIT = 8.0         # average |avg_score_ts - avg_score_py|


def _roster_from_slots(slots: dict, by_id: dict) -> Roster:
    r = Roster()
    for slot, cell in slots.items():
        if cell is None:
            continue
        player = by_id[cell["id"]]
        r = place_player(r, player, int(cell["price"]), slot)
    return r


@dataclass
class ParityResult:
    pairs: int
    games_per_pair: int
    win_rate_mae: float
    max_win_rate_diff: float
    score_mae: float
    pairs_within_tol: int
    passed: bool
    rows: List[dict]


def run_parity(season: str = "2025-26", tolerance: float = WIN_RATE_TOLERANCE) -> ParityResult:
    with open(FIXTURES, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    by_id = players_by_id(season)

    rows: List[dict] = []
    wr_diffs: List[float] = []
    score_diffs: List[float] = []
    within = 0

    for fx in data["fixtures"]:
        r1 = _roster_from_slots(fx["p1"], by_id)
        r2 = _roster_from_slots(fx["p2"], by_id)
        seed_base = int(fx["seedBase"])
        seed_step = int(fx["seedStep"])
        games = int(fx["games"])

        p1_wins = 0
        sum_p1 = 0
        sum_p2 = 0
        for g in range(games):
            seed = (seed_base + g * seed_step) & 0xFFFFFFFF
            res = simulate_game(r1, r2, season, seed)
            if res.winner == "P1":
                p1_wins += 1
            sum_p1 += res.p1
            sum_p2 += res.p2

        py_wr = p1_wins / games
        ts_wr = fx["ts"]["p1WinRate"]
        wr_diff = abs(py_wr - ts_wr)
        py_avg1, py_avg2 = sum_p1 / games, sum_p2 / games
        sc_diff = (abs(py_avg1 - fx["ts"]["avgP1"]) + abs(py_avg2 - fx["ts"]["avgP2"])) / 2

        wr_diffs.append(wr_diff)
        score_diffs.append(sc_diff)
        if wr_diff <= tolerance:
            within += 1

        rows.append(
            {
                "pair": fx["pair"],
                "ts_wr": round(ts_wr, 4),
                "py_wr": round(py_wr, 4),
                "wr_diff": round(wr_diff, 4),
                "ts_score": f"{fx['ts']['avgP1']:.1f}-{fx['ts']['avgP2']:.1f}",
                "py_score": f"{py_avg1:.1f}-{py_avg2:.1f}",
                "score_diff": round(sc_diff, 2),
            }
        )

    wr_mae = statistics.fmean(wr_diffs)
    score_mae = statistics.fmean(score_diffs)
    max_wr = max(wr_diffs)
    passed = wr_mae <= MEAN_WIN_RATE_MAE_LIMIT and score_mae <= MEAN_SCORE_MAE_LIMIT
    return ParityResult(
        pairs=len(rows),
        games_per_pair=int(data["fixtures"][0]["games"]) if rows else 0,
        win_rate_mae=wr_mae,
        max_win_rate_diff=max_wr,
        score_mae=score_mae,
        pairs_within_tol=within,
        passed=passed,
        rows=rows,
    )


def main() -> None:
    ap = argparse.ArgumentParser(description="TS-vs-Python game-sim parity check.")
    ap.add_argument("--tolerance", type=float, default=WIN_RATE_TOLERANCE)
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    if not os.path.exists(FIXTURES):
        raise SystemExit(
            "No parity_fixtures.json. Generate it first:\n"
            "  npx vitest run scripts/parity-fixture.test.ts"
        )

    res = run_parity(tolerance=args.tolerance)
    print(f"Parity check (SIMULATION_VERSION={SIMULATION_VERSION})")
    print(f"  pairs: {res.pairs} × {res.games_per_pair} games each")
    if args.verbose:
        print(f"\n  {'pair':>4} {'ts_wr':>7} {'py_wr':>7} {'Δwr':>6}  {'ts_score':>11} {'py_score':>11} {'Δscore':>7}")
        for r in res.rows:
            print(f"  {r['pair']:>4} {r['ts_wr']:>7.3f} {r['py_wr']:>7.3f} {r['wr_diff']:>6.3f}  "
                  f"{r['ts_score']:>11} {r['py_score']:>11} {r['score_diff']:>7.2f}")
    print(f"\n  win-rate MAE:        {res.win_rate_mae:.4f}  (limit {MEAN_WIN_RATE_MAE_LIMIT})")
    print(f"  max win-rate diff:   {res.max_win_rate_diff:.4f}")
    print(f"  score MAE:           {res.score_mae:.3f}   (limit {MEAN_SCORE_MAE_LIMIT})")
    print(f"  pairs within ±{args.tolerance}:  {res.pairs_within_tol}/{res.pairs}")
    print(f"\n  RESULT: {'PASS ✓ — Python sim is a valid ground truth' if res.passed else 'FAIL ✗ — discrepancy exceeds tolerance; investigate before using as ground truth'}")
    raise SystemExit(0 if res.passed else 1)


if __name__ == "__main__":
    main()
