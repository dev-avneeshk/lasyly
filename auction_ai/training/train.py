"""Generation-based training loop (spec §8, §12, §17, §18, §22, §23).

Runs SIMULATE → EVALUATE → LEARN → VALIDATE → KEEP-BEST → repeat. Uses
multiprocessing to evaluate the candidate population in parallel across CPU
cores. Saves checkpoints and the best policy; supports resume and early
stopping when validation plateaus.

CLI:
    python -m auction_ai.training.train --simulations 2000 --generations 50
    python -m auction_ai.training.train --simulations 10000 --generations 200 --seed 7
    python -m auction_ai.training.train --resume    # continue from latest checkpoint
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

from ..ai.learner import (
    LearnerConfig,
    evaluate_policy_on_scenarios,
    exploration_for,
    mutate,
    mutate_pair,
)
from ..ai.policy import DEFAULT_WEIGHTS, Policy
from .evaluation import benchmark_policy
from .scenarios import Scenario, generate_scenarios

_ROOT = os.path.dirname(os.path.dirname(__file__))
MODELS_DIR = os.path.join(_ROOT, "models")
CHECKPOINT_DIR = os.path.join(MODELS_DIR, "checkpoints")
BEST_PATH = os.path.join(MODELS_DIR, "best_policy.json")
STATE_PATH = os.path.join(CHECKPOINT_DIR, "train_state.json")


# ─── Multiprocessing worker ─────────────────────────────────────────────────
# The candidate + opponent + scenarios are passed as a tuple; the worker returns
# (candidate_dict, fitness). Scenarios are lightweight dataclasses (picklable).
def _eval_candidate(args: Tuple[dict, dict, List[Scenario]]) -> Tuple[dict, float]:
    cand_dict, opp_dict, scenarios = args
    candidate = Policy.from_dict(cand_dict)
    opponent = Policy.from_dict(opp_dict)
    fitness = evaluate_policy_on_scenarios(candidate, opponent, scenarios)
    return cand_dict, fitness


def _ensure_dirs() -> None:
    os.makedirs(CHECKPOINT_DIR, exist_ok=True)


def _save_json(path: str, obj: dict) -> None:
    _ensure_dirs()
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, indent=2)


def _load_json(path: str) -> Optional[dict]:
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def _checkpoint_path(gen: int) -> str:
    return os.path.join(CHECKPOINT_DIR, f"checkpoint_generation_{gen:03d}.json")


def _initial_policy(init: str, rng: random.Random) -> Policy:
    """Starting policy for training.

    - "default": the shipped hand-tuned weights (all 1.0). Little headroom.
    - "weak":    a deliberately mis-tuned policy (hoards budget, ignores need &
                 fit). Used to DEMONSTRATE that the learning loop genuinely
                 recovers/optimizes rather than sitting at a fixed point (§29).
    - "random":  random weights in-bounds — the hardest starting point.
    """
    if init == "default":
        return Policy.default()
    if init == "weak":
        p = Policy.default()
        p.weights.update(
            {
                "risk_tolerance": 0.25,
                "budget_weight": 0.4,
                "positional_need_weight": 0.2,
                "team_fit_weight": 0.2,
                "scarcity_weight": 0.2,
                "urgency_weight": 0.2,
            }
        )
        return p
    if init == "random":
        p = Policy.default()
        for k in list(p.weights.keys()):
            if k in ("age_weight", "potential_weight"):
                continue
            p.weights[k] = round(rng.uniform(0.2, 1.8), 3)
        return p
    return Policy.default()


def train(
    simulations: int,
    generations: int,
    *,
    seed: int = 42,
    population: int = 12,
    patience: int = 12,
    workers: Optional[int] = None,
    resume: bool = False,
    val_simulations: Optional[int] = None,
    init: str = "default",
) -> Policy:
    _ensure_dirs()
    rng = random.Random(seed)
    lcfg = LearnerConfig(population=population, generations=generations)
    workers = workers or max(1, cpu_count())

    # Validation set is fixed across the whole run (never trained on) so the
    # plateau/early-stop signal is comparable generation to generation.
    val_count = val_simulations or max(200, simulations // 5)
    val_scenarios = generate_scenarios(val_count, master_seed=seed + 1, partition="validation")

    start_gen = 0
    best = _initial_policy(init, rng)
    best_val = float("-inf")
    since_improve = 0
    history: List[dict] = []

    if resume:
        st = _load_json(STATE_PATH)
        if st:
            best = Policy.from_dict(st["best"])
            best_val = st["best_val"]
            start_gen = st["generation"] + 1
            since_improve = st.get("since_improve", 0)
            history = st.get("history", [])
            print(f"Resuming from generation {start_gen} (best_val={best_val:.4f})")

    parent = best.clone()

    # Create the worker Pool ONCE and reuse it across all generations. On macOS
    # (spawn start method, esp. Python 3.14) creating a fresh Pool per generation
    # re-imports the whole package in every worker every time — that spawn cost
    # dominated wall-time. A persistent pool pays it once.
    pool = None
    if workers > 1:
        pool = Pool(processes=workers)

    try:
        _run_generations(
            start_gen, generations, lcfg, seed, simulations, rng, parent, best,
            best_val, since_improve, history, val_scenarios, patience, pool,
        )
    finally:
        if pool is not None:
            pool.close()
            pool.join()

    # _run_generations mutates via the returned best; re-read the saved best.
    saved = _load_json(BEST_PATH)
    final = Policy.from_dict(saved) if saved else best
    print(f"\nTraining done. Best policy v{final.version} saved to {BEST_PATH}")
    return final


def _run_generations(
    start_gen, generations, lcfg, seed, simulations, rng, parent, best,
    best_val, since_improve, history, val_scenarios, patience, pool,
):
    for gen in range(start_gen, generations):
        t0 = time.time()
        sigma = exploration_for(gen, lcfg)

        # Fresh TRAIN scenarios each generation (drawn from the train partition)
        # so candidates don't overfit a single fixed batch.
        train_scenarios = generate_scenarios(
            simulations, master_seed=seed + 1000 + gen, partition="train"
        )

        # Build the population: the parent (elitism) + mutated children, using
        # ANTITHETIC pairs (parent ± ε) which halves the variance of the ES
        # search and gives a cleaner climb signal.
        population_policies: List[Policy] = [parent.clone()]
        while len(population_policies) < lcfg.population:
            pos, neg = mutate_pair(parent, sigma, rng)
            population_policies.append(pos)
            if len(population_policies) < lcfg.population:
                population_policies.append(neg)

        # OPPONENT = the fixed shipped baseline (default weights). Fitness then
        # directly measures "how much better than the original CPU", which is
        # exactly the old-vs-new improvement the system must demonstrate (§11),
        # and avoids the ~0.5 co-evolution equilibrium that gives no gradient.
        opp_dict = Policy.default().to_dict()
        jobs = [(p.to_dict(), opp_dict, train_scenarios) for p in population_policies]

        if pool is not None and len(jobs) > 1:
            results = pool.map(_eval_candidate, jobs)
        else:
            results = [_eval_candidate(j) for j in jobs]

        # Pick the fittest candidate on TRAIN reward.
        results.sort(key=lambda r: r[1], reverse=True)
        best_cand_dict, best_train_fit = results[0]
        candidate = Policy.from_dict(best_cand_dict)

        # VALIDATE the winner on the held-out set against the SAME fixed baseline
        # opponent, so the validation score is comparable across generations and
        # measures true improvement over the shipped CPU (spec §15/§17).
        val_metrics = benchmark_policy(candidate, val_scenarios, opponent=Policy.default())
        val_score = val_metrics.reward

        improved = val_score > best_val
        if improved:
            best = candidate.clone()
            best_val = val_score
            since_improve = 0
        else:
            since_improve += 1

        # The parent for next gen is always the best-so-far (keeps the search
        # anchored to the strongest validated policy).
        parent = best.clone()

        dt = time.time() - t0
        row = {
            "generation": gen,
            "seed": seed,
            "simulations": simulations,
            "exploration": round(sigma, 4),
            "train_reward": round(best_train_fit, 4),
            "val": val_metrics.as_dict(),
            "best_val": round(best_val, 4),
            "improved": improved,
            "seconds": round(dt, 2),
            "policy_version": best.version,
        }
        history.append(row)
        print(
            f"gen {gen:3d} | σ={sigma:.3f} | train={best_train_fit:8.3f} | "
            f"val={val_score:8.3f} | best={best_val:8.3f} | "
            f"roster={val_metrics.roster_score:.1f} eff={val_metrics.value_efficiency:.2f} "
            f"overpay={val_metrics.avg_overpay:.3f} win={val_metrics.win_rate:.3f} | "
            f"{'*' if improved else ' '} {dt:.1f}s"
        )

        # Persist checkpoint + best + resumable state.
        _save_json(_checkpoint_path(gen), {"policy": best.to_dict(), "metrics": row})
        _save_json(BEST_PATH, best.to_dict())
        _save_json(
            STATE_PATH,
            {
                "best": best.to_dict(),
                "best_val": best_val,
                "generation": gen,
                "since_improve": since_improve,
                "history": history,
                "config": {
                    "seed": seed,
                    "simulations": simulations,
                    "generations": generations,
                    "population": lcfg.population,
                    "patience": patience,
                },
            },
        )

        if since_improve >= patience:
            print(f"Early stopping: no validation improvement for {patience} generations.")
            break

    print(f"Best validation reward: {best_val:.4f}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Train the NBA auction CPU policy (offline).")
    ap.add_argument("--simulations", type=int, default=2000, help="train scenarios per generation")
    ap.add_argument("--generations", type=int, default=50)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--population", type=int, default=12)
    ap.add_argument("--patience", type=int, default=12, help="early-stop patience (generations)")
    ap.add_argument("--workers", type=int, default=None, help="parallel workers (default: all cores)")
    ap.add_argument("--val-simulations", type=int, default=None)
    ap.add_argument("--resume", action="store_true")
    ap.add_argument(
        "--init",
        choices=["default", "weak", "random"],
        default="default",
        help="starting policy: default (shipped), weak (mis-tuned), or random",
    )
    args = ap.parse_args()

    train(
        simulations=args.simulations,
        generations=args.generations,
        seed=args.seed,
        population=args.population,
        patience=args.patience,
        workers=args.workers,
        resume=args.resume,
        val_simulations=args.val_simulations,
        init=args.init,
    )


if __name__ == "__main__":
    main()
