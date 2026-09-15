"""Champion/challenger driver (spec §16–19, §23, §25, §26).

Starts from the anchored CHAMPION (production v6), explores its LOCAL
neighborhood with tiered mutation, filters candidates by the cheap proxy, then
subjects survivors to a PAIRED, common-random-number, progressive real-game
ladder against the champion across all opponent archetypes.

A challenger is PROMOTED to champion only when it clears a configurable
promotion rule:

  * delta (challenger_wr − champion_wr) confidence-interval LOWER bound > 0
  * delta ≥ min_margin
  * does not lose badly to ANY single archetype (robustness)
  * passes the behavior guardrail and all A–E scenario tests
  * action distribution not collapsed
  * zero hard-rule violations
  * simulator parity still valid (checked once up front)

Training never overwrites the production policy directly. Promotion updates the
anchored champion (with automatic last-known-good backup); shipping to Vercel is
a separate, explicit export step.

CLI:
    python -m auction_ai.training.challenger \
        --candidates 60 --proxy-keep 0.25 --ladder 200 1000 5000 \
        --min-margin 0.01 --seed 42
"""
from __future__ import annotations

import argparse
import json
import os
import random
import time
from dataclasses import asdict, dataclass, field
from multiprocessing import Pool, cpu_count
from typing import Dict, List, Optional, Tuple

from ..ai.learner import MutationMix, mutate_around
from ..ai.policy import Policy
from ..game import SIMULATION_VERSION
from ..validation.behavioral import (
    action_distribution,
    evaluate_behavior,
    passes_guardrail,
    scenario_tests,
)
from .champion import (
    CHAMPION_DIR,
    ChampionRecord,
    ModelId,
    load_champion,
    player_data_version,
    save_champion,
)
from .evaluation import benchmark_policy
from .opponents import archetype_opponents
from .progressive import progressive_compare
from .scenarios import Scenario, generate_scenarios

LEADERBOARD_PATH = os.path.join(CHAMPION_DIR, "leaderboard.json")
REPORT_PATH = os.path.join(CHAMPION_DIR, "experiment_report.json")


@dataclass
class PromotionRule:
    """All thresholds configurable (spec §9)."""

    min_margin: float = 0.01            # required delta (challenger − champion)
    require_positive_ci: bool = True    # delta CI lower bound must be > 0
    max_archetype_regression: float = 0.03  # may not lose to any archetype by more than this
    behavior_guardrail: bool = True
    require_scenarios_pass: bool = True  # all A–E must pass
    forbid_collapse: bool = True
    max_hard_rule_violations: int = 0


@dataclass
class LeaderboardRow:
    policy_id: str
    parent: str
    generation: int
    challenger_wr: float
    champion_wr: float
    delta: float
    delta_ci: Tuple[float, float]
    games: int
    proxy: float
    behavior: float
    scenarios_passed: int
    collapsed: bool
    hard_rule_violations: int
    worst_archetype_delta: float
    status: str  # CHAMPION | CHAMPION_CANDIDATE | PROMISING | INSUFFICIENT | REJECTED


# ─── Parallel proxy scoring ─────────────────────────────────────────────────
def _proxy_worker(args: Tuple[dict, List[Scenario], dict]) -> Tuple[dict, float]:
    cand_dict, scenarios, champ_dict = args
    cand = Policy.from_dict(cand_dict)
    champ = Policy.from_dict(champ_dict)
    return cand_dict, benchmark_policy(cand, scenarios, opponent=champ).reward


