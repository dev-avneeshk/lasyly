"""Export the trained best policy to a compact production artifact (spec §19).

Reads models/best_policy.json (produced by training) and writes a minimal,
Vercel-friendly JSON containing only what the app needs for inference: a version
and the weight vector. Also copies it into the Next.js app so the frontend can
load it directly.

CLI:
    python -m auction_ai.export.export_policy
    python -m auction_ai.export.export_policy --to lib/arena/data/cpu-policy.json
"""
from __future__ import annotations

import argparse
import json
import os

from ..ai.policy import DEFAULT_WEIGHTS, Policy

_ROOT = os.path.dirname(os.path.dirname(__file__))
_REPO = os.path.dirname(_ROOT)
BEST_PATH = os.path.join(_ROOT, "models", "best_policy.json")
DEFAULT_APP_DEST = os.path.join(_REPO, "lib", "arena", "data", "cpu-policy.json")


def build_export(policy: Policy) -> dict:
    """The exact shape the app's loader expects. Kept tiny and stable.

    We only export the *active* (non-reserved) weights so the artifact stays
    minimal and the app's fallback fills any missing key from its own defaults.
    """
    weights = {
        k: round(policy.weights.get(k, DEFAULT_WEIGHTS[k]), 4)
        for k in DEFAULT_WEIGHTS
        if k not in ("age_weight", "potential_weight")
    }
    return {"version": policy.version, "weights": weights}


def main() -> None:
    ap = argparse.ArgumentParser(description="Export the trained policy for production.")
    ap.add_argument("--policy", default=BEST_PATH, help="path to best_policy.json")
    ap.add_argument(
        "--to",
        default=DEFAULT_APP_DEST,
        help="destination in the Next.js app (lib/arena/data/cpu-policy.json)",
    )
    args = ap.parse_args()

    if not os.path.exists(args.policy):
        raise SystemExit(
            f"No trained policy at {args.policy}. Run training first:\n"
            f"  python -m auction_ai.training.train --simulations 2000 --generations 100"
        )

    with open(args.policy, "r", encoding="utf-8") as fh:
        policy = Policy.from_dict(json.load(fh))

    export = build_export(policy)
    os.makedirs(os.path.dirname(args.to), exist_ok=True)
    with open(args.to, "w", encoding="utf-8") as fh:
        json.dump(export, fh, indent=2)

    size = os.path.getsize(args.to)
    print(f"Exported policy v{export['version']} ({size} bytes) → {args.to}")
    print(json.dumps(export, indent=2))


if __name__ == "__main__":
    main()
