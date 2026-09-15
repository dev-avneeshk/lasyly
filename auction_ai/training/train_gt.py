"""Hierarchical ground-truth trainer (spec §2, §6, §11, §12, §22, §23, §30).

The real-game-optimizing training loop:

    GENERATE population (mutate best)
        → STAGE 1: fast proxy scores every candidate
        → keep the top survivor_fraction
        → STAGE 2: REAL game simulation ranks survivors (common random seeds)
        → pick winner by ground-truth win rate (with Wilson confidence)
        → behavior guardrail on the winner
        → periodically: ground-truth TOURNAMENT + proxy CALIBRATION refresh
        → keep 3 model tracks: best_proxy / best_ground_truth / best_behavior
    REPEAT

The proxy is only a search shortcut; the real game simulator is the judge. A
generation "improves" only when the winner's real win rate improves on held-out
validation while passing the behavior guardrail with zero hard-rule violations.

CLI:
    python -m auction_ai.training.train_gt --generations 20 --population 24 \
        --proxy-scenarios 60 --gt-scenarios 10 --games 120 --gt-every 4
"""
from __future__ import annotations

import argparse
import json
import os
import random
import time
from dataclasses import asdict
from multiprocessing import Pool, cpu_count
from typing import Dict, List, Optional, Tuple

from ..ai.policy import Policy
from ..ai.selection import two_stage_select
from ..game import SIMULATION_VERSION
from ..validation.behavioral import BEHAVIOR_GUARDRAIL, evaluate_behavior, passes_guardrail
from .calibration import Calibration, Observation, fit_calibration, save_calibration
from .evaluation import benchmark_policy
from .ground_truth import evaluate_policy_ground_truth, wilson_interval
from ..ai.learner import exploration_for, LearnerConfig, mutate_pair
from .opponents import build_opponent_pool
from .scenarios import generate_scenarios, Scenario

_ROOT = os.path.dirname(os.path.dirname(__file__))
MODELS_DIR = os.path.join(_ROOT, "models")
GT_DIR = os.path.join(MODELS_DIR, "ground_truth")
CHECKPOINT_DIR = os.path.join(GT_DIR, "checkpoints")
CURVE_PATH = os.path.join(GT_DIR, "learning_curve.json")
TRAINING_DATA_PATH = os.path.join(GT_DIR, "training_data.jsonl")

BEST_GROUND_TRUTH = os.path.join(GT_DIR, "best_ground_truth_policy.json")
BEST_PROXY = os.path.join(GT_DIR, "best_proxy_policy.json")
BEST_BEHAVIOR = os.path.join(GT_DIR, "best_behavior_policy.json")


# ─── Parallel proxy scorer ──────────────────────────────────────────────────
_POOL_CTX: dict = {}


def _proxy_worker(args: Tuple[dict, List[Scenario], dict]) -> Tuple[dict, float]:
    cand_dict, scenarios, opp_dict = args
    cand = Policy.from_dict(cand_dict)
    opp = Policy.from_dict(opp_dict)
    score = benchmark_policy(cand, scenarios, opponent=opp).reward
    return cand_dict, score


def _ensure_dirs() -> None:
    os.makedirs(CHECKPOINT_DIR, exist_ok=True)


def _save(path: str, obj) -> None:
    _ensure_dirs()
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, indent=2)


def _append_jsonl(path: str, obj: dict) -> None:
    _ensure_dirs()
    with open(path, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(obj) + "\n")


