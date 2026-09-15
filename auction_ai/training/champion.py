"""Champion/challenger scaffolding (spec §3, §16, §21, §22, §24).

The CHAMPION is the current production policy (v6). It is anchored, versioned,
and never overwritten during training. A CHALLENGER only replaces it after
statistically convincing evidence (see the promotion rule in challenger.py).

Every policy carries a MODEL ID recording exactly what it was trained/validated
against, so a policy validated against simulator version N is never silently
treated as validated against N+1.
"""
from __future__ import annotations

import hashlib
import json
import os
from dataclasses import asdict, dataclass, field
from typing import Optional

from ..ai.policy import Policy
from ..game import SIMULATION_VERSION

_ROOT = os.path.dirname(os.path.dirname(__file__))
MODELS_DIR = os.path.join(_ROOT, "models")
CHAMPION_DIR = os.path.join(MODELS_DIR, "champion")
CHAMPION_PATH = os.path.join(CHAMPION_DIR, "champion_policy.json")
LAST_KNOWN_GOOD = os.path.join(CHAMPION_DIR, "last_known_good_policy.json")
LEADERBOARD_PATH = os.path.join(CHAMPION_DIR, "leaderboard.json")

# The current production policy the champion is seeded from.
PRODUCTION_POLICY = os.path.join(_ROOT, "..", "lib", "arena", "data", "cpu-policy.json")
PLAYERS_PATH = os.path.join(_ROOT, "data", "players.json")


def player_data_version() -> str:
    """A stable fingerprint of the player pool (spec §21). Bumps automatically
    when ratings change, so a policy records which data it was tuned against."""
    with open(PLAYERS_PATH, "r", encoding="utf-8") as fh:
        blob = json.load(fh)
    digest = hashlib.sha256(json.dumps(blob, sort_keys=True).encode()).hexdigest()
    return f"players-{blob.get('season','?')}-{digest[:10]}"


@dataclass
class ModelId:
    """Provenance stamped onto every candidate/champion (spec §21)."""

    policy_version: str
    parent_policy: str
    simulation_version: str
    player_data_version: str
    training_seed: int

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ChampionRecord:
    """The champion policy + its provenance + its measured strength."""

    policy: Policy
    model_id: ModelId
    # Real-game win rate vs its own reference opponents at promotion time.
    reference_win_rate: float = 0.5
    promoted_from: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "policy": self.policy.to_dict(),
            "model_id": self.model_id.to_dict(),
            "reference_win_rate": self.reference_win_rate,
            "promoted_from": self.promoted_from,
        }

    @staticmethod
    def from_dict(d: dict) -> "ChampionRecord":
        mid = d["model_id"]
        return ChampionRecord(
            policy=Policy.from_dict(d["policy"]),
            model_id=ModelId(
                policy_version=mid["policy_version"],
                parent_policy=mid["parent_policy"],
                simulation_version=mid["simulation_version"],
                player_data_version=mid["player_data_version"],
                training_seed=int(mid["training_seed"]),
            ),
            reference_win_rate=d.get("reference_win_rate", 0.5),
            promoted_from=d.get("promoted_from"),
        )


def _ensure_dir() -> None:
    os.makedirs(CHAMPION_DIR, exist_ok=True)


def load_production_policy() -> Policy:
    with open(PRODUCTION_POLICY, "r", encoding="utf-8") as fh:
        return Policy.from_dict(json.load(fh))


def init_champion_from_production(seed: int = 0) -> ChampionRecord:
    """Seed the champion from the deployed production policy (v6)."""
    pol = load_production_policy()
    rec = ChampionRecord(
        policy=pol,
        model_id=ModelId(
            policy_version=f"v{pol.version}",
            parent_policy="production",
            simulation_version=SIMULATION_VERSION,
            player_data_version=player_data_version(),
            training_seed=seed,
        ),
        reference_win_rate=0.5,
        promoted_from="production",
    )
    return rec


def load_champion(seed: int = 0) -> ChampionRecord:
    """Load the anchored champion, or seed it from production on first run."""
    if os.path.exists(CHAMPION_PATH):
        with open(CHAMPION_PATH, "r", encoding="utf-8") as fh:
            return ChampionRecord.from_dict(json.load(fh))
    rec = init_champion_from_production(seed)
    save_champion(rec)
    return rec


def save_champion(rec: ChampionRecord) -> None:
    _ensure_dir()
    # Preserve the outgoing champion as last-known-good BEFORE overwriting.
    if os.path.exists(CHAMPION_PATH):
        with open(CHAMPION_PATH, "r", encoding="utf-8") as fh:
            prev = fh.read()
        with open(LAST_KNOWN_GOOD, "w", encoding="utf-8") as fh:
            fh.write(prev)
    with open(CHAMPION_PATH, "w", encoding="utf-8") as fh:
        json.dump(rec.to_dict(), fh, indent=2)


def revert_to_last_known_good() -> Optional[ChampionRecord]:
    """Production fallback (spec §24): if a promotion turns out bad, restore the
    previous champion."""
    if not os.path.exists(LAST_KNOWN_GOOD):
        return None
    with open(LAST_KNOWN_GOOD, "r", encoding="utf-8") as fh:
        rec = ChampionRecord.from_dict(json.load(fh))
    save_champion(rec)
    return rec
