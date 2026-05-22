"""
Tennis Tournament Discovery Script
Fetches tennisabstract.com/current/ to find active tournament pages.

Used by the scheduled scraper workflow to auto-detect which tournaments to scrape.

Usage:
  python discover_tournaments.py

Output:
  Prints one tournament URL per line (for piping into scrape_tennis.py)
"""

import re
import sys


def discover_tournaments() -> list[str]:
    """Fetch the tennisabstract.com homepage and extract active tournament links."""
    # The homepage has a table with id="current-events" listing active tournaments
    # Links look like: https://www.tennisabstract.com/current/2026ATPGeneva.html
    HOMEPAGE = "https://www.tennisabstract.com/"

    try:
        import subprocess
        result = subprocess.run(
            ["curl", "-sL", "-A",
             "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
             HOMEPAGE],
            capture_output=True, text=True, timeout=30
        )
        html = result.stdout
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return []

    if not html:
        print("ERROR: Empty response from tennisabstract.com", file=sys.stderr)
        return []

    # Find all tournament URLs in the /current/ directory
    # Pattern: https://www.tennisabstract.com/current/2026ATPGeneva.html
    # or relative: /current/2026ATPGeneva.html
    urls = re.findall(
        r'https://www\.tennisabstract\.com/current/(\d{4}(?:ATP|WTA)\w+\.html)',
        html
    )

    # Filter out forecast pages — we only want tournament result pages
    tournament_urls = []
    for filename in urls:
        if "Forecast" in filename:
            continue
        full_url = f"https://www.tennisabstract.com/current/{filename}"
        tournament_urls.append(full_url)

    # Deduplicate while preserving order
    seen = set()
    unique = []
    for url in tournament_urls:
        if url not in seen:
            seen.add(url)
            unique.append(url)

    return unique


if __name__ == "__main__":
    tournaments = discover_tournaments()
    if not tournaments:
        print("No active tournaments found.", file=sys.stderr)
        sys.exit(1)

    for url in tournaments:
        print(url)