def train_ground_truth(
    *,
    generations: int = 20,
    population: int = 24,
    proxy_scenarios: int = 60,
    gt_scenarios: int = 10,
    games_per_matchup: int = 120,
    survivor_fraction: float = 0.2,
    gt_every: int = 4,
    seed: int = 42,
    workers: Optional[int] = None,
    patience: int = 10,
    init: str = "default",
) -> Policy:
    _ensure_dirs()
    rng = random.Random(seed)
    workers = workers or max(1, cpu_count())
    lcfg = LearnerConfig(population=population, generations=generations)

    # Held-out VALIDATION scenarios (never trained on) for both proxy + ground
    # truth, fixed across the run so the learning curve is comparable.
    val_proxy = generate_scenarios(proxy_scenarios, master_seed=seed + 1, partition="validation")
    val_gt = generate_scenarios(gt_scenarios, master_seed=seed + 2, partition="validation")

    baseline = Policy.default()
    parent = _init_policy(init, rng)

    best_gt: Policy = parent.clone()
    best_gt_wr = -1.0
    best_proxy_pol: Policy = parent.clone()
    best_proxy_val = float("-inf")
    best_behavior_pol: Policy = parent.clone()
    best_behavior_val = -1.0
    history_bests: List[Policy] = [baseline]

    since_improve = 0
    curve: List[dict] = []
    calib: Optional[Calibration] = None
    calib_obs: List[Observation] = []

    pool = Pool(processes=workers) if workers > 1 else None
    try:
        for gen in range(generations):
            t0 = time.time()
            sigma = exploration_for(gen, lcfg)

            # ── population: parent (elitism) + antithetic mutants ──
            candidates: List[Policy] = [parent.clone()]
            while len(candidates) < population:
                pos, neg = mutate_pair(parent, sigma, rng)
                candidates.append(pos)
                if len(candidates) < population:
                    candidates.append(neg)

            # Fresh TRAIN scenarios (train partition) for proxy filtering.
            train_proxy = generate_scenarios(proxy_scenarios, master_seed=seed + 1000 + gen, partition="train")
            train_gt = generate_scenarios(gt_scenarios, master_seed=seed + 2000 + gen, partition="train")

            # Diverse opponents (baseline + prior versions). Personalities come
            # from scenario seat configs; versions come from history.
            opponents = build_opponent_pool(baseline, history_bests, k=3)
            gt_opponent = opponents[0]  # baseline is the stable reference judge

            # Parallel proxy scorer over the whole population.
            def proxy_score_fn(p: Policy) -> float:
                return benchmark_policy(p, train_proxy, opponent=baseline).reward

            if pool is not None:
                jobs = [(c.to_dict(), train_proxy, baseline.to_dict()) for c in candidates]
                results = pool.map(_proxy_worker, jobs)
                score_map = {id(c): None for c in candidates}
                # Rebuild candidate objects in the returned order.
                scored_pairs = [(Policy.from_dict(cd), sc) for cd, sc in results]
                # Two-stage selection using precomputed proxy scores.
                sel = _select_with_precomputed(
                    scored_pairs, baseline, gt_opponent, train_gt,
                    survivor_fraction, games_per_matchup,
                )
            else:
                sel = two_stage_select(
                    candidates, baseline, gt_opponent, train_proxy, train_gt,
                    survivor_fraction=survivor_fraction, games_per_matchup=games_per_matchup,
                    proxy_score_fn=proxy_score_fn,
                )

            winner = sel.winner
            winner_cs = sel.winner_score

            # ── VALIDATE the winner on held-out sets ──
            val_proxy_score = benchmark_policy(winner, val_proxy, opponent=baseline).reward
            val_gt_res = evaluate_policy_ground_truth(
                winner, baseline, val_gt, games_per_matchup=games_per_matchup
            )
            behavior = evaluate_behavior(winner)
            beh_ok = passes_guardrail(behavior)

            # ── model-selection tracks ──
            improved_gt = val_gt_res.win_rate > best_gt_wr and beh_ok
            if improved_gt:
                best_gt = winner.clone()
                best_gt_wr = val_gt_res.win_rate
                since_improve = 0
            else:
                since_improve += 1
            if val_proxy_score > best_proxy_val:
                best_proxy_val = val_proxy_score
                best_proxy_pol = winner.clone()
            if behavior.total > best_behavior_val:
                best_behavior_val = behavior.total
                best_behavior_pol = winner.clone()

            # The PARENT for next gen follows the ground-truth track (subject to
            # behavior guardrail) — real games drive the search, not the proxy.
            parent = best_gt.clone()
            history_bests.append(best_gt.clone())

            # ── calibration observations from this gen's survivors ──
            for cs in sel.survivors:
                if cs.evaluated_gt and cs.ground_truth_wr is not None:
                    calib_obs.append(Observation(cs.proxy, cs.ground_truth_wr, winner.version))

            # ── periodic ground-truth tournament + calibration refresh ──
            tournament = None
            if gen % gt_every == 0 or gen == generations - 1:
                tournament = _ground_truth_tournament(
                    {"new_best": best_gt, "baseline": baseline, "best_proxy": best_proxy_pol},
                    val_gt, games_per_matchup,
                )
                if len(calib_obs) >= 4:
                    calib = fit_calibration(calib_obs)
                    save_calibration(calib)

            dt = time.time() - t0
            row = {
                "generation": gen,
                "simulation_version": SIMULATION_VERSION,
                "seed": seed,
                "exploration": round(sigma, 4),
                "proxy_val": round(val_proxy_score, 3),
                "gt_val_win_rate": round(val_gt_res.win_rate, 4),
                "gt_val_ci": [round(val_gt_res.ci_low, 4), round(val_gt_res.ci_high, 4)],
                "gt_val_margin": round(val_gt_res.avg_margin, 3),
                "behavior": round(behavior.total, 3),
                "behavior_ok": beh_ok,
                "best_gt_win_rate": round(best_gt_wr, 4),
                "proxy_hacking_in_survivors": sel.proxy_hacking_detected,
                "calibration_spearman": round(calib.spearman, 3) if calib else None,
                "tournament": tournament,
                "seconds": round(dt, 2),
                "policy_version": winner.version,
            }
            curve.append(row)
            _append_jsonl(TRAINING_DATA_PATH, {
                "generation": gen,
                "winner_weights": winner.to_dict(),
                "proxy_val": val_proxy_score,
                "gt_val_win_rate": val_gt_res.win_rate,
                "behavior": behavior.total,
                "survivors": [
                    {"proxy": cs.proxy, "gt_wr": cs.ground_truth_wr}
                    for cs in sel.survivors
                ],
            })
            print(
                f"gen {gen:3d} | σ={sigma:.3f} | proxy_val={val_proxy_score:8.2f} | "
                f"GT_val_WR={val_gt_res.win_rate:.3f} [{val_gt_res.ci_low:.3f},{val_gt_res.ci_high:.3f}] "
                f"| beh={behavior.total:.2f}{'' if beh_ok else '✗'} | best_GT={best_gt_wr:.3f} "
                f"| {'hack!' if sel.proxy_hacking_detected else '    '} {dt:.1f}s"
            )

            # persist
            _save(BEST_GROUND_TRUTH, best_gt.to_dict())
            _save(BEST_PROXY, best_proxy_pol.to_dict())
            _save(BEST_BEHAVIOR, best_behavior_pol.to_dict())
            _save(CURVE_PATH, {"simulation_version": SIMULATION_VERSION, "curve": curve})
            _save(os.path.join(CHECKPOINT_DIR, f"gen_{gen:03d}.json"),
                  {"best_gt": best_gt.to_dict(), "row": row})

            if since_improve >= patience:
                print(f"Early stopping: no GT-validation improvement for {patience} generations.")
                break
    finally:
        if pool is not None:
            pool.close()
            pool.join()

    print(f"\nGround-truth training done (SIMULATION_VERSION={SIMULATION_VERSION}).")
    print(f"  best_ground_truth WR (val): {best_gt_wr:.4f}  → {BEST_GROUND_TRUTH}")
    return best_gt


