"""Simulator version-drift detection (spec §28, §29).

If the production TypeScript game engine changes (simulation.ts, matchup.ts,
ratings, fatigue, usage, difficulty), the Python ground-truth port can become
stale — and any policy trained against the stale port is no longer trustworthy.

This runs the parity harness; if parity now FAILS (TS and Python disagree beyond
tolerance), the ported simulator is stale and we mark the learned policy as
requiring retraining/revalidation.

Workflow after a game-engine change:
    1. npx vitest run scripts/parity-fixture.test.ts   # regenerate TS fixtures
    2. python -m auction_ai.validation.drift            # check parity
    3. if FAIL → update the Python port to match, bump SIMULATION_VERSION, retrain

CLI:
    python -m auction_ai.validation.drift
"""
from __future__ import annotations

import argparse
import json
import os

from ..game import SIMULATION_VERSION
from .parity import run_parity

_ROOT = os.path.dirname(os.path.dirname(__file__))
STALE_MARKER = os.path.join(_ROOT, "models", "STALE_POLICY.txt")


def main() -> None:
    ap = argparse.ArgumentParser(description="Detect simulator drift via parity.")
    ap.add_argument("--tolerance", type=float, default=0.10)
    args = ap.parse_args()

    res = run_parity(tolerance=args.tolerance)
    print(f"Drift check (SIMULATION_VERSION={SIMULATION_VERSION})")
    print(f"  win-rate MAE {res.win_rate_mae:.4f}, score MAE {res.score_mae:.3f}, "
          f"{res.pairs_within_tol}/{res.pairs} pairs within tolerance")

    if res.passed:
        # Parity holds → port is in sync with the TS engine.
        if os.path.exists(STALE_MARKER):
            os.remove(STALE_MARKER)
        print("  RESULT: IN SYNC ✓ — trained policy remains valid for this engine version.")
        raise SystemExit(0)

    # Parity broke → the port is stale relative to the TS engine.
    with open(STALE_MARKER, "w", encoding="utf-8") as fh:
        fh.write(
            f"Parity FAILED at SIMULATION_VERSION={SIMULATION_VERSION}\n"
            f"win_rate_mae={res.win_rate_mae:.4f} score_mae={res.score_mae:.3f}\n"
            "The Python ground-truth port is stale relative to the TypeScript game\n"
            "engine. The current learned policy must be revalidated/retrained after\n"
            "updating the port and bumping SIMULATION_VERSION.\n"
        )
    print(f"  RESULT: DRIFT DETECTED ✗ — wrote {STALE_MARKER}. Policy marked STALE; retrain after fixing the port.")
    raise SystemExit(1)


if __name__ == "__main__":
    main()
