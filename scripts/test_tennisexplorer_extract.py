"""
Live smoke test for the tennisexplorer extractor.

Fetches a few real match-detail pages and asserts the extracted fields look sane.
Run: python scripts/_test_te_extract.py
Exits non-zero if any check fails.
"""
import sys
import json
from scrapling.fetchers import Fetcher
from tennisexplorer_extract import extract_match

BASE = "https://www.tennisexplorer.com/match-detail/?id="

# (id, expected status, list of (field, expected substring/None-check))
CASES = [
    # Upcoming QF — Jodar vs Zverev (the URL the user provided)
    (
        "3220489",
        "upcoming",
        [("tournament", "French Open"), ("round", "QF"), ("surface", "Clay")],
    ),
    # Completed 5-setter — Jodar d. Carreno-Busta 3:2
    (
        "3218631",
        "completed",
        [("round", "R16"), ("winner_name", "Jodar"), ("score", "6-2")],
    ),
    # Completed with tiebreak — Darderi d. Jodar
    (
        "3201992",
        "completed",
        [("round", "QF"), ("winner_name", "Darderi"), ("score", "7-6(5)")],
    ),
]


def main() -> int:
    failures = 0
    for match_id, exp_status, field_checks in CASES:
        url = BASE + match_id
        page = Fetcher.get(url, stealthy_headers=True, timeout=30)
        if page.status != 200:
            print(f"FAIL [{match_id}] HTTP {page.status}")
            failures += 1
            continue

        data = extract_match(page, url)
        m = data["match"]
        problems = []

        if m["status"] != exp_status:
            problems.append(f"status={m['status']} (want {exp_status})")
        for field, expect in field_checks:
            val = m.get(field) or ""
            if expect not in str(val):
                problems.append(f"{field}={val!r} (want contains {expect!r})")

        # Sanity: both players present and H2H lists populated.
        if not m.get("player1_name") or not m.get("player2_name"):
            problems.append("missing player name(s)")
        if not data["h2h"]["player1"]:
            problems.append("empty H2H for player1")

        # Enrichment sanity: bios, year-by-year W/L and (for upcoming) odds.
        if not data["bios"]["player1"].get("rank_singles"):
            problems.append("missing player1 singles rank")
        yby = data["year_by_year"]["player1"]
        if not yby or "all" not in yby:
            problems.append("missing player1 year-by-year career summary")
        else:
            career = yby["all"].get("Total")
            if not career or career.get("played", 0) <= 0:
                problems.append("player1 career total not parsed")
        if exp_status == "upcoming" and not data.get("odds"):
            problems.append("missing match-winner odds for upcoming match")

        if problems:
            failures += 1
            print(f"FAIL [{match_id}] {m.get('player1_name')} vs {m.get('player2_name')}")
            for p in problems:
                print(f"      - {p}")
        else:
            print(
                f"PASS [{match_id}] {m['status']:<9} {m['tournament']} {m['round']} "
                f"| {m['player1_name']} vs {m['player2_name']}"
                + (f" | {m['winner_name']} won {m['score']}" if m["status"] == "completed" else "")
            )

    print()
    if failures:
        print(f"{failures} case(s) failed.")
        return 1
    print("All extractor checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
