"""Proxy calibration + proxy-hacking detection (spec §9, §10, §12).

Calibration: collect (proxy_score, real_win_rate) observations across policies
and fit a simple linear map proxy → predicted real WR, plus the residual error.
We do NOT assume the proxy is correct — we MEASURE its error and expose it so the
training loop can decide how much to trust the fast filter.

Proxy-hacking detection: a policy with a high proxy score but a poor real win
rate (relative to the calibrated expectation) is flagged. Training must prefer
real win rate; this surfaces when the two disagree.
"""
from __future__ import annotations

import json
import os
import statistics
from dataclasses import asdict, dataclass, field
from typing import List, Optional, Tuple

from .ground_truth import pearson, spearman

_ROOT = os.path.dirname(os.path.dirname(__file__))
CALIB_PATH = os.path.join(_ROOT, "models", "proxy_calibration.json")


@dataclass
class Observation:
    proxy: float
    real_wr: float
    policy_version: int = 0


@dataclass
class Calibration:
    slope: float
    intercept: float
    residual_std: float
    spearman: float
    pearson: float
    n: int
    # A policy whose real WR is this many residual-std BELOW its proxy-predicted
    # WR is flagged as proxy-hacking.
    hacking_sigma: float = 1.5

    def predict(self, proxy: float) -> float:
        return self.slope * proxy + self.intercept

    def is_proxy_hacking(self, proxy: float, real_wr: float) -> bool:
        if self.residual_std <= 1e-9:
            return False
        expected = self.predict(proxy)
        return (expected - real_wr) > self.hacking_sigma * self.residual_std

    def to_dict(self) -> dict:
        return asdict(self)

    @staticmethod
    def from_dict(d: dict) -> "Calibration":
        return Calibration(
            slope=d["slope"], intercept=d["intercept"], residual_std=d["residual_std"],
            spearman=d["spearman"], pearson=d["pearson"], n=d["n"],
            hacking_sigma=d.get("hacking_sigma", 1.5),
        )


def fit_calibration(obs: List[Observation]) -> Calibration:
    """Least-squares proxy → real_wr, with residual std + correlations."""
    n = len(obs)
    if n < 2:
        return Calibration(0.0, obs[0].real_wr if obs else 0.5, 0.0, 0.0, 0.0, n)
    xs = [o.proxy for o in obs]
    ys = [o.real_wr for o in obs]
    mx = sum(xs) / n
    my = sum(ys) / n
    var_x = sum((x - mx) ** 2 for x in xs)
    if var_x <= 1e-12:
        # Proxy is constant across observations — it carries no ranking info.
        return Calibration(0.0, my, statistics.pstdev(ys) if n > 1 else 0.0,
                           0.0, 0.0, n)
    slope = sum((xs[i] - mx) * (ys[i] - my) for i in range(n)) / var_x
    intercept = my - slope * mx
    resid = [ys[i] - (slope * xs[i] + intercept) for i in range(n)]
    residual_std = statistics.pstdev(resid) if n > 1 else 0.0
    return Calibration(
        slope=slope, intercept=intercept, residual_std=residual_std,
        spearman=spearman(xs, ys), pearson=pearson(xs, ys), n=n,
    )


def save_calibration(calib: Calibration, path: str = CALIB_PATH) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(calib.to_dict(), fh, indent=2)


def load_calibration(path: str = CALIB_PATH) -> Optional[Calibration]:
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as fh:
        return Calibration.from_dict(json.load(fh))


@dataclass
class HackingReport:
    """How well proxy ranked the ground-truth-evaluated survivors this cycle."""

    rank_spearman: float
    flagged: int
    total: int
    note: str = ""


def detect_proxy_hacking(pairs: List[Tuple[float, float]], calib: Optional[Calibration]) -> HackingReport:
    """`pairs` = [(proxy, real_wr), ...] for the survivors that got ground truth.
    Reports rank agreement + how many look like proxy-hacking under calibration."""
    if len(pairs) < 2:
        return HackingReport(rank_spearman=0.0, flagged=0, total=len(pairs), note="too few to assess")
    proxies = [p for p, _ in pairs]
    reals = [r for _, r in pairs]
    rho = spearman(proxies, reals)
    flagged = 0
    if calib is not None:
        flagged = sum(1 for p, r in pairs if calib.is_proxy_hacking(p, r))
    note = ""
    if rho < 0:
        note = "proxy RANKS survivors OPPOSITE to real games — trust ground truth only"
    elif rho < 0.4:
        note = "weak proxy agreement among survivors — ground truth is doing the real work"
    return HackingReport(rank_spearman=rho, flagged=flagged, total=len(pairs), note=note)