def _select_with_precomputed(
    scored_pairs, baseline, gt_opponent, gt_scenarios, survivor_fraction, games_per_matchup,
):
    """Two-stage selection when proxy scores were computed in parallel."""
    from ..ai.selection import CandidateScore, SelectionResult
    scored = [CandidateScore(policy=p, proxy=s) for p, s in scored_pairs]
    scored.sort(key=lambda c: c.proxy, reverse=True)
    n = max(3, min(len(scored), round(len(scored) * survivor_fraction)))
    survivors = scored[:n]
    for cs in survivors:
        gt = evaluate_policy_ground_truth(cs.policy, gt_opponent, gt_scenarios, games_per_matchup=games_per_matchup)
        cs.ground_truth_wr = gt.win_rate
        cs.ci_low, cs.ci_high, cs.avg_margin = gt.ci_low, gt.ci_high, gt.avg_margin
        cs.evaluated_gt = True
    survivors_by_gt = sorted(survivors, key=lambda c: (c.ground_truth_wr or 0, c.avg_margin or 0, c.proxy), reverse=True)
    winner = survivors_by_gt[0]
    hacking = survivors[0] is not winner
    return SelectionResult(winner.policy, winner, scored, survivors_by_gt, hacking)


def _ground_truth_tournament(policies: Dict[str, Policy], scenarios, games: int) -> dict:
    """Round-robin-ish: each named policy's real-game WR vs the baseline entry."""
    baseline = policies.get("baseline", Policy.default())
    out = {}
    for name, pol in policies.items():
        res = evaluate_policy_ground_truth(pol, baseline, scenarios, games_per_matchup=games)
        out[name] = {"win_rate": round(res.win_rate, 4), "ci": [round(res.ci_low, 4), round(res.ci_high, 4)]}
    return out


def _init_policy(init: str, rng: random.Random) -> Policy:
    if init == "weak":
        p = Policy.default()
        p.weights.update({
            "risk_tolerance": 0.3, "budget_weight": 0.4, "positional_need_weight": 0.2,
            "team_fit_weight": 0.2, "scarcity_weight": 0.2, "urgency_weight": 0.5,
        })
        return p
    if init == "random":
        p = Policy.default()
        for k in list(p.weights.keys()):
            if k in ("age_weight", "potential_weight"):
                continue
            p.weights[k] = round(rng.uniform(0.3, 1.8), 3)
        return p
    return Policy.default()


def main() -> None:
    ap = argparse.ArgumentParser(description="Hierarchical ground-truth trainer (proxy filter → real games).")
    ap.add_argument("--generations", type=int, default=20)
    ap.add_argument("--population", type=int, default=24)
    ap.add_argument("--proxy-scenarios", type=int, default=60)
    ap.add_argument("--gt-scenarios", type=int, default=10)
    ap.add_argument("--games", type=int, default=120)
    ap.add_argument("--survivor-fraction", type=float, default=0.2)
    ap.add_argument("--gt-every", type=int, default=4)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--workers", type=int, default=None)
    ap.add_argument("--patience", type=int, default=10)
    ap.add_argument("--init", choices=["default", "weak", "random"], default="default")
    args = ap.parse_args()

    train_ground_truth(
        generations=args.generations, population=args.population,
        proxy_scenarios=args.proxy_scenarios, gt_scenarios=args.gt_scenarios,
        games_per_matchup=args.games, survivor_fraction=args.survivor_fraction,
        gt_every=args.gt_every, seed=args.seed, workers=args.workers,
        patience=args.patience, init=args.init,
    )


if __name__ == "__main__":
    main()