# ─── Parallel ground-truth survivor evaluation ──────────────────────────────
# Each survivor's full progressive comparison + behavior/scenario/collapse/
# violation checks is independent, so we farm one survivor per worker. This is
# the expensive stage; parallelism is what makes the experiment tractable.
def _survivor_worker(args) -> dict:
    (cand_dict, champ_dict, gt_scn, ladder, min_margin, seed, idx) = args
    cand = Policy.from_dict(cand_dict)
    champion = Policy.from_dict(champ_dict)
    opponents = archetype_opponents(champion)
    verdict = progressive_compare(
        cand, champion, gt_scn, opponents, ladder=ladder, min_margin=min_margin, seed_salt=seed,
    )
    res = verdict.result
    behavior = evaluate_behavior(cand)
    scn_checks = scenario_tests(cand)
    amix = action_distribution(cand)
    violations = _hard_rule_violations_for(cand, champion, gt_scn)
    worst_arch = min(res.by_archetype.values()) if res.by_archetype else 0.0
    return {
        "idx": idx,
        "challenger_wr": res.challenger_wr,
        "champion_wr": res.champion_wr,
        "delta": res.delta,
        "delta_ci": list(res.delta_ci),
        "games": res.games,
        "behavior": behavior.total,
        "behavior_ok": passes_guardrail(behavior),
        "scenarios_passed": scn_checks.passed,
        "scenarios_total": scn_checks.total,
        "collapsed": amix.collapsed,
        "violations": violations,
        "worst_arch": worst_arch,
        "by_archetype": {k: round(v, 4) for k, v in res.by_archetype.items()},
        "stages": verdict.stages,
        "survived_ladder": verdict.survived,
    }


def _hard_rule_violations_for(policy: Policy, champion: Policy, scenarios: List[Scenario]) -> int:
    """Build rosters for the policy across scenarios; count any hard-rule breach
    (incomplete roster / overspend / duplicate)."""
    from ..simulation.roster import is_roster_complete, ordered_roster
    from .ground_truth import build_rosters

    v = 0
    for scn in scenarios:
        r, _ = build_rosters(scn, policy, champion, hero_seat="P1")
        owned = ordered_roster(r)
        if not is_roster_complete(r):
            v += 1
        if sum(o.price for o in owned) > scn.budget:
            v += 1
        ids = [o.player.id for o in owned]
        if len(ids) != len(set(ids)):
            v += 1
    return v


def _classify(row_delta: float, ci: Tuple[float, float], rule: PromotionRule,
              behavior_ok: bool, scenarios_ok: bool, collapsed: bool,
              violations: int, worst_arch: float) -> str:
    passes_all = (
        (not rule.require_positive_ci or ci[0] > 0)
        and row_delta >= rule.min_margin
        and worst_arch >= -rule.max_archetype_regression
        and (behavior_ok or not rule.behavior_guardrail)
        and (scenarios_ok or not rule.require_scenarios_pass)
        and (not collapsed or not rule.forbid_collapse)
        and violations <= rule.max_hard_rule_violations
    )
    if passes_all:
        return "CHAMPION_CANDIDATE"
    if ci[1] <= 0:
        return "REJECTED"          # confidently not better
    if row_delta >= rule.min_margin and ci[0] <= 0:
        return "INSUFFICIENT"      # looks better but not statistically confirmed
    if ci[1] > rule.min_margin:
        return "PROMISING"         # could still clear with more games
    return "INSUFFICIENT"


