"""
Shared Hypothesis strategies and pytest fixtures for football scraper tests.
"""

import sys
from pathlib import Path

# Add the scripts directory to sys.path so we can import scrape_football
scripts_dir = Path(__file__).resolve().parent.parent
if str(scripts_dir) not in sys.path:
    sys.path.insert(0, str(scripts_dir))

import hypothesis.strategies as st

from scrape_football import (
    ScraperConfig,
    MatchRecord,
    PlayerStatRecord,
    StandingsRecord,
    PlayerRecord,
    LEAGUES,
    VALID_LEAGUES,
    validate_match_record,
    validate_date_range,
    validate_leagues,
    merge_match_records,
    merge_player_records,
    calculate_daily_window,
    determine_status,
    generate_fallback_match_url,
    parse_stat_value,
    parse_minutes,
    extract_player_fbref_id,
    calculate_retry_wait,
    build_fixtures_url,
    build_standings_url,
)


# ============================================================
# Hypothesis Strategies
# ============================================================


# Strategy: match dates in YYYY-MM-DD format (range: 2024-08-01 to 2025-06-30)
match_dates = st.dates(
    min_value=__import__("datetime").date(2024, 8, 1),
    max_value=__import__("datetime").date(2025, 6, 30),
).map(lambda d: d.isoformat())


# Strategy: realistic team name strings (3-50 chars, letters and spaces)
team_names = st.text(
    alphabet=st.sampled_from(
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ "
    ),
    min_size=3,
    max_size=50,
).filter(lambda s: s.strip() and not s.isspace())


# Strategy: stat cell values — one_of: empty string, "-", non-numeric text,
# valid integers (0-99), valid floats (0.00-9.99)
stat_cells = st.one_of(
    st.just(""),
    st.just("-"),
    st.text(
        alphabet=st.sampled_from("abcdefghijklmnopqrstuvwxyz"),
        min_size=1,
        max_size=10,
    ),
    st.integers(min_value=0, max_value=99).map(str),
    st.floats(min_value=0.0, max_value=9.99, allow_nan=False, allow_infinity=False).map(
        lambda f: f"{f:.2f}"
    ),
)


# Strategy: minutes strings — one_of: empty, "0", valid integers (1-120),
# added-time format like "45+2"
minutes_strings = st.one_of(
    st.just(""),
    st.just("0"),
    st.integers(min_value=1, max_value=120).map(str),
    st.tuples(
        st.sampled_from([45, 90]),
        st.integers(min_value=1, max_value=15),
    ).map(lambda t: f"{t[0]}+{t[1]}"),
)


# Strategy: player hrefs — one_of: valid /en/players/{id}/Name pattern,
# invalid patterns, empty
player_hrefs = st.one_of(
    # Valid pattern: /en/players/{hex_id}/Player-Name
    st.tuples(
        st.text(
            alphabet=st.sampled_from("0123456789abcdef"),
            min_size=8,
            max_size=8,
        ),
        st.text(
            alphabet=st.sampled_from("abcdefghijklmnopqrstuvwxyz-"),
            min_size=3,
            max_size=20,
        ),
    ).map(lambda t: f"/en/players/{t[0]}/{t[1]}"),
    # Invalid patterns
    st.just(""),
    st.just("/en/players//"),
    st.just("/en/players/"),
    st.just("/some/other/path"),
    st.text(
        alphabet=st.sampled_from("abcdefghijklmnopqrstuvwxyz/"),
        min_size=1,
        max_size=30,
    ),
)


# Strategy: optional scores — one_of: None, integers 0-10
optional_scores = st.one_of(
    st.none(),
    st.integers(min_value=0, max_value=10),
)
