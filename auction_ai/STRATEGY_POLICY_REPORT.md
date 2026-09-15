# Hierarchical bidding strategy — did learning *how* to bid beat v6?

**Short answer: no — and the reason is structural, not a bug.** Adding a
learnable strategy/timing head (jump-bid, waiting, early-pass, opponent-response)
on top of v6's fixed valuation did not produce a challenger that beats v6 on real
games. In a 1v1, ascending, open-information auction, bid *timing* is largely
irrelevant to the outcome — what wins is *valuation* (who has the higher
walk-away price), which we deliberately held fixed.

---

## What was built (strategy-first, valuation frozen)

A hierarchical policy: valuation (`walk_away_price`, = v6, **frozen**) decides
*how much* the CPU will ultimately pay; a new **strategy head** decides *how* it
bids toward that ceiling. Four interpretable, deterministic params, all no-ops at
neutral (so v6 is reproduced exactly):

| strategy param | learns | neutral |
|----------------|--------|:-------:|
| `jump_bid_frac` | jump above the min raise toward the ceiling (shake out rivals) | 0 |
| `hold_threshold` | wait on a cheap opening claim instead of revealing interest | 0 |
| `early_pass_margin` | concede marginal lots sooner to conserve budget | 0 |
| `response_aggression` | dig in / concede based on the opponent's escalation on this lot | 0 |

Implemented in Python (`ai/policy.py` `decide()`) and mirrored bit-for-bit in
TypeScript (`ai.ts` `decideAI` + `policy.ts`). The search was run with
`--strategy-only`: **valuation weights frozen, only the strategy head explored** —
exactly "search strategy first, valuation second."

### No-op verified

Neutral strategy reproduces v6 exactly: **0 / 240 decisions differ**, identical
final rosters. Each strategy dimension demonstrably changes behavior when active
(e.g. a contested lot where v6 min-raises $5→$6, a jump policy leaps to $7). The
production artifact stays minimal — the strategy block is only serialized when
non-neutral, so v6's `cpu-policy.json` is unchanged and has no `strategy` block.

## Results

**Strategy-first champion/challenger (seed 7, 24 candidates, paired CRN across
archetypes):** no candidate beat v6. Several candidates had **Δ = exactly
0.000** — the timing tweak changed individual bids but not *which* players were
won — and the rest were worse.

**Directed single-dimension probe** (each strategy knob alone, paired vs v6):

| strategy | Δ vs v6 | reading |
|----------|:-------:|---------|
| `jump_bid_frac +0.5` | **0.000** | reaches the same player, just faster — outcome-neutral |
| `jump_bid_frac +1.0` | **0.000** | same |
| `hold_threshold +0.4` | ≈ 0 (tie) | waiting rarely changes the final roster |
| `response_aggression +0.8` | **0.000** | reacting to escalation doesn't change who wins |
| `early_pass_margin +0.5` | **−0.20** | conceding lots early clearly loses players |
| `response_aggression −0.8` | **−0.08** | conceding under pressure loses players |

The pattern is unambiguous: **aggressive timing directions are outcome-neutral;
passive/conceding directions are strictly worse.** None beats v6.

## Why (the honest, structural reason)

This game is a **1v1, ascending-price, open-information** auction. Three facts
make bid *timing/strategy* nearly irrelevant to the outcome:

1. **No third party to bluff.** Jump-bidding and waiting are tools to manipulate
   *other* bidders. With exactly one opponent and no hidden information, there's
   no one to fool — the lot goes to whoever's walk-away is higher.
2. **Ascending open outcry converges to valuation.** In an English auction the
   winner and price are determined by the two valuations, not by who raised when.
   v6 already bids up to its walk-away, so *how* it gets there doesn't change the
   endpoint.
3. **The hard-rule fallbacks absorb timing.** A jump that overshoots falls back
   to the min legal raise; a wait that risks a needed slot is disallowed. The
   engine keeps outcomes valuation-determined.

Strategy/timing pays off in **multi-party auctions** (bluff one rival to deter
another), **sealed-bid** formats (you can't observe and react, so your single
number encodes strategy), or **incomplete-information** settings (hide your
valuation). This game is none of those.

## Verdict

> **v6 remains champion.** The strategy head is implemented, mirrored in
> production TS, proven to change bidding behavior, bounded against collapse, and
> fully available to the learner — but under strict paired, multi-archetype,
> real-game evaluation, learning *how* to bid did not beat v6, so nothing was
> promoted or shipped.

Combined with the earlier valuation-feature result, we now have two independent
confirmations that **v6 is at a strong local optimum for this specific auction
format**, and that the real lever for a smarter CPU is a **change to the game**
(more teams, hidden budgets, or sealed bids) rather than a richer policy over the
current format.

## Reproduce

```bash
python -m auction_ai.training.challenger \
    --candidates 24 --proxy-scenarios 16 --gt-scenarios 3 \
    --ladder 150 400 --min-margin 0.01 --seed 7 --budgets 25 --strategy-only
```