def run_experiment(
    *,
    candidates: int = 60,
    proxy_scenarios: int = 40,
    gt_scenarios: int = 12,
    proxy_keep: float = 0.25,
    ladder: Optional[List[int]] = None,
    min_margin: float = 0.01,
    seed: int = 42,
    workers: Optional[int] = None,
    mutation: Optional[MutationMix] = None,
    promote: bool = False,
    budgets: Optional[List[int]] = None,
    strategy_only: bool = False,
) -> dict:
    """Run one controlled champion/challenger experiment and return a report.

    `promote=False` (default) NEVER changes the champion — it only reports. Set
    promote=True to allow a verified CHAMPION_CANDIDATE to become the champion.
    """
    ladder = ladder or [200, 1000, 5000]
    mutation = mutation or MutationMix()
    rule = PromotionRule(min_margin=min_margin)
    rng = random.Random(seed)
    workers = workers or max(1, cpu_count())

    # Parity must be valid before we trust ground truth at all (spec §20).
    from ..validation.parity import run_parity
    parity = run_parity()
    if not parity.passed:
        return {"error": "PARITY FAILED — Python sim is out of sync with TS; training aborted.",
                "parity": {"win_rate_mae": parity.win_rate_mae, "score_mae": parity.score_mae}}

    champ_rec = load_champion(seed=seed)
    champion = champ_rec.policy

    # Held-out VALIDATION scenarios (never the TEST partition) for both stages.
    proxy_scn = generate_scenarios(proxy_scenarios, master_seed=seed + 1, partition="validation", budgets=budgets)
    gt_scn = generate_scenarios(gt_scenarios, master_seed=seed + 2, partition="validation", budgets=budgets)
    opponents = archetype_opponents(champion)

    # ── Generate the neighborhood population around the champion ──
    population: List[Policy] = []
    for i in range(candidates):
        c = mutate_around(champion, mutation, rng, strategy_only=strategy_only)
        c.version = champion.version  # provenance: child of champion
        population.append(c)

    # ── Stage 1: proxy filter (parallel) ──
    print(f"Stage 1: proxy-scoring {len(population)} candidates around champion v{champion.version}...")
    pool = Pool(processes=workers) if workers > 1 else None
    try:
        if pool is not None:
            jobs = [(c.to_dict(), proxy_scn, champion.to_dict()) for c in population]
            scored = pool.map(_proxy_worker, jobs)
            scored_policies = [(Policy.from_dict(cd), sc) for cd, sc in scored]
        else:
            scored_policies = [(c, benchmark_policy(c, proxy_scn, opponent=champion).reward) for c in population]
    finally:
        if pool is not None:
            pool.close()
            pool.join()

    scored_policies.sort(key=lambda t: t[1], reverse=True)
    n_keep = max(3, round(len(scored_policies) * proxy_keep))
    survivors = scored_policies[:n_keep]
    print(f"  kept top {len(survivors)} by proxy for real-game evaluation.")

    # ── Stage 2: progressive paired CRN real-game ladder vs champion (parallel) ──
    print(f"Stage 2: real-game ladder {ladder} vs champion across {len(opponents)} archetypes...")
    rows: List[LeaderboardRow] = []
    best_candidate: Optional[LeaderboardRow] = None
    best_policy: Optional[Policy] = None
    proxy_by_idx = {i: sc for i, (_, sc) in enumerate(survivors)}
    cand_by_idx = {i: cand for i, (cand, _) in enumerate(survivors)}

    jobs = [
        (cand.to_dict(), champion.to_dict(), gt_scn, ladder, min_margin, seed, i)
        for i, (cand, _sc) in enumerate(survivors)
    ]
    pool2 = Pool(processes=workers) if workers > 1 and len(jobs) > 1 else None
    results: List[dict] = []
    try:
        if pool2 is not None:
            # imap_unordered streams results as each survivor finishes, so we get
            # incremental visibility instead of waiting for the whole batch.
            for r in pool2.imap_unordered(_survivor_worker, jobs):
                results.append(r)
                print(f"  [survivor {r['idx']} done] Δ={r['delta']:+.4f} "
                      f"CI[{r['delta_ci'][0]:+.4f},{r['delta_ci'][1]:+.4f}] games={r['games']}", flush=True)
        else:
            for j in jobs:
                r = _survivor_worker(j)
                results.append(r)
    finally:
        if pool2 is not None:
            pool2.close()
            pool2.join()

    for r in sorted(results, key=lambda x: x["idx"]):
        idx = r["idx"]
        scenarios_ok = r["scenarios_passed"] == r["scenarios_total"]
        ci = (r["delta_ci"][0], r["delta_ci"][1])
        status = _classify(r["delta"], ci, rule, r["behavior_ok"], scenarios_ok,
                           r["collapsed"], r["violations"], r["worst_arch"])
        row = LeaderboardRow(
            policy_id=f"cand-{seed}-{idx}",
            parent=f"v{champion.version}",
            generation=0,
            challenger_wr=round(r["challenger_wr"], 4),
            champion_wr=round(r["champion_wr"], 4),
            delta=round(r["delta"], 5),
            delta_ci=(round(ci[0], 5), round(ci[1], 5)),
            games=r["games"],
            proxy=round(proxy_by_idx[idx], 3),
            behavior=round(r["behavior"], 3),
            scenarios_passed=r["scenarios_passed"],
            collapsed=r["collapsed"],
            hard_rule_violations=r["violations"],
            worst_archetype_delta=round(r["worst_arch"], 4),
            status=status,
        )
        rows.append(row)
        print(f"  {row.policy_id}: Δ={row.delta:+.4f} CI[{row.delta_ci[0]:+.4f},{row.delta_ci[1]:+.4f}] "
              f"games={row.games} beh={row.behavior:.2f} scn={row.scenarios_passed}/5 "
              f"viol={row.hard_rule_violations} worstArch={row.worst_archetype_delta:+.3f} → {row.status}")
        if status == "CHAMPION_CANDIDATE":
            if best_candidate is None or row.delta_ci[0] > best_candidate.delta_ci[0]:
                best_candidate = row
                best_policy = cand_by_idx[idx]

    rows.sort(key=lambda r: r.delta_ci[0], reverse=True)

    # ── Promotion decision ──
    promoted = False
    if best_candidate is not None and best_policy is not None and promote:
        new_version = champion.version + 1
        best_policy.version = new_version
        new_rec = ChampionRecord(
            policy=best_policy,
            model_id=ModelId(
                policy_version=f"v{new_version}",
                parent_policy=f"v{champion.version}",
                simulation_version=SIMULATION_VERSION,
                player_data_version=player_data_version(),
                training_seed=seed,
            ),
            reference_win_rate=best_candidate.challenger_wr,
            promoted_from=f"v{champion.version}",
        )
        save_champion(new_rec)
        promoted = True

    report = {
        "simulation_version": SIMULATION_VERSION,
        "player_data_version": player_data_version(),
        "champion": f"v{champion.version}",
        "seed": seed,
        "candidates": candidates,
        "survivors_evaluated": len(survivors),
        "ladder": ladder,
        "min_margin": min_margin,
        "promotion_rule": asdict(rule),
        "best_candidate": asdict(best_candidate) if best_candidate else None,
        "beat_champion": best_candidate is not None,
        "promoted": promoted,
        "leaderboard": [asdict(r) for r in rows],
    }

    os.makedirs(CHAMPION_DIR, exist_ok=True)
    with open(LEADERBOARD_PATH, "w", encoding="utf-8") as fh:
        json.dump({"champion": f"v{champion.version}", "rows": [asdict(r) for r in rows]}, fh, indent=2)
    with open(REPORT_PATH, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)
    return report


def main() -> None:
    ap = argparse.ArgumentParser(description="Champion/challenger search around the production champion.")
    ap.add_argument("--candidates", type=int, default=60)
    ap.add_argument("--proxy-scenarios", type=int, default=40)
    ap.add_argument("--gt-scenarios", type=int, default=12)
    ap.add_argument("--proxy-keep", type=float, default=0.25)
    ap.add_argument("--ladder", type=int, nargs="+", default=[200, 1000, 5000])
    ap.add_argument("--min-margin", type=float, default=0.01)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--workers", type=int, default=None)
    ap.add_argument("--small-frac", type=float, default=0.80)
    ap.add_argument("--medium-frac", type=float, default=0.15)
    ap.add_argument("--promote", action="store_true", help="allow promotion of a verified candidate")
    ap.add_argument("--budgets", type=int, nargs="+", default=None,
                    help="restrict league budgets (e.g. 25 50) to keep the experiment tractable")
    ap.add_argument("--strategy-only", action="store_true",
                    help="freeze valuation weights; explore only the strategy/timing head (strategy-first)")
    args = ap.parse_args()

    mix = MutationMix(small_frac=args.small_frac, medium_frac=args.medium_frac)
    report = run_experiment(
        candidates=args.candidates, proxy_scenarios=args.proxy_scenarios,
        gt_scenarios=args.gt_scenarios, proxy_keep=args.proxy_keep, ladder=args.ladder,
        min_margin=args.min_margin, seed=args.seed, workers=args.workers,
        mutation=mix, promote=args.promote, budgets=args.budgets,
        strategy_only=args.strategy_only,
    )

    print("\n" + "=" * 66)
    if report.get("error"):
        print("EXPERIMENT ABORTED:", report["error"])
        return
    print(f"CHAMPION/CHALLENGER EXPERIMENT — champion {report['champion']} "
          f"(sim {report['simulation_version']})")
    bc = report["best_candidate"]
    if bc:
        print(f"  BEST CANDIDATE {bc['policy_id']}: Δ={bc['delta']:+.4f} "
              f"CI[{bc['delta_ci'][0]:+.4f},{bc['delta_ci'][1]:+.4f}] over {bc['games']} games")
        print(f"  → A verified challenger BEAT the champion "
              f"({'PROMOTED' if report['promoted'] else 'not promoted (use --promote)'}).")
    else:
        print("  No candidate beat the champion under the promotion rule.")
        print("  The champion (production v6) SURVIVES.")
    print("=" * 66)


if __name__ == "__main__":
    main()
